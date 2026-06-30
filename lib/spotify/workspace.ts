import { apiCacheKeys, getOrSetApiCache } from "@/lib/cache/api-cache";
import { getSessionSecretEnv } from "@/lib/config";
import {
  createDiscogsSearchUnits,
  type DiscogsSearchUnit,
} from "@/lib/matching/discogs-search-units";
import {
  decodeSpotifySession,
  shouldRefreshSpotifySession,
  type SpotifySession,
} from "@/lib/spotify/oauth";

export type SpotifyProfile = {
  id: string;
  displayName: string | null;
  country: string | null;
  product: string | null;
  uri: string;
  externalUrl: string | null;
  imageUrl: string | null;
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  trackCount: number;
  ownerName: string | null;
  isPublic: boolean | null;
  isCollaborative: boolean;
  uri: string;
  externalUrl: string | null;
  snapshotId: string;
};

export type SpotifySavedAlbum = {
  id: string;
  name: string;
  primaryArtist: string;
  imageUrl: string | null;
  trackCount: number;
  albumType: string | null;
  releaseDate: string | null;
  addedAt: string;
  uri: string;
  externalUrl: string | null;
};

export type SpotifySourceTrack = {
  id: string | null;
  name: string;
  primaryArtist: string;
  primaryArtistId: string | null;
  externalUrl: string | null;
  albumName: string;
  albumId: string | null;
  albumExternalUrl: string | null;
  albumType: string | null;
  albumImageUrl: string | null;
};

export type SpotifyAlbumCandidate = {
  id: string;
  album: string;
  primaryArtist: string;
  primaryArtistId: string | null;
  albumType: string | null;
  imageUrl: string | null;
  albumExternalUrl: string | null;
  artistImageUrl: string | null;
  releaseDate: string | null;
  sourceTracks: SpotifySourceTrack[];
  sourceTrackCount: number;
  duplicateTracksRemoved: number;
  isCompilation: boolean;
  handlingNote: string;
};

export type SpotifyPlaylistImportSummary = {
  sourceType: "playlist" | "album";
  playlistId: string;
  playlistName: string | null;
  playlistTrackTotal: number;
  reviewedTrackTotal: number;
  isTruncated: boolean;
  sourceTracksFound: number;
  skippedTracks: number;
  uniqueAlbumCandidates: number;
  duplicateTracksRemoved: number;
  compilationCandidates: number;
  lowQualityReasons: string[];
  albumCandidates: SpotifyAlbumCandidate[];
  discogsSearchUnits: DiscogsSearchUnit[];
};

export type SpotifyWorkspaceSnapshot = {
  profile: SpotifyProfile;
  playlists: SpotifyPlaylist[];
  totalPlaylists: number;
};

type SpotifyProfileResponse = {
  id: string;
  display_name?: string | null;
  country?: string;
  product?: string;
  uri: string;
      external_urls?: {
        spotify?: string;
      };
  images?: Array<{
    url: string;
  }>;
};

type SpotifyPlaylistListResponse = {
  items: Array<{
    id: string;
    name: string;
    description?: string | null;
    public?: boolean | null;
    collaborative: boolean;
    snapshot_id: string;
    uri: string;
    external_urls?: {
      spotify?: string;
    };
    images?: Array<{
      url: string;
    }>;
    owner?: {
      display_name?: string | null;
    };
    items?: {
      href?: string;
      total?: number;
    };
    tracks?: {
      href?: string;
      total?: number;
    };
  }>;
  total: number;
};

type SpotifyPlaylistTracksResponse = {
  items?: Array<unknown>;
  total?: number;
  next: string | null;
};

type SpotifyPlaylistTracksImportResponse = {
  items: Array<{
    track?: {
      id?: string | null;
      name?: string;
      type?: string;
      is_local?: boolean;
      artists?: Array<{
        id?: string | null;
        name?: string;
      }>;
      external_urls?: {
        spotify?: string;
      };
      album?: {
        id?: string | null;
        name?: string;
        album_type?: string;
        release_date?: string;
        external_urls?: {
          spotify?: string;
        };
        images?: Array<{
          url: string;
        }>;
        artists?: Array<{
          id?: string | null;
          name?: string;
        }>;
      };
    } | null;
  }>;
  limit: number;
  next: string | null;
  offset: number;
  total: number;
};

