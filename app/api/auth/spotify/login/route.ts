import { getSpotifyOAuthEnv } from "@/lib/config";
import {
  buildSpotifyAuthorizeUrl,
  createSpotifyOAuthState,
  getSpotifyCookieNames,
  spotifyCookieOptions,
} from "@/lib/spotify/oauth";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function redirectWithConfigurationError(request: NextRequest, missing: string[]) {
  const url = new URL("/", request.url);
  url.searchParams.set("spotify", "configuration_error");
  url.searchParams.set("missing", missing.join(","));
  return NextResponse.redirect(url);
}

function redirectToOAuthOrigin(request: NextRequest, redirectUri: string) {
  const redirectUrl = new URL(redirectUri);
  const requestHost = request.headers.get("host");

  if (requestHost === redirectUrl.host) {
    return;
  }

  return NextResponse.redirect(
    new URL(request.nextUrl.pathname, redirectUrl.origin),
  );
}

export async function GET(request: NextRequest) {
  const env = getSpotifyOAuthEnv();

  if (!env.ok) {
    return redirectWithConfigurationError(request, env.missing);
  }

  const canonicalRedirect = redirectToOAuthOrigin(request, env.redirectUri);

  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  const state = createSpotifyOAuthState();
  const authorizeUrl = buildSpotifyAuthorizeUrl({
    clientId: env.clientId,
    redirectUri: env.redirectUri,
    state,
  });

  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(getSpotifyCookieNames().state, state, {
    ...spotifyCookieOptions,
    maxAge: 10 * 60,
  });

  return response;
}
