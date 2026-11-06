import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  deleteAuthIdentityById: vi.fn(),
  deleteOwnerData: vi.fn(),
  getNeonAuthServer: vi.fn(),
  resolveWishlistOwner: vi.fn(),
}));

vi.mock("@/lib/auth/identity-deletion", () => ({
  deleteAuthIdentityById: mocks.deleteAuthIdentityById,
}));

vi.mock("@/lib/auth/server", () => ({
  getNeonAuthServer: mocks.getNeonAuthServer,
}));

vi.mock("@/lib/config", () => ({
  getWishlistEnv: vi.fn(() => ({
    ok: true,
    databaseUrl: "postgres://example.test/waxlist",
  })),
}));

vi.mock("@/lib/spotify/oauth", () => ({
  getSpotifyCookieNames: vi.fn(() => ({
    session: "waxlist_spotify_session",
    state: "waxlist_spotify_state",
  })),
  spotifyCookieOptions: {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  },
}));

vi.mock("@/lib/wishlist/server", () => ({
  clearWishlistSessionCookie: vi.fn(),
  copyWishlistCookieHeaders: vi.fn(),
  deleteOwnerData: mocks.deleteOwnerData,
  resolveWishlistOwner: mocks.resolveWishlistOwner,
}));

import { POST } from "@/app/api/privacy/delete-data/route";

describe("account data deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveWishlistOwner.mockResolvedValue({
      type: "user",
      userId: "user-1",
      authUserId: "auth-1",
      sessionIdHash: null,
    });
    mocks.deleteOwnerData.mockResolvedValue({
      deletedUser: true,
      clearedWishlistSession: false,
    });
  });

  test("falls back to the session-resolved Neon Auth identity when the managed delete endpoint is unavailable", async () => {
    mocks.getNeonAuthServer.mockReturnValue({
      ok: true,
      auth: {
        deleteUser: vi.fn().mockResolvedValue({
          error: {
            status: 404,
          },
        }),
      },
    });
    mocks.deleteAuthIdentityById.mockResolvedValue(true);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/privacy/delete-data", {
        method: "POST",
        headers: {
          accept: "application/json",
        },
      }),
    );

    expect(mocks.deleteAuthIdentityById).toHaveBeenCalledWith("auth-1");
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join("\n")).toContain(
      "waxlist_pressing_preview=;",
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      deletedUser: true,
      deletedAuthUser: true,
    });
  });

  test("fails closed when neither Managed Neon Auth nor the database fallback can delete the identity", async () => {
    mocks.getNeonAuthServer.mockReturnValue({
      ok: true,
      auth: {
        deleteUser: vi.fn().mockResolvedValue({
          error: {
            status: 404,
          },
        }),
      },
    });
    mocks.deleteAuthIdentityById.mockResolvedValue(false);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/privacy/delete-data", {
        method: "POST",
        headers: {
          accept: "application/json",
        },
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "auth_identity_deletion_failed",
        dataDeleted: true,
      },
    });
  });
});
