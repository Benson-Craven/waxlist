import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import {
  getApiCacheEnv,
  getDatabaseEnv,
  getDiscogsEnv,
  getDiscogsMatchSecurityEnv,
} from "@/lib/config";
import {
  jsonWithCollectionOwnerCookies,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import {
  DiscogsApiError,
  searchDiscogsMarketplaceListings,
  type DiscogsRateLimit,
  type StructuredDiscogsError,
} from "@/lib/discogs/client";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { listWishlistRecords } from "@/lib/wishlist/server";
import {
  buildSellerScoutRun,
  selectSellerScoutWantedRecords,
  type SellerScoutListingInput,
  type SellerScoutReleaseFailure,
} from "@/lib/wishlist/seller-scout";

export const runtime = "nodejs";

const MAX_WANTS = 25;
const MAX_LISTINGS_PER_WANT = 5;

function emptyRateLimit(): DiscogsRateLimit {
  return {
    limit: null,
    used: null,
    remaining: null,
  };
}

function mergeRateLimit(
  current: DiscogsRateLimit,
  next: DiscogsRateLimit,
): DiscogsRateLimit {
  return {
    limit: next.limit ?? current.limit,
    used: next.used ?? current.used,
    remaining:
      current.remaining === null
        ? next.remaining
        : next.remaining === null
          ? current.remaining
          : Math.min(current.remaining, next.remaining),
  };
}

function createStableHash(value: string) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 16);
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    null
  );
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createFallbackDiscogsError(error: unknown): StructuredDiscogsError {
  return {
    code: "discogs_provider_error",
    message:
      error instanceof Error
        ? error.message
        : "Seller Scout listings could not be loaded.",
    status: 0,
    retryAfterSeconds: null,
    rateLimit: emptyRateLimit(),
    providerMessage: null,
  };
}

function configurationError() {
  const databaseEnv = getDatabaseEnv();

  if (!databaseEnv.ok) {
    return NextResponse.json(
      {
        error: {
          code: "seller_scout_configuration_error",
          message: databaseEnv.message,
          missing: databaseEnv.missing,
        },
      },
      { status: 500 },
    );
  }

  const discogsEnv = getDiscogsEnv();

  if (!discogsEnv.ok) {
    return NextResponse.json(
      {
        error: {
          code: "discogs_configuration_error",
          message: discogsEnv.message,
          missing: discogsEnv.missing,
        },
      },
      { status: 500 },
    );
  }

  const cacheEnv = getApiCacheEnv();

  if (!cacheEnv.ok) {
    return NextResponse.json(
      {
        error: {
          code: "cache_configuration_error",
          message: cacheEnv.message,
          missing: cacheEnv.missing,
        },
      },
      { status: 500 },
    );
  }

  const securityEnv = getDiscogsMatchSecurityEnv();

  if (!securityEnv.ok) {
    return NextResponse.json(
      {
        error: {
          code: "seller_scout_security_configuration_error",
          message: securityEnv.message,
          missing: securityEnv.missing,
        },
      },
      { status: 500 },
    );
  }

  return null;
}

