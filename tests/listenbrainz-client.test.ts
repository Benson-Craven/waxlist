import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ListenBrainzApiError,
  fetchListenBrainzListens,
} from "@/lib/listening/listenbrainz/client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ListenBrainz client", () => {
  test("requests the selected window and at most 500 listens", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ payload: { listens: [], count: 0 } }), {
          status: 200,
          headers: {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "99",
            "X-RateLimit-Reset-In": "60",
          },
        }),
      );

    const result = await fetchListenBrainzListens({
      username: "collector",
      windowDays: 90,
      now: new Date("2026-07-23T12:00:00.000Z"),
    });
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));

    expect(requestUrl.pathname).toBe("/1/user/collector/listens");
    expect(requestUrl.searchParams.get("count")).toBe("500");
    expect(requestUrl.searchParams.get("min_ts")).toBe("1777032000");
    expect(result.rateLimit).toEqual({
      limit: 100,
      remaining: 99,
      resetInSeconds: 60,
    });
  });

  test("maps a missing user into a stable structured error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      }),
    );

    await expect(
      fetchListenBrainzListens({
        username: "missing",
        windowDays: 30,
      }),
    ).rejects.toMatchObject({
      code: "listenbrainz_user_not_found",
      status: 404,
    });
  });

  test("maps provider rate limits with retry guidance", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset-In": "42",
        },
      }),
    );

    try {
      await fetchListenBrainzListens({
        username: "collector",
        windowDays: 30,
      });
      throw new Error("Expected the provider call to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ListenBrainzApiError);
      expect(error).toMatchObject({
        code: "listenbrainz_rate_limited",
        status: 429,
        retryAfterSeconds: 42,
      });
    }
  });
});
