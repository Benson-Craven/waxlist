import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDiscogsCatalogueMasterVersions: vi.fn(),
  getDiscogsCatalogueRelease: vi.fn(),
  searchDiscogsPressings: vi.fn(),
}));

vi.mock("@/lib/discogs/catalogue-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/discogs/catalogue-client")>();
  return {
    ...actual,
    getDiscogsCatalogueMasterVersions:
      mocks.getDiscogsCatalogueMasterVersions,
    getDiscogsCatalogueRelease: mocks.getDiscogsCatalogueRelease,
    searchDiscogsPressings: mocks.searchDiscogsPressings,
  };
});

import {
  PressingCatalogueInputError,
  resolveCataloguePressing,
} from "@/lib/pressing-proof/server";

function release(masterId: number | null) {
  return {
    candidate: {
      id: 123,
      masterId,
      title: "The Example Band - Example Album",
      artist: "The Example Band",
      country: "UK",
      year: 1979,
      formats: ["Vinyl", "LP"],
      labels: ["Island Records"],
      catalogNumbers: ["ILPS 9103"],
      barcodes: ["012345678905"],
      matrixRunouts: ["A-3U"],
      pressingPlants: [],
      masteringCredits: [],
      identifiers: [],
      notes: null,
      imageUrl: null,
      uri: "https://www.discogs.com/release/123",
      resourceUrl: null,
      detailLoaded: true,
    },
    checkedAt: "2026-07-30T12:00:00.000Z",
    attribution: {
      label: "Catalogue data provided by Discogs",
      url: "https://www.discogs.com",
    },
    rateLimit: { limit: 60, used: 1, remaining: 59 },
  };
}

const access = {
  token: "token",
  userAgent: "Waxlist test",
  requestDelayMs: 0,
  cacheTtlMs: 60_000,
};

describe("pressing catalogue resolution boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects an untrusted seed release paired with a different master", async () => {
    mocks.getDiscogsCatalogueRelease.mockResolvedValue(release(456));

    await expect(
      resolveCataloguePressing({
        ...access,
        masterId: 999,
        seedReleaseId: 123,
        evidence: { catalogNumber: "ILPS 9103" },
      }),
    ).rejects.toBeInstanceOf(PressingCatalogueInputError);
    expect(mocks.getDiscogsCatalogueMasterVersions).not.toHaveBeenCalled();
  });

  test("returns unknown for a catalogue release with no master family", async () => {
    mocks.getDiscogsCatalogueRelease.mockResolvedValue(release(null));

    const result = await resolveCataloguePressing({
      ...access,
      masterId: null,
      seedReleaseId: 123,
      evidence: { catalogNumber: "ILPS 9103" },
    });

    expect(result).toMatchObject({
      masterId: null,
      familyKey: "release:123",
      resolution: {
        kind: "unknown",
        reason: "comparison_incomplete",
        resolvedReleaseId: null,
      },
    });
    expect(mocks.getDiscogsCatalogueMasterVersions).not.toHaveBeenCalled();
  });
});
