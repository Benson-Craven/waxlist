import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

import type { ListeningSourceSnapshot } from "@/lib/listening/types";
import type { DiscogsSearchUnit } from "@/lib/matching/discogs-search-units";
import { clearEnv, restoreEnv, snapshotEnv } from "./helpers/env";

const {
  loadLatestListeningSnapshot,
  searchDiscogsCatalogue,
  getSpotifyAuthorizedRequest,
  setNativeCollectionState,
} = vi.hoisted(() => ({
  loadLatestListeningSnapshot: vi.fn(),
  searchDiscogsCatalogue: vi.fn(),
  getSpotifyAuthorizedRequest: vi.fn(),
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

vi.mock("@/lib/listening/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/listening/server")>();
  return {
    ...actual,
    loadLatestListeningSnapshot,
    setNativeCollectionState,
  };
});

vi.mock("@/lib/collection/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/collection/server")>();
  return {
    ...actual,
    listCollectionRecords: vi.fn(async () => []),
  };
});

vi.mock("@/lib/discogs/catalogue-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/discogs/catalogue-client")>();
  return {
    ...actual,
    searchDiscogsCatalogue,
  };
});

vi.mock("@/lib/spotify/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/spotify/api")>();
  return {
    ...actual,
    getSpotifyAuthorizedRequest,
  };
});

import { POST } from "@/app/api/discogs/match/route";
import { POST as markCollectionState } from "@/app/api/listening/gaps/mark/route";

let envSnapshot: ReturnType<typeof snapshotEnv>;

const spotifyUnit: DiscogsSearchUnit = {
  id: "portishead::dummy",
  album: "Dummy",
  artist: "Portishead",
  normalizedAlbum: "dummy",
  normalizedArtist: "portishead",
  query: "Portishead Dummy",
  releaseYear: 1994,
  sourceTrackCount: 2,
  sourceTrackNames: ["Roads", "Sour Times"],
  source: {
    provider: "spotify",
    albumId: "album-1",
    albumUrl: "https://open.spotify.com/album/album-1",
  },
  isCompilation: false,
};

const youtubeSnapshot: ListeningSourceSnapshot = {
  provider: "youtube",
  sourceType: "video_links",
  sourceAccountId: "youtube-links",
  windowDays: null,
  evidenceReviewed: 1,
  importedAt: "2026-07-24T10:00:00.000Z",
  candidates: [
    {
      id: "youtube:dQw4w9WgXcQ",
      provider: "youtube",
      artist: "Rick Astley",
      album: "Whenever You Need Somebody",
      normalizedArtist: "rick astley",
      normalizedAlbum: "whenever you need somebody",
      releaseYear: null,
      evidenceCount: 1,
      lastEvidenceAt: null,
      trackEvidence: [],
      sourceIdentifiers: {
        releaseMbids: [],
        releaseGroupMbids: [],
        artistMbids: [],
        youtubeVideoIds: ["dQw4w9WgXcQ"],
        sourceUrls: [
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        ],
      },
      sourceEvidence: [
        {
          type: "youtube_link",
          label: "YouTube link",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          note: null,
        },
      ],
      metadataQuality: "complete",
      reviewReason: null,
    },
  ],
};

beforeEach(() => {
  envSnapshot = snapshotEnv();
  clearEnv();
  process.env.DISCOGS_TOKEN = "discogs-token";
  process.env.DISCOGS_USER_AGENT = "Waxlist/0.1 +http://localhost:3000";
  process.env.DISCOGS_REQUEST_DELAY_MS = "0";
  process.env.API_CACHE_TTL_SECONDS = "0";
  process.env.NEON_AUTH_BASE_URL = "https://auth.example.test";
  process.env.NEON_AUTH_COOKIE_SECRET =
    "abcdef0123456789abcdef0123456789";
  process.env.WAXLIST_ENABLE_SPOTIFY_IMPORT = "true";

  searchDiscogsCatalogue.mockReset();
  searchDiscogsCatalogue.mockResolvedValue({
    searchUnit: spotifyUnit,
    candidates: [
      {
        id: 123,
        masterId: 456,
        type: "release",
        title: "Portishead - Dummy",
        year: 1994,
        format: ["Vinyl", "LP"],
        country: "UK",
        uri: "/release/123-Portishead-Dummy",
        resourceUrl: "https://api.discogs.com/releases/123",
      },
    ],
    rateLimit: { limit: 60, used: 1, remaining: 59 },
  });
  loadLatestListeningSnapshot.mockReset();
  setNativeCollectionState.mockReset();
  setNativeCollectionState.mockResolvedValue("wanted");
  getSpotifyAuthorizedRequest.mockReset();
  getSpotifyAuthorizedRequest.mockResolvedValue({
    ok: true,
    session: {
      authUserId: "auth-1",
      accessToken: "access-token",
      expiresAt: Date.now() + 60_000,
      tokenType: "Bearer",
    },
  });
});

