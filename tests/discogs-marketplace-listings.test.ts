import { afterEach, describe, expect, test, vi } from "vitest";

import { searchDiscogsMarketplaceListings } from "@/lib/discogs/client";

describe("Discogs marketplace listing search", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("normalizes listing, seller, shipping, and rate-limit evidence", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          pagination: {
            page: 1,
            pages: 1,
            per_page: 2,
            items: 2,
          },
          listings: [
            {
              id: 10,
              status: "For Sale",
              uri: "https://www.discogs.com/sell/item/10",
              resource_url: "https://api.discogs.com/marketplace/listings/10",
              condition: "Very Good Plus (VG+)",
              sleeve_condition: "Very Good (VG)",
              comments: "Clean copy",
              ships_from: "United States",
              price: {
                value: 20,
                currency: "USD",
              },
              shipping_price: {
                value: 5.5,
                currency: "USD",
              },
              original_shipping_price: {},
              shipping_is_blocked: false,
              seller: {
                username: "great-seller",
                stats: {
                  rating: "99.8",
                  stars: 5,
                  total: 1200,
                },
                min_order_total: 0,
                shipping: "Combined shipping calculated at checkout.",
              },
              release: {
                id: 100,
                title: "Sade - Diamond Life",
              },
            },
            {
              id: 11,
              shipping_price: {},
              shipping_is_blocked: true,
              seller: {
                username: "blocked-seller",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "x-discogs-ratelimit": "60",
            "x-discogs-ratelimit-used": "7",
            "x-discogs-ratelimit-remaining": "53",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const page = await searchDiscogsMarketplaceListings({
      releaseId: 100,
      token: "discogs-token",
      userAgent: "Waxlist/0.1",
      perPage: 2,
      cacheTtlMs: 0,
    });

    expect(page).toMatchObject({
      releaseId: 100,
      page: 1,
      perPage: 2,
      totalItems: 2,
      freshForSeconds: 0,
      rateLimit: {
        limit: 60,
        used: 7,
        remaining: 53,
      },
    });
    expect(page.listings[0]).toMatchObject({
      id: 10,
      shipsFrom: "United States",
      price: {
        value: 20,
        currency: "USD",
      },
      shippingPrice: {
        value: 5.5,
        currency: "USD",
      },
      originalShippingPrice: null,
      shippingIsBlocked: false,
      seller: {
        username: "great-seller",
        stats: {
          rating: "99.8",
          stars: 5,
          total: 1200,
        },
      },
    });
    expect(page.listings[1]).toMatchObject({
      id: 11,
      shippingPrice: null,
      shippingIsBlocked: true,
      seller: {
        username: "blocked-seller",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.discogs.com/marketplace/search?release_id=100&page=1&per_page=2",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });
});

