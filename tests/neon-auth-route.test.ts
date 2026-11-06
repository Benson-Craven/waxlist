import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  getNeonAuthServer: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getNeonAuthServer: mocks.getNeonAuthServer,
}));

import { POST } from "@/app/api/auth/[...path]/route";

function createContext(...path: string[]) {
  return {
    params: Promise.resolve({ path }),
  };
}

function createRequest(email: string) {
  return new Request("http://localhost:3000/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      name: "Beta user",
      password: "safe-password",
    }),
  });
}

describe("Managed Neon Auth proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAXLIST_BETA_INVITE_EMAILS = "invited@example.com";
    mocks.post.mockResolvedValue(Response.json({ ok: true }));
    mocks.getNeonAuthServer.mockReturnValue({
      ok: true,
      auth: {
        handler: () => ({
          POST: mocks.post,
        }),
      },
    });
  });

  afterEach(() => {
    delete process.env.WAXLIST_BETA_INVITE_EMAILS;
  });

  test("rejects direct email signup for an uninvited account", async () => {
    const response = await POST(
      createRequest("unlisted@example.com"),
      createContext("sign-up", "email"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "beta_invite_required",
      },
    });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  test("allows an invited email signup to reach Managed Neon Auth", async () => {
    const request = createRequest("INVITED@example.com");
    const context = createContext("sign-up", "email");
    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(mocks.post).toHaveBeenCalledWith(request, context);
  });

  test("does not gate non-signup auth requests", async () => {
    const request = createRequest("unlisted@example.com");
    const context = createContext("sign-in", "email");
    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(mocks.post).toHaveBeenCalledWith(request, context);
  });
});
