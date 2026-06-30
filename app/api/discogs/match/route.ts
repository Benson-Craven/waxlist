import {
  getApiCacheEnv,
  getDiscogsEnv,
  getDiscogsMatchSecurityEnv,
} from "@/lib/config";
import {
  DiscogsApiError,
  getDiscogsMarketplaceStats,
  searchDiscogsForUnit,
  type DiscogsMarketplaceStats,
  type DiscogsRateLimit,
  type StructuredDiscogsError,
} from "@/lib/discogs/client";
import { rankDiscogsSearchResult } from "@/lib/matching/match-discogs-release";
import { writeAuditLog } from "@/lib/security/audit-log";
import { readLimitedJsonRequest } from "@/lib/security/limited-json";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  copyCookieHeaders,
  getSpotifyAuthorizedRequest,
} from "@/lib/spotify/api";
import { getSpotifyCookieNames } from "@/lib/spotify/oauth";
import type { DiscogsSearchUnit } from "@/lib/matching/discogs-search-units";
import { createHash, randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MatchRequestBody = {
  searchUnits?: DiscogsSearchUnit[];
};

const MAX_SEARCH_UNITS = 100;
const MATCH_ROUTE = "/api/discogs/match";

type MatchFailure = {
  searchUnit: DiscogsSearchUnit;
  error: StructuredDiscogsError;
};

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

function createFallbackDiscogsError(error: unknown): StructuredDiscogsError {
  return {
    code: "discogs_provider_error",
    message:
      error instanceof Error
        ? error.message
        : "Discogs matching could not be completed for this album.",
    status: 0,
    retryAfterSeconds: null,
    rateLimit: emptyRateLimit(),
    providerMessage: null,
  };
}

function isSearchUnit(value: unknown): value is DiscogsSearchUnit {
  if (!value || typeof value !== "object") {
    return false;
  }

  const unit = value as Partial<DiscogsSearchUnit>;

  return (
    typeof unit.id === "string" &&
    typeof unit.album === "string" &&
    typeof unit.artist === "string" &&
    typeof unit.normalizedAlbum === "string" &&
    typeof unit.normalizedArtist === "string" &&
    typeof unit.query === "string" &&
    typeof unit.sourceTrackCount === "number" &&
    Array.isArray(unit.sourceTrackNames)
  );
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  cookieResponse?: NextResponse,
  headers?: HeadersInit,
) {
  const response = NextResponse.json(payload, {
    status,
    headers,
  });

  copyCookieHeaders(cookieResponse, response);

  return response;
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const ip = getClientIp(request);
  const ipId = ip ? createStableHash(ip) : undefined;

  if (!request.cookies.has(getSpotifyCookieNames().session)) {
    writeAuditLog("warn", {
      event: "discogs_match_denied",
      requestId,
      route: MATCH_ROUTE,
      status: 401,
      ipId,
      reason: "unauthenticated",
    });

    return jsonResponse(
      {
        error: {
          code: "spotify_not_connected",
          message: "Connect Spotify before matching records on Discogs.",
        },
      },
      401,
    );
  }

  const authorized = await getSpotifyAuthorizedRequest(request);

  if (!authorized.ok) {
    writeAuditLog("warn", {
      event: "discogs_match_denied",
      requestId,
      route: MATCH_ROUTE,
      status: authorized.response.status,
      ipId,
      reason: "unauthenticated",
    });

    return authorized.response;
  }

  const subjectId = createStableHash(
    authorized.session.refreshToken ?? authorized.session.accessToken,
  );
  const securityEnv = getDiscogsMatchSecurityEnv();

  if (!securityEnv.ok) {
    writeAuditLog("error", {
      event: "discogs_match_denied",
      requestId,
      route: MATCH_ROUTE,
      status: 500,
      subjectId,
      ipId,
      reason: "security_configuration_error",
    });

    return jsonResponse(
      {
        error: {
          code: "discogs_match_security_configuration_error",
          message: securityEnv.message,
          missing: securityEnv.missing,
        },
      },
      500,
      authorized.response,
    );
  }

  const requestRateLimit = checkRateLimit({
    key: `discogs-match:${subjectId}:${ipId ?? "unknown-ip"}`,
    limit: securityEnv.rateLimitMaxRequests,
    windowMs: securityEnv.rateLimitWindowMs,
  });

  if (!requestRateLimit.ok) {
    writeAuditLog("warn", {
      event: "discogs_match_denied",
      requestId,
      route: MATCH_ROUTE,
      status: 429,
      subjectId,
      ipId,
      reason: "rate_limited",
      details: {
        limit: requestRateLimit.limit,
        retryAfterSeconds: requestRateLimit.retryAfterSeconds,
      },
    });

    return jsonResponse(
      {
        error: {
          code: "discogs_match_rate_limited",
          message: "Too many Discogs match requests. Please wait and retry.",
          retryAfterSeconds: requestRateLimit.retryAfterSeconds,
        },
      },
      429,
      authorized.response,
      {
        "Retry-After": String(requestRateLimit.retryAfterSeconds),
        "X-RateLimit-Limit": String(requestRateLimit.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(
          Math.ceil(requestRateLimit.resetAt / 1000),
        ),
      },
    );
  }

  const env = getDiscogsEnv();
  const cacheEnv = getApiCacheEnv();

  if (!env.ok) {
    writeAuditLog("error", {
      event: "discogs_match_denied",
      requestId,
      route: MATCH_ROUTE,
      status: 500,
      subjectId,
      ipId,
      reason: "discogs_configuration_error",
    });

    return jsonResponse(
      {
        error: {
          code: "discogs_configuration_error",
          message: env.message,
          missing: env.missing,
        },
      },
      500,
      authorized.response,
    );
  }

  if (!cacheEnv.ok) {
    writeAuditLog("error", {
      event: "discogs_match_denied",
      requestId,
      route: MATCH_ROUTE,
      status: 500,
      subjectId,
      ipId,
      reason: "cache_configuration_error",
    });

    return jsonResponse(
      {
        error: {
          code: "cache_configuration_error",
          message: cacheEnv.message,
          missing: cacheEnv.missing,
        },
      },
      500,
      authorized.response,
    );
  }

  const bodyResult = await readLimitedJsonRequest(
    request,
    securityEnv.maxBodyBytes,
  );

  if (!bodyResult.ok) {
    writeAuditLog("warn", {
      event: "discogs_match_denied",
      requestId,
      route: MATCH_ROUTE,
      status: bodyResult.status,
      subjectId,
      ipId,
      reason: bodyResult.code,
      details: {
        bytesRead: bodyResult.bytesRead,
        maxBodyBytes: securityEnv.maxBodyBytes,
      },
    });

    return jsonResponse(
      {
        error: {
          code: bodyResult.code,
          message: bodyResult.message,
        },
      },
      bodyResult.status,
      authorized.response,
    );
  }

  const body = bodyResult.value as MatchRequestBody | null;
  const searchUnits = body?.searchUnits;

  if (!Array.isArray(searchUnits) || searchUnits.length === 0) {
    writeAuditLog("warn", {
      event: "discogs_match_denied",
      requestId,
      route: MATCH_ROUTE,
      status: 400,
      subjectId,
      ipId,
      reason: "missing_search_units",
      details: {
        bytesRead: bodyResult.bytesRead,
      },
    });

    return jsonResponse(
      {
        error: {
          code: "missing_search_units",
          message: "At least one normalized album search unit is required.",
        },
      },
      400,
      authorized.response,
    );
  }

  const validSearchUnits = searchUnits.filter(isSearchUnit);

  if (validSearchUnits.length !== searchUnits.length) {
    writeAuditLog("warn", {
      event: "discogs_match_denied",
      requestId,
      route: MATCH_ROUTE,
      status: 400,
      subjectId,
      ipId,
      reason: "invalid_search_units",
      details: {
        requestedUnits: searchUnits.length,
        validUnits: validSearchUnits.length,
      },
    });

    return jsonResponse(
      {
        error: {
          code: "invalid_search_units",
          message: "Every Discogs search unit must include album and artist metadata.",
        },
      },
      400,
      authorized.response,
    );
  }

  const cappedSearchUnits = validSearchUnits.slice(0, MAX_SEARCH_UNITS);
  const results = [];
  const failures: MatchFailure[] = [];
  let rateLimit = emptyRateLimit();
  let stoppedForRateLimit = false;
  let attemptedUnits = 0;

  for (const [index, unit] of cappedSearchUnits.entries()) {
    attemptedUnits += 1;

    if (index > 0) {
      await wait(env.requestDelayMs);
    }

    try {
      const searchResult = await searchDiscogsForUnit({
        unit,
        token: env.token,
        userAgent: env.userAgent,
        cacheTtlMs: cacheEnv.ttlMs,
      });
      rateLimit = mergeRateLimit(rateLimit, searchResult.rateLimit);
      const preliminaryResult = rankDiscogsSearchResult(searchResult);
      const marketplaceStatsByReleaseId = new Map<
        number,
        DiscogsMarketplaceStats
      >();
      const preliminaryBestMatch = preliminaryResult.bestMatch;

      if (preliminaryBestMatch) {
        await wait(env.requestDelayMs);

        try {
          const stats = await getDiscogsMarketplaceStats({
            releaseId: preliminaryBestMatch.id,
            token: env.token,
            userAgent: env.userAgent,
            cacheTtlMs: cacheEnv.ttlMs,
          });

          marketplaceStatsByReleaseId.set(preliminaryBestMatch.id, stats);
        } catch (error) {
          const structuredError =
            error instanceof DiscogsApiError
              ? error.toStructuredError()
              : createFallbackDiscogsError(error);

          rateLimit = mergeRateLimit(rateLimit, structuredError.rateLimit);
          failures.push({
            searchUnit: unit,
            error: structuredError,
          });

          if (structuredError.code === "discogs_rate_limited") {
            stoppedForRateLimit = true;
          }
        }
      }

      results.push(
        rankDiscogsSearchResult(searchResult, marketplaceStatsByReleaseId),
      );

      if (stoppedForRateLimit) {
        break;
      }
    } catch (error) {
      const structuredError =
        error instanceof DiscogsApiError
          ? error.toStructuredError()
          : createFallbackDiscogsError(error);

      rateLimit = mergeRateLimit(rateLimit, structuredError.rateLimit);
      failures.push({
        searchUnit: unit,
        error: structuredError,
      });

      if (structuredError.code === "discogs_rate_limited") {
        stoppedForRateLimit = true;
        break;
      }
    }
  }

  const skippedUnits = validSearchUnits.length - attemptedUnits;

  writeAuditLog("info", {
    event: "discogs_match_completed",
    requestId,
    route: MATCH_ROUTE,
    status: 200,
    subjectId,
    ipId,
    details: {
      requestedUnits: validSearchUnits.length,
      searchedUnits: attemptedUnits,
      skippedUnits,
      failures: failures.length,
      stoppedForRateLimit,
    },
  });

  return jsonResponse(
    {
      matchRun: {
        searchedUnits: attemptedUnits,
        skippedUnits,
        maxSearchUnits: MAX_SEARCH_UNITS,
        requestDelayMs: env.requestDelayMs,
        stoppedForRateLimit,
        rateLimit,
        results,
        failures,
      },
    },
    200,
    authorized.response,
    {
      "X-RateLimit-Limit": String(requestRateLimit.limit),
      "X-RateLimit-Remaining": String(requestRateLimit.remaining),
      "X-RateLimit-Reset": String(Math.ceil(requestRateLimit.resetAt / 1000)),
    },
  );
}
