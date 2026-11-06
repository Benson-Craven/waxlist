import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import {
  getApiCacheEnv,
  getDiscogsEnv,
  getDiscogsMatchSecurityEnv,
} from "@/lib/config";
import {
  DiscogsCatalogueError,
  searchDiscogsPressings,
} from "@/lib/discogs/catalogue-client";
import { readLimitedJsonRequest } from "@/lib/security/limited-json";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 20);
}

function cleanQuery(value: unknown) {
  if (typeof value !== "string") return null;
  const query = value.trim().replace(/\s+/g, " ").slice(0, 120);
  return query.length >= 2 ? query : null;
}

export async function POST(request: NextRequest) {
  const owner = await resolveAuthenticatedOwner();

  if (!owner.ok) {
    return NextResponse.json(
      {
        error: {
          code: "catalogue_auth_required",
          message: "Sign in before searching Discogs.",
        },
      },
      { status: 401 },
    );
  }

  const [discogsEnv, cacheEnv, securityEnv] = [
    getDiscogsEnv(),
    getApiCacheEnv(),
    getDiscogsMatchSecurityEnv(),
  ];

  if (!discogsEnv.ok || !cacheEnv.ok || !securityEnv.ok) {
    return NextResponse.json(
      {
        error: {
          code: "catalogue_search_configuration_error",
          message: "Discogs search is not configured in this build.",
        },
      },
      { status: 500 },
    );
  }

  const rateLimit = checkRateLimit({
    key: `catalogue-search:${hash(owner.owner.userId)}`,
    limit: securityEnv.rateLimitMaxRequests,
    windowMs: securityEnv.rateLimitWindowMs,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: {
          code: "catalogue_search_rate_limited",
          message: "Too many searches. Try again in a moment.",
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
      { error: { code: bodyResult.code, message: bodyResult.message } },
      { status: bodyResult.status },
    );
  }

  const body =
    bodyResult.value && typeof bodyResult.value === "object"
      ? (bodyResult.value as Record<string, unknown>)
      : {};
  const query = cleanQuery(body.query);

  if (!query) {
    return NextResponse.json(
      {
        error: {
          code: "catalogue_query_required",
          message: "Search for an artist or album first.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const search = await searchDiscogsPressings({
      query: { query },
      token: discogsEnv.token,
      userAgent: discogsEnv.userAgent,
      cacheTtlMs: cacheEnv.ttlMs,
    });

    return NextResponse.json({
      candidates: search.candidates.slice(0, 12).map((candidate) => ({
        id: candidate.id,
        masterId: candidate.masterId,
        title: candidate.title,
        year: candidate.year,
        formats: candidate.formats,
        country: candidate.country,
        label: candidate.labels[0] ?? null,
        catalogNumber: candidate.catalogNumbers[0] ?? null,
      })),
    });
  } catch (error) {
    const catalogueError =
      error instanceof DiscogsCatalogueError ? error : null;

    return NextResponse.json(
      {
        error: {
          code: catalogueError?.code ?? "catalogue_search_failed",
          message:
            catalogueError?.status === 429
              ? "Discogs is rate limiting search. Try again shortly."
              : "Discogs search could not be completed.",
          retryAfterSeconds: catalogueError?.retryAfterSeconds ?? null,
        },
      },
      { status: catalogueError?.status || 502 },
    );
  }
}
