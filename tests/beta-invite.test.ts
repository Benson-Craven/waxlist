import { describe, expect, test } from "vitest";

import { evaluateBetaInvite } from "@/lib/auth/invite";

describe("invite-only beta access", () => {
  test("matches allowlisted email addresses case-insensitively", () => {
    expect(
      evaluateBetaInvite({
        email: "BENSON@example.com",
        allowlist: "other@example.com, benson@example.com",
        production: true,
      }),
    ).toEqual({ allowed: true, mode: "allowlist" });
  });

  test("fails closed for an unlisted production signup", () => {
    expect(
      evaluateBetaInvite({
        email: "unlisted@example.com",
        allowlist: "invited@example.com",
        production: true,
      }),
    ).toEqual({ allowed: false, mode: "allowlist" });
  });

  test("fails closed in production when the allowlist is missing", () => {
    expect(
      evaluateBetaInvite({
        email: "anyone@example.com",
        allowlist: "",
        production: true,
      }),
    ).toEqual({ allowed: false, mode: "unconfigured" });
  });

  test("keeps local development usable when no allowlist is configured", () => {
    expect(
      evaluateBetaInvite({
        email: "local@example.com",
        allowlist: "",
        production: false,
      }),
    ).toEqual({ allowed: true, mode: "local-development" });
  });
});
