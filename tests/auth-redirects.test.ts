import { describe, expect, test } from "vitest";

import { buildSignInHref, getSafeNextPath } from "@/lib/auth/redirects";

describe("safe post-sign-in destinations", () => {
  test("keeps a relative workspace path with its query", () => {
    expect(getSafeNextPath("/app?view=collection&q=sade")).toBe(
      "/app?view=collection&q=sade",
    );
  });

  test("falls back when the value is missing or not a path", () => {
    expect(getSafeNextPath(undefined)).toBe("/app");
    expect(getSafeNextPath("")).toBe("/app");
    expect(getSafeNextPath("app")).toBe("/app");
    expect(getSafeNextPath("   ")).toBe("/app");
  });

  test.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "javascript:alert(1)",
    "///evil.example",
  ])("rejects the untrusted destination %s", (value) => {
    expect(getSafeNextPath(value)).toBe("/app");
  });

  test("rejects auth and api routes so a crafted value cannot loop", () => {
    expect(getSafeNextPath("/auth/sign-in")).toBe("/app");
    expect(getSafeNextPath("/auth")).toBe("/app");
    expect(getSafeNextPath("/api/auth/sign-out")).toBe("/app");
  });

  test("rejects destinations with control characters", () => {
    expect(getSafeNextPath("/app\nLocation: https://evil.example")).toBe(
      "/app",
    );
  });

  test("uses an explicit fallback", () => {
    expect(getSafeNextPath("https://evil.example", "/app?view=crate")).toBe(
      "/app?view=crate",
    );
    expect(getSafeNextPath("/app?view=shelf", "/app")).toBe("/app?view=shelf");
  });

  test("returns an empty string when the fallback is empty", () => {
    expect(getSafeNextPath("https://evil.example", "")).toBe("");
  });

  test("reads the first value when the query repeats a parameter", () => {
    expect(getSafeNextPath(["/app?view=crate", "/app?view=shelf"])).toBe(
      "/app?view=crate",
    );
  });
});

describe("sign-in href", () => {
  test("carries the destination, source, and status", () => {
    expect(
      buildSignInHref({
        next: "/app?view=collection",
        source: "listenbrainz",
        status: "auth_required",
      }),
    ).toBe(
      "/auth/sign-in?next=%2Fapp%3Fview%3Dcollection&source=listenbrainz&status=auth_required",
    );
  });

  test("drops an unsafe destination and an unknown source", () => {
    expect(
      buildSignInHref({ next: "//evil.example", source: "unknown-source" }),
    ).toBe("/auth/sign-in");
  });

  test("returns the bare sign-in path without parameters", () => {
    expect(buildSignInHref()).toBe("/auth/sign-in");
  });
});
