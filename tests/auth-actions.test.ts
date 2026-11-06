import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { clearEnv, restoreEnv, snapshotEnv } from "./helpers/env";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  getNeonAuthServer: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getNeonAuthServer: mocks.getNeonAuthServer,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import { signInWithEmail, signUpWithEmail } from "@/app/auth/actions";

class RedirectSignal extends Error {
  constructor(readonly destination: string) {
    super(destination);
  }
}

let envSnapshot: ReturnType<typeof snapshotEnv>;

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

function expectRedirect() {
  const call = mocks.redirect.mock.calls.at(-1);

  expect(call).toBeDefined();

  return new URL(String(call?.[0]), "http://127.0.0.1:3000");
}

beforeEach(() => {
  envSnapshot = snapshotEnv();
  clearEnv();
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((destination: string) => {
    throw new RedirectSignal(destination);
  });
  mocks.getNeonAuthServer.mockReturnValue({
    ok: true,
    auth: {
      signIn: { email: mocks.signIn },
      signUp: { email: mocks.signUp },
    },
  });
});

afterEach(() => {
  restoreEnv(envSnapshot);
});

describe("sign-in action", () => {
  test("asks for both fields instead of calling the provider", async () => {
    await expect(
      signInWithEmail(null, formData({ email: "", password: "" })),
    ).resolves.toEqual({ error: "Enter your email and password to continue." });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  test("rejects a malformed email before calling the provider", async () => {
    await expect(
      signInWithEmail(null, formData({ email: "not-an-email", password: "secret" })),
    ).resolves.toEqual({ error: "Enter a valid email address." });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  test("normalises the email but never trims the password", async () => {
    mocks.signIn.mockResolvedValue({
      data: { token: "session-token" },
      error: null,
    });

    await expect(
      signInWithEmail(
        null,
        formData({
          email: "  Benson@Example.com ",
          password: "  spaced password  ",
          source: "listenbrainz",
          next: "/app?view=collection&q=sade",
        }),
      ),
    ).rejects.toBeInstanceOf(RedirectSignal);

    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "benson@example.com",
      password: "  spaced password  ",
    });
    expect(expectRedirect().pathname).toBe("/app");
    expect(expectRedirect().searchParams.get("view")).toBe("collection");
  });

  test("returns friendly copy for rejected credentials", async () => {
    mocks.signIn.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
    });

    const state = await signInWithEmail(
      null,
      formData({ email: "benson@example.com", password: "wrong-password" }),
    );

    expect(state?.error).toMatch(/don't match/);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  test("survives a provider exception", async () => {
    mocks.signIn.mockRejectedValue(new Error("ECONNRESET"));

    await expect(
      signInWithEmail(
        null,
        formData({ email: "benson@example.com", password: "secret-password" }),
      ),
    ).resolves.toMatchObject({ error: expect.stringMatching(/can't reach/) });
  });

  test("ignores an untrusted next value", async () => {
    mocks.signIn.mockResolvedValue({
      data: { token: "session-token" },
      error: null,
    });

    await expect(
      signInWithEmail(
        null,
        formData({
          email: "benson@example.com",
          password: "secret-password",
          next: "//evil.example/steal",
        }),
      ),
    ).rejects.toBeInstanceOf(RedirectSignal);

    expect(expectRedirect().origin).toBe("http://127.0.0.1:3000");
    expect(expectRedirect().pathname).toBe("/app");
    expect(expectRedirect().searchParams.get("view")).toBe("crate");
  });
});

describe("sign-up action", () => {
  test("requires a name", async () => {
    await expect(
      signUpWithEmail(
        null,
        formData({
          name: "  ",
          email: "invited@example.com",
          password: "safe-password",
        }),
      ),
    ).resolves.toMatchObject({ error: expect.stringMatching(/Add your name/) });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  test("requires a password with at least eight characters", async () => {
    await expect(
      signUpWithEmail(
        null,
        formData({
          name: "Beta user",
          email: "invited@example.com",
          password: "short",
        }),
      ),
    ).resolves.toMatchObject({
      error: "Use a password with at least 8 characters.",
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  test("keeps the invite gate", async () => {
    process.env.WAXLIST_BETA_INVITE_EMAILS = "invited@example.com";

    await expect(
      signUpWithEmail(
        null,
        formData({
          name: "Beta user",
          email: "unlisted@example.com",
          password: "safe-password",
        }),
      ),
    ).resolves.toEqual({
      error: "This email is not on the WAXLIST beta invite list.",
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  test("explains an existing account", async () => {
    mocks.signUp.mockResolvedValue({
      data: null,
      error: { code: "USER_ALREADY_EXISTS", status: 409 },
    });

    await expect(
      signUpWithEmail(
        null,
        formData({
          name: "Beta user",
          email: "invited@example.com",
          password: "safe-password",
        }),
      ),
    ).resolves.toMatchObject({ error: expect.stringMatching(/Sign in instead/) });
  });

  test("sends a session-less signup to sign-in with a verification notice", async () => {
    mocks.signUp.mockResolvedValue({ data: { token: null }, error: null });

    await expect(
      signUpWithEmail(
        null,
        formData({
          name: "Beta user",
          email: "invited@example.com",
          password: "safe-password",
          source: "youtube",
          next: "/app?view=crate&source=youtube",
        }),
      ),
    ).rejects.toBeInstanceOf(RedirectSignal);

    const destination = expectRedirect();

    expect(destination.pathname).toBe("/auth/sign-in");
    expect(destination.searchParams.get("status")).toBe("verify_email");
    expect(destination.searchParams.get("next")).toBe(
      "/app?view=crate&source=youtube",
    );
  });

  test("redirects a signed-up account to the requested workspace view", async () => {
    mocks.signUp.mockResolvedValue({
      data: { token: "session-token" },
      error: null,
    });

    await expect(
      signUpWithEmail(
        null,
        formData({
          name: "Beta user",
          email: "invited@example.com",
          password: "safe-password",
          next: "/app?view=collection",
        }),
      ),
    ).rejects.toBeInstanceOf(RedirectSignal);

    expect(expectRedirect().pathname).toBe("/app");
    expect(expectRedirect().searchParams.get("view")).toBe("collection");
  });

  test("returns the configuration message when auth is unavailable", async () => {
    mocks.getNeonAuthServer.mockReturnValue({
      ok: false,
      error: { message: "Missing required Neon Auth environment variables." },
    });

    await expect(
      signUpWithEmail(
        null,
        formData({
          name: "Beta user",
          email: "invited@example.com",
          password: "safe-password",
        }),
      ),
    ).resolves.toEqual({
      error: "Missing required Neon Auth environment variables.",
    });
  });
});
