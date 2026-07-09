"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Disc3,
  ExternalLink,
  Loader2,
  Music2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Status,
  StatusIndicator,
  StatusLabel,
} from "@/components/ui/status";
import { SPOTIFY_AUTH_START_PATH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  SpotifyPlaylistImportSummary,
  SpotifyPlaylist,
  SpotifyProfile,
  SpotifySavedAlbum,
  SpotifyWorkspaceSnapshot,
} from "@/lib/spotify/workspace";
import type {
  DiscogsRateLimit,
  StructuredDiscogsError,
} from "@/lib/discogs/client";
import type {
  DiscogsMatchResult,
  RankedDiscogsMatch,
} from "@/lib/matching/match-discogs-release";
import {
  createPriceBreakdownFromMarketplaceStats,
  normalizeWishlistBuyingControls,
  normalizeWishlistRecord,
  type WishlistRecord,
} from "@/lib/wishlist/record";

type EndpointErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    missing?: string[];
  };
};
type SpotifyProfilePayload = { profile: SpotifyProfile };
type SpotifyPlaylistPayload = {
  playlists: SpotifyPlaylist[];
  paging: {
    limit: number;
    offset: number;
    total: number;
    next: string | null;
    previous: string | null;
  };
};
type SpotifyImportSummaryPayload = {
  importSummary: SpotifyPlaylistImportSummary;
};
type SpotifyAlbumPayload = {
  albums: SpotifySavedAlbum[];
  paging: SpotifyPlaylistPayload["paging"];
};
type DiscogsMatchPayload = {
  matchRun: {
    searchedUnits: number;
    skippedUnits: number;
    maxSearchUnits: number;
    requestDelayMs: number;
    stoppedForRateLimit: boolean;
    rateLimit: DiscogsRateLimit;
    results: DiscogsMatchResult[];
    failures: Array<{
      searchUnit: DiscogsMatchResult["searchUnit"];
      error: StructuredDiscogsError;
    }>;
  };
};
type VinylCrateRecord = {
  result: DiscogsMatchResult;
  match: NonNullable<DiscogsMatchResult["bestMatch"]>;
};
type DiscogsReviewItem = {
  result: DiscogsMatchResult;
  match: RankedDiscogsMatch | null;
  status: "possible" | "weak" | "none";
  reason: string;
};
type WishlistPayload = { records: WishlistRecord[] };
type WishlistSavePayload = { record: WishlistRecord };
type CrateSortKey =
  | "recommendation"
  | "confidence"
  | "availability"
  | "price"
  | "artist"
  | "album";

const PLAYLIST_PAGE_LIMIT = 12;
const ALBUM_PAGE_LIMIT = 12;
const WISHLIST_STORAGE_KEY = "waxlist:wishlist:v1";
const WISHLIST_CHANGED_EVENT = "waxlist:wishlist-changed";
const ALBUM_SEARCH_STORAGE_KEY = "waxlist:saved-album-search:v1";
const IMPORT_DIALOG_ANIMATION_MS = 220;

class EndpointRequestError extends Error {
  code: string | null;
  missing: string[];
  status: number;

  constructor(input: {
    message: string;
    status: number;
    code?: string;
    missing?: string[];
  }) {
    super(input.message);
    this.name = "EndpointRequestError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.missing = input.missing ?? [];
  }
}

function useHasMounted() {
  return useSyncExternalStore(
    (onStoreChange) => {
      queueMicrotask(onStoreChange);

      return () => {};
    },
    () => true,
    () => false,
  );
}

type LoadState =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      profile: SpotifyProfile;
      playlists: SpotifyPlaylist[];
      playlistPaging: SpotifyPlaylistPayload["paging"];
      isPlaylistPageLoading: boolean;
      playlistPageError: string | null;
    }
  | {
      status: "error";
      message: string;
    };

async function fetchJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
  });
  const rawBody = await response.text();

  let payload = {} as T & EndpointErrorPayload;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as T & EndpointErrorPayload;
    } catch {
      payload = {} as T & EndpointErrorPayload;
    }
  }

  if (!response.ok) {
    throw new EndpointRequestError({
      message: payload.error?.message ?? "Spotify data could not be loaded.",
      status: response.status,
      code: payload.error?.code,
      missing: payload.error?.missing,
    });
  }

  return payload;
}

function isSpotifyReconnectMessage(message: string) {
  return (
    message.includes("Connect Spotify again") ||
    message.includes("Reconnect Spotify")
  );
}

function getDiscogsConfigurationMessage(error: EndpointRequestError) {
  const missingLabel =
    error.missing.length > 0 ? ` Missing: ${error.missing.join(", ")}.` : "";

  return `${error.message}${missingLabel} Add the missing Discogs values to .env.local, restart the dev server, then retry matching.`;
}

function getCrateRecordId(record: VinylCrateRecord) {
  return `${record.result.searchUnit.id}::${record.match.id}`;
}

function getCrateRecords(payload: DiscogsMatchPayload) {
  return payload.matchRun.results
    .map((result) =>
      result.bestMatch
        ? {
            result,
            match: result.bestMatch,
          }
        : null,
    )
    .filter((record): record is VinylCrateRecord => Boolean(record));
}

function getDiscogsReviewItems(payload: DiscogsMatchPayload) {
  return payload.matchRun.results
    .filter((result) => !result.bestMatch)
    .map((result) => {
      const reviewMatch = result.matches[0] ?? null;

      if (!reviewMatch) {
        return {
          result,
          match: null,
          status: "none" as const,
          reason:
            "Discogs did not return a vinyl candidate for this album search.",
        };
      }

      if (reviewMatch.confidence >= 60) {
        return {
          result,
          match: reviewMatch,
          status: "possible" as const,
          reason:
            "Best candidate is a possible match, but confidence is below the strong recommendation threshold.",
        };
      }

      return {
        result,
        match: reviewMatch,
        status: "weak" as const,
        reason:
          "Best candidate is weak and needs manual title, artist, and format review before treating it as a match.",
      };
    });
}

function formatRetryDelay(seconds: number) {
  if (seconds < 60) {
    return `${seconds.toLocaleString()} seconds`;
  }

  const minutes = Math.ceil(seconds / 60);

  return `${minutes.toLocaleString()} ${minutes === 1 ? "minute" : "minutes"}`;
}

function getRateLimitLabel(rateLimit: DiscogsRateLimit) {
  if (
    rateLimit.limit === null &&
    rateLimit.used === null &&
    rateLimit.remaining === null
  ) {
    return "Discogs rate-limit status was not returned.";
  }

  const parts = [
    rateLimit.remaining !== null
      ? `${rateLimit.remaining.toLocaleString()} remaining`
      : null,
    rateLimit.used !== null ? `${rateLimit.used.toLocaleString()} used` : null,
    rateLimit.limit !== null ? `${rateLimit.limit.toLocaleString()} limit` : null,
  ].filter((part): part is string => Boolean(part));

  return `Discogs rate limit: ${parts.join(" / ")}.`;
}

function getDiscogsArtistFromTitle(title: string, fallback: string) {
  const [artistPart] = title.split(/\s+-\s+/, 1);

  return artistPart?.trim() || fallback;
}

function createWishlistRecord(record: VinylCrateRecord): WishlistRecord {
  return {
    id: getCrateRecordId(record),
    savedAt: new Date().toISOString(),
    spotifyAlbum: record.result.searchUnit.album,
    spotifyArtist: record.result.searchUnit.artist,
    spotifyAlbumId: record.result.searchUnit.spotifyAlbumId,
    spotifyAlbumUrl: record.result.searchUnit.spotifyAlbumUrl,
    discogsReleaseId: record.match.id,
    discogsTitle: record.match.title,
    discogsArtist: getDiscogsArtistFromTitle(
      record.match.title,
      record.result.searchUnit.artist,
    ),
    discogsUri: record.match.uri,
    thumb: record.match.thumb,
    format: record.match.format,
    year: record.match.year,
    country: record.match.country,
    recommendationScore: record.match.recommendationScore,
    confidence: record.match.confidence,
    availabilityLabel: record.match.availability.label,
    priceLabel: record.match.priceHint.label,
    sourceTrackCount: record.result.searchUnit.sourceTrackCount,
    buyingControls: normalizeWishlistBuyingControls(null),
    priceBreakdown: createPriceBreakdownFromMarketplaceStats({
      value: record.match.priceHint.value,
      currency: record.match.priceHint.currency,
      label: record.match.priceHint.label,
      checkedAt: record.match.priceHint.checkedAt,
      freshForSeconds: record.match.priceHint.freshForSeconds,
    }),
  };
}

function readWishlistRecords() {
  if (typeof window === "undefined") {
    return [] satisfies WishlistRecord[];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(WISHLIST_STORAGE_KEY) ?? "[]",
    ) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeWishlistRecord)
      .filter((record): record is WishlistRecord => Boolean(record));
  } catch {
    return [];
  }
}

function writeWishlistRecords(records: WishlistRecord[]) {
  window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(WISHLIST_CHANGED_EVENT));
}

function mergeWishlistRecords(records: WishlistRecord[]) {
  const recordsById = new Map<string, WishlistRecord>();

  for (const record of records) {
    if (!recordsById.has(record.id)) {
      recordsById.set(record.id, record);
    }
  }

  return [...recordsById.values()].sort(
    (first, second) => Date.parse(second.savedAt) - Date.parse(first.savedAt),
  );
}

async function loadWishlistRecordsFromApi() {
  const payload = await fetchJson<WishlistPayload>("/api/wishlist");

  return payload.records
    .map(normalizeWishlistRecord)
    .filter((record): record is WishlistRecord => Boolean(record));
}

