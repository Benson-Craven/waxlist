import { describe, expect, test, vi } from "vitest";
import {
  decodeSpotifySession,
  encodeSpotifySession,
  isSpotifySessionForAuthUser,
  shouldRefreshSpotifySession,
} from "@/lib/spotify/oauth";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("Spotify session encode/decode", () => {
  test("round-trips encrypted Spotify session cookies without leaking raw tokens", () => {
    vi.setSystemTime(new Date("2026-06-30T12:00:00Z"));

    const encoded = encodeSpotifySession(
      {
        authUserId: "auth-1",
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
      authUserId: "auth-1",
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
        authUserId: "auth-1",
        accessToken: "access-token",
        expiresIn: 3600,
        tokenType: "Bearer",
      },
      SECRET,
    );
    const parts = encoded.split(".");
    const authTag = parts[2]!;
    parts[2] = `${authTag.startsWith("A") ? "B" : "A"}${authTag.slice(1)}`;

    expect(decodeSpotifySession(parts.join("."), SECRET)).toBeUndefined();
    expect(
      decodeSpotifySession(encoded, "abcdef0123456789abcdef0123456789"),
    ).toBeUndefined();
  });

  test("binds a Spotify session to the WAXLIST auth identity", () => {
    const encoded = encodeSpotifySession(
      {
        authUserId: "auth-1",
        accessToken: "access-token",
        expiresIn: 3600,
        tokenType: "Bearer",
      },
      SECRET,
    );
    const session = decodeSpotifySession(encoded, SECRET)!;

    expect(isSpotifySessionForAuthUser(session, "auth-1")).toBe(true);
    expect(isSpotifySessionForAuthUser(session, "auth-2")).toBe(false);
  });

  test("detects sessions inside the refresh skew", () => {
    vi.setSystemTime(new Date("2026-06-30T12:00:00Z"));

    expect(
      shouldRefreshSpotifySession({
        authUserId: "auth-1",
        accessToken: "token",
        expiresAt: Date.parse("2026-06-30T12:00:30Z"),
        tokenType: "Bearer",
      }),
    ).toBe(true);
    expect(
      shouldRefreshSpotifySession({
        authUserId: "auth-1",
        accessToken: "token",
        expiresAt: Date.parse("2026-06-30T12:05:00Z"),
        tokenType: "Bearer",
      }),
    ).toBe(false);
  });
});
