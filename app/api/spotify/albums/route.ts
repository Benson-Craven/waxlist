import {
  copyCookieHeaders,
  getSpotifyAuthorizedRequest,
  spotifyApiErrorResponse,
} from "@/lib/spotify/api";
import { getApiCacheEnv } from "@/lib/config";
import { SPOTIFY_OAUTH_SCOPES } from "@/lib/constants";
import {
  loadSpotifySavedAlbumImportSummary,
  loadSpotifySavedAlbums,
  SpotifyPlaylistImportError,
} from "@/lib/spotify/workspace";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

function getMissingAlbumScopes(scope?: string) {
  const grantedScopes = new Set(scope?.split(" ").filter(Boolean) ?? []);

  return SPOTIFY_OAUTH_SCOPES.filter((scopeName) => !grantedScopes.has(scopeName));
}

export async function GET(request: NextRequest) {
  const authorized = await getSpotifyAuthorizedRequest(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const albumId = request.nextUrl.searchParams.get("albumId");

  if (albumId) {
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

    if (!isSpotifyId(albumId)) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_album_id",
            message: "Spotify album id is invalid.",
          },
        },
        { status: 400 },
      );
    }

    try {
      const importSummary = await loadSpotifySavedAlbumImportSummary(
        albumId,
        authorized.session,
        { cacheTtlMs: cacheEnv.ttlMs },
      );
      const response = NextResponse.json({ importSummary });

      copyCookieHeaders(authorized.response, response);

      return response;
    } catch (error) {
      let message = "Spotify album tracks could not be fetched.";

      if (error instanceof SpotifyPlaylistImportError) {
        const missingScopes = getMissingAlbumScopes(authorized.session.scope);

        if (error.status === 403 && missingScopes.includes("user-library-read")) {
          message =
            "Spotify album tracks could not be fetched: Forbidden. Reconnect Spotify to grant user-library-read.";
        } else {
          message = `Spotify album tracks could not be fetched: ${error.message}`;
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

  try {
    const payload = await loadSpotifySavedAlbums({
      limit: getBoundedIntegerParam(
        request.nextUrl.searchParams,
        "limit",
        20,
        1,
        50,
      ),
      offset: getBoundedIntegerParam(
        request.nextUrl.searchParams,
        "offset",
        0,
        0,
        100000,
      ),
      session: authorized.session,
    });
    const response = NextResponse.json(payload);

    copyCookieHeaders(authorized.response, response);

    return response;
  } catch (error) {
    let message = "Spotify saved albums could not be fetched.";

    if (error instanceof SpotifyPlaylistImportError) {
      const missingScopes = getMissingAlbumScopes(authorized.session.scope);

      if (error.status === 403 && missingScopes.includes("user-library-read")) {
        message =
          "Spotify saved albums could not be fetched: Forbidden. Reconnect Spotify to grant user-library-read.";
      } else {
        message = `Spotify saved albums could not be fetched: ${error.message}`;
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
