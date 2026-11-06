import { createHash, randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { disabledCapabilityResponse } from "@/lib/capabilities/response";

import {
  getApiCacheEnv,
  getDiscogsEnv,
  getDiscogsMatchSecurityEnv,
} from "@/lib/config";
import {
  DiscogsApiError,
  getDiscogsMasterVersions,
  getDiscogsReleaseDetail,
  type DiscogsRateLimit,
  type StructuredDiscogsError,
} from "@/lib/discogs/client";
import {
  normalizePressingEvidence,
  rankPressingCandidates,
  type PressingCandidate,
  type PressingEvidence,
} from "@/lib/pressing-detective/matching";
import { writeAuditLog } from "@/lib/security/audit-log";
import { readLimitedJsonRequest } from "@/lib/security/limited-json";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const IDENTIFY_ROUTE = "/api/discogs/identify-copy";
const MAX_VERSION_CANDIDATES = 50;
const DETAIL_FETCH_LIMIT = 8;

type IdentifyCopyRequestBody = {
  releaseId?: unknown;
  masterId?: unknown;
  evidence?: unknown;
};

type IdentifyCopyFailure = {
  releaseId: number | null;
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
        : "Discogs copy identification could not be completed.",
    status: 0,
    retryAfterSeconds: null,
    rateLimit: emptyRateLimit(),
    providerMessage: null,
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
  void cookieResponse;

  return response;
}

function positiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeEvidenceInput(value: unknown): PressingEvidence {
  if (!value || typeof value !== "object") {
    return {};
  }

  const evidence = value as Record<string, unknown>;
  const year = positiveInteger(evidence.year);
  const stringField = (key: string) =>
    typeof evidence[key] === "string" ? evidence[key] : undefined;

  return normalizePressingEvidence({
    format: stringField("format"),
    country: stringField("country"),
    year,
    label: stringField("label"),
    catalogNumber: stringField("catalogNumber"),
    barcode: stringField("barcode"),
    matrixRunout: stringField("matrixRunout"),
    identifierText: stringField("identifierText"),
  });
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mergeDetailedCandidate(
  baseCandidate: PressingCandidate,
  detailedCandidate: PressingCandidate | undefined,
): PressingCandidate {
  if (!detailedCandidate) {
    return baseCandidate;
  }

  return {
    ...baseCandidate,
    ...detailedCandidate,
    masterId: detailedCandidate.masterId ?? baseCandidate.masterId,
    imageUrl: detailedCandidate.imageUrl ?? baseCandidate.imageUrl,
    uri: detailedCandidate.uri ?? baseCandidate.uri,
    resourceUrl: detailedCandidate.resourceUrl ?? baseCandidate.resourceUrl,
  };
}

export async function POST(request: NextRequest) {
  const disabled = disabledCapabilityResponse("discogsRestrictedData");
  if (disabled) return disabled;
  const requestId = randomUUID();
  const ip = getClientIp(request);
  const ipId = ip ? createStableHash(ip) : undefined;
  const resolved = await resolveAuthenticatedOwner();

  if (!resolved.ok) {
    writeAuditLog("warn", {
      event: "discogs_identify_denied",
      requestId,
      route: IDENTIFY_ROUTE,
      status: resolved.code === "auth_required" ? 401 : 500,
      ipId,
      reason: "unauthenticated",
    });

    return jsonResponse(
      {
        error: {
          code: resolved.code,
          message: resolved.message,
        },
      },
      resolved.code === "auth_required" ? 401 : 500,
    );
  }

  const responseCookies: NextResponse | undefined = undefined;
  const subjectId = createStableHash(resolved.owner.userId);
  const securityEnv = getDiscogsMatchSecurityEnv();

  if (!securityEnv.ok) {
    return jsonResponse(
      {
        error: {
          code: "discogs_identify_security_configuration_error",
          message: securityEnv.message,
          missing: securityEnv.missing,
        },
      },
      500,
      responseCookies,
    );
  }

  const requestRateLimit = checkRateLimit({
    key: `discogs-identify:${subjectId}:${ipId ?? "unknown-ip"}`,
    limit: securityEnv.rateLimitMaxRequests,
    windowMs: securityEnv.rateLimitWindowMs,
  });

  if (!requestRateLimit.ok) {
    return jsonResponse(
      {
        error: {
          code: "discogs_identify_rate_limited",
          message: "Too many Discogs identification requests. Please wait and retry.",
          retryAfterSeconds: requestRateLimit.retryAfterSeconds,
        },
      },
      429,
      responseCookies,
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
    return jsonResponse(
      {
        error: {
          code: "discogs_configuration_error",
          message: env.message,
          missing: env.missing,
        },
      },
      500,
      responseCookies,
    );
  }

  if (!cacheEnv.ok) {
    return jsonResponse(
      {
        error: {
          code: "cache_configuration_error",
          message: cacheEnv.message,
          missing: cacheEnv.missing,
        },
      },
      500,
      responseCookies,
    );
  }

  const bodyResult = await readLimitedJsonRequest(
    request,
    securityEnv.maxBodyBytes,
  );

  if (!bodyResult.ok) {
    return jsonResponse(
      {
        error: {
          code: bodyResult.code,
          message: bodyResult.message,
        },
      },
      bodyResult.status,
      responseCookies,
    );
  }

  const body = bodyResult.value as IdentifyCopyRequestBody | null;
  const releaseId = positiveInteger(body?.releaseId);
  let masterId = positiveInteger(body?.masterId);
  const evidence = normalizeEvidenceInput(body?.evidence);
  let rateLimit = emptyRateLimit();
  const failures: IdentifyCopyFailure[] = [];
  let sourceReleaseDetail: PressingCandidate | null = null;

  if (!releaseId && !masterId) {
    return jsonResponse(
      {
        error: {
          code: "discogs_release_or_master_required",
          message: "A Discogs release id or master id is required.",
        },
      },
      400,
      responseCookies,
    );
  }

  if (!masterId && releaseId) {
    try {
      sourceReleaseDetail = await getDiscogsReleaseDetail({
        releaseId,
        token: env.token,
        userAgent: env.userAgent,
        cacheTtlMs: cacheEnv.ttlMs,
      });
      masterId = sourceReleaseDetail.masterId;
    } catch (error) {
      const structuredError =
        error instanceof DiscogsApiError
          ? error.toStructuredError()
          : createFallbackDiscogsError(error);

      rateLimit = mergeRateLimit(rateLimit, structuredError.rateLimit);
      failures.push({
        releaseId,
        error: structuredError,
      });
    }
  }

  if (!masterId) {
    return jsonResponse(
      {
        error: {
          code: "discogs_master_required",
          message:
            "This release is not linked to a Discogs master release, so WAXLIST cannot compare versions yet.",
          failures,
        },
      },
      400,
      responseCookies,
    );
  }

  try {
    const versionsPage = await getDiscogsMasterVersions({
      masterId,
      page: 1,
      perPage: MAX_VERSION_CANDIDATES,
      token: env.token,
      userAgent: env.userAgent,
      cacheTtlMs: cacheEnv.ttlMs,
    });

    rateLimit = mergeRateLimit(rateLimit, versionsPage.rateLimit);

    const preliminaryRanking = rankPressingCandidates(
      versionsPage.versions,
      evidence,
    );
    const detailReleaseIds = new Set<number>();

    if (releaseId) {
      detailReleaseIds.add(releaseId);
    }

    for (const candidate of preliminaryRanking) {
      if (detailReleaseIds.size >= DETAIL_FETCH_LIMIT) {
        break;
      }

      detailReleaseIds.add(candidate.id);
    }

    const detailedCandidates = new Map<number, PressingCandidate>();

    if (sourceReleaseDetail) {
      detailedCandidates.set(sourceReleaseDetail.id, sourceReleaseDetail);
    }

    for (const [index, candidateReleaseId] of Array.from(
      detailReleaseIds,
    ).entries()) {
      if (detailedCandidates.has(candidateReleaseId)) {
        continue;
      }

      if (index > 0 && env.requestDelayMs > 0) {
        await wait(env.requestDelayMs);
      }

      try {
        const detailedCandidate = await getDiscogsReleaseDetail({
          releaseId: candidateReleaseId,
          token: env.token,
          userAgent: env.userAgent,
          cacheTtlMs: cacheEnv.ttlMs,
        });

        detailedCandidates.set(candidateReleaseId, detailedCandidate);
      } catch (error) {
        const structuredError =
          error instanceof DiscogsApiError
            ? error.toStructuredError()
            : createFallbackDiscogsError(error);

        rateLimit = mergeRateLimit(rateLimit, structuredError.rateLimit);
        failures.push({
          releaseId: candidateReleaseId,
          error: structuredError,
        });

        if (structuredError.code === "discogs_rate_limited") {
          break;
        }
      }
    }

    const candidateIds = new Set(versionsPage.versions.map((version) => version.id));
    const candidates = versionsPage.versions.map((candidate) =>
      mergeDetailedCandidate(candidate, detailedCandidates.get(candidate.id)),
    );

    for (const detailedCandidate of detailedCandidates.values()) {
      if (!candidateIds.has(detailedCandidate.id)) {
        candidates.unshift(detailedCandidate);
      }
    }

    writeAuditLog("info", {
      event: "discogs_identify_completed",
      requestId,
      route: IDENTIFY_ROUTE,
      status: 200,
      subjectId,
      ipId,
      details: {
        masterId,
        releaseId,
        candidates: candidates.length,
        detailReleaseIds: detailedCandidates.size,
        failures: failures.length,
      },
    });

    return jsonResponse(
      {
        identifyRun: {
          masterId,
          sourceReleaseId: releaseId,
          totalVersions: versionsPage.totalItems,
          returnedVersions: candidates.length,
          maxVersionCandidates: MAX_VERSION_CANDIDATES,
          detailFetchLimit: DETAIL_FETCH_LIMIT,
          detailReleaseIds: Array.from(detailedCandidates.keys()),
          truncated: versionsPage.totalItems > candidates.length,
          rateLimit,
          candidates,
          failures,
        },
      },
      200,
      responseCookies,
      {
        "X-RateLimit-Limit": String(requestRateLimit.limit),
        "X-RateLimit-Remaining": String(requestRateLimit.remaining),
        "X-RateLimit-Reset": String(Math.ceil(requestRateLimit.resetAt / 1000)),
      },
    );
  } catch (error) {
    const structuredError =
      error instanceof DiscogsApiError
        ? error.toStructuredError()
        : createFallbackDiscogsError(error);

    writeAuditLog("warn", {
      event: "discogs_identify_failed",
      requestId,
      route: IDENTIFY_ROUTE,
      status: structuredError.status || 502,
      subjectId,
      ipId,
      reason: structuredError.code,
    });

    return jsonResponse(
      {
        error: structuredError,
      },
      structuredError.status || 502,
      responseCookies,
    );
  }
}
