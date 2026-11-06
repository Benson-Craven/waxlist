import { describe, expect, test } from "vitest";

import { getCanonicalOriginUrlFromHost } from "@/lib/auth/canonical-origin";

describe("canonical auth origin", () => {
  test("leaves a request that already uses the app origin alone", () => {
    expect(
      getCanonicalOriginUrlFromHost({
        requestHost: "127.0.0.1:3000",
        pathWithQuery: "/auth/sign-in?source=spotify",
        configuredAppUrl: "http://127.0.0.1:3000",
      }),
    ).toBeNull();
  });

  test("moves another loopback host onto the canonical origin", () => {
    expect(
      getCanonicalOriginUrlFromHost({
        requestHost: "localhost:3000",
        pathWithQuery: "/auth/sign-in?next=%2Fapp%3Fview%3Dcollection",
        configuredAppUrl: "http://127.0.0.1:3000",
      }),
    ).toBe(
      "http://127.0.0.1:3000/auth/sign-in?next=%2Fapp%3Fview%3Dcollection",
    );
  });

  test("reads the first forwarded host", () => {
    expect(
      getCanonicalOriginUrlFromHost({
        requestHost: "waxlist-beta.example, internal:3000",
        pathWithQuery: "/app",
        configuredAppUrl: "https://waxlist.example",
      }),
    ).toBe("https://waxlist.example/app");
  });

  test("ignores missing, invalid, or non-path input", () => {
    expect(
      getCanonicalOriginUrlFromHost({
        requestHost: null,
        pathWithQuery: "/app",
        configuredAppUrl: "http://127.0.0.1:3000",
      }),
    ).toBeNull();
    expect(
      getCanonicalOriginUrlFromHost({
        requestHost: "localhost:3000",
        pathWithQuery: "/app",
        configuredAppUrl: "not a url",
      }),
    ).toBeNull();
    expect(
      getCanonicalOriginUrlFromHost({
        requestHost: "localhost:3000",
        pathWithQuery: "/app",
        configuredAppUrl: undefined,
      }),
    ).toBeNull();
    expect(
      getCanonicalOriginUrlFromHost({
        requestHost: "localhost:3000",
        pathWithQuery: "https://evil.example",
        configuredAppUrl: "http://127.0.0.1:3000",
      }),
    ).toBeNull();
    expect(
      getCanonicalOriginUrlFromHost({
        requestHost: "localhost:3000",
        pathWithQuery: "//evil.example",
        configuredAppUrl: "http://127.0.0.1:3000",
      }),
    ).toBeNull();
  });

  test("compares hosts including the port", () => {
    expect(
      getCanonicalOriginUrlFromHost({
        requestHost: "127.0.0.1:3001",
        pathWithQuery: "/app",
        configuredAppUrl: "http://127.0.0.1:3000",
      }),
    ).toBe("http://127.0.0.1:3000/app");
  });
});
