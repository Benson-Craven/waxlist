import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { DiscogsSearchUnit } from "@/lib/matching/discogs-search-units";

const mocks = vi.hoisted(() => ({
  cachedValue: null as unknown,
  getOrSetApiCache: vi.fn(),
}));

vi.mock("@/lib/cache/api-cache", () => ({
  getOrSetApiCache: mocks.getOrSetApiCache,
}));

import {
  getDiscogsCatalogueMasterVersions,
  getDiscogsCatalogueRelease,
  searchDiscogsCatalogue,
  searchDiscogsPressings,
} from "@/lib/discogs/catalogue-client";

const youtubeSearchUnit: DiscogsSearchUnit = {
  id: "youtube:dQw4w9WgXcQ",
  album: "Whenever You Need Somebody",
  artist: "Rick Astley",
  normalizedAlbum: "whenever you need somebody",
  normalizedArtist: "rick astley",
  query: "Rick Astley Whenever You Need Somebody",
  releaseYear: null,
  sourceTrackCount: 1,
  sourceTrackNames: [],
  source: {
    provider: "youtube",
    albumId: "dQw4w9WgXcQ",
    albumUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  isCompilation: false,
};

describe("Discogs public catalogue cache", () => {
  beforeEach(() => {
    mocks.cachedValue = null;
    mocks.getOrSetApiCache.mockImplementation(
      async (
        _key: string,
        _ttlMs: number,
        loader: () => Promise<unknown>,
      ) => {
        mocks.cachedValue = await loader();
        return mocks.cachedValue;
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            results: [
              {
                id: 123,
                master_id: 456,
                type: "release",
                title: "Rick Astley - Whenever You Need Somebody",
                year: 1987,
                format: ["Vinyl", "LP"],
                country: "UK",
                uri: "/release/123",
                resource_url: "https://api.discogs.com/releases/123",
              },
            ],
          },
          {
            headers: {
              "x-discogs-ratelimit": "60",
              "x-discogs-ratelimit-used": "1",
              "x-discogs-ratelimit-remaining": "59",
            },
          },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("keeps YouTube evidence outside the shared CC0 cache value", async () => {
    const result = await searchDiscogsCatalogue({
      unit: youtubeSearchUnit,
      token: "token",
      userAgent: "Waxlist test",
      cacheTtlMs: 60_000,
    });

    expect(result.searchUnit).toEqual(youtubeSearchUnit);
    expect(result.candidates[0]).toMatchObject({ id: 123, masterId: 456 });
    expect(JSON.stringify(mocks.cachedValue)).not.toContain("dQw4w9WgXcQ");
    expect(JSON.stringify(mocks.cachedValue)).not.toContain("youtube");
    expect(mocks.cachedValue).toMatchObject({
      candidates: [{ id: 123 }],
      rateLimit: { remaining: 59 },
    });
  });

  test("searches pressing seeds using catalogue fields without returning restricted fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          pagination: {
            items: 1,
          },
          results: [
            {
              id: 123,
              master_id: 456,
              type: "release",
              title: "The Example Band - Example Album",
              year: 1979,
              format: ["Vinyl", "LP"],
              country: "UK",
              label: ["Island Records"],
              catno: "ILPS 9103",
              barcode: ["012345678905"],
              uri: "/release/123",
              cover_image: "https://restricted.example/image.jpg",
              thumb: "https://restricted.example/thumb.jpg",
              lowest_price: 99,
            },
          ],
        }),
      ),
    );

    const result = await searchDiscogsPressings({
      query: {
        barcode: "012345678905",
      },
      token: "token",
      userAgent: "Waxlist test",
      cacheTtlMs: 60_000,
    });

    expect(result.candidates).toEqual([
      {
        id: 123,
        masterId: 456,
        title: "The Example Band - Example Album",
        year: 1979,
        formats: ["Vinyl", "LP"],
        country: "UK",
        labels: ["Island Records"],
        catalogNumbers: ["ILPS 9103"],
        barcodes: ["012345678905"],
        uri: "https://www.discogs.com/release/123",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("image");
    expect(JSON.stringify(result)).not.toContain("price");
    expect(JSON.stringify(mocks.cachedValue)).not.toContain("image");
    expect(JSON.stringify(mocks.cachedValue)).not.toContain("price");
  });

  test("loads release identifiers and manufacturing clues while excluding images and marketplace data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: 123,
          master_id: 456,
          title: "Example Album",
          artists: [{ name: "The Example Band" }],
          country: "UK",
          year: 1979,
          formats: [
            {
              name: "Vinyl",
              descriptions: ["LP", "Album"],
            },
          ],
          labels: [{ name: "Island Records", catno: "ILPS 9103" }],
          identifiers: [
            {
              type: "Barcode",
              value: "012345678905",
              description: null,
            },
            {
              type: "Matrix / Runout",
              value: "A-3U",
              description: "Side A",
            },
          ],
          companies: [
            {
              name: "Example Pressing Plant",
              entity_type_name: "Pressed By",
            },
          ],
          extraartists: [
            {
              name: "Example Engineer",
              role: "Mastered By",
            },
          ],
          uri: "/release/123",
          images: [{ uri: "https://restricted.example/image.jpg" }],
          lowest_price: 99,
        }),
      ),
    );

    const result = await getDiscogsCatalogueRelease({
      releaseId: 123,
      token: "token",
      userAgent: "Waxlist test",
      cacheTtlMs: 60_000,
    });

    expect(result.candidate).toMatchObject({
      id: 123,
      masterId: 456,
      artist: "The Example Band",
      labels: ["Island Records"],
      catalogNumbers: ["ILPS 9103"],
      barcodes: ["012345678905"],
      matrixRunouts: ["A-3U"],
      pressingPlants: ["Example Pressing Plant"],
      masteringCredits: ["Example Engineer"],
      imageUrl: null,
      notes: null,
      resourceUrl: null,
      detailLoaded: true,
    });
    expect(JSON.stringify(result)).not.toContain("restricted.example");
    expect(JSON.stringify(result)).not.toContain("lowest_price");
    expect(JSON.stringify(mocks.cachedValue)).not.toContain("restricted.example");
    expect(JSON.stringify(mocks.cachedValue)).not.toContain("lowest_price");
  });

  test("reports master-version completeness from catalogue pagination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          pagination: {
            items: 3,
            page: 1,
            pages: 2,
            per_page: 2,
          },
          versions: [
            {
              id: 123,
              title: "Example Album",
              country: "UK",
              released: "1979",
              format: "LP",
              label: "Island Records",
              catno: "ILPS 9103",
              uri: "/release/123",
            },
            {
              id: 124,
              title: "Example Album",
              country: "US",
              released: "1980",
              format: "LP",
              label: "Island Records",
              catno: "ILPS 9103-A",
              uri: "/release/124",
            },
          ],
        }),
      ),
    );

    const result = await getDiscogsCatalogueMasterVersions({
      masterId: 456,
      page: 1,
      perPage: 2,
      token: "token",
      userAgent: "Waxlist test",
      cacheTtlMs: 60_000,
    });

    expect(result).toMatchObject({
      masterId: 456,
      totalItems: 3,
      page: 1,
      totalPages: 2,
      versions: [
        { id: 123, detailLoaded: false },
        { id: 124, detailLoaded: false },
      ],
    });
  });
});
