import { getDiscogsEnv } from "@/lib/config";
import {
  getDiscogsMarketplaceStats,
  searchDiscogsForUnit,
  type DiscogsMarketplaceStats,
} from "@/lib/discogs/client";
import { rankDiscogsSearchResult } from "@/lib/matching/match-discogs-release";
import type { DiscogsSearchUnit } from "@/lib/matching/discogs-search-units";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type MatchRequestBody = {
  searchUnits?: DiscogsSearchUnit[];
};

const MAX_SEARCH_UNITS = 100;
const DISCOGS_REQUEST_DELAY_MS = 1100;

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

export async function POST(request: Request) {
  const env = getDiscogsEnv();

  if (!env.ok) {
    return NextResponse.json(
      {
        error: {
          code: "discogs_configuration_error",
          message: env.message,
          missing: env.missing,
        },
      },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as MatchRequestBody | null;
  const searchUnits = body?.searchUnits;

  if (!Array.isArray(searchUnits) || searchUnits.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "missing_search_units",
          message: "At least one normalized album search unit is required.",
        },
      },
      { status: 400 },
    );
  }

  const validSearchUnits = searchUnits.filter(isSearchUnit);

  if (validSearchUnits.length !== searchUnits.length) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_search_units",
          message: "Every Discogs search unit must include album and artist metadata.",
        },
      },
      { status: 400 },
    );
  }

  const cappedSearchUnits = validSearchUnits.slice(0, MAX_SEARCH_UNITS);
  const results = [];
  const failures = [];

  for (const [index, unit] of cappedSearchUnits.entries()) {
    if (index > 0) {
      await wait(DISCOGS_REQUEST_DELAY_MS);
    }

    try {
      const searchResult = await searchDiscogsForUnit({
        unit,
        token: env.token,
        userAgent: env.userAgent,
      });
      const preliminaryResult = rankDiscogsSearchResult(searchResult);
      const marketplaceStatsByReleaseId = new Map<
        number,
        DiscogsMarketplaceStats
      >();
      const preliminaryBestMatch = preliminaryResult.bestMatch;

      if (preliminaryBestMatch) {
        await wait(DISCOGS_REQUEST_DELAY_MS);
        const stats = await getDiscogsMarketplaceStats({
          releaseId: preliminaryBestMatch.id,
          token: env.token,
          userAgent: env.userAgent,
        });

        marketplaceStatsByReleaseId.set(preliminaryBestMatch.id, stats);
      }

      results.push(
        rankDiscogsSearchResult(searchResult, marketplaceStatsByReleaseId),
      );
    } catch (error) {
      failures.push({
        searchUnit: unit,
        message:
          error instanceof Error
            ? error.message
            : "Discogs search failed for this album.",
      });
    }
  }

  return NextResponse.json({
    matchRun: {
      searchedUnits: cappedSearchUnits.length,
      skippedUnits: validSearchUnits.length - cappedSearchUnits.length,
      maxSearchUnits: MAX_SEARCH_UNITS,
      results,
      failures,
    },
  });
}
