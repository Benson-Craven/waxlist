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
  listCollectionRecords,
  resolveCollectionOwner,
} from "@/lib/collection/server";
import {
  DiscogsApiError,
  getDiscogsMasterVersions,
  type DiscogsRateLimit,
  type StructuredDiscogsError,
} from "@/lib/discogs/client";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  buildSmartWantPreview,
  evaluateSmartWantCandidates,
} from "@/lib/wishlist/smart-want";
import { getSmartWant } from "@/lib/wishlist/smart-want-server";

export const runtime = "nodejs";

const MAX_VERSION_CANDIDATES = 75;

function emptyRateLimit(): DiscogsRateLimit {
  return {
    limit: null,
    used: null,
    remaining: null,
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

function createFallbackDiscogsError(error: unknown): StructuredDiscogsError {
  return {
    code: "discogs_provider_error",
    message:
      error instanceof Error
        ? error.message
        : "Discogs Smart Want candidates could not be loaded.",
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
          code: "smart_want_configuration_error",
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
          code: "smart_want_security_configuration_error",
          message: securityEnv.message,
          missing: securityEnv.missing,
        },
      },
      { status: 500 },
    );
  }

  return null;
}

function smartWantAuthRequired() {
  return NextResponse.json(
    {
      error: {
        code: "smart_want_auth_required",
        message: "Connect Spotify before loading Smart Want candidates.",
      },
    },
    { status: 401 },
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const configurationFailure = configurationError();

  if (configurationFailure) {
    return configurationFailure;
  }

  const owner = await resolveCollectionOwner(request);

  if (!owner) {
    return smartWantAuthRequired();
  }

  const ip = getClientIp(request);
  const securityEnv = getDiscogsMatchSecurityEnv();

  if (!securityEnv.ok) {
    return jsonWithCollectionOwnerCookies(
      owner,
      {
        error: {
          code: "smart_want_security_configuration_error",
          message: securityEnv.message,
          missing: securityEnv.missing,
        },
      },
      500,
    );
  }

  const requestRateLimit = checkRateLimit({
    key: `smart-want-candidates:${owner.userId}:${ip ? createStableHash(ip) : "unknown-ip"}`,
    limit: securityEnv.rateLimitMaxRequests,
    windowMs: securityEnv.rateLimitWindowMs,
  });

  if (!requestRateLimit.ok) {
    const response = jsonWithCollectionOwnerCookies(
      owner,
      {
        error: {
          code: "smart_want_candidates_rate_limited",
          message: "Too many Smart Want candidate requests. Please wait and retry.",
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

  const { id } = await context.params;
  const smartWant = await getSmartWant(owner, id);

  if (!smartWant) {
    return jsonWithCollectionOwnerCookies(
      owner,
      {
        error: {
          code: "smart_want_not_found",
          message: "Smart Want was not found.",
        },
      },
      404,
    );
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

  try {
    const [versionsPage, collectionRecords] = await Promise.all([
      getDiscogsMasterVersions({
        masterId: smartWant.masterReleaseId,
        page: 1,
        perPage: MAX_VERSION_CANDIDATES,
        token: env.token,
        userAgent: env.userAgent,
        cacheTtlMs: cacheEnv.ttlMs,
      }),
      listCollectionRecords(owner),
    ]);
    const ownedRecords = collectionRecords.filter(
      (record) => record.status === "owned",
    );
    const ownedReleaseIds = ownedRecords.map((record) => record.discogsReleaseId);
    const ownedMasterIds = ownedRecords
      .map((record) => record.discogsMasterId)
      .filter((masterId): masterId is number => typeof masterId === "number");
    const candidates = evaluateSmartWantCandidates(
      versionsPage.versions,
      smartWant,
      {
        ownedReleaseIds,
        ownedMasterIds,
      },
    );
    const preview = buildSmartWantPreview(candidates);
    const response = jsonWithCollectionOwnerCookies(owner, {
      candidateRun: {
        smartWantId: smartWant.id,
        masterReleaseId: smartWant.masterReleaseId,
        totalVersions: versionsPage.totalItems,
        returnedVersions: candidates.length,
        maxVersionCandidates: MAX_VERSION_CANDIDATES,
        detailFetchLimit: 0,
        truncated: versionsPage.totalItems > candidates.length,
        rateLimit: versionsPage.rateLimit,
        preview,
        candidates,
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
  } catch (error) {
    const structuredError =
      error instanceof DiscogsApiError
        ? error.toStructuredError()
        : createFallbackDiscogsError(error);

    return jsonWithCollectionOwnerCookies(
      owner,
      {
        error: structuredError,
      },
      structuredError.status || 502,
    );
  }
}
