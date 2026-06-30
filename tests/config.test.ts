import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  getApiCacheEnv,
  getDatabaseEnv,
  getDiscogsEnv,
  getDiscogsMatchSecurityEnv,
  getSessionSecretEnv,
  getSpotifyOAuthEnv,
} from "@/lib/config";
import { clearEnv, restoreEnv, snapshotEnv } from "./helpers/env";

let envSnapshot: ReturnType<typeof snapshotEnv>;

beforeEach(() => {
  envSnapshot = snapshotEnv();
  clearEnv();
});

afterEach(() => {
  restoreEnv(envSnapshot);
});

describe("environment validation", () => {
  test("reports all missing Spotify OAuth variables clearly", () => {
    expect(getSpotifyOAuthEnv()).toEqual({
      ok: false,
      missing: [
        "SPOTIFY_CLIENT_ID",
        "SPOTIFY_CLIENT_SECRET",
        "SPOTIFY_REDIRECT_URI",
      ],
      message:
        "Missing required Spotify OAuth environment variables: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI.",
    });
  });

  test("rejects Spotify redirect URIs that do not use the callback route", () => {
    process.env.SPOTIFY_CLIENT_ID = "client";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    process.env.SPOTIFY_REDIRECT_URI = "http://127.0.0.1:3000/wrong";

    const result = getSpotifyOAuthEnv();

    expect(result.ok).toBe(false);
    expect(result.message).toContain("/api/auth/spotify/callback");
  });

  test("accepts SESSION_SECRET and AUTH_SECRET only when long enough", () => {
    process.env.SESSION_SECRET = "too-short";
    expect(getSessionSecretEnv()).toMatchObject({
      ok: false,
      missing: [],
    });

    process.env.SESSION_SECRET =
      "0123456789abcdef0123456789abcdef";
    expect(getSessionSecretEnv()).toEqual({
      ok: true,
      secret: "0123456789abcdef0123456789abcdef",
      source: "SESSION_SECRET",
    });
  });

  test("validates Discogs token, user agent, and optional delay", () => {
    process.env.DISCOGS_TOKEN = "discogs-token";
    process.env.DISCOGS_USER_AGENT = "Waxlist/0.1 +http://127.0.0.1:3000";
    process.env.DISCOGS_REQUEST_DELAY_MS = "250";

    expect(getDiscogsEnv()).toEqual({
      ok: true,
      token: "discogs-token",
      userAgent: "Waxlist/0.1 +http://127.0.0.1:3000",
      requestDelayMs: 250,
    });
  });

  test("requires DATABASE_URL for enabled persistent API cache", () => {
    process.env.API_CACHE_TTL_SECONDS = "900";

    const result = getApiCacheEnv();

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Persistent API caching requires DATABASE_URL");
  });

  test("allows API cache to be disabled without DATABASE_URL", () => {
    process.env.API_CACHE_TTL_SECONDS = "0";

    expect(getApiCacheEnv()).toEqual({
      ok: true,
      ttlMs: 0,
    });
  });

  test("validates database URLs and Discogs match security defaults", () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/waxlist";

    expect(getDatabaseEnv()).toEqual({
      ok: true,
      databaseUrl: "postgres://user:pass@localhost:5432/waxlist",
    });
    expect(getDiscogsMatchSecurityEnv()).toEqual({
      ok: true,
      maxBodyBytes: 64 * 1024,
      rateLimitWindowMs: 60 * 1000,
      rateLimitMaxRequests: 8,
    });
  });
});
