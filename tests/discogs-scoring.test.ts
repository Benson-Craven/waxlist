import { describe, expect, test } from "vitest";
import { rankDiscogsSearchResult } from "@/lib/matching/match-discogs-release";
import type { DiscogsSearchResult } from "@/lib/discogs/client";

const baseResult: DiscogsSearchResult = {
  searchUnit: {
    id: "unit-1",
    album: "Star",
    artist: "Milky",
    normalizedAlbum: "star",
    normalizedArtist: "milky",
    query: "Milky Star",
    sourceTrackCount: 3,
    sourceTrackNames: ["Just the Way You Are", "In My Mind", "Be My World"],
    releaseYear: 2003,
  },
  rateLimit: {
    limit: 60,
    used: 1,
    remaining: 59,
  },
  candidates: [
    {
      id: 100,
      type: "release",
      title: "Milky - Star",
      year: 2003,
      format: ["Vinyl", "LP"],
      country: "Italy",
      thumb: null,
      uri: "/release/100-Milky-Star",
      resourceUrl: "https://api.discogs.com/releases/100",
    },
    {
      id: 200,
      type: "release",
      title: "Star - Milky Way",
      year: 2003,
      format: ["Vinyl", "12\""],
      country: "US",
      thumb: null,
      uri: "/release/200-Star-Milky-Way",
      resourceUrl: "https://api.discogs.com/releases/200",
    },
  ],
};

describe("Discogs scoring", () => {
  test("ranks exact artist/release vinyl matches above wrong-side title matches", () => {
    const ranked = rankDiscogsSearchResult(baseResult);

    expect(ranked.bestMatch?.id).toBe(100);
    expect(ranked.matches[0].confidence).toBeGreaterThanOrEqual(75);
    expect(ranked.matches[0].reasons).toContain(
      "Discogs release title matches the Spotify album title.",
    );
    expect(ranked.matches[1].confidence).toBeLessThan(75);
    expect(ranked.matches[1].reasons).toContain(
      "Spotify album title did not match the Discogs release title.",
    );
  });

  test("folds marketplace availability and practical price into recommendation score", () => {
    const ranked = rankDiscogsSearchResult(
      baseResult,
      new Map([
        [
          100,
          {
            releaseId: 100,
            numForSale: 7,
            checkedAt: "2026-07-09T10:00:00.000Z",
            freshForSeconds: 900,
            lowestPrice: {
              value: 24,
              currency: "USD",
            },
          },
        ],
      ]),
    );

    expect(ranked.matches[0]).toMatchObject({
      id: 100,
      availability: {
        status: "available",
        label: "7 for sale",
        numForSale: 7,
      },
      priceHint: {
        label: "From $24",
        value: 24,
        currency: "USD",
        source: "discogs_marketplace_stats",
        checkedAt: "2026-07-09T10:00:00.000Z",
        freshForSeconds: 900,
      },
    });
    expect(ranked.matches[0].recommendationScore).toBeGreaterThan(
      ranked.matches[1].recommendationScore,
    );
  });

  test("preserves marketplace source metadata when lowest price is unavailable", () => {
    const ranked = rankDiscogsSearchResult(
      baseResult,
      new Map([
        [
          100,
          {
            releaseId: 100,
            numForSale: 7,
            checkedAt: "2026-07-09T10:00:00.000Z",
            freshForSeconds: 900,
            lowestPrice: null,
          },
        ],
      ]),
    );

    expect(ranked.matches[0]).toMatchObject({
      id: 100,
      availability: {
        status: "available",
        label: "7 for sale",
        numForSale: 7,
      },
      priceHint: {
        label: "Price unavailable",
        value: null,
        currency: null,
        source: "discogs_marketplace_stats",
        checkedAt: "2026-07-09T10:00:00.000Z",
        freshForSeconds: 900,
      },
    });
  });
});
