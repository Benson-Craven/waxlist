import { describe, expect, test, vi } from "vitest";
import { createDiscogsApiError } from "@/lib/discogs/client";

describe("Discogs error mapping", () => {
  test("maps provider rate limits into friendly structured errors", async () => {
    const error = await createDiscogsApiError(
      new Response(JSON.stringify({ message: "You are making requests too quickly." }), {
        status: 429,
        headers: {
          "retry-after": "12",
          "x-discogs-ratelimit": "60",
          "x-discogs-ratelimit-used": "60",
          "x-discogs-ratelimit-remaining": "0",
        },
      }),
    );

    expect(error.toStructuredError()).toEqual({
      code: "discogs_rate_limited",
      message: "Discogs is rate limiting requests. Please retry in about 12 seconds.",
      status: 429,
      retryAfterSeconds: 12,
      rateLimit: {
        limit: 60,
        used: 60,
        remaining: 0,
      },
      providerMessage: "You are making requests too quickly.",
    });
  });

  test("maps dated Retry-After headers and credential failures", async () => {
    vi.setSystemTime(new Date("2026-06-30T12:00:00Z"));

    const error = await createDiscogsApiError(
      new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 403,
        headers: {
          "retry-after": "Tue, 30 Jun 2026 12:01:30 GMT",
        },
      }),
    );

    expect(error.toStructuredError()).toMatchObject({
      code: "discogs_auth_failed",
      message:
        "Discogs rejected the server credentials. Check DISCOGS_TOKEN and try again.",
      status: 403,
      retryAfterSeconds: 90,
      providerMessage: "Invalid token",
    });
  });
});
