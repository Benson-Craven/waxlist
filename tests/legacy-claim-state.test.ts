import { describe, expect, test } from "vitest";

import {
  createLegacyClaimState,
  verifyLegacyClaimState,
} from "@/lib/auth/legacy-claim";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("legacy claim OAuth state", () => {
  test("binds the nonce to the initiating neutral auth user", () => {
    const cookieValue = createLegacyClaimState({
      nonce: "nonce-1",
      authUserId: "auth-1",
      secret: SECRET,
    });

    expect(
      verifyLegacyClaimState({
        cookieValue,
        nonce: "nonce-1",
        authUserId: "auth-1",
        secret: SECRET,
      }),
    ).toBe(true);
    expect(
      verifyLegacyClaimState({
        cookieValue,
        nonce: "nonce-1",
        authUserId: "auth-2",
        secret: SECRET,
      }),
    ).toBe(false);
  });

  test("rejects a changed nonce or signature", () => {
    const cookieValue = createLegacyClaimState({
      nonce: "nonce-1",
      authUserId: "auth-1",
      secret: SECRET,
    });

    expect(
      verifyLegacyClaimState({
        cookieValue,
        nonce: "nonce-2",
        authUserId: "auth-1",
        secret: SECRET,
      }),
    ).toBe(false);
    expect(
      verifyLegacyClaimState({
        cookieValue: `${cookieValue.slice(0, -1)}x`,
        nonce: "nonce-1",
        authUserId: "auth-1",
        secret: SECRET,
      }),
    ).toBe(false);
  });
});
