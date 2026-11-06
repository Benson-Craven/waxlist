import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { clearEnv, restoreEnv, snapshotEnv } from "./helpers/env";
import {
  encodeSpotifySession,
  getSpotifyCookieNames,
} from "@/lib/spotify/oauth";

const SECRET = "0123456789abcdef0123456789abcdef";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

import { getSpotifyConnectionState } from "@/lib/spotify/connection";

let envSnapshot: ReturnType<typeof snapshotEnv>;

beforeEach(() => {
  envSnapshot = snapshotEnv();
  clearEnv();
  process.env.SESSION_SECRET = SECRET;
  mocks.cookies.mockReset();
});

afterEach(() => {
  restoreEnv(envSnapshot);
});

function mockSessionCookie(value: string | undefined) {
  mocks.cookies.mockResolvedValue({
    get: (name: string) =>
      name === getSpotifyCookieNames().session && value
        ? { name, value }
        : undefined,
  });
}

describe("server Spotify connection state", () => {
  test("reports not connected when the browser holds no Spotify session", async () => {
    mockSessionCookie(undefined);

    await expect(getSpotifyConnectionState("auth-1")).resolves.toBe(
      "not_connected",
    );
  });

  test("reports connected for a live session belonging to this account", async () => {
    mockSessionCookie(
      encodeSpotifySession(
        {
          authUserId: "auth-1",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresIn: 3600,
          tokenType: "Bearer",
        },
        SECRET,
      ),
    );

    await expect(getSpotifyConnectionState("auth-1")).resolves.toBe("connected");
  });

  test("ignores a session minted for another WAXLIST account", async () => {
    mockSessionCookie(
      encodeSpotifySession(
        {
          authUserId: "auth-other",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresIn: 3600,
          tokenType: "Bearer",
        },
        SECRET,
      ),
    );

    await expect(getSpotifyConnectionState("auth-1")).resolves.toBe(
      "not_connected",
    );
  });

  test("treats an expired session with no refresh token as disconnected", async () => {
    mockSessionCookie(
      encodeSpotifySession(
        {
          authUserId: "auth-1",
          accessToken: "access-token",
          expiresIn: -60,
          tokenType: "Bearer",
        },
        SECRET,
      ),
    );

    await expect(getSpotifyConnectionState("auth-1")).resolves.toBe(
      "not_connected",
    );
  });

  test("keeps an expired session that can still be refreshed", async () => {
    mockSessionCookie(
      encodeSpotifySession(
        {
          authUserId: "auth-1",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresIn: -60,
          tokenType: "Bearer",
        },
        SECRET,
      ),
    );

    await expect(getSpotifyConnectionState("auth-1")).resolves.toBe("connected");
  });

  test("does not trust an undecryptable cookie", async () => {
    mockSessionCookie("v1.not-a-real-session");

    await expect(getSpotifyConnectionState("auth-1")).resolves.toBe(
      "not_connected",
    );
  });
});
