import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { disabledCapabilityResponse } from "@/lib/capabilities/response";
import {
  getApiCacheEnv,
  getDiscogsEnv,
  getDiscogsMatchSecurityEnv,
} from "@/lib/config";
import { DiscogsCatalogueError } from "@/lib/discogs/catalogue-client";
import { searchPressingSeeds } from "@/lib/pressing-proof/server";
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

function text(value: unknown, maxLength = 160) {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
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
          code: "pressing_search_configuration_error",
          message: failed?.message ?? "Pressing search is not configured.",
          missing: failed?.missing ?? [],
        },
      },
      { status: 500 },
    );
  }

  const rateLimit = checkRateLimit({
    key: `pressing-search:${hash(clientIp(request))}`,
    limit: securityEnv.rateLimitMaxRequests,
    windowMs: securityEnv.rateLimitWindowMs,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: {
          code: "pressing_search_rate_limited",
          message: "Too many pressing searches. Please wait and retry.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const bodyResult = await readLimitedJsonRequest(
    request,
    securityEnv.maxBodyBytes,
  );
  if (!bodyResult.ok) {
    return NextResponse.json(
      {
        error: {
          code: bodyResult.code,
          message: bodyResult.message,
        },
      },
      { status: bodyResult.status },
    );
  }

  const body =
    bodyResult.value && typeof bodyResult.value === "object"
      ? (bodyResult.value as Record<string, unknown>)
      : {};
  const releaseId = positiveInteger(body.discogsId);
  const query = {
    query: text(body.query),
    artist: text(body.artist),
    title: text(body.title),
    barcode: text(body.barcode, 80),
    catalogNumber: text(body.catalogNumber, 80),
  };

  if (!releaseId && !Object.values(query).some(Boolean)) {
    return NextResponse.json(
      {
        error: {
          code: "pressing_search_input_required",
          message:
            "Enter an artist, title, barcode, catalogue number, or Discogs release ID.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const search = await searchPressingSeeds({
      query,
      releaseId,
      token: discogsEnv.token,
      userAgent: discogsEnv.userAgent,
      requestDelayMs: discogsEnv.requestDelayMs,
      cacheTtlMs: cacheEnv.ttlMs,
    });

    return NextResponse.json({ search });
  } catch (error) {
    const catalogueError =
      error instanceof DiscogsCatalogueError ? error : null;
    return NextResponse.json(
      {
        error: {
          code: catalogueError?.code ?? "pressing_search_failed",
          message:
            catalogueError?.message ??
            "Pressing search could not be completed.",
          retryAfterSeconds: catalogueError?.retryAfterSeconds ?? null,
        },
      },
      { status: catalogueError?.status || 502 },
    );
  }
}
