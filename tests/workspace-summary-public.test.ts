import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLatestDiscogsImportRun: vi.fn(),
  listCollectionRecords: vi.fn(),
  listWishlistRecords: vi.fn(),
  loadSpinLogStats: vi.fn(),
}));

vi.mock("@/lib/capabilities/server", () => ({
  getServerCapabilities: vi.fn(() => ({
    listenbrainzImport: true,
    discogsCatalogue: true,
    spotifyLegacyClaim: true,
    spotifyImport: true,
    youtubeLinks: true,
    youtubeWatchHistory: false,
    youtubeMusicLibrary: false,
    discogsCollectionSync: false,
    discogsMarketplace: false,
    sellerScout: false,
    discogsRestrictedData: false,
  })),
}));

vi.mock("@/lib/collection/discogs-import", () => ({
  getLatestDiscogsImportRun: mocks.getLatestDiscogsImportRun,
}));

vi.mock("@/lib/collection/server", () => {
  return {
    listCollectionRecords: mocks.listCollectionRecords,
  };
});

vi.mock("@/lib/wishlist/server", () => {
  return {
    listWishlistRecords: mocks.listWishlistRecords,
  };
});

vi.mock("@/lib/spins/server", () => {
  return {
    loadSpinLogStats: mocks.loadSpinLogStats,
  };
});

import { loadWorkspaceSummary } from "@/lib/workspace/summary";

describe("public workspace summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCollectionRecords.mockResolvedValue([]);
    mocks.loadSpinLogStats.mockResolvedValue({
      totalSpins: 0,
      spinsLast7Days: 0,
      uniqueRecords: 0,
      currentStreakDays: 0,
      lastSpinAt: null,
    });
  });

  test("does not load legacy Discogs import or wishlist data when restricted capabilities are closed", async () => {
    const owner = {
      type: "user" as const,
      userId: "user-1",
      authUserId: "auth-1",
      sessionIdHash: null,
    };
    const summary = await loadWorkspaceSummary(owner);

    expect(mocks.listCollectionRecords).toHaveBeenCalledOnce();
    expect(mocks.listCollectionRecords).toHaveBeenCalledWith(owner, {
      keepArtwork: true,
    });
    expect(mocks.getLatestDiscogsImportRun).not.toHaveBeenCalled();
    expect(mocks.listWishlistRecords).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      latestImportRun: null,
      priorityWantlistCount: 0,
      spinTotal: 0,
      spinCount7d: 0,
      lastSpinAt: null,
    });
  });
});