type SpotifySavedAlbumsResponse = {
  items: Array<{
    added_at: string;
    album: SpotifyAlbumDetailsResponse;
  }>;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
};

type SpotifyAlbumTracksResponse = {
  items: Array<{
    id?: string | null;
    name?: string;
    type?: string;
    artists?: Array<{
      id?: string | null;
      name?: string;
    }>;
  }>;
  limit: number;
  next: string | null;
  offset: number;
  total: number;
};

type SpotifyAlbumDetailsResponse = {
  id: string;
  name: string;
  album_type?: string;
  release_date?: string;
  total_tracks?: number;
  uri: string;
  external_urls?: {
    spotify?: string;
  };
  images?: Array<{
    url: string;
  }>;
  artists?: Array<{
    id?: string | null;
    name?: string;
  }>;
  tracks?: SpotifyAlbumTracksResponse;
};

type SpotifyArtistsResponse = {
  artists: Array<{
    id: string;
    name?: string;
    images?: Array<{
      url: string;
    }>;
  } | null>;
};

type SpotifyArtistSearchResponse = {
  artists?: {
    items?: Array<{
      id: string;
      name: string;
      images?: Array<{
        url: string;
      }>;
    }>;
  };
};

type SpotifyPlaylistDetailsResponse = {
  id: string;
  name?: string | null;
  snapshot_id?: string;
  tracks?: {
    total?: number;
  };
};

export class SpotifyPlaylistImportError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SpotifyPlaylistImportError";
  }
}

export type SpotifyPlaylistSource = SpotifyPlaylistListResponse["items"][number];

const MAX_IMPORT_TRACKS = 500;

type ImportSummaryCacheOptions = {
  cacheTtlMs?: number;
};

async function fetchSpotifyJson<T>(path: string, session: SpotifySession) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `${session.tokenType} ${session.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

async function fetchSpotifyJsonOrThrow<T>(
  path: string,
  session: SpotifySession,
) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `${session.tokenType} ${session.accessToken}`,
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        error?: {
          message?: string;
        };
      }
    | null;

  if (!response.ok) {
    throw new SpotifyPlaylistImportError(
      payload?.error?.message ??
        `Spotify playlist tracks request failed with status ${response.status}.`,
      response.status,
    );
  }

  return payload as T;
}

async function resolvePlaylistTrackCount(
  playlist: SpotifyPlaylistSource,
  session: SpotifySession,
) {
  const inlineTotal = playlist.items?.total ?? playlist.tracks?.total;

  if (typeof inlineTotal === "number" && inlineTotal > 0) {
    return inlineTotal;
  }

  const tracksHref = playlist.items?.href ?? playlist.tracks?.href;

  if (!tracksHref) {
    return typeof inlineTotal === "number" ? inlineTotal : 0;
  }

  let nextUrl: string | null = tracksHref;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `${session.tokenType} ${session.accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      break;
    }

    const page = (await response.json()) as SpotifyPlaylistTracksResponse;

    if (typeof page.total === "number") {
      return page.total;
    }

    if (!page.next) {
      return page.items?.length ?? inlineTotal ?? 0;
    }

    nextUrl = page.next;
  }

  return inlineTotal ?? 0;
}

function normalizeProfile(profile: SpotifyProfileResponse): SpotifyProfile {
  return {
    id: profile.id,
    displayName: profile.display_name ?? null,
    country: profile.country ?? null,
    product: profile.product ?? null,
    uri: profile.uri,
    externalUrl: profile.external_urls?.spotify ?? null,
    imageUrl: profile.images?.[0]?.url ?? null,
  };
}

function normalizeSavedAlbums(albumPage: SpotifySavedAlbumsResponse) {
  return albumPage.items.map(({ added_at: addedAt, album }) => ({
    id: album.id,
    name: album.name,
    primaryArtist: album.artists?.[0]?.name ?? "Unknown artist",
    imageUrl: album.images?.[0]?.url ?? null,
    trackCount: album.total_tracks ?? album.tracks?.total ?? 0,
    albumType: album.album_type ?? null,
    releaseDate: album.release_date ?? null,
    addedAt,
    uri: album.uri,
    externalUrl: album.external_urls?.spotify ?? null,
  })) satisfies SpotifySavedAlbum[];
}

