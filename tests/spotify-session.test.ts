import { describe, expect, test, vi } from "vitest";
import {
  decodeSpotifySession,
  encodeSpotifySession,
  shouldRefreshSpotifySession,
} from "@/lib/spotify/oauth";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("Spotify session encode/decode", () => {
  test("round-trips encrypted Spotify session cookies without leaking raw tokens", () => {
    vi.setSystemTime(new Date("2026-06-30T12:00:00Z"));

    const encoded = encodeSpotifySession(
      {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 3600,
        scope: "playlist-read-private",
        tokenType: "Bearer",
      },
      SECRET,
    );

    expect(encoded).toMatch(/^v1\./);
    expect(encoded).not.toContain("access-token");
    expect(encoded).not.toContain("refresh-token");
    expect(decodeSpotifySession(encoded, SECRET)).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.parse("2026-06-30T13:00:00Z"),
      scope: "playlist-read-private",
      tokenType: "Bearer",
    });
  });

  test("rejects tampered or wrong-secret session cookies", () => {
    const encoded = encodeSpotifySession(
      {
        accessToken: "access-token",
        expiresIn: 3600,
        tokenType: "Bearer",
      },
      SECRET,
    );

    expect(decodeSpotifySession(`${encoded.slice(0, -1)}x`, SECRET)).toBeUndefined();
    expect(
      decodeSpotifySession(encoded, "abcdef0123456789abcdef0123456789"),
    ).toBeUndefined();
  });

  test("detects sessions inside the refresh skew", () => {
    vi.setSystemTime(new Date("2026-06-30T12:00:00Z"));

    expect(
      shouldRefreshSpotifySession({
        accessToken: "token",
        expiresAt: Date.parse("2026-06-30T12:00:30Z"),
        tokenType: "Bearer",
      }),
    ).toBe(true);
    expect(
      shouldRefreshSpotifySession({
        accessToken: "token",
        expiresAt: Date.parse("2026-06-30T12:05:00Z"),
        tokenType: "Bearer",
      }),
    ).toBe(false);
  });
});
