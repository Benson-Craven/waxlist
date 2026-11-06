import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { requireServerCapability } from "@/lib/capabilities/server";
import { listCollectionRecords } from "@/lib/collection/server";
import {
  getApiCacheEnv,
  getDiscogsEnv,
  getDiscogsMatchSecurityEnv,
  getNeonAuthEnv,
} from "@/lib/config";
import {
  DiscogsCatalogueError,
  searchDiscogsCatalogue,
  type DiscogsCatalogueRateLimit,
} from "@/lib/discogs/catalogue-client";
import { classifyCollectionGap } from "@/lib/listening/collection-gap";
import { createCollectionMarkToken } from "@/lib/listening/mark-token";
import { loadLatestListeningSnapshot } from "@/lib/listening/server";
import type {
  ListeningAlbumCandidate,
  ListeningSourceProvider,
  ListeningSourceType,
} from "@/lib/listening/types";
import {
  createDiscogsSearchUnitFromListeningCandidate,
  type DiscogsSearchUnit,
} from "@/lib/matching/discogs-search-units";
import {
  rankDiscogsSearchResult,
  RELIABLE_MATCH_CONFIDENCE,
} from "@/lib/matching/match-discogs-release";
import { writeAuditLog } from "@/lib/security/audit-log";
import { readLimitedJsonRequest } from "@/lib/security/limited-json";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  copyCookieHeaders,
  getSpotifyAuthorizedRequest,
} from "@/lib/spotify/api";

export const runtime = "nodejs";

const MAX_SEARCH_UNITS = 100;
const MATCH_ROUTE = "/api/discogs/match";

type MatchRequestBody = {
  candidates?: unknown;
  provider?: unknown;
  sourceType?: unknown;
  searchUnits?: unknown;
};

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 16);
}

type CandidateEdit = {
  id: string;
  artist: string;
  album: string;
};

type MatchSourceCandidate = Pick<
  ListeningAlbumCandidate,
  "artist" | "album" | "metadataQuality"
>;

function isSearchUnit(value: unknown): value is DiscogsSearchUnit {
  if (!value || typeof value !== "object") return false;
  const unit = value as Partial<DiscogsSearchUnit>;

  return (
    typeof unit.id === "string" &&
    typeof unit.album === "string" &&
    typeof unit.artist === "string" &&
    typeof unit.normalizedAlbum === "string" &&
    typeof unit.normalizedArtist === "string" &&
    typeof unit.query === "string" &&
    typeof unit.sourceTrackCount === "number" &&
    Array.isArray(unit.sourceTrackNames) &&
    unit.source?.provider === "spotify"
  );
}

function readListeningSource(body: MatchRequestBody | null): {
  provider: ListeningSourceProvider;
  sourceType: ListeningSourceType;
} | null {
  const provider = body?.provider ?? "listenbrainz";
  const sourceType = body?.sourceType ?? "listening_history";

  if (provider === "listenbrainz" && sourceType === "listening_history") {
    return { provider, sourceType };
  }

  if (provider === "youtube" && sourceType === "video_links") {
    return { provider, sourceType };
  }

  return null;
}

function readCandidateEdits(value: unknown): CandidateEdit[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const edits: CandidateEdit[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const candidate = item as Record<string, unknown>;

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.artist !== "string" ||
      typeof candidate.album !== "string"
    ) {
      return null;
    }

    edits.push({
      id: candidate.id,
      artist: candidate.artist.trim(),
      album: candidate.album.trim(),
    });
  }

  return edits;
}

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

function emptyRateLimit(): DiscogsCatalogueRateLimit {
  return { limit: null, used: null, remaining: null };
}