async function saveWishlistRecordToApi(record: WishlistRecord) {
  const payload = await fetchJson<WishlistSavePayload>("/api/wishlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ record }),
  });

  return normalizeWishlistRecord(payload.record) ?? record;
}

async function removeWishlistRecordFromApi(recordId: string) {
  await fetchJson<{ ok: boolean }>("/api/wishlist", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recordId }),
  });
}

async function syncWishlistRecordsFromApi() {
  const apiRecords = await loadWishlistRecordsFromApi();
  const localRecords = readWishlistRecords();
  const apiRecordIds = new Set(apiRecords.map((record) => record.id));
  const localOnlyRecords = localRecords.filter(
    (record) => !apiRecordIds.has(record.id),
  );
  const migratedRecords = await Promise.all(
    localOnlyRecords.map((record) => saveWishlistRecordToApi(record)),
  );
  const nextRecords = mergeWishlistRecords([...migratedRecords, ...apiRecords]);

  writeWishlistRecords(nextRecords);

  return nextRecords;
}

function readBrowserStorageValue(key: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(key) ?? "";
}

function loadWishlistIds() {
  return new Set(readWishlistRecords().map((record) => record.id));
}

function useWishlistRecords() {
  const [records, setRecords] = useState<WishlistRecord[]>(() =>
    readWishlistRecords(),
  );

  useEffect(() => {
    let isActive = true;

    function syncWishlistRecords() {
      setRecords(readWishlistRecords());
    }

    syncWishlistRecords();
    syncWishlistRecordsFromApi()
      .then((nextRecords) => {
        if (isActive) {
          setRecords(nextRecords);
        }
      })
      .catch(() => {
        if (isActive) {
          setRecords(readWishlistRecords());
        }
      });
    window.addEventListener(WISHLIST_CHANGED_EVENT, syncWishlistRecords);
    window.addEventListener("storage", syncWishlistRecords);

    return () => {
      isActive = false;
      window.removeEventListener(WISHLIST_CHANGED_EVENT, syncWishlistRecords);
      window.removeEventListener("storage", syncWishlistRecords);
    };
  }, []);

  const removeRecord = useCallback((recordId: string) => {
    const nextRecords = readWishlistRecords().filter(
      (record) => record.id !== recordId,
    );

    writeWishlistRecords(nextRecords);
    setRecords(nextRecords);
    removeWishlistRecordFromApi(recordId).catch(() => {
      setRecords(readWishlistRecords());
    });
  }, []);

  return { records, removeRecord };
}

function sortCrateRecords(records: VinylCrateRecord[], sortKey: CrateSortKey) {
  return [...records].sort((first, second) => {
    if (sortKey === "confidence") {
      return second.match.confidence - first.match.confidence;
    }

    if (sortKey === "availability") {
      return (
        (second.match.availability.numForSale ?? -1) -
        (first.match.availability.numForSale ?? -1)
      );
    }

    if (sortKey === "price") {
      return (
        (first.match.priceHint.value ?? Number.POSITIVE_INFINITY) -
        (second.match.priceHint.value ?? Number.POSITIVE_INFINITY)
      );
    }

    if (sortKey === "artist") {
      return first.result.searchUnit.artist.localeCompare(
        second.result.searchUnit.artist,
      );
    }

    if (sortKey === "album") {
      return first.result.searchUnit.album.localeCompare(
        second.result.searchUnit.album,
      );
    }

    return second.match.recommendationScore - first.match.recommendationScore;
  });
}

function pluralizeTracks(trackCount: number) {
  return `${trackCount.toLocaleString()} ${trackCount === 1 ? "track" : "tracks"}`;
}

function getProfileName(profile: SpotifyProfile) {
  return profile.displayName ?? profile.id;
}

