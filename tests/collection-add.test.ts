import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCollectionRecordByRelease: vi.fn(),
  insertCollectionRecord: vi.fn(),
  updateCollectionRecord: vi.fn(),
  getDiscogsCatalogueRelease: vi.fn(),
  loadDiscogsReleaseArtwork: vi.fn(),
  getDiscogsEnv: vi.fn(),
  getApiCacheEnv: vi.fn(),
}));

vi.mock("@/lib/collection/server", () => ({
  findCollectionRecordByRelease: mocks.findCollectionRecordByRelease,
  insertCollectionRecord: mocks.insertCollectionRecord,
  updateCollectionRecord: mocks.updateCollectionRecord,
}));

vi.mock("@/lib/config", () => ({
  getDiscogsEnv: mocks.getDiscogsEnv,
  getApiCacheEnv: mocks.getApiCacheEnv,
}));

vi.mock("@/lib/discogs/catalogue-client", () => ({
  DiscogsCatalogueError: class DiscogsCatalogueError extends Error {},
  getDiscogsCatalogueRelease: mocks.getDiscogsCatalogueRelease,
}));

vi.mock("@/lib/discogs/release-artwork", () => ({
  loadDiscogsReleaseArtwork: mocks.loadDiscogsReleaseArtwork,
}));

import { addCollectionRecord } from "@/lib/collection/add";

const owner = {
  type: "user" as const,
  userId: "user-1",
  sessionIdHash: null,
};

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "record-1",
    userId: "user-1",
    discogsReleaseId: 123,
    artist: "Sade",
    title: "Diamond Life",
    status: "wanted",
    favourite: false,
    ...overrides,
  };
}

describe("addCollectionRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findCollectionRecordByRelease.mockResolvedValue(null);
    mocks.getDiscogsEnv.mockReturnValue({
      ok: true,
      token: "token",
      userAgent: "Waxlist test",
    });
    mocks.getApiCacheEnv.mockReturnValue({ ok: true, ttlMs: 0 });
    mocks.getDiscogsCatalogueRelease.mockResolvedValue({
      candidate: {
        id: 123,
        masterId: 456,
        title: "Sade - Diamond Life",
        artist: "Sade",
        country: "UK",
        year: 1984,
        formats: ["Vinyl", "LP"],
        labels: ["Epic"],
        catalogNumbers: ["EPC 26044"],
        barcodes: [],
      },
    });
    mocks.loadDiscogsReleaseArtwork.mockResolvedValue(
      "https://img.test/diamond-life.jpg",
    );
    mocks.insertCollectionRecord.mockImplementation(async (_owner, input) =>
      record({ ...input }),
    );
    mocks.updateCollectionRecord.mockImplementation(async (_owner, id, patch) =>
      record({ id, ...patch }),
    );
  });

  test("promotes an existing want to owned instead of duplicating it", async () => {
    mocks.findCollectionRecordByRelease.mockResolvedValue(record());

    const result = await addCollectionRecord(owner, {
      discogsReleaseId: 123,
      status: "owned",
    });

    expect(mocks.updateCollectionRecord).toHaveBeenCalledWith(owner, "record-1", {
      status: "owned",
    });
    expect(mocks.insertCollectionRecord).not.toHaveBeenCalled();
    expect(result.existed).toBe(true);
  });

  test("never demotes an owned record when adding a duplicate want", async () => {
    mocks.findCollectionRecordByRelease.mockResolvedValue(
      record({ status: "owned" }),
    );

    const result = await addCollectionRecord(owner, {
      discogsReleaseId: 123,
      status: "wanted",
    });

    expect(mocks.updateCollectionRecord).not.toHaveBeenCalled();
    expect(mocks.insertCollectionRecord).not.toHaveBeenCalled();
    expect(result.record.status).toBe("owned");
  });

  test("inserts a release resolved from the public catalogue", async () => {
    const result = await addCollectionRecord(owner, {
      discogsReleaseId: 123,
      status: "owned",
      favourite: true,
    });

    expect(mocks.insertCollectionRecord).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({
        discogsReleaseId: 123,
        artist: "Sade",
        title: "Diamond Life",
        discogsMasterId: 456,
        label: "Epic",
        catalogNumber: "EPC 26044",
        imageUrl: "https://img.test/diamond-life.jpg",
        favourite: true,
        status: "owned",
      }),
    );
    expect(result.existed).toBe(false);
  });
});
