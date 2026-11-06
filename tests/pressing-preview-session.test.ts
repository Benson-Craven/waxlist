import { describe, expect, test } from "vitest";

import {
  createPressingPreviewSession,
  readPressingPreviewSession,
} from "@/lib/pressing-proof/preview-session";

const secret = "0123456789abcdef0123456789abcdef";

describe("anonymous pressing preview session", () => {
  test("binds one 24-hour preview to its release family without exposing the IP", () => {
    const value = createPressingPreviewSession({
      secret,
      investigationId: "preview-1",
      familyKey: "master:42",
      ipHash: "private-ip-hash",
      now: new Date("2026-07-30T12:00:00Z"),
    });

    expect(value).not.toContain("private-ip-hash");
    expect(
      readPressingPreviewSession({
        secret,
        value,
        now: new Date("2026-07-31T11:59:59Z"),
      }),
    ).toMatchObject({
      investigationId: "preview-1",
      familyKey: "master:42",
      ipHash: "private-ip-hash",
    });
  });

  test("rejects expired and tampered preview cookies", () => {
    const value = createPressingPreviewSession({
      secret,
      investigationId: "preview-1",
      familyKey: "master:42",
      ipHash: "private-ip-hash",
      now: new Date("2026-07-30T12:00:00Z"),
    });

    expect(
      readPressingPreviewSession({
        secret,
        value,
        now: new Date("2026-07-31T12:00:01Z"),
      }),
    ).toBeNull();
    expect(
      readPressingPreviewSession({
        secret,
        value: `${value.slice(0, -1)}x`,
        now: new Date("2026-07-30T13:00:00Z"),
      }),
    ).toBeNull();
  });
});
