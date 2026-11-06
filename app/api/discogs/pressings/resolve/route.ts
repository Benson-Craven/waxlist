import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { disabledCapabilityResponse } from "@/lib/capabilities/response";
import {
  getApiCacheEnv,
  getDiscogsEnv,
  getDiscogsMatchSecurityEnv,
  getSessionSecretEnv,
} from "@/lib/config";
import { DiscogsCatalogueError } from "@/lib/discogs/catalogue-client";
import { normalizePressingEvidence } from "@/lib/pressing-detective/matching";
import {
  createPressingPreviewSession,
  PRESSING_PREVIEW_COOKIE,
  PRESSING_PREVIEW_TTL_MS,
  readPressingPreviewSession,
} from "@/lib/pressing-proof/preview-session";
import {
  loadPressingCollectionOverlay,
  PressingCatalogueInputError,
  resolveCataloguePressing,
} from "@/lib/pressing-proof/server";
import { readLimitedJsonRequest } from "@/lib/security/limited-json";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 20);
}

function positiveInteger(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function evidenceFrom(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const optionalText = (key: string) =>
    typeof record[key] === "string"
      ? String(record[key]).trim().slice(0, 300)
      : undefined;

  return normalizePressingEvidence({
    barcode: optionalText("barcode"),
    catalogNumber: optionalText("catalogNumber"),
    country: optionalText("country"),
    label: optionalText("label"),
    format: optionalText("format"),
    matrixRunout: optionalText("matrixRunout"),
    identifierText: optionalText("identifierText"),
    year: positiveInteger(record.year),
  });
}

export async function POST(request: NextRequest) {
  const disabled = disabledCapabilityResponse("pressingProof");
  if (disabled) return disabled;

  const [discogsEnv, cacheEnv, securityEnv] = [
    getDiscogsEnv(),
    getApiCacheEnv(),
    getDiscogsMatchSecurityEnv(),
  ];
  if (!discogsEnv.ok || !cacheEnv.ok || !securityEnv.ok) {
    const failed = [discogsEnv, cacheEnv, securityEnv].find(
      (result) => !result.ok,
    );
    return NextResponse.json(
      {
        error: {
          code: "pressing_resolve_configuration_error",
          message: failed?.message ?? "Pressing resolution is not configured.",
          missing: failed?.missing ?? [],
        },
      },
      { status: 500 },
    );
  }

  const bodyResult = await readLimitedJsonRequest(
    request,
    securityEnv.maxBodyBytes,
  );
  if (!bodyResult.ok) {
    return NextResponse.json(
      {
        error: { code: bodyResult.code, message: bodyResult.message },
      },
      { status: bodyResult.status },
    );
  }
  const body =
    bodyResult.value && typeof bodyResult.value === "object"
      ? (bodyResult.value as Record<string, unknown>)
      : {};
  const masterId = positiveInteger(body.masterId);
  const seedReleaseId = positiveInteger(body.seedReleaseId);

  if (!masterId && !seedReleaseId) {
    return NextResponse.json(
      {
        error: {
          code: "pressing_family_required",
          message: "Choose a Discogs release family before checking evidence.",
        },
      },
      { status: 400 },
    );
  }

  const resolvedOwner = await resolveAuthenticatedOwner();
  const authenticated = resolvedOwner.ok;
  const ipHash = hash(clientIp(request));
  const subject = authenticated
    ? hash(resolvedOwner.owner.userId)
    : ipHash;
  const requestRateLimit = checkRateLimit({
    key: `pressing-resolve:${subject}`,
    limit: securityEnv.rateLimitMaxRequests,
    windowMs: securityEnv.rateLimitWindowMs,
  });
  if (!requestRateLimit.ok) {
    return NextResponse.json(
      {
        error: {
          code: "pressing_resolve_rate_limited",
          message: "Too many evidence checks. Please wait and retry.",
          retryAfterSeconds: requestRateLimit.retryAfterSeconds,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(requestRateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const sessionEnv = authenticated ? null : getSessionSecretEnv();
  if (sessionEnv && !sessionEnv.ok) {
    return NextResponse.json(
      {
        error: {
          code: "pressing_preview_configuration_error",
          message: sessionEnv.message,
          missing: sessionEnv.missing,
        },
      },
      { status: 500 },
    );
  }
  const existing =
    sessionEnv?.ok
      ? readPressingPreviewSession({
          secret: sessionEnv.secret,
          value: request.cookies.get(PRESSING_PREVIEW_COOKIE)?.value,
        })
      : null;

  if (
    existing &&
    (existing.ipHash !== ipHash ||
      (masterId !== null && existing.familyKey !== `master:${masterId}`))
  ) {
    return NextResponse.json(
      {
        error: {
          code: "anonymous_preview_family_limit",
          message:
            "The anonymous preview is limited to one release family. Sign in to start or save another investigation.",
        },
      },
      { status: 403 },
    );
  }

  try {
    const result = await resolveCataloguePressing({
      masterId,
      seedReleaseId,
      evidence: evidenceFrom(body.evidence),
      token: discogsEnv.token,
      userAgent: discogsEnv.userAgent,
      requestDelayMs: discogsEnv.requestDelayMs,
      cacheTtlMs: cacheEnv.ttlMs,
    });
    const familyKey = result.familyKey;

    if (authenticated) {
      const collectionOverlay = await loadPressingCollectionOverlay(
        resolvedOwner.owner,
        result.resolution.remainingCandidates.map(({ id }) => id),
      );

      return NextResponse.json({
        investigation: {
          authenticated: true,
          previewId: null,
        },
        collectionOverlay,
        ...result,
      });
    }

    if (!sessionEnv?.ok) {
      throw new Error("Anonymous preview session is unavailable.");
    }

    if (
      existing &&
      existing.familyKey !== familyKey
    ) {
      return NextResponse.json(
        {
          error: {
            code: "anonymous_preview_family_limit",
            message:
              "The anonymous preview is limited to one release family. Sign in to start or save another investigation.",
          },
        },
        { status: 403 },
      );
    }

    const cookieValue = existing
      ? request.cookies.get(PRESSING_PREVIEW_COOKIE)?.value ?? ""
      : createPressingPreviewSession({
        secret: sessionEnv.secret,
        familyKey,
        ipHash,
      });
    const preview = readPressingPreviewSession({
      secret: sessionEnv.secret,
      value: cookieValue,
    });
    const response = NextResponse.json({
      investigation: {
        authenticated: false,
        previewId: preview?.investigationId ?? null,
      },
      ...result,
    });

    if (!existing) {
      response.cookies.set(PRESSING_PREVIEW_COOKIE, cookieValue, {
        httpOnly: true,
        maxAge: PRESSING_PREVIEW_TTL_MS / 1000,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (error) {
    const catalogueError =
      error instanceof DiscogsCatalogueError ? error : null;
    const inputError =
      error instanceof PressingCatalogueInputError ? error : null;
    return NextResponse.json(
      {
        error: {
          code:
            inputError?.code ??
            catalogueError?.code ??
            "pressing_resolve_failed",
          message:
            inputError?.message ??
            catalogueError?.message ??
            (error instanceof Error
              ? error.message
              : "Pressing evidence could not be checked."),
          retryAfterSeconds: catalogueError?.retryAfterSeconds ?? null,
        },
      },
      { status: inputError ? 400 : catalogueError?.status || 502 },
    );
  }
}
