import { getSessionSecretEnv, getSpotifyOAuthEnv } from "@/lib/config";
import {
  decodeSpotifySession,
  encodeSpotifySession,
  getSpotifyCookieNames,
  SPOTIFY_SESSION_COOKIE_MAX_AGE_SECONDS,
  shouldRefreshSpotifySession,
  spotifyCookieOptions,
  SPOTIFY_TOKEN_URL,
  type SpotifySession,
} from "@/lib/spotify/oauth";
import { type NextRequest, NextResponse } from "next/server";

const SPOTIFY_API_URL = "https://api.spotify.com/v1";
type SpotifyRefreshResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
};

type SpotifyApiError = {
  error: {
    status?: number;
    message?: string;
  };
};

export type SpotifyAuthorizedRequest =
  | {
      ok: true;
      session: SpotifySession;
      response?: NextResponse;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...extra,
      },
    },
    { status },
  );
}

async function refreshSpotifySession(
  session: SpotifySession,
): Promise<SpotifyAuthorizedRequest> {
  if (!session.refreshToken) {
    return {
      ok: false,
      response: jsonError(
        401,
        "spotify_session_expired",
        "Spotify session expired. Connect Spotify again.",
      ),
    };
  }

  const env = getSpotifyOAuthEnv();
  const sessionSecret = getSessionSecretEnv();

  if (!env.ok) {
    return {
      ok: false,
      response: jsonError(500, "spotify_configuration_error", env.message, {
        missing: env.missing,
      }),
    };
  }

  if (!sessionSecret.ok) {
    return {
      ok: false,
      response: jsonError(
        500,
        "spotify_session_configuration_error",
        sessionSecret.message,
        {
          missing: sessionSecret.missing,
        },
      ),
    };
  }

  const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.clientId}:${env.clientSecret}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
    cache: "no-store",
  });

  const tokenPayload = (await tokenResponse.json()) as SpotifyRefreshResponse;

  if (
    !tokenResponse.ok ||
    !tokenPayload.access_token ||
    !tokenPayload.token_type ||
    !tokenPayload.expires_in
  ) {
    return {
      ok: false,
      response: jsonError(
        401,
        tokenPayload.error ?? "spotify_refresh_failed",
        "Spotify session could not be refreshed. Connect Spotify again.",
      ),
    };
  }

  const refreshedSession: SpotifySession = {
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + tokenPayload.expires_in * 1000,
    scope: tokenPayload.scope ?? session.scope,
    tokenType: tokenPayload.token_type,
  };
  const response = new NextResponse(null);

  response.cookies.set(
    getSpotifyCookieNames().session,
    encodeSpotifySession(
      {
        accessToken: refreshedSession.accessToken,
        refreshToken: refreshedSession.refreshToken,
        expiresIn: tokenPayload.expires_in,
        scope: refreshedSession.scope,
        tokenType: refreshedSession.tokenType,
      },
      sessionSecret.secret,
    ),
    {
      ...spotifyCookieOptions,
      maxAge: SPOTIFY_SESSION_COOKIE_MAX_AGE_SECONDS,
    },
  );

  return {
    ok: true,
    session: refreshedSession,
    response,
  };
}

export async function getSpotifyAuthorizedRequest(
  request: NextRequest,
): Promise<SpotifyAuthorizedRequest> {
  const env = getSpotifyOAuthEnv();
  const sessionSecret = getSessionSecretEnv();

  if (!env.ok) {
    return {
      ok: false,
      response: jsonError(500, "spotify_configuration_error", env.message, {
        missing: env.missing,
      }),
    };
  }

  if (!sessionSecret.ok) {
    return {
      ok: false,
      response: jsonError(
        500,
        "spotify_session_configuration_error",
        sessionSecret.message,
        {
          missing: sessionSecret.missing,
        },
      ),
    };
  }

  const sessionCookie = request.cookies.get(getSpotifyCookieNames().session);

  if (!sessionCookie) {
    return {
      ok: false,
      response: jsonError(
        401,
        "spotify_not_connected",
        "Connect Spotify before requesting profile or playlists.",
      ),
    };
  }

  const session = decodeSpotifySession(
    sessionCookie.value,
    sessionSecret.secret,
  );

  if (!session) {
    return {
      ok: false,
      response: jsonError(
        401,
        "spotify_session_invalid",
        "Spotify session cookie is invalid. Connect Spotify again.",
      ),
    };
  }

  if (shouldRefreshSpotifySession(session)) {
    return refreshSpotifySession(session);
  }

  return {
    ok: true,
    session,
  };
}

export async function fetchSpotifyJson<T>(
  path: string,
  session: SpotifySession,
) {
  const response = await fetch(`${SPOTIFY_API_URL}${path}`, {
    headers: {
      Authorization: `${session.tokenType} ${session.accessToken}`,
    },
    cache: "no-store",
  });
  const payload = (await response.json()) as T | SpotifyApiError;

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

export function spotifyApiErrorResponse(
  status: number,
  payload: unknown,
  fallbackMessage: string,
  cookieResponse?: NextResponse,
) {
  const spotifyError =
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object"
      ? (payload.error as { message?: unknown })
      : undefined;
  const message =
    status === 401
      ? "Spotify session expired or was revoked. Connect Spotify again."
      : typeof spotifyError?.message === "string"
      ? spotifyError.message
      : fallbackMessage;
  const code =
    status === 401 ? "spotify_session_expired" : "spotify_api_error";

  const response = NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );

  copyCookieHeaders(cookieResponse, response);

  return response;
}

export function copyCookieHeaders(
  from: NextResponse | undefined,
  to: NextResponse,
) {
  const setCookie = from?.headers.getSetCookie();

  if (!setCookie) {
    return;
  }

  for (const cookie of setCookie) {
    to.headers.append("set-cookie", cookie);
  }
}