export async function normalizeSpotifyPlaylists(
  playlistPage: SpotifyPlaylistListResponse,
  session: SpotifySession,
): Promise<SpotifyPlaylist[]> {
  const trackCounts = await Promise.all(
    playlistPage.items.map((playlist) =>
      resolvePlaylistTrackCount(playlist, session),
    ),
  );

  return playlistPage.items.map((playlist, index) => ({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description ?? null,
    imageUrl: playlist.images?.[0]?.url ?? null,
    trackCount: trackCounts[index] ?? 0,
    ownerName: playlist.owner?.display_name ?? null,
    isPublic: playlist.public ?? null,
    isCollaborative: playlist.collaborative,
    uri: playlist.uri,
    externalUrl: playlist.external_urls?.spotify ?? null,
    snapshotId: playlist.snapshot_id,
  }));
}

function getTrackPrimaryArtist(
  track: NonNullable<SpotifyPlaylistTracksImportResponse["items"][number]["track"]>,
) {
  return (
    track.artists?.[0]?.name ??
    track.album?.artists?.[0]?.name ??
    "Unknown artist"
  );
}

function getTrackPrimaryArtistId(
  track: NonNullable<SpotifyPlaylistTracksImportResponse["items"][number]["track"]>,
) {
  return track.artists?.[0]?.id ?? track.album?.artists?.[0]?.id ?? null;
}

function isSpotifyMusicTrack(
  track: NonNullable<SpotifyPlaylistTracksImportResponse["items"][number]["track"]>,
) {
  return !track.type || track.type === "track";
}

