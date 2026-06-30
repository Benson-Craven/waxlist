import {
  copyCookieHeaders,
  fetchSpotifyJson,
  getSpotifyAuthorizedRequest,
  spotifyApiErrorResponse,
} from "@/lib/spotify/api";
import { getApiCacheEnv } from "@/lib/config";
import { SPOTIFY_OAUTH_SCOPES } from "@/lib/constants";
import {
  loadSpotifyPlaylistImportSummary,
  normalizeSpotifyPlaylists,
  SpotifyPlaylistImportError,
} from "@/lib/spotify/workspace";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type SpotifyPlaylistListResponse = {
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
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
      width?: number | null;
      height?: number | null;
    }>;
    owner?: {
      id?: string;
      display_name?: string | null;
    };
    tracks: {
      href: string;
      total: number;
    };
  }>;
};

function getBoundedIntegerParam(
  searchParams: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const rawValue = searchParams.get(name);

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function isSpotifyId(value: string) {
  return /^[A-Za-z0-9]+$/.test(value);
}

function getMissingImportScopes(scope?: string) {
  const grantedScopes = new Set(scope?.split(" ").filter(Boolean) ?? []);

  return SPOTIFY_OAUTH_SCOPES.filter((scopeName) => !grantedScopes.has(scopeName));
}

export async function GET(request: NextRequest) {
  const authorized = await getSpotifyAuthorizedRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const playlistId = request.nextUrl.searchParams.get("playlistId");

  if (playlistId) {
    const cacheEnv = getApiCacheEnv();

    if (!cacheEnv.ok) {
      return NextResponse.json(
        {
          error: {
            code: "cache_configuration_error",
            message: cacheEnv.message,
            missing: cacheEnv.missing,
          },
        },
        { status: 500 },
      );
    }

    if (!isSpotifyId(playlistId)) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_playlist_id",
            message: "Spotify playlist id is invalid.",
          },
        },
        { status: 400 },
      );
    }

    try {
      const importSummary = await loadSpotifyPlaylistImportSummary(
        playlistId,
        authorized.session,
        { cacheTtlMs: cacheEnv.ttlMs },
      );
      const response = NextResponse.json({ importSummary });

      copyCookieHeaders(authorized.response, response);

      return response;
    } catch (error) {
      let message = "Spotify playlist tracks could not be fetched.";

      if (error instanceof SpotifyPlaylistImportError) {
        const missingScopes = getMissingImportScopes(authorized.session.scope);

        if (error.status === 403 && missingScopes.length > 0) {
          message = `Spotify playlist tracks could not be fetched: Forbidden. Reconnect Spotify to grant ${missingScopes.join(
            ", ",
          )}.`;
        } else if (error.status === 403) {
          message =
            "Spotify playlist tracks could not be fetched: Forbidden. Spotify is not exposing this playlist's tracks to WAXLIST. Choose a playlist you created, or copy these songs into a new playlist in your Spotify account and try that.";
        } else {
          message = `Spotify playlist tracks could not be fetched: ${error.message}`;
        }
      }

      return spotifyApiErrorResponse(
        error instanceof SpotifyPlaylistImportError ? error.status : 502,
        null,
        message,
        authorized.response,
      );
    }
  }

  const limit = getBoundedIntegerParam(
    request.nextUrl.searchParams,
    "limit",
    20,
    1,
    50,
  );
  const offset = getBoundedIntegerParam(
    request.nextUrl.searchParams,
    "offset",
    0,
    0,
    100000,
  );
  const spotifyResponse = await fetchSpotifyJson<SpotifyPlaylistListResponse>(
    `/me/playlists?${new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })}`,
    authorized.session,
  );

  if (!spotifyResponse.ok) {
    return spotifyApiErrorResponse(
      spotifyResponse.status,
      spotifyResponse.payload,
      "Spotify playlists could not be fetched.",
      authorized.response,
    );
  }

  const playlistPage = spotifyResponse.payload as SpotifyPlaylistListResponse;
  const response = NextResponse.json({
    playlists: await normalizeSpotifyPlaylists(
      {
        items: playlistPage.items,
        total: playlistPage.total,
      },
      authorized.session,
    ),
    paging: {
      limit: playlistPage.limit,
      offset: playlistPage.offset,
      total: playlistPage.total,
      next: playlistPage.next,
      previous: playlistPage.previous,
    },
  });

  copyCookieHeaders(authorized.response, response);

  return response;
}
