import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  replaceListeningSnapshot,
  loadLatestListeningSnapshot,
} = vi.hoisted(() => ({
  replaceListeningSnapshot: vi.fn(),
  loadLatestListeningSnapshot: vi.fn(),
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

vi.mock("@/lib/listening/server", () => ({
  loadLatestListeningSnapshot,
  replaceListeningSnapshot,
}));

import {
  GET,
  POST,
} from "@/app/api/listening/youtube/links/route";

describe("YouTube link intake route", () => {
  beforeEach(() => {
    replaceListeningSnapshot.mockReset();
    loadLatestListeningSnapshot.mockReset();
  });

  test("normalizes and persists video links without making an outbound request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    replaceListeningSnapshot.mockImplementation(async (_owner, snapshot) => snapshot);

    const response = await POST(
      new Request("http://localhost:3000/api/listening/youtube/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              url: "https://youtu.be/dQw4w9WgXcQ",
              artist: "Rick Astley",
              album: "Whenever You Need Somebody",
              metadataConfirmed: true,
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      snapshot: {
        provider: "youtube",
        sourceType: "video_links",
        candidates: [
          {
            metadataQuality: "complete",
            sourceEvidence: [
              {
                label: "YouTube link",
              },
            ],
          },
        ],
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(replaceListeningSnapshot).toHaveBeenCalledOnce();
  });

  test("returns playlist-specific guidance and does not persist partial input", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/listening/youtube/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              url: "https://www.youtube.com/playlist?list=PL123",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_youtube_links",
        message: "Playlist import is coming later. Add individual video links.",
        issues: [
          {
            code: "playlist_unsupported",
          },
        ],
      },
    });
    expect(replaceListeningSnapshot).not.toHaveBeenCalled();
  });

  test("loads only the video-links snapshot", async () => {
    loadLatestListeningSnapshot.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(loadLatestListeningSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      "youtube",
      "video_links",
    );
  });
});
