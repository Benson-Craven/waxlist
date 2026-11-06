import { NextResponse, type NextRequest } from "next/server";

import {
  claimLegacySpotifyData,
  verifyLegacyClaimState,
} from "@/lib/auth/legacy-claim";
import { getAuthStatusForOwnerFailure } from "@/lib/auth/notices";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { buildSignInHref } from "@/lib/auth/redirects";
import { requireServerCapability } from "@/lib/capabilities/server";
import {
  getAppUrl,
  getNeonAuthEnv,
  getSessionSecretEnv,
  getSpotifyOAuthEnv,
} from "@/lib/config";
import {
  encodeSpotifyCredential,
  encodeSpotifySession,
  getSpotifyCookieNames,
  SPOTIFY_SESSION_COOKIE_MAX_AGE_SECONDS,
  SPOTIFY_TOKEN_URL,
  spotifyCookieOptions,
} from "@/lib/spotify/oauth";

export const runtime = "nodejs";

type SpotifyTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
};

type SpotifyProfileResponse = {
  id?: string;
  display_name?: string | null;
  images?: Array<{ url?: string }>;
};

function redirectClaimResult(
  status: "claimed" | "error",
  reason?: string,
) {
  const url = getAppUrl("/app?view=profile");
  url.searchParams.set("spotifyClaim", status);
  if (reason) url.searchParams.set("reason", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(getSpotifyCookieNames().state);
  response.cookies.delete(getSpotifyCookieNames().session);
  return response;
}

function redirectConnectionResult(
  status: "connected" | "error",
  reason?: string,
) {
  const url = getAppUrl("/app?view=crate&source=spotify");
  url.searchParams.set("spotify", status);
  if (reason) url.searchParams.set("reason", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(getSpotifyCookieNames().state);
  return response;
}

export async function GET(request: NextRequest) {
  const resolved = await resolveAuthenticatedOwner();
  if (!resolved.ok) {
    return NextResponse.redirect(
      getAppUrl(
        buildSignInHref({
          next: "/app?view=crate&source=spotify",
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

  const env = getSpotifyOAuthEnv();
  const authEnv = getNeonAuthEnv();
  const sessionEnv = getSessionSecretEnv();
  if (!env.ok || !authEnv.ok || (importCapability.ok && !sessionEnv.ok)) {
    return importCapability.ok
      ? redirectConnectionResult("error", "configuration_error")
      : redirectClaimResult("error", "configuration_error");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(getSpotifyCookieNames().state)?.value;

  if (
    !code ||
    !verifyLegacyClaimState({
      cookieValue: stateCookie,
      nonce: state,
      authUserId: resolved.owner.authUserId,
      secret: authEnv.cookieSecret,
    })
  ) {
    return importCapability.ok
      ? redirectConnectionResult("error", "invalid_state")
      : redirectClaimResult("error", "invalid_state");
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
  const token = (await tokenResponse.json()) as SpotifyTokenResponse;

  if (!tokenResponse.ok || !token.access_token || !token.token_type) {
    return importCapability.ok
      ? redirectConnectionResult(
          "error",
          token.error ?? "token_exchange_failed",
        )
      : redirectClaimResult(
          "error",
          token.error ?? "token_exchange_failed",
        );
  }

  const profileResponse = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `${token.token_type} ${token.access_token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const profile = (await profileResponse.json()) as SpotifyProfileResponse;

  if (!profileResponse.ok || !profile.id) {
    return importCapability.ok
      ? redirectConnectionResult("error", "profile_lookup_failed")
      : redirectClaimResult("error", "profile_lookup_failed");
  }

  if (
    importCapability.ok &&
    (!sessionEnv.ok || !token.expires_in || token.expires_in <= 0)
  ) {
    return redirectConnectionResult("error", "invalid_token_response");
  }

  const connection =
    importCapability.ok && sessionEnv.ok && token.expires_in
      ? {
          accessTokenEncrypted: encodeSpotifyCredential(
            token.access_token,
            sessionEnv.secret,
          ),
          refreshTokenEncrypted: token.refresh_token
            ? encodeSpotifyCredential(token.refresh_token, sessionEnv.secret)
            : null,
          scope: token.scope ?? null,
          expiresAt: new Date(Date.now() + token.expires_in * 1000),
        }
      : undefined;
  let result: Awaited<ReturnType<typeof claimLegacySpotifyData>>;

  try {
    result = await claimLegacySpotifyData({
      currentUserId: resolved.owner.userId,
      authUserId: resolved.owner.authUserId,
      spotifyUserId: profile.id,
      displayName: profile.display_name ?? resolved.profile.displayName,
      imageUrl:
        profile.images?.find((image) => image.url)?.url ??
        resolved.profile.imageUrl,
      connection,
    });
  } catch {
    console.error("[spotify-callback] Account-link persistence failed.");
    return importCapability.ok
      ? redirectConnectionResult("error", "connection_failed")
      : redirectClaimResult("error", "connection_failed");
  }

  if (!result.ok) {
    return importCapability.ok
      ? redirectConnectionResult("error", result.code)
      : redirectClaimResult("error", result.code);
  }

  if (!importCapability.ok || !sessionEnv.ok || !token.expires_in) {
    return redirectClaimResult("claimed");
  }

  const response = redirectConnectionResult("connected");
  response.cookies.set(
    getSpotifyCookieNames().session,
    encodeSpotifySession(
      {
        authUserId: resolved.owner.authUserId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresIn: token.expires_in,
        scope: token.scope,
        tokenType: token.token_type,
      },
      sessionEnv.secret,
    ),
    {
      ...spotifyCookieOptions,
      maxAge: SPOTIFY_SESSION_COOKIE_MAX_AGE_SECONDS,
    },
  );

  return response;
}
