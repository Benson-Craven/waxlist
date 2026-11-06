import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { clearEnv, restoreEnv, snapshotEnv } from "./helpers/env";
import { getSpotifyCookieNames } from "@/lib/spotify/oauth";

const mocks = vi.hoisted(() => ({
  resolveAuthenticatedOwner: vi.fn(),
  releaseSpotifyConnection: vi.fn(),
}));

vi.mock("@/lib/auth/owner", () => ({
  resolveAuthenticatedOwner: mocks.resolveAuthenticatedOwner,
}));

vi.mock("@/lib/spotify/connection", () => ({
  releaseSpotifyConnection: mocks.releaseSpotifyConnection,
}));

import { POST } from "@/app/api/auth/spotify/logout/route";

let envSnapshot: ReturnType<typeof snapshotEnv>;

beforeEach(() => {
  envSnapshot = snapshotEnv();
  clearEnv();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
  mocks.resolveAuthenticatedOwner.mockResolvedValue({
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
  });
  mocks.releaseSpotifyConnection.mockResolvedValue(undefined);
});

afterEach(() => {
  restoreEnv(envSnapshot);
});

describe("Spotify disconnect", () => {
  test("releases the stored Spotify link so another WAXLIST account can claim it", async () => {
    const response = await POST();
    const cookieNames = getSpotifyCookieNames();
    const setCookie = response.headers.getSetCookie().join("\n");

    expect(mocks.releaseSpotifyConnection).toHaveBeenCalledTimes(1);
    expect(mocks.releaseSpotifyConnection).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:3000/app?view=profile&spotify=disconnected",
    );
    expect(setCookie).toContain(`${cookieNames.session}=`);
    expect(setCookie).toContain(`${cookieNames.state}=`);
    expect(setCookie.match(/Max-Age=0/g)).toHaveLength(2);
  });

  test("clears cookies but never touches another account when signed out", async () => {
    mocks.resolveAuthenticatedOwner.mockResolvedValue({
      ok: false,
      code: "auth_required",
      message: "Sign in to continue.",
      missing: [],
    });

    const response = await POST();

    expect(mocks.releaseSpotifyConnection).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/");
  });

  test("still clears the browser session when the release fails", async () => {
    mocks.releaseSpotifyConnection.mockRejectedValue(new Error("DB_DOWN"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST();

    expect(response.status).toBe(303);
    expect(errorSpy).toHaveBeenCalledWith(
      "[spotify-disconnect] Spotify link release failed.",
    );
    expect(response.headers.getSetCookie().join("\n")).toContain(
      `${getSpotifyCookieNames().session}=`,
    );
  });
});
