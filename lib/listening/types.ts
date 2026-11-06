export const LISTENING_SOURCE_PROVIDERS = [
  "listenbrainz",
  "spotify",
  "youtube",
] as const;

export type ListeningSourceProvider =
  (typeof LISTENING_SOURCE_PROVIDERS)[number];

export const LISTENING_SOURCE_TYPES = [
  "listening_history",
  "playlist",
  "saved_albums",
  "video_links",
  "watch_history",
  "music_library",
] as const;

export type ListeningSourceType = (typeof LISTENING_SOURCE_TYPES)[number];

export type ListeningTrackEvidence = {
  name: string;
  listenCount: number;
  lastListenedAt: string;
  recordingMbids: string[];
};

export type ListeningSourceEvidence =
  | {
      type: "listenbrainz_listens";
      label: "ListenBrainz listens";
      url: null;
      note: null;
    }
  | {
      type: "youtube_link";
      label: "YouTube link";
      url: string;
      note: string | null;
    };

export type ListeningAlbumCandidate = {
  id: string;
  provider: ListeningSourceProvider;
  artist: string;
  album: string;
  normalizedArtist: string;
  normalizedAlbum: string;
  releaseYear: number | null;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  trackEvidence: ListeningTrackEvidence[];
  sourceIdentifiers: {
    releaseMbids: string[];
    releaseGroupMbids: string[];
    artistMbids: string[];
    youtubeVideoIds: string[];
    sourceUrls: string[];
  };
  sourceEvidence: ListeningSourceEvidence[];
  metadataQuality: "complete" | "review";
  reviewReason: string | null;
};

export type ListeningSourceSnapshot = {
  provider: ListeningSourceProvider;
  sourceType: ListeningSourceType;
  sourceAccountId: string;
  windowDays: 30 | 90 | 365 | null;
  evidenceReviewed: number;
  candidates: ListeningAlbumCandidate[];
  importedAt: string;
};

export type ListeningSourceAdapter<RawInput> = {
  provider: ListeningSourceProvider;
  normalize(input: RawInput): ListeningSourceSnapshot;
};

export type CollectionGapState =
  | "owned"
  | "wanted"
  | "missing"
  | "review"
  | "unmatched";

export type CollectionGapCandidate = {
  candidate: ListeningAlbumCandidate;
  state: CollectionGapState;
  match: {
    releaseId: number;
    masterId: number | null;
    confidence: number;
    discogsUrl: string | null;
  } | null;
};