afterEach(() => {
  restoreEnv(envSnapshot);
});

describe("Discogs match source routing", () => {
  test("preserves Spotify searchUnits compatibility and adds native collection actions", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/discogs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchUnits: [spotifyUnit] }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.matchRun.results[0]).toMatchObject({
      searchUnit: {
        source: {
          provider: "spotify",
        },
      },
      matches: expect.any(Array),
      bestMatch: {
        id: 123,
        uri: "https://www.discogs.com/release/123-Portishead-Dummy",
        markToken: expect.any(String),
      },
      state: "missing",
    });
    expect(getSpotifyAuthorizedRequest).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "auth-1",
    );
  });

  test("routes confirmed YouTube link evidence through native gap matching", async () => {
    loadLatestListeningSnapshot.mockResolvedValue(youtubeSnapshot);
    searchDiscogsCatalogue.mockResolvedValue({
      searchUnit: spotifyUnit,
      candidates: [
        {
          id: 789,
          masterId: 987,
          type: "release",
          title: "Rick Astley - Whenever You Need Somebody",
          year: 1987,
          format: ["Vinyl", "LP"],
          country: "UK",
          uri: "/release/789",
          resourceUrl: "https://api.discogs.com/releases/789",
        },
      ],
      rateLimit: { limit: 60, used: 1, remaining: 59 },
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/discogs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "youtube",
          sourceType: "video_links",
          candidates: youtubeSnapshot.candidates,
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(loadLatestListeningSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      "youtube",
      "video_links",
    );
    expect(payload.matchRun.results[0]).toMatchObject({
      searchUnit: {
        source: {
          provider: "youtube",
          albumUrl:
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      },
      state: "missing",
      bestMatch: {
        id: 789,
        markToken: expect.any(String),
      },
    });
  });

  test("carries confirmed YouTube evidence through matching into a native wanted action", async () => {
    loadLatestListeningSnapshot.mockResolvedValue(youtubeSnapshot);
    searchDiscogsCatalogue.mockResolvedValue({
      searchUnit: spotifyUnit,
      candidates: [
        {
          id: 789,
          masterId: 987,
          type: "release",
          title: "Rick Astley - Whenever You Need Somebody",
          year: 1987,
          format: ["Vinyl", "LP"],
          country: "UK",
          uri: "/release/789",
          resourceUrl: "https://api.discogs.com/releases/789",
        },
      ],
      rateLimit: { limit: 60, used: 1, remaining: 59 },
    });

    const matchResponse = await POST(
      new NextRequest("http://localhost:3000/api/discogs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "youtube",
          sourceType: "video_links",
          candidates: youtubeSnapshot.candidates,
        }),
      }),
    );
    const matchPayload = await matchResponse.json();
    const markToken =
      matchPayload.matchRun.results[0]?.bestMatch?.markToken;

    expect(markToken).toEqual(expect.any(String));

    const markResponse = await markCollectionState(
      new Request("http://localhost:3000/api/listening/gaps/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "wanted", markToken }),
      }),
    );

    expect(markResponse.status).toBe(200);
    expect(setNativeCollectionState).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: expect.objectContaining({ userId: "user-1" }),
        status: "wanted",
        releaseId: 789,
        masterId: 987,
      }),
    );
  });

  test("requires persisted YouTube metadata confirmation", async () => {
    loadLatestListeningSnapshot.mockResolvedValue({
      ...youtubeSnapshot,
      candidates: [
        {
          ...youtubeSnapshot.candidates[0]!,
          metadataQuality: "review",
          reviewReason:
            "Confirm the artist and album before catalogue matching.",
        },
      ],
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/discogs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "youtube",
          sourceType: "video_links",
          candidates: youtubeSnapshot.candidates,
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "youtube_metadata_confirmation_required",
      },
    });
    expect(searchDiscogsCatalogue).not.toHaveBeenCalled();
  });
});
