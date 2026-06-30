import { getSessionSecretEnv, getSpotifyOAuthEnv } from "@/lib/config";
import {
  encodeSpotifySession,
  getSpotifyCookieNames,
  SPOTIFY_SESSION_COOKIE_MAX_AGE_SECONDS,
  SPOTIFY_TOKEN_URL,
  spotifyCookieOptions,
} from "@/lib/spotify/oauth";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type SpotifyTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

function redirectHome(
  request: NextRequest,
  status: "connected" | "error" | "configuration_error",
  reason?: string,
) {
  const url = new URL(status === "connected" ? "/app" : "/", request.url);
  if (status !== "connected") {
    url.searchParams.set("spotify", status);
  }
  if (reason) {
    url.searchParams.set("reason", reason);
  }
  return NextResponse.redirect(url);
}

function redirectWithOAuthError(request: NextRequest, reason: string) {
  const response = redirectHome(request, "error", reason);
  response.cookies.delete(getSpotifyCookieNames().state);
  response.headers.set("x-waxlist-spotify-oauth-error", reason);
  return response;
}

export async function GET(request: NextRequest) {
  const env = getSpotifyOAuthEnv();
  const sessionSecret = getSessionSecretEnv();

  if (!env.ok) {
    const response = redirectHome(request, "configuration_error");
    response.cookies.delete(getSpotifyCookieNames().state);
    response.headers.set("x-waxlist-spotify-oauth-error", "configuration_error");
    return response;
  }

  if (!sessionSecret.ok) {
    const response = redirectHome(request, "configuration_error");
    response.cookies.delete(getSpotifyCookieNames().state);
    response.headers.set(
      "x-waxlist-spotify-oauth-error",
      "session_configuration_error",
    );
    return response;
  }

  const { searchParams } = request.nextUrl;
  const spotifyError = searchParams.get("error");

  if (spotifyError) {
    return redirectWithOAuthError(request, spotifyError);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(getSpotifyCookieNames().state)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithOAuthError(request, "invalid_state");
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
      grant_type: "authorization_code",
      code,
      redirect_uri: env.redirectUri,
    }),
    cache: "no-store",
  });

  const tokenPayload = (await tokenResponse.json()) as SpotifyTokenResponse;

  if (
    !tokenResponse.ok ||
    !tokenPayload.access_token ||
    !tokenPayload.token_type ||
    !tokenPayload.expires_in
  ) {
    return redirectWithOAuthError(
      request,
      tokenPayload.error ?? "token_exchange_failed",
    );
  }

  const response = redirectHome(request, "connected");
  response.cookies.delete(getSpotifyCookieNames().state);
  response.cookies.set(
    getSpotifyCookieNames().session,
    encodeSpotifySession(
      {
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token,
        expiresIn: tokenPayload.expires_in,
        scope: tokenPayload.scope,
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
