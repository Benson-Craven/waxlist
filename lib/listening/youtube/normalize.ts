import { normalizeForDiscogsSearch } from "@/lib/matching/discogs-search-units";
import type {
  ListeningAlbumCandidate,
  ListeningSourceSnapshot,
} from "@/lib/listening/types";

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);
const YOUTU_BE_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

export const YOUTUBE_LINK_MAX_ENTRIES = 25;
export const YOUTUBE_LINK_MAX_NOTE_LENGTH = 500;

export type YouTubeLinkEntryInput = {
  url: string;
  artist?: string;
  album?: string;
  note?: string;
  metadataConfirmed?: boolean;
};

export type YouTubeLinkIssue = {
  index: number;
  input: string;
  code:
    | "malformed_url"
    | "unsupported_protocol"
    | "unsupported_host"
    | "playlist_unsupported"
    | "invalid_video_id";
  message: string;
};

export type ParsedYouTubeVideoUrl =
  | {
      ok: true;
      videoId: string;
      canonicalUrl: string;
    }
  | {
      ok: false;
      code: YouTubeLinkIssue["code"];
      message: string;
    };

function invalid(
  code: YouTubeLinkIssue["code"],
  message: string,
): ParsedYouTubeVideoUrl {
  return { ok: false, code, message };
}

export function parseYouTubeVideoUrl(input: string): ParsedYouTubeVideoUrl {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    return invalid("malformed_url", "Enter a complete YouTube video URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return invalid(
      "unsupported_protocol",
      "YouTube links must use http or https.",
    );
  }

  const host = url.hostname.toLowerCase();

  if (!YOUTUBE_HOSTS.has(host) && !YOUTU_BE_HOSTS.has(host)) {
    return invalid(
      "unsupported_host",
      "Only youtube.com and youtu.be video links are supported.",
    );
  }

  if (
    url.searchParams.has("list") ||
    url.pathname === "/playlist" ||
    url.pathname.startsWith("/playlist/")
  ) {
    return invalid(
      "playlist_unsupported",
      "Playlist import is coming later. Add individual video links.",
    );
  }

  let videoId = "";

  if (YOUTU_BE_HOSTS.has(host)) {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v") ?? "";
  } else if (url.pathname.startsWith("/shorts/")) {
    videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
  }

  if (!YOUTUBE_VIDEO_ID.test(videoId)) {
    return invalid(
      "invalid_video_id",
      "This URL does not contain a valid individual YouTube video ID.",
    );
  }

  return {
    ok: true,
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

type NormalizedEntry = {
  videoId: string;
  canonicalUrl: string;
  artist: string;
  album: string;
  note: string | null;
  metadataConfirmed: boolean;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function mergeEntry(
  current: NormalizedEntry | undefined,
  next: NormalizedEntry,
): NormalizedEntry {
  if (!current) return next;

  const currentIsConfirmed = Boolean(
    current.metadataConfirmed && current.artist && current.album,
  );
  const nextIsConfirmed = Boolean(
    next.metadataConfirmed && next.artist && next.album,
  );

  if (nextIsConfirmed) {
    return {
      ...next,
      note: next.note || current.note,
      metadataConfirmed: true,
    };
  }

  if (currentIsConfirmed) {
    return {
      ...current,
      note: next.note || current.note,
      metadataConfirmed: true,
    };
  }

  return {
    ...current,
    artist: next.artist || current.artist,
    album: next.album || current.album,
    note: next.note || current.note,
    metadataConfirmed: false,
  };
}

function createCandidate(entry: NormalizedEntry): ListeningAlbumCandidate {
  const metadataComplete = Boolean(
    entry.metadataConfirmed && entry.artist && entry.album,
  );

  return {
    id: `youtube:${entry.videoId}`,
    provider: "youtube",
    artist: entry.artist,
    album: entry.album,
    normalizedArtist: normalizeForDiscogsSearch(entry.artist),
    normalizedAlbum: normalizeForDiscogsSearch(entry.album),
    releaseYear: null,
    evidenceCount: 1,
    lastEvidenceAt: null,
    trackEvidence: [],
    sourceIdentifiers: {
      releaseMbids: [],
      releaseGroupMbids: [],
      artistMbids: [],
      youtubeVideoIds: [entry.videoId],
      sourceUrls: [entry.canonicalUrl],
    },
    sourceEvidence: [
      {
        type: "youtube_link",
        label: "YouTube link",
        url: entry.canonicalUrl,
        note: entry.note,
      },
    ],
    metadataQuality: metadataComplete ? "complete" : "review",
    reviewReason: metadataComplete
      ? null
      : entry.artist && entry.album
        ? "Confirm the artist and album before catalogue matching."
        : "Add and confirm the artist and album before catalogue matching.",
  };
}

export function normalizeYouTubeLinkEntries(input: {
  entries: YouTubeLinkEntryInput[];
  now?: Date;
}): {
  snapshot: ListeningSourceSnapshot;
  issues: YouTubeLinkIssue[];
} {
  const issues: YouTubeLinkIssue[] = [];
  const deduplicated = new Map<string, NormalizedEntry>();

  for (const [index, rawEntry] of input.entries
    .slice(0, YOUTUBE_LINK_MAX_ENTRIES)
    .entries()) {
    const rawUrl = cleanText(rawEntry.url, 2_048);
    const parsed = parseYouTubeVideoUrl(rawUrl);

    if (!parsed.ok) {
      issues.push({
        index,
        input: rawUrl,
        code: parsed.code,
        message: parsed.message,
      });
      continue;
    }

    const next: NormalizedEntry = {
      videoId: parsed.videoId,
      canonicalUrl: parsed.canonicalUrl,
      artist: cleanText(rawEntry.artist, 200),
      album: cleanText(rawEntry.album, 300),
      note: cleanText(rawEntry.note, YOUTUBE_LINK_MAX_NOTE_LENGTH) || null,
      metadataConfirmed: rawEntry.metadataConfirmed === true,
    };
    deduplicated.set(
      parsed.videoId,
      mergeEntry(deduplicated.get(parsed.videoId), next),
    );
  }

  const now = input.now ?? new Date();
  const candidates = Array.from(deduplicated.values()).map(createCandidate);

  return {
    snapshot: {
      provider: "youtube",
      sourceType: "video_links",
      sourceAccountId: "youtube-links",
      windowDays: null,
      evidenceReviewed: candidates.length,
      candidates,
      importedAt: now.toISOString(),
    },
    issues,
  };
}
