import { afterEach, describe, expect, test, vi } from "vitest";

import { getDiscogsMarketplaceStats } from "@/lib/discogs/client";

const fetchMock = vi.fn();

describe("Discogs marketplace stats", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("asks Discogs for the lowest price in the requested currency", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          num_for_sale: 30,
          lowest_price: { value: 25.15, currency: "GBP" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const stats = await getDiscogsMarketplaceStats({
      releaseId: 9169243,
      token: "token",
      userAgent: "Waxlist/0.1 +http://localhost:3000",
      cacheTtlMs: 0,
      currency: "GBP",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.discogs.com/marketplace/stats/9169243?curr_abbr=GBP",
    );
    expect(stats).toMatchObject({
      releaseId: 9169243,
      numForSale: 30,
      lowestPrice: { value: 25.15, currency: "GBP" },
    });
  });

  test("keeps a release without listings unpriced", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ num_for_sale: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const stats = await getDiscogsMarketplaceStats({
      releaseId: 1,
      token: "token",
      userAgent: "Waxlist/0.1 +http://localhost:3000",
      cacheTtlMs: 0,
    });

    expect(stats.lowestPrice).toBeNull();
  });
});
