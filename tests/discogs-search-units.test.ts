import { describe, expect, test } from "vitest";

import { createDiscogsSearchUnitFromListeningCandidate } from "@/lib/matching/discogs-search-units";

describe("provider-neutral Discogs search units", () => {
  test("carries ListenBrainz evidence without Spotify-specific fields", () => {
    const unit = createDiscogsSearchUnitFromListeningCandidate({
      id: "listenbrainz:portishead::dummy",
      provider: "listenbrainz",
      artist: "Portishead",
      album: "Dummy",
      normalizedArtist: "portishead",
      normalizedAlbum: "dummy",
      releaseYear: 1994,
      evidenceCount: 7,
      lastEvidenceAt: "2026-07-23T12:00:00.000Z",
      trackEvidence: [
        {
          name: "Roads",
          listenCount: 4,
          lastListenedAt: "2026-07-23T12:00:00.000Z",
          recordingMbids: ["recording-roads"],
        },
      ],
      sourceIdentifiers: {
        releaseMbids: ["release-dummy"],
        releaseGroupMbids: ["release-group-dummy"],
        artistMbids: ["artist-portishead"],
        youtubeVideoIds: [],
        sourceUrls: [],
      },
      sourceEvidence: [
        {
          type: "listenbrainz_listens",
          label: "ListenBrainz listens",
          url: null,
          note: null,
        },
      ],
      metadataQuality: "complete",
      reviewReason: null,
    });

    expect(unit).toMatchObject({
      album: "Dummy",
      artist: "Portishead",
      sourceTrackCount: 7,
      sourceTrackNames: ["Roads"],
      source: {
        provider: "listenbrainz",
        albumId: "release-group-dummy",
        albumUrl: null,
      },
    });
    expect(unit).not.toHaveProperty("spotifyAlbumId");
    expect(unit).not.toHaveProperty("spotifyAlbumUrl");
  });
});
