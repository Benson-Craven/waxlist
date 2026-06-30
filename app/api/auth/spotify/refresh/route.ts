import { getSessionSecretEnv, getSpotifyOAuthEnv } from "@/lib/config";
import {
  decodeSpotifySession,
  encodeSpotifySession,
  getSpotifyCookieNames,
  SPOTIFY_SESSION_COOKIE_MAX_AGE_SECONDS,
  SPOTIFY_TOKEN_URL,
  spotifyCookieOptions,
} from "@/lib/spotify/oauth";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type SpotifyRefreshResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
};

function redirectHome(
  request: NextRequest,
  status: "connected" | "error",
  reason?: string,
) {
  const url = new URL("/", request.url);
  url.searchParams.set("spotify", status);
  if (reason) {
    url.searchParams.set("reason", reason);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const env = getSpotifyOAuthEnv();
  const sessionSecret = getSessionSecretEnv();

  if (!env.ok || !sessionSecret.ok) {
    return redirectHome(request, "error", "session_configuration_error");
  }

  const sessionCookie = request.cookies.get(getSpotifyCookieNames().session);

  if (!sessionCookie) {
    return redirectHome(request, "error", "session_missing");
  }

  const session = decodeSpotifySession(
    sessionCookie.value,
    sessionSecret.secret,
  );

  if (!session?.refreshToken) {
    return redirectHome(request, "error", "session_expired");
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
    return redirectHome(
      request,
      "error",
      tokenPayload.error ?? "session_refresh_failed",
    );
  }

  const response = redirectHome(request, "connected");

  response.cookies.set(
    getSpotifyCookieNames().session,
    encodeSpotifySession(
      {
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token ?? session.refreshToken,
        expiresIn: tokenPayload.expires_in,
        scope: tokenPayload.scope ?? session.scope,
        tokenType: tokenPayload.token_type,
      },
      sessionSecret.secret,
    ),
    {
      ...spotifyCookieOptions,
      maxAge: SPOTIFY_SESSION_COOKIE_MAX_AGE_SECONDS,
    },
  );

  return response;
}