function getVisibilityLabel(playlist: SpotifyPlaylist) {
  if (playlist.isCollaborative) {
    return "Collaborative";
  }

  if (playlist.isPublic === true) {
    return "Public";
  }

  if (playlist.isPublic === false) {
    return "Private";
  }

  return "Playlist";
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function LoadingPanel({ showProfilePanel }: { showProfilePanel: boolean }) {
  return (
    <div
      className={cn(
        "grid gap-6",
        showProfilePanel ? "lg:grid-cols-[0.85fr_1.4fr]" : "lg:grid-cols-1",
      )}
    >
      {showProfilePanel ? (
        <div className="rounded-3xl border border-white/10 bg-black/25 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-white/10">
              <Loader2 className="size-6 animate-spin text-[#FFF4E8]/70" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-28 rounded-full bg-white/15" />
              <div className="h-5 w-44 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      ) : null}
      <div className="rounded-3xl border border-white/10 bg-black/25 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 h-5 w-36 rounded-full bg-white/15" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-40 rounded-2xl border border-white/10 bg-white/8"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  const shouldShowReconnect = isSpotifyReconnectMessage(message);

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-8 text-center shadow-2xl backdrop-blur-xl">
      <div className="mb-5 flex justify-center">
        <Status
          status="offline"
          className="h-8 border-red-400/25 bg-red-500/10 px-3 text-xs text-[#FFF4E8]"
          role="status"
          aria-label="Workspace status: offline"
        >
          <StatusIndicator />
          <StatusLabel className="text-[#FFF4E8]/72" />
        </Status>
      </div>
      <p className="text-sm font-medium text-[#FFF4E8]">
        Spotify data could not load.
      </p>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#FFF4E8]/70">
        {message}
      </p>
      {shouldShowReconnect ? (
        <Button
          asChild
          className="mt-5 h-10 rounded-full bg-[#1DB954] px-5 text-sm font-semibold text-[#041008] hover:bg-[#22d162]"
        >
          <a href={SPOTIFY_AUTH_START_PATH}>Reconnect Spotify</a>
        </Button>
      ) : null}
    </div>
  );
}

function WishlistPanel() {
  const { records, removeRecord } = useWishlistRecords();
  const visibleRecords = records.slice(0, 4);
  const hiddenCount = Math.max(0, records.length - visibleRecords.length);

  return (
    <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.045] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#D34278]/18 text-[#FFF4E8] shadow-[0_0_32px_rgba(211,66,120,0.16)] ring-1 ring-white/10"
            aria-hidden="true"
          >
            <BookmarkCheck className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#FFF4E8]/45">
              Wishlist
            </p>
            <p className="mt-1 text-sm font-medium text-[#FFF4E8]">
              {records.length.toLocaleString()} saved{" "}
              {records.length === 1 ? "record" : "records"}
            </p>
          </div>
        </div>
      </div>

      {visibleRecords.length > 0 ? (
        <div className="mt-4 space-y-3">
          {visibleRecords.map((record) => (
            <article
              key={record.id}
              className="grid gap-3 border border-white/10 bg-black/22 p-3"
            >
              <div className="flex gap-3">
                <div className="relative size-14 shrink-0 overflow-hidden bg-[#160A24]">
                  {record.thumb ? (
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${record.thumb})` }}
                      aria-label={`${record.discogsTitle} Discogs image`}
                      role="img"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[#FFF4E8]/45">
                      <Disc3 className="size-5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-[#FFF4E8]">
                    {record.spotifyAlbum}
                  </h3>
                  <p className="mt-1 truncate text-xs text-[#FFF4E8]/52">
                    {record.spotifyArtist}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#FFF4E8]/42">
                    {record.recommendationScore}/100 · {record.confidence}/100
                    match · {record.priceLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {record.discogsUri ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-8 flex-1 rounded-full border-white/15 bg-white/8 px-3 text-xs text-[#FFF4E8] hover:bg-white/15"
                  >
                    <a href={record.discogsUri} target="_blank" rel="noreferrer">
                      Open
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
                {record.spotifyAlbumUrl ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-8 flex-1 rounded-full border-white/15 bg-white/8 px-3 text-xs text-[#FFF4E8] hover:bg-white/15"
                  >
                    <a
                      href={record.spotifyAlbumUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Play
                      <CirclePlay className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeRecord(record.id)}
                  className="h-8 rounded-full border-white/15 bg-white/8 px-3 text-xs text-[#FFF4E8] hover:bg-white/15"
                  aria-label={`Remove ${record.spotifyAlbum} from wishlist`}
                >
                  <X className="size-3.5" />
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#FFF4E8]/55">
          Saved Discogs matches will appear here after you run a match and tap
          Save.
        </p>
      )}

      {hiddenCount > 0 ? (
        <p className="mt-3 text-xs text-[#FFF4E8]/45">
          {hiddenCount.toLocaleString()} more saved in your wishlist.
        </p>
      ) : null}
    </section>
  );
}

function ProfilePanel({ profile }: { profile: SpotifyProfile }) {
  const profileName = getProfileName(profile);

  return (
    <aside className="rounded-3xl border border-white/10 bg-black/25 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-4">
        {profile.imageUrl ? (
          <div
            className="size-16 shrink-0 rounded-2xl bg-cover bg-center ring-1 ring-white/15"
            style={{ backgroundImage: `url(${profile.imageUrl})` }}
            aria-label={`${profileName} Spotify profile image`}
            role="img"
          />
        ) : (
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#1DB954]/20 text-[#1DB954] ring-1 ring-white/15">
            <Music2 className="size-7" />
          </div>
        )}

        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.35em] text-[#FFF4E8]/45">
            Connected profile
          </p>
          <h2 className="mt-2 truncate text-2xl font-semibold text-[#FFF4E8]">
            {profileName}
          </h2>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
          <dt className="text-[#FFF4E8]/50">Plan</dt>
          <dd className="mt-1 font-medium capitalize text-[#FFF4E8]">
            {profile.product ?? "Spotify"}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
          <dt className="text-[#FFF4E8]/50">Region</dt>
          <dd className="mt-1 font-medium text-[#FFF4E8]">
            {profile.country ?? "Unset"}
          </dd>
        </div>
      </dl>

      {profile.externalUrl ? (
        <Button
          asChild
          variant="outline"
          className="mt-6 w-full rounded-full border-white/15 bg-white/8 text-[#FFF4E8] hover:bg-white/15"
        >
          <a href={profile.externalUrl} target="_blank" rel="noreferrer">
            Open Spotify
            <ExternalLink className="size-4" />
          </a>
        </Button>
      ) : null}

      <WishlistPanel />
    </aside>
  );
}

function PlaylistCard({
  playlist,
  isSelected,
  onSelect,
}: {
  playlist: SpotifyPlaylist;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex min-h-48 cursor-pointer flex-col overflow-hidden rounded-3xl border bg-black/25 text-left shadow-2xl backdrop-blur-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030A]",
        isSelected
          ? "border-[#1DB954]/70 shadow-[0_0_42px_rgba(29,185,84,0.18)]"
          : "border-white/10 hover:border-white/25 hover:bg-black/35",
      )}
      aria-pressed={isSelected}
    >
      <div className="relative h-32 bg-[#160A24]">
        {playlist.imageUrl ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="h-full w-full bg-cover bg-center transition duration-300 group-hover:scale-[1.05]"
              style={{ backgroundImage: `url(${playlist.imageUrl})` }}
              aria-hidden="true"
            />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 grid place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(211,66,120,0.26),transparent_34%),#160A24]">
            <Disc3 className="size-10 text-[#FFF4E8]/45" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.55)_56%,rgba(0,0,0,0.32)_100%)]" />
        <Badge className="absolute left-4 top-4 border-white/10 bg-black/45 text-[#FFF4E8] backdrop-blur">
          {getVisibilityLabel(playlist)}
        </Badge>
        {isSelected ? (
          <span className="absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-[#1DB954] text-[#041008]">
            <Check className="size-4" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-[#FFF4E8]">
          {playlist.name}
        </h3>
        <p className="mt-2 text-sm text-[#FFF4E8]/60">
          {pluralizeTracks(playlist.trackCount)}
        </p>
        {playlist.ownerName ? (
          <p className="mt-1 truncate text-xs text-[#FFF4E8]/45">
            {playlist.ownerName}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function AlbumCard({
  album,
  isSelected,
  onSelect,
}: {
  album: SpotifySavedAlbum;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex min-h-48 cursor-pointer flex-col overflow-hidden rounded-3xl border bg-black/25 text-left shadow-2xl backdrop-blur-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030A]",
        isSelected
          ? "border-[#1DB954]/70 shadow-[0_0_42px_rgba(29,185,84,0.18)]"
          : "border-white/10 hover:border-white/25 hover:bg-black/35",
      )}
      aria-pressed={isSelected}
    >
      <div className="relative h-32 bg-[#160A24]">
        {album.imageUrl ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="h-full w-full bg-cover bg-center transition duration-300 group-hover:scale-[1.05]"
              style={{ backgroundImage: `url(${album.imageUrl})` }}
              aria-hidden="true"
            />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 grid place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(211,66,120,0.26),transparent_34%),#160A24]">
            <Disc3 className="size-10 text-[#FFF4E8]/45" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.55)_56%,rgba(0,0,0,0.32)_100%)]" />
        <Badge className="absolute left-4 top-4 border-white/10 bg-black/45 text-[#FFF4E8] backdrop-blur">
          Album
        </Badge>
        {isSelected ? (
          <span className="absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-[#1DB954] text-[#041008]">
            <Check className="size-4" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-[#FFF4E8]">
          {album.name}
        </h3>
        <p className="mt-2 truncate text-sm text-[#FFF4E8]/60">
          {album.primaryArtist}
        </p>
        <p className="mt-1 text-xs text-[#FFF4E8]/45">
          {pluralizeTracks(album.trackCount)}
          {album.releaseDate ? ` - ${album.releaseDate}` : ""}
        </p>
      </div>
    </button>
  );
}

function SelectedPlaylistBanner({
  playlist,
  isLoading,
  onReviewImport,
}: {
  playlist: SpotifyPlaylist | undefined;
  isLoading: boolean;
  onReviewImport: () => void;
}) {
  const hasMounted = useHasMounted();

  if (!hasMounted) {
    return null;
  }

  const isVisible = Boolean(playlist);

  return createPortal(
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#05030A]/88 px-4 py-3 shadow-[0_-24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl transform-gpu transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity,filter] motion-reduce:transition-none sm:px-6",
        isVisible
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0"
          : "pointer-events-none translate-y-6 scale-[0.985] opacity-0 blur-[1.5px]",
      )}
      aria-hidden={!isVisible}
    >
      {playlist ? (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {playlist.imageUrl ? (
              <div
                className="size-14 shrink-0 rounded-xl bg-cover bg-center ring-1 ring-white/15"
                style={{ backgroundImage: `url(${playlist.imageUrl})` }}
                aria-label={`${playlist.name} playlist cover`}
                role="img"
              />
            ) : (
              <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#160A24] text-[#FFF4E8]/55 ring-1 ring-white/15">
                <Disc3 className="size-6" />
              </div>
            )}

            <div className="min-w-0">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-[#1DB954]">
                Selected playlist
              </p>
              <div className="mt-1 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <p className="truncate text-sm font-semibold text-[#FFF4E8] sm:text-base">
                  {playlist.name}
                </p>
                <p className="shrink-0 text-xs text-[#FFF4E8]/55 sm:text-sm">
                  {pluralizeTracks(playlist.trackCount)}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            disabled={isLoading}
            onClick={onReviewImport}
            className="h-11 shrink-0 rounded-full bg-[#1DB954] px-6 text-sm font-semibold text-[#041008] hover:bg-[#22d162] disabled:bg-white/15 disabled:text-[#FFF4E8]/35"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Reviewing
              </>
            ) : (
              "Review import"
            )}
          </Button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function SelectedAlbumBanner({
  album,
  isLoading,
  onReviewImport,
}: {
  album: SpotifySavedAlbum | undefined;
  isLoading: boolean;
  onReviewImport: () => void;
}) {
  const hasMounted = useHasMounted();

  if (!hasMounted) {
    return null;
  }

  const isVisible = Boolean(album);

  return createPortal(
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#05030A]/88 px-4 py-3 shadow-[0_-24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl transform-gpu transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity,filter] motion-reduce:transition-none sm:px-6",
        isVisible
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0"
          : "pointer-events-none translate-y-6 scale-[0.985] opacity-0 blur-[1.5px]",
      )}
      aria-hidden={!isVisible}
    >
      {album ? (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {album.imageUrl ? (
              <div
                className="size-14 shrink-0 rounded-xl bg-cover bg-center ring-1 ring-white/15"
                style={{ backgroundImage: `url(${album.imageUrl})` }}
                aria-label={`${album.name} album cover`}
                role="img"
              />
            ) : (
              <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#160A24] text-[#FFF4E8]/55 ring-1 ring-white/15">
                <Disc3 className="size-6" />
              </div>
            )}

            <div className="min-w-0">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-[#1DB954]">
                Selected album
              </p>
              <div className="mt-1 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <p className="truncate text-sm font-semibold text-[#FFF4E8] sm:text-base">
                  {album.name}
                </p>
                <p className="shrink-0 text-xs text-[#FFF4E8]/55 sm:text-sm">
                  {album.primaryArtist}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            disabled={isLoading}
            onClick={onReviewImport}
            className="h-11 shrink-0 rounded-full bg-[#1DB954] px-6 text-sm font-semibold text-[#041008] hover:bg-[#22d162] disabled:bg-white/15 disabled:text-[#FFF4E8]/35"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Reviewing
              </>
            ) : (
              "Review import"
            )}
          </Button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function VinylCrateResults({ payload }: { payload: DiscogsMatchPayload }) {
  const [sortKey, setSortKey] = useState<CrateSortKey>("recommendation");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(() =>
    loadWishlistIds(),
  );
  const crateRecords = useMemo(() => getCrateRecords(payload), [payload]);
  const reviewItems = useMemo(() => getDiscogsReviewItems(payload), [payload]);
  const visibleRecords = useMemo(() => {
    const filteredRecords = availableOnly
      ? crateRecords.filter(
          (record) => record.match.availability.status === "available",
        )
      : crateRecords;

    return sortCrateRecords(filteredRecords, sortKey);
  }, [availableOnly, crateRecords, sortKey]);

  useEffect(() => {
    let isActive = true;

    function syncWishlistIds() {
      setWishlistIds(loadWishlistIds());
    }

    window.addEventListener(WISHLIST_CHANGED_EVENT, syncWishlistIds);
    window.addEventListener("storage", syncWishlistIds);
    syncWishlistRecordsFromApi()
      .then((records) => {
        if (isActive) {
          setWishlistIds(new Set(records.map((record) => record.id)));
        }
      })
      .catch(() => {
        if (isActive) {
          setWishlistIds(loadWishlistIds());
        }
      });

    return () => {
      isActive = false;
      window.removeEventListener(WISHLIST_CHANGED_EVENT, syncWishlistIds);
      window.removeEventListener("storage", syncWishlistIds);
    };
  }, []);

  async function toggleWishlist(record: VinylCrateRecord) {
    const recordId = getCrateRecordId(record);
    const wishlistRecord = createWishlistRecord(record);
    const currentRecords = readWishlistRecords();
    const isSaved = currentRecords.some(
      (currentRecord) => currentRecord.id === recordId,
    );
    const nextRecords = isSaved
      ? currentRecords.filter((currentRecord) => currentRecord.id !== recordId)
      : [
          wishlistRecord,
          ...currentRecords.filter(
            (currentRecord) => currentRecord.id !== recordId,
          ),
        ];

    writeWishlistRecords(nextRecords);
    setWishlistIds(new Set(nextRecords.map((nextRecord) => nextRecord.id)));

    try {
      if (isSaved) {
        await removeWishlistRecordFromApi(recordId);
      } else {
        const savedRecord = await saveWishlistRecordToApi(wishlistRecord);
        const syncedRecords = mergeWishlistRecords([
          savedRecord,
          ...readWishlistRecords().filter(
            (currentRecord) => currentRecord.id !== savedRecord.id,
          ),
        ]);

        writeWishlistRecords(syncedRecords);
        setWishlistIds(
          new Set(syncedRecords.map((syncedRecord) => syncedRecord.id)),
        );
      }
    } catch {
      setWishlistIds(loadWishlistIds());
    }
  }

  return (
    <div className="mt-5">
      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <div className="border-l border-white/15 bg-white/[0.055] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#FFF4E8]/38">
            Searched
          </p>
          <p className="mt-2 text-lg font-semibold text-[#FFF4E8]">
            {payload.matchRun.searchedUnits.toLocaleString()}
          </p>
        </div>
        <div className="border-l border-white/15 bg-white/[0.055] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#FFF4E8]/38">
            Reliable
          </p>
          <p className="mt-2 text-lg font-semibold text-[#FFF4E8]">
            {crateRecords.length.toLocaleString()}
          </p>
        </div>
        <div className="border-l border-white/15 bg-white/[0.055] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#FFF4E8]/38">
            Review
          </p>
          <p className="mt-2 text-lg font-semibold text-[#FFF4E8]">
            {reviewItems.length.toLocaleString()}
          </p>
        </div>
        <div className="border-l border-white/15 bg-white/[0.055] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#FFF4E8]/38">
            Failures
          </p>
          <p className="mt-2 text-lg font-semibold text-[#FFF4E8]">
            {payload.matchRun.failures.length.toLocaleString()}
          </p>
        </div>
      </div>

      {payload.matchRun.skippedUnits > 0 ? (
        <p className="mt-3 text-sm text-[#FFF4E8]/52">
          {payload.matchRun.stoppedForRateLimit
            ? `${payload.matchRun.skippedUnits.toLocaleString()} remaining albums were not searched after the Discogs rate-limit response.`
            : `Search run capped at ${payload.matchRun.maxSearchUnits.toLocaleString()} units; ${payload.matchRun.skippedUnits.toLocaleString()} remaining albums were not searched in this run.`}
        </p>
      ) : null}

      <div className="mt-3 space-y-2 text-sm leading-6">
        <p className="text-[#FFF4E8]/52">
          {getRateLimitLabel(payload.matchRun.rateLimit)} Requests were spaced by{" "}
          {payload.matchRun.requestDelayMs.toLocaleString()}ms.
        </p>
        {payload.matchRun.stoppedForRateLimit ? (
          <p className="border-l-2 border-[#F08A4B] bg-[#F08A4B]/10 px-4 py-3 text-[#FFF4E8]/72">
            Discogs asked WAXLIST to pause, so the remaining albums were left
            unsearched for now.
          </p>
        ) : null}
        {payload.matchRun.failures.length > 0 ? (
          <div className="border-l-2 border-[#D34278] bg-[#D34278]/10 px-4 py-3 text-[#FFF4E8]/72">
            <p className="font-medium text-[#FFF4E8]">
              Some Discogs requests need another pass.
            </p>
            <ul className="mt-2 space-y-1">
              {payload.matchRun.failures.slice(0, 3).map((failure) => (
                <li key={`${failure.searchUnit.id}:${failure.error.code}`}>
                  {failure.searchUnit.artist} - {failure.searchUnit.album}:{" "}
                  {failure.error.message}
                  {failure.error.retryAfterSeconds !== null
                    ? ` Try again in ${formatRetryDelay(
                        failure.error.retryAfterSeconds,
                      )}.`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-3 border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-[#FFF4E8]/42">
            <SlidersHorizontal className="size-3.5" />
            Vinyl crate
          </p>
          <p className="mt-2 text-sm leading-6 text-[#FFF4E8]/62">
            Ranked by listening signal, match confidence, vinyl format,
            marketplace availability, and price practicality.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#FFF4E8]/68">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(event) => setAvailableOnly(event.target.checked)}
              className="size-4 accent-[#1DB954]"
            />
            Available only
          </label>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as CrateSortKey)}
            className="h-10 rounded-full border border-white/15 bg-[#05030A] px-4 text-sm text-[#FFF4E8] outline-none focus:border-[#1DB954]"
            aria-label="Sort vinyl crate"
          >
            <option value="recommendation">Recommendation</option>
            <option value="confidence">Confidence</option>
            <option value="availability">Availability</option>
            <option value="price">Estimated price</option>
            <option value="artist">Artist</option>
            <option value="album">Album</option>
          </select>
        </div>
      </div>

      {visibleRecords.length > 0 ? (
        <div className="mt-4 space-y-4">
          {visibleRecords.map((record, index) => {
            const recordId = getCrateRecordId(record);
            const isSaved = wishlistIds.has(recordId);

            return (
              <article
                key={recordId}
                className="overflow-hidden border border-white/10 bg-white/[0.045] transition hover:border-white/20 hover:bg-white/[0.065]"
              >
                <div className="grid gap-0 lg:grid-cols-[9rem_minmax(0,1fr)]">
                  <div className="relative min-h-40 bg-[#160A24]">
                    {record.match.thumb ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${record.match.thumb})` }}
                        aria-label={`${record.match.title} Discogs image`}
                        role="img"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_35%_25%,rgba(211,66,120,0.26),transparent_38%),#160A24] text-[#FFF4E8]/45">
                        <Disc3 className="size-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-white/10" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-xs tabular-nums text-[#FFF4E8]">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Badge className="border-[#1DB954]/25 bg-[#1DB954]/15 text-[#BDF5CB]">
                            {record.match.recommendationLabel} ·{" "}
                            {record.match.recommendationScore}/100
                          </Badge>
                          <Badge className="border-white/10 bg-black/25 text-[#FFF4E8]/72">
                            {record.match.confidenceLabel} ·{" "}
                            {record.match.confidence}/100
                          </Badge>
                          <Badge className="border-white/10 bg-black/25 text-[#FFF4E8]/72">
                            {record.match.availability.label}
                          </Badge>
                          <Badge className="border-white/10 bg-black/25 text-[#FFF4E8]/72">
                            {record.match.priceHint.label}
                          </Badge>
                        </div>

                        <h3 className="mt-3 text-2xl font-semibold leading-tight text-[#FFF4E8]">
                          {record.result.searchUnit.album}
                        </h3>
                        <p className="mt-1 text-sm text-[#FFF4E8]/58">
                          {record.result.searchUnit.artist}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[#FFF4E8]/70">
                          Discogs: {record.match.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#FFF4E8]/48">
                          {record.match.format.length > 0
                            ? record.match.format.join(", ")
                            : "Format unknown"}
                          {record.match.year ? ` · ${record.match.year}` : ""}
                          {record.match.country
                            ? ` · ${record.match.country}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => toggleWishlist(record)}
                          className="h-10 rounded-full border-white/15 bg-white/8 px-4 text-sm text-[#FFF4E8] hover:bg-white/15"
                        >
                          {isSaved ? (
                            <BookmarkCheck className="size-4" />
                          ) : (
                            <Bookmark className="size-4" />
                          )}
                          {isSaved ? "Saved" : "Save"}
                        </Button>
                        {record.match.uri ? (
                          <Button
                            asChild
                            className="h-10 rounded-full bg-[#1DB954] px-4 text-sm font-semibold text-[#041008] hover:bg-[#22d162]"
                          >
                            <a
                              href={record.match.uri}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Discogs
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                        {record.result.searchUnit.spotifyAlbumUrl ? (
                          <Button
                            asChild
                            variant="outline"
                            className="h-10 rounded-full border-white/15 bg-white/8 px-4 text-sm text-[#FFF4E8] hover:bg-white/15"
                          >
                            <a
                              href={record.result.searchUnit.spotifyAlbumUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Play album
                              <CirclePlay className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="border-l border-[#D34278]/45 bg-[#D34278]/8 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.24em] text-[#FFF4E8]/40">
                          Why this
                        </p>
                        <ul className="mt-2 space-y-1 text-sm leading-6 text-[#FFF4E8]/68">
                          {record.match.whyThis.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="border-l border-white/15 bg-black/20 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.24em] text-[#FFF4E8]/40">
                          Match evidence
                        </p>
                        <ul className="mt-2 space-y-1 text-sm leading-6 text-[#FFF4E8]/62">
                          {record.match.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#FFF4E8]/55">
          No strong Discogs matches crossed the automatic recommendation
          threshold.
        </p>
      )}

      <DiscogsUnresolvedResults
        reviewItems={reviewItems}
        failures={payload.matchRun.failures}
      />
    </div>
  );
}

function DiscogsUnresolvedResults({
  reviewItems,
  failures,
}: {
  reviewItems: DiscogsReviewItem[];
  failures: DiscogsMatchPayload["matchRun"]["failures"];
}) {
  if (reviewItems.length === 0 && failures.length === 0) {
    return null;
  }

  const possibleItems = reviewItems.filter(
    (item) => item.status === "possible" || item.status === "weak",
  );
  const noMatchItems = reviewItems.filter((item) => item.status === "none");

  return (
    <section className="mt-6 border border-[#F08A4B]/18 bg-[#05030A]/55 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#F08A4B]/72">
            Needs review
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[#FFF4E8]">
            Unmatched and weak Discogs results
          </h3>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[#FFF4E8]/58">
          These albums are not guaranteed recommendations. Review the Discogs
          candidate manually before saving or buying.
        </p>
      </div>

      {possibleItems.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-medium text-[#FFF4E8]">
            Weak or possible matches needing review
          </p>
          <div className="mt-3 grid gap-3">
            {possibleItems.map((item) => (
              <article
                key={`${item.result.searchUnit.id}:${item.status}`}
                className="border-l border-[#F08A4B]/45 bg-[#F08A4B]/8 px-4 py-3"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-base font-semibold text-[#FFF4E8]">
                      {item.result.searchUnit.album}
                    </p>
                    <p className="mt-1 text-sm text-[#FFF4E8]/62">
                      {item.result.searchUnit.artist}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#FFF4E8]/62">
                      {item.result.searchUnit.sourceTrackCount.toLocaleString()}{" "}
                      source{" "}
                      {item.result.searchUnit.sourceTrackCount === 1
                        ? "track"
                        : "tracks"}{" "}
                      - {item.reason}
                    </p>
                    {item.match ? (
                      <div className="mt-3 space-y-1 text-sm leading-6 text-[#FFF4E8]/58">
                        <p>
                          Candidate: {item.match.title} -{" "}
                          {item.match.confidenceLabel},{" "}
                          {item.match.confidence}/100 confidence.
                        </p>
                        <p>
                          {item.match.format.length > 0
                            ? item.match.format.join(", ")
                            : "Format unknown"}
                          {item.match.year ? ` - ${item.match.year}` : ""}
                          {item.match.country ? ` - ${item.match.country}` : ""}
                        </p>
                        <p>{item.match.reasons[0]}</p>
                      </div>
                    ) : null}
                  </div>
                  {item.match?.uri ? (
                    <Button
                      asChild
                      variant="outline"
                      className="h-10 w-fit shrink-0 rounded-full border-white/15 bg-white/8 px-4 text-sm text-[#FFF4E8] hover:bg-white/15"
                    >
                      <a
                        href={item.match.uri}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Review Discogs
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {noMatchItems.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-medium text-[#FFF4E8]">
            No reliable match found
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {noMatchItems.map((item) => (
              <article
                key={item.result.searchUnit.id}
                className="border-l border-white/15 bg-white/[0.045] px-4 py-3"
              >
                <p className="text-base font-semibold text-[#FFF4E8]">
                  {item.result.searchUnit.album}
                </p>
                <p className="mt-1 text-sm text-[#FFF4E8]/62">
                  {item.result.searchUnit.artist}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#FFF4E8]/58">
                  {item.result.searchUnit.sourceTrackCount.toLocaleString()}{" "}
                  source{" "}
                  {item.result.searchUnit.sourceTrackCount === 1
                    ? "track"
                    : "tracks"}{" "}
                  - {item.reason}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {failures.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-medium text-[#FFF4E8]">
            Discogs search failures
          </p>
          <div className="mt-3 grid gap-3">
            {failures.map((failure, index) => (
              <article
                key={`${failure.searchUnit.id}:${failure.error.code}:${failure.error.status}:${index}`}
                className="border-l border-[#D34278]/50 bg-[#D34278]/10 px-4 py-3"
              >
                <p className="text-base font-semibold text-[#FFF4E8]">
                  {failure.searchUnit.album}
                </p>
                <p className="mt-1 text-sm text-[#FFF4E8]/62">
                  {failure.searchUnit.artist}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#FFF4E8]/62">
                  {failure.searchUnit.sourceTrackCount.toLocaleString()} source{" "}
                  {failure.searchUnit.sourceTrackCount === 1
                    ? "track"
                    : "tracks"}{" "}
                  - {failure.error.message}
                  {failure.error.retryAfterSeconds !== null
                    ? ` Retry in ${formatRetryDelay(
                        failure.error.retryAfterSeconds,
                      )}.`
                    : ""}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#FFF4E8]/38">
                  {failure.error.code}
                  {failure.error.status ? ` - HTTP ${failure.error.status}` : ""}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ImportSummaryPanel({
  summary,
}: {
  summary: SpotifyPlaylistImportSummary;
}) {
  const sourceLabel = summary.sourceType === "album" ? "album" : "playlist";
  const sourceTitle = summary.playlistName ?? `Selected ${sourceLabel}`;
  const visibleCandidates = summary.albumCandidates.slice(0, 12);
  const featuredCandidate = summary.albumCandidates[0];
  const featuredCoverUrl = featuredCandidate?.imageUrl ?? null;
  const featuredArtistImageUrl = featuredCandidate?.artistImageUrl ?? null;
  const [discogsMatchState, setDiscogsMatchState] = useState<
    | { status: "idle"; payload: null; message: null }
    | { status: "loading"; payload: null; message: null }
    | { status: "ready"; payload: DiscogsMatchPayload; message: null }
    | { status: "error"; payload: null; message: string }
  >({ status: "idle", payload: null, message: null });

  async function matchToDiscogs() {
    setDiscogsMatchState({ status: "loading", payload: null, message: null });

    try {
      const payload = await fetchJson<DiscogsMatchPayload>(
        "/api/discogs/match",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            searchUnits: summary.discogsSearchUnits,
          }),
        },
      );

      setDiscogsMatchState({ status: "ready", payload, message: null });
    } catch (error) {
      setDiscogsMatchState({
        status: "error",
        payload: null,
        message:
          error instanceof EndpointRequestError &&
          error.code === "discogs_configuration_error"
            ? getDiscogsConfigurationMessage(error)
            : error instanceof Error
              ? error.message
              : "Discogs matching could not be completed.",
      });
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/15 bg-[#05030A]/95 shadow-[0_40px_120px_rgba(0,0,0,0.62)] ring-1 ring-[#D34278]/15">
      <div className="relative border-b border-white/10 px-5 py-6 sm:px-8 sm:py-7">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(240,138,75,0.24),transparent_30%),radial-gradient(circle_at_82%_12%,rgba(211,66,120,0.22),transparent_32%),linear-gradient(135deg,rgba(109,42,168,0.28),transparent_48%)]"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="relative w-fit shrink-0 pb-4 pr-4">
              <div className="relative size-28 overflow-hidden rounded-[1.35rem] border border-white/15 bg-[#160A24] shadow-[0_24px_70px_rgba(0,0,0,0.42)] sm:size-36">
                {featuredCoverUrl ? (
                  <div
                    className="h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${featuredCoverUrl})` }}
                    aria-label={`${featuredCandidate?.album ?? sourceTitle} album cover`}
                    role="img"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_35%_25%,rgba(211,66,120,0.28),transparent_38%),#160A24] text-[#FFF4E8]/58">
                    <Disc3 className="size-10" />
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10"
                  aria-hidden="true"
                />
              </div>
              <div className="absolute bottom-0 right-0 size-16 overflow-hidden rounded-full border-2 border-[#05030A] bg-[#160A24] shadow-[0_16px_36px_rgba(0,0,0,0.45)] ring-1 ring-white/20 sm:size-20">
                {featuredArtistImageUrl ? (
                  <div
                    className="h-full w-full bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${featuredArtistImageUrl})`,
                    }}
                    aria-label={`${featuredCandidate?.primaryArtist ?? "Primary artist"} artist image`}
                    role="img"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_40%_25%,rgba(240,138,75,0.25),transparent_42%),#160A24] text-[#FFF4E8]/52">
                    <Music2 className="size-6" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.42em] text-[#1DB954]">
                Crate intake
              </p>
              <h2
                id="import-summary-heading"
                className="mt-3 max-w-3xl font-serif text-4xl italic leading-none text-[#FFF4E8] sm:text-5xl"
              >
                {sourceTitle}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#FFF4E8]/68">
                Review the album signals WAXLIST found before Discogs matching.
                Each candidate keeps the exact source tracks that caused it to
                be included.
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:min-w-[30rem]">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {[
                ["Tracks", summary.sourceTracksFound],
                ["Albums", summary.uniqueAlbumCandidates],
                ["Duplicates", summary.duplicateTracksRemoved],
                ["Skipped", summary.skippedTracks],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-l border-white/15 bg-black/20 px-4 py-3 backdrop-blur"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[#FFF4E8]/42">
                    {label}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[#FFF4E8]">
                    {value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {featuredCandidate ? (
              <div className="border border-white/10 bg-black/20 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-[#FFF4E8]/40">
                  Strongest signal
                </p>
                <p className="mt-2 truncate text-sm font-medium text-[#FFF4E8]">
                  {featuredCandidate.album}
                </p>
                <p className="mt-1 text-xs text-[#FFF4E8]/50">
                  {featuredCandidate.sourceTrackCount.toLocaleString()} source{" "}
                  {featuredCandidate.sourceTrackCount === 1
                    ? "track"
                    : "tracks"}{" "}
                  by {featuredCandidate.primaryArtist}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-3 text-sm text-[#FFF4E8]/58 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Reviewed {summary.reviewedTrackTotal.toLocaleString()} of{" "}
            {summary.playlistTrackTotal.toLocaleString()} {sourceLabel} entries.
          </p>
          <p>
            {summary.compilationCandidates.toLocaleString()} compilation{" "}
            {summary.compilationCandidates === 1 ? "candidate" : "candidates"}
          </p>
        </div>

        {summary.lowQualityReasons.length > 0 ? (
          <div className="mt-5 border-l-2 border-[#F08A4B] bg-[#F08A4B]/10 px-4 py-3">
            <p className="text-sm font-medium text-[#FFF4E8]">
              Source needs review
            </p>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-[#FFF4E8]/70">
              {summary.lowQualityReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-5 border-l-2 border-[#1DB954] bg-[#1DB954]/8 px-4 py-3 text-sm text-[#FFF4E8]/66">
            Metadata is usable for album-level matching.
          </p>
        )}

        <div className="mt-5 border border-white/10 bg-black/25 p-4 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#FFF4E8]/40">
                Discogs search units
              </p>
              <p className="mt-2 text-sm leading-6 text-[#FFF4E8]/66">
                {summary.discogsSearchUnits.length.toLocaleString()} normalized{" "}
                {summary.discogsSearchUnits.length === 1 ? "album" : "albums"}{" "}
                ready. WAXLIST will send one Discogs search per normalized
                album, not one per Spotify track.
              </p>
            </div>
            <Button
              type="button"
              disabled={
                discogsMatchState.status === "loading" ||
                summary.discogsSearchUnits.length === 0
              }
              onClick={matchToDiscogs}
              className="h-11 shrink-0 rounded-full bg-[#1DB954] px-6 text-sm font-semibold text-[#041008] hover:bg-[#22d162] disabled:bg-white/15 disabled:text-[#FFF4E8]/35"
            >
              {discogsMatchState.status === "loading" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Matching
                </>
              ) : (
                "Match to Discogs"
              )}
            </Button>
          </div>

          {discogsMatchState.status === "error" ? (
            <p className="mt-4 border-l-2 border-[#F08A4B] bg-[#F08A4B]/10 px-4 py-3 text-sm leading-6 text-[#FFF4E8]/72">
              {discogsMatchState.message}
            </p>
          ) : null}

          {summary.discogsSearchUnits.length === 0 ? (
            <p className="mt-4 border-l-2 border-[#F08A4B] bg-[#F08A4B]/10 px-4 py-3 text-sm leading-6 text-[#FFF4E8]/72">
              No album-level Discogs searches are ready for this source. Choose
              a playlist or saved album with Spotify album metadata, then review
              the import again.
            </p>
          ) : null}

          {discogsMatchState.status === "ready" ? (
            <VinylCrateResults payload={discogsMatchState.payload} />
          ) : null}
        </div>

        <div className="mt-6 space-y-3">
          {visibleCandidates.map((candidate, index) => (
            <article
              key={candidate.id}
              className="group border border-white/10 bg-white/[0.055] p-4 transition hover:border-white/20 hover:bg-white/[0.075] sm:p-5"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                <div className="min-w-0">
                  <div className="flex items-start gap-4">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#160A24]">
                      {candidate.imageUrl ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${candidate.imageUrl})`,
                          }}
                          aria-label={`${candidate.album} album cover`}
                          role="img"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[#FFF4E8]/42">
                          <Disc3 className="size-6" />
                        </div>
                      )}
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[0.62rem] tabular-nums text-[#FFF4E8]/75">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold leading-tight text-[#FFF4E8]">
                        {candidate.album}
                      </h3>
                      <div className="mt-2 flex min-w-0 items-center gap-2">
                        <div className="size-7 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#160A24]">
                          {candidate.artistImageUrl ? (
                            <div
                              className="h-full w-full bg-cover bg-center"
                              style={{
                                backgroundImage: `url(${candidate.artistImageUrl})`,
                              }}
                              aria-label={`${candidate.primaryArtist} artist image`}
                              role="img"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[#FFF4E8]/42">
                              <Music2 className="size-3.5" />
                            </div>
                          )}
                        </div>
                        <p className="min-w-0 truncate text-sm text-[#FFF4E8]/62">
                          {candidate.primaryArtist}
                          {candidate.releaseDate
                            ? ` - ${candidate.releaseDate}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-[#FFF4E8]/62">
                      {candidate.sourceTrackCount} source{" "}
                      {candidate.sourceTrackCount === 1 ? "track" : "tracks"}
                    </span>
                    {candidate.duplicateTracksRemoved > 0 ? (
                      <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-[#FFF4E8]/62">
                        {candidate.duplicateTracksRemoved} duplicate{" "}
                        {candidate.duplicateTracksRemoved === 1
                          ? "track"
                          : "tracks"}{" "}
                        removed
                      </span>
                    ) : null}
                    {candidate.isCompilation ? (
                      <span className="rounded-full border border-[#F08A4B]/25 bg-[#F08A4B]/10 px-3 py-1 text-xs text-[#FFF4E8]/72">
                        Compilation handling
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[#FFF4E8]/50">
                    {candidate.handlingNote}
                  </p>
                  {candidate.albumExternalUrl ? (
                    <Button
                      asChild
                      variant="outline"
                      className="mt-4 h-9 rounded-full border-white/15 bg-white/8 px-4 text-sm text-[#FFF4E8] hover:bg-white/15"
                    >
                      <a
                        href={candidate.albumExternalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Play album
                        <CirclePlay className="size-4" />
                      </a>
                    </Button>
                  ) : null}
                </div>

                <div className="border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <p className="text-xs uppercase tracking-[0.28em] text-[#FFF4E8]/38">
                    Individual tracks
                  </p>
                  <ol className="mt-3 space-y-2">
                    {candidate.sourceTracks.map((track, trackIndex) => (
                      <li
                        key={`${track.id ?? track.name}-${trackIndex}`}
                        className="flex items-start gap-3 text-sm leading-5"
                      >
                        <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-[#FFF4E8]/32">
                          {trackIndex + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[#FFF4E8]/78">
                            {track.name}
                          </p>
                          <p className="truncate text-xs text-[#FFF4E8]/40">
                            {track.primaryArtist}
                          </p>
                        </div>
                        {track.externalUrl ? (
                          <a
                            href={track.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[0.68rem] font-medium text-[#FFF4E8]/72 transition hover:bg-white/14 hover:text-[#FFF4E8]"
                            aria-label={`Play ${track.name} on Spotify`}
                          >
                            <CirclePlay className="size-3" />
                            Play
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </article>
          ))}
        </div>

        {summary.albumCandidates.length > visibleCandidates.length ? (
          <p className="mt-5 text-center text-sm text-[#FFF4E8]/45">
            Showing {visibleCandidates.length.toLocaleString()} of{" "}
            {summary.albumCandidates.length.toLocaleString()} album candidates.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ImportSummaryDialog({
  isOpen,
  summary,
  onClose,
}: {
  isOpen: boolean;
  summary: SpotifyPlaylistImportSummary | null;
  onClose: () => void;
}) {
  const hasMounted = useHasMounted();
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const requestClose = useCallback(() => {
    clearCloseTimer();
    setIsVisible(false);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, IMPORT_DIALOG_ANIMATION_MS);
  }, [clearCloseTimer, onClose]);

  useEffect(() => {
    if (!summary || !isOpen) {
      return;
    }

    clearCloseTimer();
    const animationFrame = requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [clearCloseTimer, isOpen, summary]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!summary || !isOpen) {
      return;
    }

    const scrollY = window.scrollY;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyPaddingRight = document.body.style.paddingRight;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        requestClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.paddingRight = previousBodyPaddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, requestClose, summary]);

  if (!summary || !hasMounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-black/78 px-4 py-6 opacity-0 backdrop-blur-md transition-opacity duration-200 ease-out motion-reduce:transition-none sm:px-6",
        isVisible && "opacity-100",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-summary-heading"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer"
        aria-label="Close import summary"
        onClick={requestClose}
      />
      <div
        className={cn(
          "relative max-h-[calc(100vh-3rem)] w-full max-w-6xl translate-y-4 overflow-y-auto rounded-3xl opacity-0 outline-none transition-[opacity,transform] duration-200 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none",
          isVisible && "translate-y-0 opacity-100",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-4 top-4 z-10 size-10 rounded-full border-white/15 bg-black/65 text-[#FFF4E8] shadow-2xl backdrop-blur hover:bg-black/80"
          aria-label="Close import summary"
          onClick={requestClose}
        >
          <X className="size-4" />
        </Button>
        <ImportSummaryPanel summary={summary} />
      </div>
    </div>,
    document.body,
  );
}

function PlaylistPicker({
  playlists,
  paging,
  isPageLoading,
  pageError,
  onPageChange,
}: {
  playlists: SpotifyPlaylist[];
  paging: SpotifyPlaylistPayload["paging"];
  isPageLoading: boolean;
  pageError: string | null;
  onPageChange: (offset: number) => void;
}) {
  const [sourceMode, setSourceMode] = useState<"playlists" | "albums">(
    "albums",
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(
    playlists[0]?.id ?? "",
  );
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [albumSearchQuery, setAlbumSearchQuery] = useState("");
  const [albumState, setAlbumState] = useState<{
    albums: SpotifySavedAlbum[];
    paging: SpotifyAlbumPayload["paging"];
    isPageLoading: boolean;
    pageError: string | null;
    hasLoaded: boolean;
  }>({
    albums: [],
    paging: {
      limit: ALBUM_PAGE_LIMIT,
      offset: 0,
      total: 0,
      next: null,
      previous: null,
    },
    isPageLoading: false,
    pageError: null,
    hasLoaded: false,
  });
  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId),
    [playlists, selectedPlaylistId],
  );
  const visibleAlbums = useMemo(() => {
    const normalizedQuery = normalizeSearchText(albumSearchQuery);

    if (!normalizedQuery) {
      return albumState.albums;
    }

    return albumState.albums.filter((album) => {
      const searchableAlbum = normalizeSearchText(
        [
          album.name,
          album.primaryArtist,
          album.releaseDate,
          album.albumType,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return searchableAlbum.includes(normalizedQuery);
    });
  }, [albumSearchQuery, albumState.albums]);
  const selectedAlbum = useMemo(
    () => visibleAlbums.find((album) => album.id === selectedAlbumId),
    [selectedAlbumId, visibleAlbums],
  );
  const currentPage = Math.floor(paging.offset / paging.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(paging.total / paging.limit));
  const firstPlaylistNumber =
    paging.total > 0 ? Math.min(paging.offset + 1, paging.total) : 0;
  const lastPlaylistNumber = Math.min(
    paging.offset + playlists.length,
    paging.total,
  );
  const previousOffset = Math.max(0, paging.offset - paging.limit);
  const nextOffset = paging.offset + paging.limit;
  const canGoPrevious = paging.offset > 0 && !isPageLoading;
  const canGoNext = paging.offset + paging.limit < paging.total && !isPageLoading;
  const albumCurrentPage =
    Math.floor(albumState.paging.offset / albumState.paging.limit) + 1;
  const albumTotalPages = Math.max(
    1,
    Math.ceil(albumState.paging.total / albumState.paging.limit),
  );
  const albumFirstNumber =
    albumState.paging.total > 0
      ? Math.min(albumState.paging.offset + 1, albumState.paging.total)
      : 0;
  const albumLastNumber = Math.min(
    albumState.paging.offset + albumState.albums.length,
    albumState.paging.total,
  );
  const albumPreviousOffset = Math.max(
    0,
    albumState.paging.offset - albumState.paging.limit,
  );
  const albumNextOffset = albumState.paging.offset + albumState.paging.limit;
  const canGoAlbumPrevious =
    albumState.paging.offset > 0 && !albumState.isPageLoading;
  const canGoAlbumNext =
    albumState.paging.offset + albumState.paging.limit <
      albumState.paging.total && !albumState.isPageLoading;
  const [importSummaryState, setImportSummaryState] = useState<
    | { status: "idle"; summary: null; message: null }
    | { status: "loading"; summary: null; message: null }
    | { status: "ready"; summary: SpotifyPlaylistImportSummary; message: null }
    | { status: "error"; summary: null; message: string }
  >({ status: "idle", summary: null, message: null });
  const [isImportSummaryOpen, setIsImportSummaryOpen] = useState(false);
  const shouldShowReconnect =
    importSummaryState.status === "error" &&
    importSummaryState.message.includes("Reconnect Spotify to grant");
  const shouldShowAlbumReconnect =
    albumState.pageError?.includes("Reconnect Spotify to grant") ?? false;

  useEffect(() => {
    loadAlbumPage(0);
  }, []);

  useEffect(() => {
    setAlbumSearchQuery(readBrowserStorageValue(ALBUM_SEARCH_STORAGE_KEY));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ALBUM_SEARCH_STORAGE_KEY, albumSearchQuery);
  }, [albumSearchQuery]);

  async function loadAlbumPage(offset: number) {
    const boundedOffset = Math.max(0, offset);

    setAlbumState((currentState) => ({
      ...currentState,
      isPageLoading: true,
      pageError: null,
    }));

    try {
      const albumPayload = await fetchJson<SpotifyAlbumPayload>(
        `/api/spotify/albums?${new URLSearchParams({
          limit: ALBUM_PAGE_LIMIT.toString(),
          offset: boundedOffset.toString(),
        })}`,
      );

      setAlbumState({
        albums: albumPayload.albums,
        paging: albumPayload.paging,
        isPageLoading: false,
        pageError: null,
        hasLoaded: true,
      });
      setSelectedAlbumId((currentAlbumId) =>
        albumPayload.albums.some((album) => album.id === currentAlbumId)
          ? currentAlbumId
          : (albumPayload.albums[0]?.id ?? ""),
      );
    } catch (error) {
      setAlbumState((currentState) => ({
        ...currentState,
        isPageLoading: false,
        pageError:
          error instanceof Error
            ? error.message
            : "Spotify saved albums could not be loaded.",
        hasLoaded: true,
      }));
    }
  }

  function selectSourceMode(nextSourceMode: "playlists" | "albums") {
    setSourceMode(nextSourceMode);
    setImportSummaryState({ status: "idle", summary: null, message: null });

    if (nextSourceMode === "albums" && !albumState.hasLoaded) {
      loadAlbumPage(0);
    }
  }

  async function reviewSelectedPlaylistImport() {
    if (!selectedPlaylist) {
      return;
    }

    setImportSummaryState({ status: "loading", summary: null, message: null });

    try {
      const payload = await fetchJson<SpotifyImportSummaryPayload>(
        `/api/spotify/playlists?${new URLSearchParams({
          playlistId: selectedPlaylist.id,
        })}`,
      );

      setImportSummaryState({
        status: "ready",
        summary: payload.importSummary,
        message: null,
      });
      setIsImportSummaryOpen(true);
    } catch (error) {
      setImportSummaryState({
        status: "error",
        summary: null,
        message:
          error instanceof Error
            ? error.message
            : "Spotify playlist import could not be reviewed.",
      });
    }
  }

  async function reviewSelectedAlbumImport() {
    if (!selectedAlbum) {
      return;
    }

    setImportSummaryState({ status: "loading", summary: null, message: null });

    try {
      const payload = await fetchJson<SpotifyImportSummaryPayload>(
        `/api/spotify/albums?${new URLSearchParams({
          albumId: selectedAlbum.id,
        })}`,
      );

      setImportSummaryState({
        status: "ready",
        summary: payload.importSummary,
        message: null,
      });
      setIsImportSummaryOpen(true);
    } catch (error) {
      setImportSummaryState({
        status: "error",
        summary: null,
        message:
          error instanceof Error
            ? error.message
            : "Spotify album import could not be reviewed.",
      });
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-black/25 p-5 pb-24 shadow-2xl backdrop-blur-xl sm:p-6 sm:pb-28">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#FFF4E8]/45">
            Source
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#FFF4E8]">
            Choose a source crate
          </h2>
          <div className="mt-4 inline-flex rounded-full border border-white/10 bg-black/25 p-1">
            <button
              type="button"
              onClick={() => selectSourceMode("playlists")}
              className={cn(
                "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition",
                sourceMode === "playlists"
                  ? "bg-[#1DB954] text-[#041008]"
                  : "text-[#FFF4E8]/65 hover:text-[#FFF4E8]",
              )}
            >
              Playlists
            </button>
            <button
              type="button"
              onClick={() => selectSourceMode("albums")}
              className={cn(
                "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition",
                sourceMode === "albums"
                  ? "bg-[#1DB954] text-[#041008]"
                  : "text-[#FFF4E8]/65 hover:text-[#FFF4E8]",
              )}
            >
              Saved albums
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <p className="text-sm text-[#FFF4E8]/55">
            {sourceMode === "playlists"
              ? paging.total.toLocaleString()
              : albumState.paging.total.toLocaleString()}{" "}
            available
          </p>
          {sourceMode === "playlists" && paging.total > paging.limit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canGoPrevious}
                onClick={() => onPageChange(0)}
                className="size-9 cursor-pointer rounded-full border-white/15 bg-white/8 text-[#FFF4E8] hover:bg-white/15 disabled:cursor-default disabled:bg-white/5 disabled:text-[#FFF4E8]/30"
                aria-label="Show first page of playlists"
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canGoPrevious}
                onClick={() => onPageChange(previousOffset)}
                className="size-9 cursor-pointer rounded-full border-white/15 bg-white/8 text-[#FFF4E8] hover:bg-white/15 disabled:cursor-default disabled:bg-white/5 disabled:text-[#FFF4E8]/30"
                aria-label="Show previous playlists"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-24 text-center text-xs text-[#FFF4E8]/55">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canGoNext}
                onClick={() => onPageChange(nextOffset)}
                className="size-9 cursor-pointer rounded-full border-white/15 bg-white/8 text-[#FFF4E8] hover:bg-white/15 disabled:cursor-default disabled:bg-white/5 disabled:text-[#FFF4E8]/30"
                aria-label="Show next playlists"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canGoNext}
                onClick={() => onPageChange(paging.limit * (totalPages - 1))}
                className="size-9 cursor-pointer rounded-full border-white/15 bg-white/8 text-[#FFF4E8] hover:bg-white/15 disabled:cursor-default disabled:bg-white/5 disabled:text-[#FFF4E8]/30"
                aria-label="Show last page of playlists"
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          ) : null}
          {sourceMode === "albums" &&
          albumState.paging.total > albumState.paging.limit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canGoAlbumPrevious}
                onClick={() => loadAlbumPage(0)}
                className="size-9 cursor-pointer rounded-full border-white/15 bg-white/8 text-[#FFF4E8] hover:bg-white/15 disabled:cursor-default disabled:bg-white/5 disabled:text-[#FFF4E8]/30"
                aria-label="Show first page of saved albums"
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canGoAlbumPrevious}
                onClick={() => loadAlbumPage(albumPreviousOffset)}
                className="size-9 cursor-pointer rounded-full border-white/15 bg-white/8 text-[#FFF4E8] hover:bg-white/15 disabled:cursor-default disabled:bg-white/5 disabled:text-[#FFF4E8]/30"
                aria-label="Show previous saved albums"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-24 text-center text-xs text-[#FFF4E8]/55">
                Page {albumCurrentPage} of {albumTotalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canGoAlbumNext}
                onClick={() => loadAlbumPage(albumNextOffset)}
                className="size-9 cursor-pointer rounded-full border-white/15 bg-white/8 text-[#FFF4E8] hover:bg-white/15 disabled:cursor-default disabled:bg-white/5 disabled:text-[#FFF4E8]/30"
                aria-label="Show next saved albums"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canGoAlbumNext}
                onClick={() =>
                  loadAlbumPage(albumState.paging.limit * (albumTotalPages - 1))
                }
                className="size-9 cursor-pointer rounded-full border-white/15 bg-white/8 text-[#FFF4E8] hover:bg-white/15 disabled:cursor-default disabled:bg-white/5 disabled:text-[#FFF4E8]/30"
                aria-label="Show last page of saved albums"
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {sourceMode === "playlists" && playlists.length > 0 ? (
        <>
          <div
            className={cn(
              "mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
              isPageLoading && "opacity-60",
            )}
            aria-busy={isPageLoading}
          >
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                isSelected={playlist.id === selectedPlaylist?.id}
                onSelect={() =>
                  setSelectedPlaylistId((currentPlaylistId) =>
                    currentPlaylistId === playlist.id ? "" : playlist.id,
                  )
                }
              />
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 text-sm text-[#FFF4E8]/55 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {firstPlaylistNumber.toLocaleString()}-
              {lastPlaylistNumber.toLocaleString()} of{" "}
              {paging.total.toLocaleString()}
            </p>
            {isPageLoading ? (
              <p className="inline-flex items-center gap-2 text-[#FFF4E8]/65">
                <Loader2 className="size-4 animate-spin" />
                Loading playlists
              </p>
            ) : null}
          </div>

          {pageError ? (
            <p
              className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-[#FFF4E8]/70"
              role="status"
            >
              {pageError}
            </p>
          ) : null}

          <SelectedPlaylistBanner
            playlist={selectedPlaylist}
            isLoading={importSummaryState.status === "loading"}
            onReviewImport={reviewSelectedPlaylistImport}
          />
        </>
      ) : null}

      {sourceMode === "albums" ? (
        <>
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <label
              htmlFor="saved-album-search"
              className="text-xs uppercase tracking-[0.3em] text-[#FFF4E8]/42"
            >
              Search saved albums
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/38"
                  aria-hidden="true"
                />
                <Input
                  id="saved-album-search"
                  type="search"
                  value={albumSearchQuery}
                  onChange={(event) => setAlbumSearchQuery(event.target.value)}
                  placeholder="Search by album, artist, year, or type"
                  className="h-11 rounded-full border-white/15 bg-white/8 pl-10 pr-4 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#1DB954] focus-visible:ring-[#1DB954]/25"
                  autoComplete="off"
                />
              </div>
              {albumSearchQuery ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAlbumSearchQuery("")}
                  className="h-11 rounded-full border-white/15 bg-white/8 px-5 text-sm text-[#FFF4E8] hover:bg-white/15"
                >
                  <X className="size-4" />
                  Clear
                </Button>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-[#FFF4E8]/52">
              Filters the saved albums loaded on this page and keeps the query
              in this browser only.
            </p>
          </div>

          {albumState.isPageLoading && albumState.albums.length === 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="h-48 rounded-3xl border border-white/10 bg-white/8"
                />
              ))}
            </div>
          ) : null}

          {albumState.albums.length > 0 && visibleAlbums.length > 0 ? (
            <>
              <div
                className={cn(
                  "mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
                  albumState.isPageLoading && "opacity-60",
                )}
                aria-busy={albumState.isPageLoading}
              >
                {visibleAlbums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    isSelected={album.id === selectedAlbum?.id}
                    onSelect={() =>
                      setSelectedAlbumId((currentAlbumId) =>
                        currentAlbumId === album.id ? "" : album.id,
                      )
                    }
                  />
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-2 text-sm text-[#FFF4E8]/55 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {albumSearchQuery
                    ? `Showing ${visibleAlbums.length.toLocaleString()} matching ${visibleAlbums.length === 1 ? "album" : "albums"} from page ${albumCurrentPage}`
                    : `Showing ${albumFirstNumber.toLocaleString()}-${albumLastNumber.toLocaleString()} of ${albumState.paging.total.toLocaleString()}`}
                </p>
                {albumState.isPageLoading ? (
                  <p className="inline-flex items-center gap-2 text-[#FFF4E8]/65">
                    <Loader2 className="size-4 animate-spin" />
                    Loading saved albums
                  </p>
                ) : null}
              </div>

              <SelectedAlbumBanner
                album={selectedAlbum}
                isLoading={importSummaryState.status === "loading"}
                onReviewImport={reviewSelectedAlbumImport}
              />
            </>
          ) : null}

          {albumState.albums.length > 0 &&
          visibleAlbums.length === 0 &&
          !albumState.isPageLoading ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/8 p-8 text-center">
              <p className="text-sm font-medium text-[#FFF4E8]">
                No matching albums on this page.
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/55">
                Try another search term, clear the search, or page through more
                saved albums.
              </p>
            </div>
          ) : null}

          {albumState.pageError ? (
            <div
              className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-[#FFF4E8]/70 sm:flex-row sm:items-center sm:justify-between"
              role="status"
            >
              <p>{albumState.pageError}</p>
              {shouldShowAlbumReconnect ? (
                <Button
                  asChild
                  className="h-10 shrink-0 rounded-full bg-[#1DB954] px-5 text-sm font-semibold text-[#041008] hover:bg-[#22d162]"
                >
                  <a href={SPOTIFY_AUTH_START_PATH}>Reconnect Spotify</a>
                </Button>
              ) : null}
            </div>
          ) : null}

          {albumState.hasLoaded &&
          albumState.albums.length === 0 &&
          !albumState.pageError ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/8 p-8 text-center">
              <p className="text-sm font-medium text-[#FFF4E8]">
                No saved albums found.
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/55">
                Spotify saved albums are albums added to your library. Liked
                songs are separate and are not included here yet.
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      {sourceMode === "playlists" && playlists.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/8 p-8 text-center">
          <p className="text-sm font-medium text-[#FFF4E8]">
            No playlists found.
          </p>
        </div>
      ) : null}

      {importSummaryState.status === "error" ? (
        <div
          className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-[#FFF4E8]/70 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p>{importSummaryState.message}</p>
          {shouldShowReconnect ? (
            <Button
              asChild
              className="h-10 shrink-0 rounded-full bg-[#1DB954] px-5 text-sm font-semibold text-[#041008] hover:bg-[#22d162]"
            >
              <a href={SPOTIFY_AUTH_START_PATH}>Reconnect Spotify</a>
            </Button>
          ) : null}
        </div>
      ) : null}

      <ImportSummaryDialog
        isOpen={isImportSummaryOpen}
        summary={
          importSummaryState.status === "ready"
            ? importSummaryState.summary
            : null
        }
        onClose={() => setIsImportSummaryOpen(false)}
      />
    </section>
  );
}

export function ConnectedWorkspace({
  initialWorkspace,
  showProfilePanel = true,
}: {
  initialWorkspace?: SpotifyWorkspaceSnapshot | null;
  showProfilePanel?: boolean;
}) {
  const [loadState, setLoadState] = useState<LoadState>(
    initialWorkspace
      ? {
          status: "ready",
          profile: initialWorkspace.profile,
          playlists: initialWorkspace.playlists,
          playlistPaging: {
            limit: PLAYLIST_PAGE_LIMIT,
            offset: 0,
            total: initialWorkspace.totalPlaylists,
            next:
              initialWorkspace.playlists.length < initialWorkspace.totalPlaylists
                ? ""
                : null,
            previous: null,
          },
          isPlaylistPageLoading: false,
          playlistPageError: null,
        }
      : { status: "loading" },
  );

  useEffect(() => {
    if (initialWorkspace) {
      return;
    }

    let isActive = true;

    async function loadSpotifyData() {
      try {
        const [profilePayload, playlistPayload] = await Promise.all([
          fetchJson<SpotifyProfilePayload>("/api/spotify/profile"),
          fetchJson<SpotifyPlaylistPayload>(
            `/api/spotify/playlists?limit=${PLAYLIST_PAGE_LIMIT}`,
          ),
        ]);

        if (!isActive) {
          return;
        }

        setLoadState({
          status: "ready",
          profile: profilePayload.profile,
          playlists: playlistPayload.playlists,
          playlistPaging: playlistPayload.paging,
          isPlaylistPageLoading: false,
          playlistPageError: null,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLoadState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Spotify data could not be loaded.",
        });
      }
    }

    loadSpotifyData();

    return () => {
      isActive = false;
    };
  }, [initialWorkspace]);

  async function loadPlaylistPage(offset: number) {
    const boundedOffset = Math.max(0, offset);

    setLoadState((currentState) =>
      currentState.status === "ready"
        ? {
            ...currentState,
            isPlaylistPageLoading: true,
            playlistPageError: null,
          }
        : currentState,
    );

    try {
      const playlistPayload = await fetchJson<SpotifyPlaylistPayload>(
        `/api/spotify/playlists?${new URLSearchParams({
          limit: PLAYLIST_PAGE_LIMIT.toString(),
          offset: boundedOffset.toString(),
        })}`,
      );

      setLoadState((currentState) =>
        currentState.status === "ready"
          ? {
              ...currentState,
              playlists: playlistPayload.playlists,
              playlistPaging: playlistPayload.paging,
              isPlaylistPageLoading: false,
              playlistPageError: null,
            }
          : currentState,
      );
    } catch (error) {
      setLoadState((currentState) =>
        currentState.status === "ready"
          ? {
              ...currentState,
              isPlaylistPageLoading: false,
              playlistPageError:
                error instanceof Error
                  ? error.message
                  : "Spotify playlists could not be loaded.",
            }
          : currentState,
      );
    }
  }

  if (loadState.status === "loading") {
    return (
      <div>
        <LoadingPanel showProfilePanel={showProfilePanel} />
      </div>
    );
  }

  if (loadState.status === "error") {
    return <ErrorPanel message={loadState.message} />;
  }

  return (
    <div>
      <div
        className={cn(
          "grid gap-6",
          showProfilePanel ? "lg:grid-cols-[0.85fr_1.4fr]" : "lg:grid-cols-1",
        )}
      >
        {showProfilePanel ? <ProfilePanel profile={loadState.profile} /> : null}
        <PlaylistPicker
          playlists={loadState.playlists}
          paging={loadState.playlistPaging}
          isPageLoading={loadState.isPlaylistPageLoading}
          pageError={loadState.playlistPageError}
          onPageChange={loadPlaylistPage}
        />
      </div>
    </div>
  );
}
