import { beforeEach, describe, expect, test, vi } from "vitest";

import { createCollectionMarkToken } from "@/lib/listening/mark-token";

const mocks = vi.hoisted(() => ({
  loadDiscogsReleaseArtwork: vi.fn(),
  setNativeCollectionState: vi.fn(),
}));

vi.mock("@/lib/auth/owner", () => ({
  resolveAuthenticatedOwner: vi.fn(async () => ({
    ok: true,
    owner: {
      type: "user",
      userId: "user-1",
      authUserId: "auth-1",
      sessionIdHash: null,
    },
    profile: {
      id: "auth-1",
      displayName: "Test user",
      email: "invited@example.com",
      imageUrl: null,
    },
  })),
}));

vi.mock("@/lib/config", () => ({
  getNeonAuthEnv: vi.fn(() => ({
    ok: true,
    baseUrl: "https://auth.example.test",
    cookieSecret: "0123456789abcdef0123456789abcdef",
  })),
}));

vi.mock("@/lib/discogs/release-artwork", () => ({
  loadDiscogsReleaseArtwork: mocks.loadDiscogsReleaseArtwork,
}));

vi.mock("@/lib/listening/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/listening/server")>();

  return {
    ...actual,
    setNativeCollectionState: mocks.setNativeCollectionState,
  };
});

import { POST } from "@/app/api/listening/gaps/mark/route";

const secret = "0123456789abcdef0123456789abcdef";

describe("native collection-gap state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadDiscogsReleaseArtwork.mockResolvedValue(
      "https://i.discogs.com/cover.jpg",
    );
    mocks.setNativeCollectionState.mockResolvedValue("wanted");
  });

  test("persists a server-verified native wanted action", async () => {
    const markToken = createCollectionMarkToken({
      secret,
      payload: {
        userId: "user-1",
        releaseId: 123,
        masterId: 456,
        artist: "Rick Astley",
        title: "Whenever You Need Somebody",
        format: ["Vinyl", "LP"],
        year: 1987,
        confidence: 91,
        expiresAt: Date.now() + 60_000,
      },
    });
    const response = await POST(
      new Request("http://localhost:3000/api/listening/gaps/mark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "wanted", markToken }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ state: "wanted" });
    expect(mocks.loadDiscogsReleaseArtwork).toHaveBeenCalledWith(123);
    expect(mocks.setNativeCollectionState).toHaveBeenCalledWith({
      owner: expect.objectContaining({ userId: "user-1" }),
      status: "wanted",
      releaseId: 123,
      masterId: 456,
      artist: "Rick Astley",
      title: "Whenever You Need Somebody",
      format: ["Vinyl", "LP"],
      year: 1987,
      imageUrl: "https://i.discogs.com/cover.jpg",
    });
  });

  test("persists the state when the cover lookup fails", async () => {
    mocks.loadDiscogsReleaseArtwork.mockResolvedValue(null);
    const markToken = createCollectionMarkToken({
      secret,
      payload: {
        userId: "user-1",
        releaseId: 123,
        masterId: 456,
        artist: "Rick Astley",
        title: "Whenever You Need Somebody",
        format: ["Vinyl", "LP"],
        year: 1987,
        confidence: 91,
        expiresAt: Date.now() + 60_000,
      },
    });
    const response = await POST(
      new Request("http://localhost:3000/api/listening/gaps/mark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "owned", markToken }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ state: "owned" });
    expect(mocks.setNativeCollectionState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "owned",
        imageUrl: null,
      }),
    );
  });
});
