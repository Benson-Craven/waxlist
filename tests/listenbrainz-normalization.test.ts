import { describe, expect, test } from "vitest";

import {
  LISTENBRAINZ_MAX_ALBUM_CANDIDATES,
  LISTENBRAINZ_MAX_LISTENS,
  normalizeListenBrainzListens,
  type ListenBrainzListen,
} from "@/lib/listening/listenbrainz/normalize";

function listen(input: {
  artist: string;
  release?: string;
  track: string;
  listenedAt: number;
  releaseMbid?: string;
}): ListenBrainzListen {
  return {
    listened_at: input.listenedAt,
    recording_msid: `msid-${input.track}-${input.listenedAt}`,
    track_metadata: {
      artist_name: input.artist,
      release_name: input.release,
      track_name: input.track,
      additional_info: {
        release_mbid: input.releaseMbid,
        recording_mbid: `recording-${input.track}`,
        artist_mbids: [`artist-${input.artist}`],
      },
    },
  };
}

describe("ListenBrainz normalization", () => {
  test("groups album evidence and retains listen, track, time, and source identifiers", () => {
    const result = normalizeListenBrainzListens({
      listens: [
        listen({
          artist: "Portishead",
          release: "Dummy",
          track: "Roads",
          listenedAt: 1_720_000_000,
          releaseMbid: "release-dummy",
        }),
        listen({
          artist: "Portishead",
          release: "Dummy",
          track: "Roads",
          listenedAt: 1_719_000_000,
          releaseMbid: "release-dummy",
        }),
        listen({
          artist: "Portishead",
          release: "Dummy",
          track: "Sour Times",
          listenedAt: 1_718_000_000,
          releaseMbid: "release-dummy",
        }),
      ],
      now: new Date("2024-07-04T00:00:00.000Z"),
      windowDays: 90,
    });

    expect(result.evidenceReviewed).toBe(3);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      provider: "listenbrainz",
      artist: "Portishead",
      album: "Dummy",
      normalizedArtist: "portishead",
      normalizedAlbum: "dummy",
      evidenceCount: 3,
      metadataQuality: "complete",
      sourceIdentifiers: {
        releaseMbids: ["release-dummy"],
        artistMbids: ["artist-Portishead"],
      },
    });
    expect(result.candidates[0]?.trackEvidence).toEqual([
      {
        name: "Roads",
        listenCount: 2,
        lastListenedAt: "2024-07-03T09:46:40.000Z",
        recordingMbids: ["recording-Roads"],
      },
      {
        name: "Sour Times",
        listenCount: 1,
        lastListenedAt: "2024-06-10T06:13:20.000Z",
        recordingMbids: ["recording-Sour Times"],
      },
    ]);
  });

  test("keeps missing release metadata in review instead of classifying a gap", () => {
    const result = normalizeListenBrainzListens({
      listens: [
        listen({
          artist: "Burial",
          track: "Archangel",
          listenedAt: 1_720_000_000,
        }),
      ],
      now: new Date("2024-07-04T00:00:00.000Z"),
      windowDays: 30,
    });

    expect(result.candidates[0]).toMatchObject({
      artist: "Burial",
      album: "",
      metadataQuality: "review",
      reviewReason: "Release metadata is missing.",
    });
  });

  test("returns normalized evidence without retaining the raw provider response", () => {
    const rawListen = {
      ...listen({
        artist: "Massive Attack",
        release: "Mezzanine",
        track: "Teardrop",
        listenedAt: 1_720_000_000,
      }),
      inserted_at: 1_720_000_005,
      user_name: "private-provider-field",
      track_metadata: {
        ...listen({
          artist: "Massive Attack",
          release: "Mezzanine",
          track: "Teardrop",
          listenedAt: 1_720_000_000,
        }).track_metadata,
        mbid_mapping: {
          raw_provider_payload: "must-not-persist",
        },
      },
    } as ListenBrainzListen;
    const result = normalizeListenBrainzListens({
      listens: [rawListen],
      now: new Date("2024-07-04T00:00:00.000Z"),
      windowDays: 30,
      sourceAccountId: "collector",
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("private-provider-field");
    expect(serialized).not.toContain("must-not-persist");
    expect(serialized).not.toContain("inserted_at");
    expect(result.candidates[0]).toMatchObject({
      artist: "Massive Attack",
      album: "Mezzanine",
    });
  });

  test("applies the selected time window before the 500-listen review bound", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    const withinWindow = Math.floor(now.getTime() / 1000) - 60;
    const outsideWindow = Math.floor(now.getTime() / 1000) - 31 * 86_400;
    const listens = Array.from({ length: LISTENBRAINZ_MAX_LISTENS + 25 }, (_, index) =>
      listen({
        artist: `Artist ${index}`,
        release: `Album ${index}`,
        track: `Track ${index}`,
        listenedAt: withinWindow - index,
      }),
    );
    listens.push(
      listen({
        artist: "Old artist",
        release: "Old album",
        track: "Old track",
        listenedAt: outsideWindow,
      }),
    );

    const result = normalizeListenBrainzListens({
      listens,
      now,
      windowDays: 30,
    });

    expect(result.evidenceReviewed).toBe(LISTENBRAINZ_MAX_LISTENS);
    expect(result.candidates).toHaveLength(LISTENBRAINZ_MAX_ALBUM_CANDIDATES);
    expect(result.candidates.some((candidate) => candidate.artist === "Old artist")).toBe(
      false,
    );
  });
});
