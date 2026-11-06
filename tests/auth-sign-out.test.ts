import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { clearEnv, restoreEnv, snapshotEnv } from "./helpers/env";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  getNeonAuthServer: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getNeonAuthServer: mocks.getNeonAuthServer,
}));

import { POST } from "@/app/api/auth/sign-out/route";
import { WISHLIST_SESSION_COOKIE } from "@/lib/constants";
import { getSpotifyCookieNames } from "@/lib/spotify/oauth";

let envSnapshot: ReturnType<typeof snapshotEnv>;

beforeEach(() => {
  envSnapshot = snapshotEnv();
  clearEnv();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
  mocks.getNeonAuthServer.mockReturnValue({
    ok: true,
    auth: { signOut: mocks.signOut },
  });
});

afterEach(() => {
  restoreEnv(envSnapshot);
});

describe("sign-out", () => {
  test("ends the account session and every WAXLIST cookie", async () => {
    const response = await POST();
    const cookieNames = getSpotifyCookieNames();
    const setCookie = response.headers.getSetCookie().join("\n");

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/");
    expect(response.headers.get("clear-site-data")).toBe('"cache", "storage"');
    expect(setCookie).toContain(`${cookieNames.session}=`);
    expect(setCookie).toContain(`${cookieNames.state}=`);
    expect(setCookie).toContain(
      `${WISHLIST_SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970`,
    );
    expect(setCookie.match(/Max-Age=0/g)).toHaveLength(2);
  });

  test("still signs out locally when the provider fails", async () => {
    mocks.signOut.mockRejectedValue(new Error("NETWORK_RESET"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST();

    expect(response.status).toBe(303);
    expect(errorSpy).toHaveBeenCalledWith(
      "[auth-sign-out] Provider sign-out failed.",
    );
  });

  test("redirects cleanly when auth is not configured", async () => {
    mocks.getNeonAuthServer.mockReturnValue({
      ok: false,
      error: { message: "Missing NEON_AUTH_BASE_URL." },
    });

    const response = await POST();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/");
  });
});
