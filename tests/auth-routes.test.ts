import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as callbackGET } from "@/app/api/auth/spotify/callback/route";
import { GET as loginGET } from "@/app/api/auth/spotify/login/route";
import { GET as refreshGET } from "@/app/api/auth/spotify/refresh/route";
import {
  encodeSpotifySession,
  getSpotifyCookieNames,
} from "@/lib/spotify/oauth";
import { clearEnv, restoreEnv, snapshotEnv } from "./helpers/env";

let envSnapshot: ReturnType<typeof snapshotEnv>;

beforeEach(() => {
  envSnapshot = snapshotEnv();
  clearEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreEnv(envSnapshot);
});

function setValidAuthEnv(input?: { redirectUri?: string }) {
  process.env.SPOTIFY_CLIENT_ID = "client-id";
  process.env.SPOTIFY_CLIENT_SECRET = "client-secret";
  process.env.SPOTIFY_REDIRECT_URI =
    input?.redirectUri ?? "http://localhost:3000/api/auth/spotify/callback";
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";
}

describe("Spotify auth route failures", () => {
  test("login redirects to a landing-page configuration error when env is missing", async () => {
    const response = await loginGET(
      new NextRequest("http://localhost:3000/api/auth/spotify/login"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?spotify=configuration_error&missing=SPOTIFY_CLIENT_ID%2CSPOTIFY_CLIENT_SECRET%2CSPOTIFY_REDIRECT_URI",
    );
  });

  test("callback rejects missing or mismatched state and clears the state cookie", async () => {
    setValidAuthEnv();

    const request = new NextRequest(
      "http://localhost:3000/api/auth/spotify/callback?code=abc&state=actual",
      {
        headers: {
          cookie: `${getSpotifyCookieNames().state}=expected`,
        },
      },
    );
    const response = await callbackGET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?spotify=error&reason=invalid_state",
    );
    expect(response.headers.get("x-waxlist-spotify-oauth-error")).toBe(
      "invalid_state",
    );
    expect(response.headers.getSetCookie().join("\n")).toContain(
      `${getSpotifyCookieNames().state}=`,
    );
  });

  test("callback maps token exchange failures into a recoverable OAuth error", async () => {
    setValidAuthEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Authorization code expired",
          }),
          { status: 400 },
        ),
      ),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/auth/spotify/callback?code=abc&state=expected",
      {
        headers: {
          cookie: `${getSpotifyCookieNames().state}=expected`,
        },
      },
    );
    const response = await callbackGET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?spotify=error&reason=invalid_grant",
    );
    expect(response.headers.get("x-waxlist-spotify-oauth-error")).toBe(
      "invalid_grant",
    );
  });

  test("refresh clears the stale Spotify session when no refresh token is stored", async () => {
    setValidAuthEnv();
    const cookieNames = getSpotifyCookieNames();
    const session = encodeSpotifySession(
      {
        accessToken: "expired-access-token",
        expiresIn: -60,
        tokenType: "Bearer",
      },
      process.env.SESSION_SECRET!,
    );
    const request = new NextRequest(
      "http://localhost:3000/api/auth/spotify/refresh",
      {
        headers: {
          cookie: `${cookieNames.session}=${session}`,
        },
      },
    );
    const response = await refreshGET(request);
    const setCookie = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?spotify=error&reason=session_expired",
    );
    expect(setCookie).toContain(`${cookieNames.session}=`);
    expect(setCookie).toContain("Max-Age=0");
  });

  test("refresh redirects stale sessions back to the configured Spotify host", async () => {
    setValidAuthEnv({
      redirectUri: "http://127.0.0.1:3000/api/auth/spotify/callback",
    });
    const cookieNames = getSpotifyCookieNames();
    const session = encodeSpotifySession(
      {
        accessToken: "expired-access-token",
        expiresIn: -60,
        tokenType: "Bearer",
      },
      process.env.SESSION_SECRET!,
    );
    const request = new NextRequest(
      "http://localhost:3000/api/auth/spotify/refresh",
      {
        headers: {
          cookie: `${cookieNames.session}=${session}`,
        },
      },
    );
    const response = await refreshGET(request);
    const setCookie = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/?spotify=error&reason=session_expired",
    );
    expect(setCookie).toContain(`${cookieNames.session}=`);
    expect(setCookie).toContain("Max-Age=0");
  });

  test("refresh clears the stale Spotify session when Spotify rejects the refresh token", async () => {
    setValidAuthEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Refresh token revoked",
          }),
          { status: 400 },
        ),
      ),
    );

    const cookieNames = getSpotifyCookieNames();
    const session = encodeSpotifySession(
      {
        accessToken: "expired-access-token",
        refreshToken: "revoked-refresh-token",
        expiresIn: -60,
        tokenType: "Bearer",
      },
      process.env.SESSION_SECRET!,
    );
    const request = new NextRequest(
      "http://localhost:3000/api/auth/spotify/refresh",
      {
        headers: {
          cookie: `${cookieNames.session}=${session}`,
        },
      },
    );
    const response = await refreshGET(request);
    const setCookie = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?spotify=error&reason=invalid_grant",
    );
    expect(setCookie).toContain(`${cookieNames.session}=`);
    expect(setCookie).toContain("Max-Age=0");
  });
});