function mergeRateLimit(
  current: DiscogsCatalogueRateLimit,
  next: DiscogsCatalogueRateLimit,
) {
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

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const resolved = await resolveAuthenticatedOwner();

  if (!resolved.ok) {
    return NextResponse.json(
      {
        error: {
          code: resolved.code,
          message: resolved.message,
        },
      },
      { status: resolved.code === "auth_required" ? 401 : 500 },
    );
  }

  const capability = requireServerCapability("discogsCatalogue");

  if (!capability.ok) {
    return NextResponse.json({ error: capability.error }, { status: 404 });
  }

  const security = getDiscogsMatchSecurityEnv();
  const discogs = getDiscogsEnv();
  const cache = getApiCacheEnv();
  const auth = getNeonAuthEnv();

  if (!security.ok || !discogs.ok || !cache.ok || !auth.ok) {
    const failed:
      | { ok: false; message: string; missing: string[] }
      | undefined = !security.ok
      ? security
      : !discogs.ok
        ? discogs
        : !cache.ok
          ? cache
          : !auth.ok
            ? auth
          : undefined;

    if (!failed) {
      throw new Error("Discogs configuration narrowing failed.");
    }
    return NextResponse.json(
      {
        error: {
          code: "discogs_configuration_error",
          message: failed.message,
          missing: failed.missing,
        },
      },
      { status: 500 },
    );
  }

  const ip = clientIp(request);
  const rate = checkRateLimit({
    key: `discogs-match:${stableHash(resolved.owner.userId)}:${ip ? stableHash(ip) : "unknown"}`,
    limit: security.rateLimitMaxRequests,
    windowMs: security.rateLimitWindowMs,
  });

  if (!rate.ok) {
    return NextResponse.json(
      {
        error: {
          code: "discogs_match_rate_limited",
          message: "Too many catalogue match requests. Please wait and retry.",
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const bodyResult = await readLimitedJsonRequest(
    request,
    security.maxBodyBytes,
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

  const body = bodyResult.value as MatchRequestBody | null;
  const spotifySearchUnits = Array.isArray(body?.searchUnits)
    ? body.searchUnits
    : null;
  const isSpotifyRequest = spotifySearchUnits !== null;
  let spotifyCookieResponse: NextResponse | undefined;
  const candidates: ListeningAlbumCandidate[] = [];
  const sourceCandidateById = new Map<string, MatchSourceCandidate>();
  let searchUnits: DiscogsSearchUnit[];

  if (isSpotifyRequest) {
    const capability = requireServerCapability("spotifyImport");

    if (!capability.ok) {
      return NextResponse.json({ error: capability.error }, { status: 404 });
    }

    if (
      spotifySearchUnits.length === 0 ||
      spotifySearchUnits.length > MAX_SEARCH_UNITS ||
      spotifySearchUnits.some((unit) => !isSearchUnit(unit)) ||
      new Set(
        spotifySearchUnits.map((unit) => (unit as DiscogsSearchUnit).id),
      ).size !== spotifySearchUnits.length
    ) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_search_units",
            message:
              "Provide between one and 100 unique Spotify album search units.",
          },
        },
        { status: 400 },
      );
    }

    const spotify = await getSpotifyAuthorizedRequest(
      request,
      resolved.owner.authUserId,
    );

    if (!spotify.ok) {
      return spotify.response;
    }

    spotifyCookieResponse = spotify.response;
    searchUnits = spotifySearchUnits as DiscogsSearchUnit[];
    for (const unit of searchUnits) {
      sourceCandidateById.set(unit.id, {
        artist: unit.artist,
        album: unit.album,
        metadataQuality: "complete",
      });
    }
  } else {
    const source = readListeningSource(body);
    const candidateEdits = readCandidateEdits(body?.candidates);

    if (
      !source ||
      !candidateEdits ||
      candidateEdits.length === 0 ||
      candidateEdits.length > MAX_SEARCH_UNITS ||
      new Set(candidateEdits.map((candidate) => candidate.id)).size !==
        candidateEdits.length
    ) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_listening_candidates",
            message:
              "Provide between one and 100 unique albums from a supported source snapshot.",
          },
        },
        { status: 400 },
      );
    }

    const snapshot = await loadLatestListeningSnapshot(
      resolved.owner,
      source.provider,
      source.sourceType,
    );

    if (!snapshot) {
      return NextResponse.json(
        {
          error: {
            code: "listening_snapshot_required",
            message:
              source.provider === "youtube"
                ? "Save YouTube links before matching the catalogue."
                : "Import ListenBrainz history before matching the catalogue.",
          },
        },
        { status: 409 },
      );
    }

    const storedCandidateById = new Map(
      snapshot.candidates.map((candidate) => [candidate.id, candidate]),
    );

    for (const edit of candidateEdits) {
      const stored = storedCandidateById.get(edit.id);

      if (!stored) {
        return NextResponse.json(
          {
            error: {
              code: "listening_candidate_not_found",
              message:
                "One or more albums are not part of the latest source snapshot.",
            },
          },
          { status: 400 },
        );
      }

      if (
        source.provider === "youtube" &&
        stored.metadataQuality !== "complete"
      ) {
        return NextResponse.json(
          {
            error: {
              code: "youtube_metadata_confirmation_required",
              message:
                "Confirm the artist and album for every YouTube link before catalogue matching.",
            },
          },
          { status: 409 },
        );
      }

      const artist =
        stored.metadataQuality === "review" ? edit.artist : stored.artist.trim();
      const album =
        stored.metadataQuality === "review" ? edit.album : stored.album.trim();

      if (!artist || !album) {
        return NextResponse.json(
          {
            error: {
              code: "listening_candidate_review_required",
              message:
                "Complete ambiguous artist and album names before matching.",
            },
          },
          { status: 400 },
        );
      }

      candidates.push({
        ...stored,
        artist,
        album,
        metadataQuality: "complete",
        reviewReason: null,
      });
      sourceCandidateById.set(stored.id, {
        artist,
        album,
        metadataQuality: "complete",
      });
    }

    searchUnits = candidates.map(
      createDiscogsSearchUnitFromListeningCandidate,
    );
  }

  const collection = await listCollectionRecords(resolved.owner);
  const results = [];
  const failures = [];
  let providerRateLimit = emptyRateLimit();
  let stoppedForRateLimit = false;

  for (const [index, unit] of searchUnits
    .slice(0, MAX_SEARCH_UNITS)
    .entries()) {
    if (index > 0) await sleep(discogs.requestDelayMs);

    try {
      const catalogueResult = await searchDiscogsCatalogue({
        unit,
        token: discogs.token,
        userAgent: discogs.userAgent,
        cacheTtlMs: cache.ttlMs,
      });
      providerRateLimit = mergeRateLimit(
        providerRateLimit,
        catalogueResult.rateLimit,
      );
      const masterIdByRelease = new Map(
        catalogueResult.candidates.map((candidate) => [
          candidate.id,
          candidate.masterId,
        ]),
      );
      const ranked = rankDiscogsSearchResult({
        searchUnit: unit,
        candidates: catalogueResult.candidates.map((candidate) => ({
          id: candidate.id,
          type: candidate.type,
          title: candidate.title,
          year: candidate.year,
          format: candidate.format,
          country: candidate.country,
          thumb: null,
          uri: candidate.uri
            ? `https://www.discogs.com${candidate.uri}`
            : `https://www.discogs.com/release/${candidate.id}`,
          resourceUrl: null,
        })),
        rateLimit: catalogueResult.rateLimit,
      });
      const best = ranked.bestMatch;
      const masterId = best ? (masterIdByRelease.get(best.id) ?? null) : null;
      const sourceCandidate = sourceCandidateById.get(unit.id);
      const state = classifyCollectionGap({
        candidateMetadataQuality:
          sourceCandidate?.metadataQuality ?? "complete",
        match: best
          ? {
              releaseId: best.id,
              masterId,
              confidence: best.confidence,
            }
          : null,
        collection,
      });
      const markToken =
        best &&
        sourceCandidate &&
        best.confidence >= RELIABLE_MATCH_CONFIDENCE &&
        state !== "review" &&
        state !== "unmatched"
          ? createCollectionMarkToken({
              secret: auth.cookieSecret,
              payload: {
                userId: resolved.owner.userId,
                releaseId: best.id,
                masterId,
                artist: sourceCandidate.artist,
                title: sourceCandidate.album,
                format: best.format,
                year: best.year,
                confidence: best.confidence,
                expiresAt: Date.now() + 15 * 60 * 1000,
              },
            })
          : null;

      if (isSpotifyRequest) {
        results.push({
          ...ranked,
          state,
          bestMatch: best
            ? {
                ...best,
                masterId,
                markToken,
              }
            : null,
        });
      } else {
        results.push({
          searchUnit: unit,
          state,
          bestMatch: best
            ? {
                id: best.id,
                masterId,
                title: best.title,
                year: best.year,
                format: best.format,
                country: best.country,
                discogsUrl: best.uri
                  ? best.uri.startsWith("http")
                    ? best.uri
                    : `https://www.discogs.com${best.uri}`
                  : `https://www.discogs.com/release/${best.id}`,
                confidence: best.confidence,
                confidenceLabel: best.confidenceLabel,
                reasons: best.reasons,
                markToken,
              }
            : null,
        });
      }
    } catch (error) {
      const structured =
        error instanceof DiscogsCatalogueError
          ? {
              code: error.code,
              message: error.message,
              status: error.status,
              retryAfterSeconds: error.retryAfterSeconds,
              rateLimit: error.rateLimit,
            }
          : {
              code: "discogs_provider_error",
              message: "Discogs catalogue matching could not be completed.",
              status: 0,
              retryAfterSeconds: null,
              rateLimit: emptyRateLimit(),
              providerMessage: null,
            };
      providerRateLimit = mergeRateLimit(
        providerRateLimit,
        structured.rateLimit,
      );
      failures.push({
        searchUnit: unit,
        error: {
          ...structured,
          providerMessage:
            "providerMessage" in structured
              ? structured.providerMessage
              : null,
        },
      });
      if (structured.code === "discogs_rate_limited") {
        stoppedForRateLimit = true;
        break;
      }
    }
  }

  writeAuditLog("info", {
    event: "discogs_catalogue_match_completed",
    requestId,
    route: MATCH_ROUTE,
    status: 200,
    subjectId: stableHash(resolved.owner.userId),
    details: {
      searchedUnits: results.length + failures.length,
      results: results.length,
      failures: failures.length,
      stoppedForRateLimit,
    },
  });

  const response = NextResponse.json({
    matchRun: {
      searchedUnits: results.length + failures.length,
      skippedUnits:
        searchUnits.length - (results.length + failures.length),
      maxSearchUnits: MAX_SEARCH_UNITS,
      requestDelayMs: discogs.requestDelayMs,
      stoppedForRateLimit,
      rateLimit: providerRateLimit,
      results,
      failures,
      attribution: "Data provided by Discogs.",
    },
  });
  copyCookieHeaders(spotifyCookieResponse, response);

  return response;
}
