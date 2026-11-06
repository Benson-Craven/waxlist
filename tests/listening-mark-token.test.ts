import { describe, expect, test } from "vitest";

import {
  createCollectionMarkToken,
  verifyCollectionMarkToken,
} from "@/lib/listening/mark-token";

const secret = "0123456789abcdef0123456789abcdef";
const now = 1_800_000_000_000;

function createToken() {
  return createCollectionMarkToken({
    secret,
    payload: {
      userId: "user-1",
      releaseId: 123,
      masterId: 456,
      artist: "Artist",
      title: "Album",
      format: ["Vinyl", "LP"],
      year: 1999,
      confidence: 91,
      expiresAt: now + 60_000,
    },
  });
}

describe("collection mark tokens", () => {
  test("round-trips a signed reliable match for the expected owner", () => {
    expect(
      verifyCollectionMarkToken({
        token: createToken(),
        expectedUserId: "user-1",
        secret,
        now,
      }),
    ).toMatchObject({
      ok: true,
      payload: {
        releaseId: 123,
        masterId: 456,
        artist: "Artist",
        title: "Album",
        confidence: 91,
      },
    });
  });

  test("rejects tampering, another owner, and expiry", () => {
    const token = createToken();
    const [payload, tokenSignature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
        releaseId: 999,
      }),
      "utf8",
    ).toString("base64url");

    expect(
      verifyCollectionMarkToken({
        token: `${tamperedPayload}.${tokenSignature}`,
        expectedUserId: "user-1",
        secret,
        now,
      }),
    ).toEqual({ ok: false, code: "invalid" });
    expect(
      verifyCollectionMarkToken({
        token,
        expectedUserId: "user-2",
        secret,
        now,
      }),
    ).toEqual({ ok: false, code: "wrong_owner" });
    expect(
      verifyCollectionMarkToken({
        token,
        expectedUserId: "user-1",
        secret,
        now: now + 60_000,
      }),
    ).toEqual({ ok: false, code: "expired" });
  });
});
