import { NextResponse, type NextRequest } from "next/server";

import { getAuthStatusForOwnerFailure } from "@/lib/auth/notices";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { buildSignInHref } from "@/lib/auth/redirects";
import { createLegacyClaimState } from "@/lib/auth/legacy-claim";
import { requireServerCapability } from "@/lib/capabilities/server";
import {
  getAppUrl,
  getNeonAuthEnv,
  getSpotifyOAuthEnv,
} from "@/lib/config";
import {
  buildSpotifyAuthorizeUrl,
  createSpotifyOAuthState,
  getSpotifyCookieNames,
  spotifyCookieOptions,
} from "@/lib/spotify/oauth";

export const runtime = "nodejs";

const SPOTIFY_CRATE_PATH = "/app?view=crate&source=spotify";

function redirectToOAuthOrigin(request: NextRequest, redirectUri: string) {
  const redirectUrl = new URL(redirectUri);
  const requestHost = request.headers.get("host") ?? request.nextUrl.host;

  if (requestHost === redirectUrl.host) {
    return null;
  }

  return NextResponse.redirect(
    new URL(request.nextUrl.pathname, redirectUrl.origin),
  );
}

export async function GET(request: NextRequest) {
  const env = getSpotifyOAuthEnv();

  if (env.ok) {
    const canonicalRedirect = redirectToOAuthOrigin(request, env.redirectUri);

    if (canonicalRedirect) {
      return canonicalRedirect;
    }
  }

  const resolved = await resolveAuthenticatedOwner();

  if (!resolved.ok) {
    return NextResponse.redirect(
      getAppUrl(
        buildSignInHref({
          next: SPOTIFY_CRATE_PATH,
          source: "spotify",
          status: getAuthStatusForOwnerFailure(resolved.code),
        }),
      ),
    );
  }

  const importCapability = requireServerCapability("spotifyImport");
  const claimCapability = requireServerCapability("spotifyLegacyClaim");
  if (!importCapability.ok && !claimCapability.ok) {
    return NextResponse.json(
      { error: importCapability.error },
      { status: 404 },
    );
  }

  const authEnv = getNeonAuthEnv();

  if (!env.ok) {
    return NextResponse.json(
      {
        error: {
          code: "spotify_configuration_error",
          message: env.message,
          missing: env.missing,
        },
      },
      { status: 500 },
    );
  }

  if (!authEnv.ok) {
    return NextResponse.json(
      {
        error: {
          code: "spotify_configuration_error",
          message: authEnv.message,
          missing: authEnv.missing,
        },
      },
      { status: 500 },
    );
  }

  const state = createSpotifyOAuthState();
  const response = NextResponse.redirect(
    buildSpotifyAuthorizeUrl({
      clientId: env.clientId,
      redirectUri: env.redirectUri,
      state,
      scopes: importCapability.ok
        ? undefined
        : ["user-read-private"],
    }),
  );
  response.cookies.set(
    getSpotifyCookieNames().state,
    createLegacyClaimState({
      nonce: state,
      authUserId: resolved.owner.authUserId,
      secret: authEnv.cookieSecret,
    }),
    {
      ...spotifyCookieOptions,
      maxAge: 10 * 60,
    },
  );

  return response;
}