function normalizeArtistImageKey(artistName: string) {
  return artistName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getArtistNameImageKey(artistName: string) {
  return `name:${normalizeArtistImageKey(artistName)}`;
}

async function loadSpotifyArtistImageMap(
  rawTracks: SpotifyPlaylistTracksImportResponse["items"],
  session: SpotifySession,
) {
  const artistSignals = rawTracks.flatMap((item) => {
    const track = item.track;

    if (!track || !isSpotifyMusicTrack(track)) {
      return [];
    }

    const artistName = getTrackPrimaryArtist(track);

    if (artistName === "Unknown artist") {
      return [];
    }

    return [
      {
        id: getTrackPrimaryArtistId(track),
        name: artistName,
      },
    ];
  });
  const artistIds = Array.from(
    new Set(
      artistSignals
        .map((artist) => artist.id)
        .filter((artistId): artistId is string => Boolean(artistId)),
    ),
  );
  const artistNames = Array.from(
    new Set(artistSignals.map((artist) => artist.name)),
  );
  const artistImages = new Map<string, string | null>();

  for (let index = 0; index < artistIds.length; index += 50) {
    const ids = artistIds.slice(index, index + 50);
    const artistPage = await fetchSpotifyJson<SpotifyArtistsResponse>(
      `/artists?${new URLSearchParams({ ids: ids.join(",") })}`,
      session,
    );

    for (const artist of artistPage?.artists ?? []) {
      if (artist) {
        const imageUrl = artist.images?.[0]?.url ?? null;

        artistImages.set(artist.id, imageUrl);

        if (artist.name) {
          artistImages.set(getArtistNameImageKey(artist.name), imageUrl);
        }
      }
    }
  }

  for (const artistName of artistNames) {
    const nameKey = getArtistNameImageKey(artistName);

    if (artistImages.get(nameKey)) {
      continue;
    }

    const searchPage = await fetchSpotifyJson<SpotifyArtistSearchResponse>(
      `/search?${new URLSearchParams({
        q: artistName,
        type: "artist",
        limit: "5",
      })}`,
      session,
    );
    const normalizedArtistName = normalizeArtistImageKey(artistName);
    const artistMatch =
      searchPage?.artists?.items?.find(
        (artist) => normalizeArtistImageKey(artist.name) === normalizedArtistName,
      ) ?? searchPage?.artists?.items?.[0];

    if (artistMatch) {
      const imageUrl = artistMatch.images?.[0]?.url ?? null;

      artistImages.set(nameKey, imageUrl);
      artistImages.set(artistMatch.id, imageUrl);
    }
  }

  return artistImages;
}

function getCandidateKey(track: SpotifySourceTrack) {
  const albumKey = track.albumId ?? track.albumName.toLowerCase();

  return `${track.primaryArtist.toLowerCase()}::${albumKey}`;
}

function getTrackKey(track: SpotifySourceTrack) {
  return `${getCandidateKey(track)}::${track.name.toLowerCase()}`;
}

function createLowQualityReasons(input: {
  playlistTrackTotal: number;
  sourceTracksFound: number;
  skippedTracks: number;
  uniqueAlbumCandidates: number;
  duplicateTracksRemoved: number;
  compilationCandidates: number;
  isTruncated: boolean;
}) {
  const reasons: string[] = [];

  if (input.playlistTrackTotal === 0) {
    reasons.push("This playlist is empty.");
  }

  if (input.sourceTracksFound === 0 && input.playlistTrackTotal > 0) {
    reasons.push("No usable Spotify track metadata was found.");
  }

  if (input.sourceTracksFound > 0 && input.uniqueAlbumCandidates < 3) {
    reasons.push("The playlist has very few album candidates to match.");
  }

  if (input.skippedTracks > input.sourceTracksFound) {
    reasons.push("Most playlist entries were unavailable or missing album data.");
  }

  if (
    input.sourceTracksFound > 0 &&
    input.duplicateTracksRemoved / input.sourceTracksFound >= 0.4
  ) {
    reasons.push("A large share of source tracks were duplicate album signals.");
  }

  if (
    input.uniqueAlbumCandidates > 0 &&
    input.compilationCandidates / input.uniqueAlbumCandidates >= 0.5
  ) {
    reasons.push("Many candidates look like compilations, so artist matching may be weaker.");
  }

  if (input.isTruncated) {
    reasons.push(
      `Only the first ${MAX_IMPORT_TRACKS.toLocaleString()} playlist entries were reviewed.`,
    );
  }

  return reasons;
}

export function buildPlaylistImportSummary(input: {
  sourceType: "playlist" | "album";
  playlistId: string;
  playlistName: string | null;
  playlistTrackTotal: number;
  rawTracks: SpotifyPlaylistTracksImportResponse["items"];
  artistImages: Map<string, string | null>;
}) {
  const candidates = new Map<
    string,
    {
      album: string;
      primaryArtist: string;
      primaryArtistId: string | null;
      albumType: string | null;
      imageUrl: string | null;
      albumExternalUrl: string | null;
      artistImageUrl: string | null;
      releaseDate: string | null;
      isCompilation: boolean;
      sourceTracks: SpotifySourceTrack[];
      seenTracks: Set<string>;
      duplicateTracksRemoved: number;
    }
  >();
  let skippedTracks = 0;

  for (const item of input.rawTracks) {
    const track = item.track;

    if (
      !track ||
      !isSpotifyMusicTrack(track) ||
      track.is_local ||
      !track.name ||
      !track.album?.name
    ) {
      skippedTracks += 1;
      continue;
    }

    const sourceTrack: SpotifySourceTrack = {
      id: track.id ?? null,
      name: track.name,
      primaryArtist: getTrackPrimaryArtist(track),
      primaryArtistId: getTrackPrimaryArtistId(track),
      externalUrl: track.external_urls?.spotify ?? null,
      albumName: track.album.name,
      albumId: track.album.id ?? null,
      albumExternalUrl: track.album.external_urls?.spotify ?? null,
      albumType: track.album.album_type ?? null,
      albumImageUrl: track.album.images?.[0]?.url ?? null,
    };
    const candidateKey = getCandidateKey(sourceTrack);
    const trackKey = getTrackKey(sourceTrack);
    const currentCandidate =
      candidates.get(candidateKey) ??
      {
        album: sourceTrack.albumName,
        primaryArtist: sourceTrack.primaryArtist,
        primaryArtistId: sourceTrack.primaryArtistId,
        albumType: sourceTrack.albumType,
        imageUrl: sourceTrack.albumImageUrl,
        albumExternalUrl: sourceTrack.albumExternalUrl,
        artistImageUrl: sourceTrack.primaryArtistId
          ? (input.artistImages.get(sourceTrack.primaryArtistId) ??
            input.artistImages.get(getArtistNameImageKey(sourceTrack.primaryArtist)) ??
            null)
          : (input.artistImages.get(getArtistNameImageKey(sourceTrack.primaryArtist)) ??
            null),
        releaseDate: track.album.release_date ?? null,
        isCompilation: sourceTrack.albumType === "compilation",
        sourceTracks: [],
        seenTracks: new Set<string>(),
        duplicateTracksRemoved: 0,
      };

    if (currentCandidate.seenTracks.has(trackKey)) {
      currentCandidate.duplicateTracksRemoved += 1;
      candidates.set(candidateKey, currentCandidate);
      continue;
    }

    currentCandidate.seenTracks.add(trackKey);
    currentCandidate.sourceTracks.push(sourceTrack);
    candidates.set(candidateKey, currentCandidate);
  }

  const albumCandidates = Array.from(candidates.entries())
    .map(([id, candidate]) => {
      const sourceTrackCount = candidate.sourceTracks.length;

      return {
        id,
        album: candidate.album,
        primaryArtist: candidate.primaryArtist,
        primaryArtistId: candidate.primaryArtistId,
        albumType: candidate.albumType,
        imageUrl: candidate.imageUrl,
        albumExternalUrl: candidate.albumExternalUrl,
        artistImageUrl: candidate.artistImageUrl,
        releaseDate: candidate.releaseDate,
        sourceTracks: candidate.sourceTracks,
        sourceTrackCount,
        duplicateTracksRemoved: candidate.duplicateTracksRemoved,
        isCompilation: candidate.isCompilation,
        handlingNote: candidate.isCompilation
          ? "Compilation detected; keep the track artist as the primary Discogs search signal."
          : sourceTrackCount > 1
            ? "Multiple playlist tracks point to this album; send one album candidate forward."
            : "Single source track; keep as a lower-signal album candidate.",
      } satisfies SpotifyAlbumCandidate;
    })
    .sort((first, second) => {
      if (second.sourceTrackCount !== first.sourceTrackCount) {
        return second.sourceTrackCount - first.sourceTrackCount;
      }

      return first.album.localeCompare(second.album);
    });
  const duplicateTracksRemoved = albumCandidates.reduce(
    (total, candidate) => total + candidate.duplicateTracksRemoved,
    0,
  );
  const compilationCandidates = albumCandidates.filter(
    (candidate) => candidate.isCompilation,
  ).length;
  const sourceTracksFound = albumCandidates.reduce(
    (total, candidate) => total + candidate.sourceTrackCount,
    0,
  );
  const summaryCounts = {
    playlistTrackTotal: input.playlistTrackTotal,
    reviewedTrackTotal: input.rawTracks.length,
    isTruncated: input.rawTracks.length < input.playlistTrackTotal,
    sourceTracksFound,
    skippedTracks,
    uniqueAlbumCandidates: albumCandidates.length,
    duplicateTracksRemoved,
    compilationCandidates,
  };
  const discogsSearchUnits = createDiscogsSearchUnits(albumCandidates);

  return {
    playlistId: input.playlistId,
    playlistName: input.playlistName,
    sourceType: input.sourceType,
    ...summaryCounts,
    lowQualityReasons: createLowQualityReasons(summaryCounts),
    albumCandidates,
    discogsSearchUnits,
  } satisfies SpotifyPlaylistImportSummary;
}

export async function loadSpotifyPlaylistImportSummary(
  playlistId: string,
  session: SpotifySession,
  options: ImportSummaryCacheOptions = {},
): Promise<SpotifyPlaylistImportSummary> {
  const playlistDetails =
    await fetchSpotifyJsonOrThrow<SpotifyPlaylistDetailsResponse>(
      `/playlists/${playlistId}?fields=id,name,snapshot_id,tracks(total)`,
      session,
    );
  const snapshotId = playlistDetails.snapshot_id ?? "unknown";
  const cacheKey = apiCacheKeys.spotifyPlaylist(playlistId, snapshotId);

  return getOrSetApiCache(cacheKey, options.cacheTtlMs ?? 0, async () => {
    let offset = 0;
    let total = playlistDetails?.tracks?.total ?? 0;
    const rawTracks: SpotifyPlaylistTracksImportResponse["items"] = [];

    do {
      const tracksPage =
        await fetchSpotifyJsonOrThrow<SpotifyPlaylistTracksImportResponse>(
          `/playlists/${playlistId}/tracks?${new URLSearchParams({
            limit: "100",
            offset: offset.toString(),
          })}`,
          session,
        );

      total = tracksPage.total;
      rawTracks.push(...tracksPage.items);
      offset += tracksPage.limit;
    } while (offset < total && rawTracks.length < MAX_IMPORT_TRACKS);

    const artistImages = await loadSpotifyArtistImageMap(rawTracks, session);

    return buildPlaylistImportSummary({
      sourceType: "playlist",
      playlistId,
      playlistName: playlistDetails?.name ?? null,
      playlistTrackTotal: total,
      rawTracks,
      artistImages,
    });
  });
}

export async function loadSpotifySavedAlbums(input: {
  limit: number;
  offset: number;
  session: SpotifySession;
}) {
  const albumPage = await fetchSpotifyJsonOrThrow<SpotifySavedAlbumsResponse>(
    `/me/albums?${new URLSearchParams({
      limit: input.limit.toString(),
      offset: input.offset.toString(),
    })}`,
    input.session,
  );

  return {
    albums: normalizeSavedAlbums(albumPage),
    paging: {
      limit: albumPage.limit,
      offset: albumPage.offset,
      total: albumPage.total,
      next: albumPage.next,
      previous: albumPage.previous,
    },
  };
}

export async function loadSpotifySavedAlbumImportSummary(
  albumId: string,
  session: SpotifySession,
  options: ImportSummaryCacheOptions = {},
): Promise<SpotifyPlaylistImportSummary> {
  return getOrSetApiCache(
    apiCacheKeys.spotifyAlbum(albumId),
    options.cacheTtlMs ?? 0,
    async () => {
      const album = await fetchSpotifyJsonOrThrow<SpotifyAlbumDetailsResponse>(
        `/albums/${albumId}`,
        session,
      );
      let offset = 0;
      let total = album.tracks?.total ?? album.total_tracks ?? 0;
      const rawTracks: SpotifyPlaylistTracksImportResponse["items"] = [];

      do {
        const trackPage =
          await fetchSpotifyJsonOrThrow<SpotifyAlbumTracksResponse>(
            `/albums/${albumId}/tracks?${new URLSearchParams({
              limit: "50",
              offset: offset.toString(),
            })}`,
            session,
          );

        total = trackPage.total;
        rawTracks.push(
          ...trackPage.items.map((track) => ({
            track: {
              id: track.id ?? null,
              name: track.name,
              type: track.type ?? "track",
              is_local: false,
              artists: album.artists?.length ? album.artists : track.artists,
              external_urls: track.id
                ? {
                    spotify: `https://open.spotify.com/track/${track.id}`,
                  }
                : undefined,
              album: {
                id: album.id,
                name: album.name,
                album_type: album.album_type,
                release_date: album.release_date,
                external_urls: album.external_urls,
                images: album.images,
                artists: album.artists,
              },
            },
          })),
        );
        offset += trackPage.limit;
      } while (offset < total && rawTracks.length < MAX_IMPORT_TRACKS);

      const artistImages = await loadSpotifyArtistImageMap(rawTracks, session);

      return buildPlaylistImportSummary({
        sourceType: "album",
        playlistId: album.id,
        playlistName: album.name,
        playlistTrackTotal: total,
        rawTracks,
        artistImages,
      });
    },
  );
}

export async function loadSpotifyWorkspaceSnapshot(
  sessionCookieValue?: string,
): Promise<SpotifyWorkspaceSnapshot | null> {
  if (!sessionCookieValue) {
    return null;
  }

  const sessionSecret = getSessionSecretEnv();

  if (!sessionSecret.ok) {
    return null;
  }

  const session = decodeSpotifySession(
    sessionCookieValue,
    sessionSecret.secret,
  );

  if (!session) {
    return null;
  }

  if (shouldRefreshSpotifySession(session)) {
    return null;
  }

  const [profilePayload, playlistPayload] = await Promise.all([
    fetchSpotifyJson<SpotifyProfileResponse>("/me", session),
    fetchSpotifyJson<SpotifyPlaylistListResponse>(
      "/me/playlists?limit=12",
      session,
    ),
  ]).catch(() => [null, null] as const);

  if (!profilePayload || !playlistPayload) {
    return null;
  }

  return {
    profile: normalizeProfile(profilePayload),
    playlists: await normalizeSpotifyPlaylists(playlistPayload, session),
    totalPlaylists: playlistPayload.total,
  };
}
