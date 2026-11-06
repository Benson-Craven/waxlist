import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  getNeonAuthServer: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getNeonAuthServer: mocks.getNeonAuthServer,
}));

import { GET, POST } from "@/app/api/auth/[...path]/route";

function createContext(...path: string[]) {
  return {
    params: Promise.resolve({ path }),
  };
}

function createRequest() {
  return new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "invited@example.com",
      password: "safe-password",
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WAXLIST_BETA_INVITE_EMAILS = "invited@example.com";
  mocks.getNeonAuthServer.mockReturnValue({
    ok: true,
    auth: {
      handler: () => ({
        GET: mocks.get,
        POST: mocks.post,
      }),
    },
  });
});

describe("Managed Neon Auth proxy failure handling", () => {
  test("returns a structured 502 when the sign-in provider throws", async () => {
    mocks.post.mockRejectedValue(new Error("socket hang up"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      createRequest(),
      createContext("sign-in", "email"),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "auth_service_unavailable" },
    });
    expect(errorSpy).toHaveBeenCalledWith("[auth-proxy] POST request failed.");
  });

  test("returns a structured 502 when a session read throws", async () => {
    mocks.get.mockRejectedValue(new Error("ECONNRESET"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(
      new Request("http://127.0.0.1:3000/api/auth/get-session"),
      createContext("get-session"),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "auth_service_unavailable" },
    });
  });

  test("keeps the invite gate ahead of the provider call", async () => {
    mocks.post.mockResolvedValue(Response.json({ ok: true }));
    const request = new Request("http://127.0.0.1:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "unlisted@example.com",
        password: "safe-password",
      }),
    });

    const response = await POST(
      request,
      createContext("sign-up", "email"),
    );

    expect(response.status).toBe(403);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
