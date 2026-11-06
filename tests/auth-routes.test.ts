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
import { createLegacyClaimState } from "@/lib/auth/legacy-claim";

const claimLegacySpotifyData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/owner", () => ({
  resolveAuthenticatedOwner: vi.fn(async () => ({
    ok: true,
    owner: {
      type: "user",
      userId: "user-1",
      authUserId: "auth-1",
      sessionIdHash: null,
    },
    profile: {
      id: "auth-1",
      displayName: "Test user",
      email: "test@example.com",
      imageUrl: null,
    },
  })),
}));

vi.mock("@/lib/auth/legacy-claim", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/legacy-claim")>();

  return {
    ...actual,
    claimLegacySpotifyData,
  };
});

let envSnapshot: ReturnType<typeof snapshotEnv>;

beforeEach(() => {
  envSnapshot = snapshotEnv();
  clearEnv();
  claimLegacySpotifyData.mockReset();
  claimLegacySpotifyData.mockResolvedValue({
    ok: true,
    status: "linked_current",
    userId: "user-1",
  });
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
  process.env.NEON_AUTH_BASE_URL = "https://auth.example.test";
  process.env.NEON_AUTH_COOKIE_SECRET =
    "abcdef0123456789abcdef0123456789";
  process.env.WAXLIST_ENABLE_SPOTIFY_IMPORT = "true";
}

function claimStateCookie(nonce: string) {
  return createLegacyClaimState({
    nonce,
    authUserId: "auth-1",
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  });
}

describe("Spotify auth routes", () => {
  test("beta connection requests the existing playlist and saved-album scopes", async () => {
    setValidAuthEnv();

    const response = await loginGET(
      new NextRequest("http://localhost:3000/api/auth/spotify/login"),
    );
    const location = new URL(response.headers.get("location")!);

    expect(location.searchParams.get("scope")).toContain("user-library-read");
    expect(location.searchParams.get("scope")).toContain(
      "playlist-read-private",
    );
  });

  test("disabled import falls back to the safe profile-only legacy claim", async () => {
    setValidAuthEnv();
    process.env.WAXLIST_ENABLE_SPOTIFY_IMPORT = "false";

    const response = await loginGET(
      new NextRequest("http://localhost:3000/api/auth/spotify/login"),
    );
    const location = new URL(response.headers.get("location")!);

    expect(location.searchParams.get("scope")).toBe("user-read-private");
  });

  test("canonicalizes the OAuth host before checking the host-bound account session", async () => {
    setValidAuthEnv({
      redirectUri: "http://127.0.0.1:3000/api/auth/spotify/callback",
    });

    const response = await loginGET(
      new NextRequest("http://localhost:3000/api/auth/spotify/login"),
    );

    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/api/auth/spotify/login",
    );
  });

  test("legacy claim login fails closed when provider configuration is missing", async () => {
    const response = await loginGET(
      new NextRequest("http://localhost:3000/api/auth/spotify/login"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "spotify_configuration_error",
      },
    });
  });

  test("callback rejects missing or mismatched state and clears the state cookie", async () => {
    setValidAuthEnv();

    const request = new NextRequest(
      "http://localhost:3000/api/auth/spotify/callback?code=abc&state=actual",
      {
        headers: {
          cookie: `${getSpotifyCookieNames().state}=${claimStateCookie("expected")}`,
        },
      },
    );
    const response = await callbackGET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/app?view=crate&source=spotify&spotify=error&reason=invalid_state",
    );
    expect(response.headers.getSetCookie().join("\n")).toContain(
      `${getSpotifyCookieNames().state}=`,
    );
  });

  test("returns callback errors to the configured app origin", async () => {
    setValidAuthEnv({
      redirectUri: "http://127.0.0.1:3000/api/auth/spotify/callback",
    });
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000/";

    const response = await callbackGET(
      new NextRequest(
        "http://localhost:3000/api/auth/spotify/callback?code=abc&state=actual",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/app?view=crate&source=spotify&spotify=error&reason=invalid_state",
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
          cookie: `${getSpotifyCookieNames().state}=${claimStateCookie("expected")}`,
        },
      },
    );
    const response = await callbackGET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/app?view=crate&source=spotify&spotify=error&reason=invalid_grant",
    );
  });

  test("successful connection binds encrypted credentials and an account-bound session", async () => {
    setValidAuthEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            token_type: "Bearer",
            expires_in: 3600,
            scope: "playlist-read-private user-library-read",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "spotify-1",
            display_name: "Spotify user",
            images: [],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await callbackGET(
      new NextRequest(
        "http://localhost:3000/api/auth/spotify/callback?code=abc&state=expected",
        {
          headers: {
            cookie: `${getSpotifyCookieNames().state}=${claimStateCookie("expected")}`,
          },
        },
      ),
    );
    const setCookie = response.headers.getSetCookie().join("\n");

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/app?view=crate&source=spotify&spotify=connected",
    );
    expect(setCookie).toContain(`${getSpotifyCookieNames().session}=v1.`);
    expect(setCookie).not.toContain("access-token");
    expect(setCookie).not.toContain("refresh-token");
    expect(claimLegacySpotifyData).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: "auth-1",
        spotifyUserId: "spotify-1",
        connection: expect.objectContaining({
          accessTokenEncrypted: expect.stringMatching(/^v1\./),
          refreshTokenEncrypted: expect.stringMatching(/^v1\./),
        }),
      }),
    );
  });

  test("callback turns an account-link failure into a recoverable connection error", async () => {
    setValidAuthEnv();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: "access-token",
              refresh_token: "refresh-token",
              token_type: "Bearer",
              expires_in: 3600,
              scope: "playlist-read-private user-library-read",
            }),
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: "spotify-1",
              display_name: "Spotify user",
              images: [],
            }),
          ),
        ),
    );
    claimLegacySpotifyData.mockRejectedValueOnce(
      new Error("Account-link persistence failed."),
    );

    const response = await callbackGET(
      new NextRequest(
        "http://localhost:3000/api/auth/spotify/callback?code=abc&state=expected",
        {
          headers: {
            cookie: `${getSpotifyCookieNames().state}=${claimStateCookie("expected")}`,
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/app?view=crate&source=spotify&spotify=error&reason=connection_failed",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[spotify-callback] Account-link persistence failed.",
    );
  });

  test("refresh clears the stale Spotify session when no refresh token is stored", async () => {
    setValidAuthEnv();
    const cookieNames = getSpotifyCookieNames();
    const session = encodeSpotifySession(
      {
        authUserId: "auth-1",
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

  test("refresh rejects a Spotify session created for another WAXLIST account", async () => {
    setValidAuthEnv();
    const cookieNames = getSpotifyCookieNames();
    const session = encodeSpotifySession(
      {
        authUserId: "auth-other",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: -60,
        tokenType: "Bearer",
      },
      process.env.SESSION_SECRET!,
    );
    const response = await refreshGET(
      new NextRequest("http://localhost:3000/api/auth/spotify/refresh", {
        headers: {
          cookie: `${cookieNames.session}=${session}`,
        },
      }),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?spotify=error&reason=session_expired",
    );
    expect(response.headers.getSetCookie().join("\n")).toContain("Max-Age=0");
  });

  test("refresh redirects stale sessions back to the configured Spotify host", async () => {
    setValidAuthEnv({
      redirectUri: "http://127.0.0.1:3000/api/auth/spotify/callback",
    });
    const cookieNames = getSpotifyCookieNames();
    const session = encodeSpotifySession(
      {
        authUserId: "auth-1",
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
        authUserId: "auth-1",
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
