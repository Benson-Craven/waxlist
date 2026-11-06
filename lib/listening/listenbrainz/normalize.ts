import { normalizeForDiscogsSearch } from "@/lib/matching/discogs-search-units";
import type {
  ListeningAlbumCandidate,
  ListeningSourceSnapshot,
  ListeningTrackEvidence,
} from "@/lib/listening/types";

export const LISTENBRAINZ_MAX_LISTENS = 500;
export const LISTENBRAINZ_MAX_ALBUM_CANDIDATES = 100;

export type ListenBrainzListen = {
  listened_at?: number;
  recording_msid?: string;
  track_metadata?: {
    artist_name?: string;
    release_name?: string;
    track_name?: string;
    additional_info?: {
      artist_mbids?: string[];
      recording_mbid?: string;
      release_mbid?: string;
      release_group_mbid?: string;
      release_year?: number | string;
    };
  };
};

type MutableTrackEvidence = {
  name: string;
  listenCount: number;
  lastListenedAt: string;
  recordingMbids: Set<string>;
};

type MutableCandidate = Omit<
  ListeningAlbumCandidate,
  "trackEvidence" | "sourceIdentifiers" | "sourceEvidence"
> & {
  trackEvidence: Map<string, MutableTrackEvidence>;
  sourceIdentifiers: {
    releaseMbids: Set<string>;
    releaseGroupMbids: Set<string>;
    artistMbids: Set<string>;
    youtubeVideoIds: Set<string>;
    sourceUrls: Set<string>;
  };
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readYear(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 1000 && value <= 9999 ? value : null;
  }

  if (typeof value === "string") {
    const year = Number.parseInt(value.slice(0, 4), 10);
    return Number.isInteger(year) && year >= 1000 && year <= 9999
      ? year
      : null;
  }

  return null;
}

function addString(set: Set<string>, value: unknown) {
  const normalized = cleanText(value);

  if (normalized) {
    set.add(normalized);
  }
}

function getCandidateKey(input: {
  normalizedArtist: string;
  normalizedAlbum: string;
  track: string;
  recordingMsid: string;
}) {
  if (input.normalizedArtist && input.normalizedAlbum) {
    return `${input.normalizedArtist}::${input.normalizedAlbum}`;
  }

  const trackKey = normalizeForDiscogsSearch(input.track);
  return [
    input.normalizedArtist || "unknown-artist",
    "review",
    trackKey || input.recordingMsid || "unknown-track",
  ].join("::");
}

