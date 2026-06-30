import { describe, expect, test, vi } from "vitest";
import {
  buildPlaylistImportSummary,
  normalizeSpotifyPlaylists,
} from "@/lib/spotify/workspace";
import type { SpotifySession } from "@/lib/spotify/oauth";

const session: SpotifySession = {
  accessToken: "access-token",
  expiresAt: Date.now() + 3600_000,
  tokenType: "Bearer",
};

describe("Spotify normalization", () => {
  test("normalizes playlist cards using inline track totals without extra fetches", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const playlists = await normalizeSpotifyPlaylists(
      {
        total: 1,
        items: [
          {
            id: "playlist-1",
            name: "Heavy Rotation",
            collaborative: false,
            public: false,
            snapshot_id: "snapshot-1",
            uri: "spotify:playlist:playlist-1",
            external_urls: {
              spotify: "https://open.spotify.com/playlist/playlist-1",
            },
            images: [{ url: "https://image.example/playlist.jpg" }],
            owner: { display_name: "Benson" },
            tracks: { total: 42 },
          },
        ],
      },
      session,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(playlists).toEqual([
      {
        id: "playlist-1",
        name: "Heavy Rotation",
        description: null,
        imageUrl: "https://image.example/playlist.jpg",
        trackCount: 42,
        ownerName: "Benson",
        isPublic: false,
        isCollaborative: false,
        uri: "spotify:playlist:playlist-1",
        externalUrl: "https://open.spotify.com/playlist/playlist-1",
        snapshotId: "snapshot-1",
      },
    ]);
  });

  test("groups playlist tracks by primary artist and album, removes duplicate track signals, and prepares Discogs search units", () => {
    const summary = buildPlaylistImportSummary({
      sourceType: "playlist",
      playlistId: "playlist-1",
      playlistName: "Heavy Rotation",
      playlistTrackTotal: 4,
      artistImages: new Map([["artist-1", "https://image.example/artist.jpg"]]),
      rawTracks: [
        {
          track: {
            id: "track-1",
            name: "Intro",
            type: "track",
            artists: [{ id: "artist-1", name: "The Records" }],
            external_urls: { spotify: "https://open.spotify.com/track/track-1" },
            album: {
              id: "album-1",
              name: "Wax Works (Deluxe)",
              album_type: "album",
              release_date: "2022-04-01",
              external_urls: { spotify: "https://open.spotify.com/album/album-1" },
              images: [{ url: "https://image.example/album.jpg" }],
              artists: [{ id: "artist-1", name: "The Records" }],
            },
          },
        },
        {
          track: {
            id: "track-2",
            name: "Single",
            type: "track",
            artists: [{ id: "artist-1", name: "The Records" }],
            album: {
              id: "album-1",
              name: "Wax Works (Deluxe)",
              album_type: "album",
              release_date: "2022",
              artists: [{ id: "artist-1", name: "The Records" }],
            },
          },
        },
        {
          track: {
            id: "track-2",
            name: "Single",
            type: "track",
            artists: [{ id: "artist-1", name: "The Records" }],
            album: {
              id: "album-1",
              name: "Wax Works (Deluxe)",
              album_type: "album",
              artists: [{ id: "artist-1", name: "The Records" }],
            },
          },
        },
        {
          track: {
            id: "local-1",
            name: "Local File",
            type: "track",
            is_local: true,
            album: { name: "Unknown Album" },
          },
        },
      ],
    });

    expect(summary.sourceTracksFound).toBe(2);
    expect(summary.skippedTracks).toBe(1);
    expect(summary.duplicateTracksRemoved).toBe(1);
    expect(summary.albumCandidates).toHaveLength(1);
    expect(summary.albumCandidates[0]).toMatchObject({
      album: "Wax Works (Deluxe)",
      primaryArtist: "The Records",
      artistImageUrl: "https://image.example/artist.jpg",
      sourceTrackCount: 2,
      duplicateTracksRemoved: 1,
    });
    expect(summary.discogsSearchUnits[0]).toMatchObject({
      album: "Wax Works (Deluxe)",
      artist: "The Records",
      normalizedAlbum: "wax works",
      normalizedArtist: "the records",
      sourceTrackCount: 2,
      releaseYear: 2022,
    });
  });
});