function sellerScoutAuthRequired() {
  return NextResponse.json(
    {
      error: {
        code: "seller_scout_auth_required",
        message: "Connect Spotify before scanning seller bundle opportunities.",
      },
    },
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return sellerScoutAuthRequired();
  }

  const configurationFailure = configurationError();

  if (configurationFailure) {
    return configurationFailure;
  }

  const securityEnv = getDiscogsMatchSecurityEnv();

  if (!securityEnv.ok) {
    return jsonWithCollectionOwnerCookies(
      owner,
      {
        error: {
          code: "seller_scout_security_configuration_error",
          message: securityEnv.message,
          missing: securityEnv.missing,
        },
      },
      500,
    );
  }

  const ip = getClientIp(request);
  const requestRateLimit = checkRateLimit({
    key: `seller-scout:${owner.userId}:${ip ? createStableHash(ip) : "unknown-ip"}`,
    limit: securityEnv.rateLimitMaxRequests,
    windowMs: securityEnv.rateLimitWindowMs,
  });

  if (!requestRateLimit.ok) {
    const response = jsonWithCollectionOwnerCookies(
      owner,
      {
        error: {
          code: "seller_scout_rate_limited",
          message: "Too many Seller Scout requests. Please wait and retry.",
          retryAfterSeconds: requestRateLimit.retryAfterSeconds,
        },
      },
      429,
    );

    response.headers.set("Retry-After", String(requestRateLimit.retryAfterSeconds));
    response.headers.set("X-RateLimit-Limit", String(requestRateLimit.limit));
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil(requestRateLimit.resetAt / 1000)),
    );

    return response;
  }

  const env = getDiscogsEnv();
  const cacheEnv = getApiCacheEnv();

  if (!env.ok) {
    return jsonWithCollectionOwnerCookies(
      owner,
      {
        error: {
          code: "discogs_configuration_error",
          message: env.message,
          missing: env.missing,
        },
      },
      500,
    );
  }

  if (!cacheEnv.ok) {
    return jsonWithCollectionOwnerCookies(
      owner,
      {
        error: {
          code: "cache_configuration_error",
          message: cacheEnv.message,
          missing: cacheEnv.missing,
        },
      },
      500,
    );
  }

  const records = await listWishlistRecords(owner);
  const selectedRecords = selectSellerScoutWantedRecords(records, MAX_WANTS);
  const listingInputs: SellerScoutListingInput[] = [];
  const failures: SellerScoutReleaseFailure[] = [];
  let rateLimit = emptyRateLimit();
  let stoppedForRateLimit = false;

  for (const [index, record] of selectedRecords.entries()) {
    if (index > 0) {
      await wait(env.requestDelayMs);
    }

    try {
      const listingsPage = await searchDiscogsMarketplaceListings({
        releaseId: record.discogsReleaseId,
        token: env.token,
        userAgent: env.userAgent,
        perPage: MAX_LISTINGS_PER_WANT,
        cacheTtlMs: cacheEnv.ttlMs,
      });

      rateLimit = mergeRateLimit(rateLimit, listingsPage.rateLimit);
      listingInputs.push({
        releaseId: record.discogsReleaseId,
        wantedRecord: record,
        listings: listingsPage.listings,
        checkedAt: listingsPage.checkedAt,
        freshForSeconds: listingsPage.freshForSeconds,
      });
    } catch (error) {
      const structuredError =
        error instanceof DiscogsApiError
          ? error.toStructuredError()
          : createFallbackDiscogsError(error);

      rateLimit = mergeRateLimit(rateLimit, structuredError.rateLimit);
      failures.push({
        releaseId: record.discogsReleaseId,
        wantedRecordId: record.id,
        message: structuredError.message,
        retryAfterSeconds: structuredError.retryAfterSeconds,
      });

      if (structuredError.code === "discogs_rate_limited") {
        stoppedForRateLimit = true;
        break;
      }
    }
  }

  const scoutRun = buildSellerScoutRun({
    records,
    listingInputs,
    failures,
    checkedAt: new Date().toISOString(),
    maxWants: MAX_WANTS,
    maxListingsPerWant: MAX_LISTINGS_PER_WANT,
  });
  const response = jsonWithCollectionOwnerCookies(owner, {
    sellerScoutRun: {
      ...scoutRun,
      stoppedForRateLimit,
      requestDelayMs: env.requestDelayMs,
      rateLimit,
    },
  });

  response.headers.set("X-RateLimit-Limit", String(requestRateLimit.limit));
  response.headers.set(
    "X-RateLimit-Remaining",
    String(requestRateLimit.remaining),
  );
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(requestRateLimit.resetAt / 1000)),
  );

  return response;
}
