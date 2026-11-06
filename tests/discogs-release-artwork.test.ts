import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiCacheEnv: vi.fn(),
  getDiscogsEnv: vi.fn(),
  getDiscogsReleaseDetail: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  getApiCacheEnv: mocks.getApiCacheEnv,
  getDiscogsEnv: mocks.getDiscogsEnv,
}));

vi.mock("@/lib/discogs/client", () => ({
  getDiscogsReleaseDetail: mocks.getDiscogsReleaseDetail,
}));

import { loadDiscogsReleaseArtwork } from "@/lib/discogs/release-artwork";

describe("discogs release artwork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDiscogsEnv.mockReturnValue({
      ok: true,
      token: "token",
      userAgent: "Waxlist/0.1 +http://127.0.0.1:3000",
      requestDelayMs: 1100,
    });
    mocks.getApiCacheEnv.mockReturnValue({ ok: true, ttlMs: 900_000 });
    mocks.getDiscogsReleaseDetail.mockResolvedValue({
      imageUrl: "https://i.discogs.com/cover.jpg",
    });
  });

  test("loads the stored release artwork through the shared cache", async () => {
    await expect(loadDiscogsReleaseArtwork(123)).resolves.toBe(
      "https://i.discogs.com/cover.jpg",
    );
    expect(mocks.getDiscogsReleaseDetail).toHaveBeenCalledWith({
      releaseId: 123,
      token: "token",
      userAgent: "Waxlist/0.1 +http://127.0.0.1:3000",
      cacheTtlMs: 900_000,
      signal: expect.any(AbortSignal),
    });
  });

  test("does not call Discogs for an invalid release id", async () => {
    await expect(loadDiscogsReleaseArtwork(0)).resolves.toBeNull();
    expect(mocks.getDiscogsReleaseDetail).not.toHaveBeenCalled();
  });

  test("returns null when the Discogs environment is incomplete", async () => {
    mocks.getDiscogsEnv.mockReturnValue({
      ok: false,
      missing: ["DISCOGS_TOKEN"],
      message: "Missing required Discogs environment variables.",
    });

    await expect(loadDiscogsReleaseArtwork(123)).resolves.toBeNull();
    expect(mocks.getDiscogsReleaseDetail).not.toHaveBeenCalled();
  });

  test("keeps the collection write alive when the provider fails", async () => {
    mocks.getDiscogsReleaseDetail.mockRejectedValue(new Error("rate limited"));

    await expect(loadDiscogsReleaseArtwork(123)).resolves.toBeNull();
  });

  test("returns null when the release has no artwork", async () => {
    mocks.getDiscogsReleaseDetail.mockResolvedValue({ imageUrl: null });

    await expect(loadDiscogsReleaseArtwork(123)).resolves.toBeNull();
  });

  test("still loads artwork when caching is disabled", async () => {
    mocks.getApiCacheEnv.mockReturnValue({ ok: false, missing: [], message: "no db" });

    await expect(loadDiscogsReleaseArtwork(123)).resolves.toBe(
      "https://i.discogs.com/cover.jpg",
    );
    expect(mocks.getDiscogsReleaseDetail).toHaveBeenCalledWith(
      expect.objectContaining({ cacheTtlMs: 0 }),
    );
  });
});