function finalizeCandidate(candidate: MutableCandidate): ListeningAlbumCandidate {
  const trackEvidence = Array.from(candidate.trackEvidence.values())
    .map(
      (track): ListeningTrackEvidence => ({
        name: track.name,
        listenCount: track.listenCount,
        lastListenedAt: track.lastListenedAt,
        recordingMbids: Array.from(track.recordingMbids).sort(),
      }),
    )
    .sort((first, second) => {
      if (second.listenCount !== first.listenCount) {
        return second.listenCount - first.listenCount;
      }

      return first.name.localeCompare(second.name);
    });

  return {
    ...candidate,
    trackEvidence,
    sourceIdentifiers: {
      releaseMbids: Array.from(candidate.sourceIdentifiers.releaseMbids).sort(),
      releaseGroupMbids: Array.from(
        candidate.sourceIdentifiers.releaseGroupMbids,
      ).sort(),
      artistMbids: Array.from(candidate.sourceIdentifiers.artistMbids).sort(),
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
  };
}

export function normalizeListenBrainzListens(input: {
  listens: ListenBrainzListen[];
  now?: Date;
  windowDays: 30 | 90 | 365;
  sourceAccountId?: string;
}): ListeningSourceSnapshot {
  const now = input.now ?? new Date();
  const minimumTimestamp =
    Math.floor(now.getTime() / 1000) - input.windowDays * 86_400;
  const boundedListens = input.listens
    .filter(
      (listen) =>
        typeof listen.listened_at === "number" &&
        listen.listened_at > minimumTimestamp &&
        listen.listened_at <= Math.floor(now.getTime() / 1000),
    )
    .sort((first, second) => (second.listened_at ?? 0) - (first.listened_at ?? 0))
    .slice(0, LISTENBRAINZ_MAX_LISTENS);
  const candidates = new Map<string, MutableCandidate>();

  for (const listen of boundedListens) {
    const metadata = listen.track_metadata;
    const listenedAt = listen.listened_at;

    if (!metadata || typeof listenedAt !== "number") {
      continue;
    }

    const artist = cleanText(metadata.artist_name);
    const album = cleanText(metadata.release_name);
    const track = cleanText(metadata.track_name);

    if (!track) {
      continue;
    }

    const normalizedArtist = normalizeForDiscogsSearch(artist);
    const normalizedAlbum = normalizeForDiscogsSearch(album);
    const key = getCandidateKey({
      normalizedArtist,
      normalizedAlbum,
      track,
      recordingMsid: cleanText(listen.recording_msid),
    });
    const lastListenedAt = new Date(listenedAt * 1000).toISOString();
    let candidate = candidates.get(key);

    if (!candidate) {
      const reviewReason = !artist
        ? "Artist metadata is missing."
        : !album
          ? "Release metadata is missing."
          : null;
      candidate = {
        id: `listenbrainz:${key}`,
        provider: "listenbrainz",
        artist,
        album,
        normalizedArtist,
        normalizedAlbum,
        releaseYear: readYear(metadata.additional_info?.release_year),
        evidenceCount: 0,
        lastEvidenceAt: lastListenedAt,
        trackEvidence: new Map(),
        sourceIdentifiers: {
          releaseMbids: new Set(),
          releaseGroupMbids: new Set(),
          artistMbids: new Set(),
          youtubeVideoIds: new Set(),
          sourceUrls: new Set(),
        },
        metadataQuality: reviewReason ? "review" : "complete",
        reviewReason,
      };
      candidates.set(key, candidate);
    }

    candidate.evidenceCount += 1;
    if (
      !candidate.lastEvidenceAt ||
      lastListenedAt > candidate.lastEvidenceAt
    ) {
      candidate.lastEvidenceAt = lastListenedAt;
    }

    const trackKey = normalizeForDiscogsSearch(track) || track;
    const existingTrack = candidate.trackEvidence.get(trackKey);

    if (existingTrack) {
      existingTrack.listenCount += 1;
      if (lastListenedAt > existingTrack.lastListenedAt) {
        existingTrack.lastListenedAt = lastListenedAt;
      }
      addString(
        existingTrack.recordingMbids,
        metadata.additional_info?.recording_mbid,
      );
    } else {
      const recordingMbids = new Set<string>();
      addString(recordingMbids, metadata.additional_info?.recording_mbid);
      candidate.trackEvidence.set(trackKey, {
        name: track,
        listenCount: 1,
        lastListenedAt,
        recordingMbids,
      });
    }

    addString(
      candidate.sourceIdentifiers.releaseMbids,
      metadata.additional_info?.release_mbid,
    );
    addString(
      candidate.sourceIdentifiers.releaseGroupMbids,
      metadata.additional_info?.release_group_mbid,
    );
    for (const artistMbid of metadata.additional_info?.artist_mbids ?? []) {
      addString(candidate.sourceIdentifiers.artistMbids, artistMbid);
    }
  }

  return {
    provider: "listenbrainz",
    sourceType: "listening_history",
    sourceAccountId: input.sourceAccountId ?? "",
    windowDays: input.windowDays,
    evidenceReviewed: boundedListens.length,
    candidates: Array.from(candidates.values())
      .map(finalizeCandidate)
      .sort((first, second) => {
        if (second.evidenceCount !== first.evidenceCount) {
          return second.evidenceCount - first.evidenceCount;
        }

        return (second.lastEvidenceAt ?? "").localeCompare(
          first.lastEvidenceAt ?? "",
        );
      })
      .slice(0, LISTENBRAINZ_MAX_ALBUM_CANDIDATES),
    importedAt: now.toISOString(),
  };
}
