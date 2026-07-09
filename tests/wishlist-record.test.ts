import { describe, expect, it } from "vitest";

import {
  createPriceBreakdownFromMarketplaceStats,
  createUnknownPriceBreakdown,
  getEstimatedDeliveredCost,
  getPriceBreakdownDisplay,
  getPriceBreakdownFreshness,
  normalizeWishlistBuyingControls,
  normalizeWishlistRecord,
} from "@/lib/wishlist/record";

const baseWishlistRecord = {
  id: "release:123",
  savedAt: "2026-06-30T21:55:00.000Z",
  spotifyAlbum: "Diamond Life",
  spotifyArtist: "Sade",
  spotifyAlbumId: "spotify-album-1",
  spotifyAlbumUrl: "https://open.spotify.com/album/1",
  discogsReleaseId: 123,
  discogsTitle: "Diamond Life",
  discogsArtist: "Sade",
  discogsUri: "https://www.discogs.com/release/123",
  thumb: null,
  format: ["Vinyl", "LP"],
  year: 1984,
  country: "UK",
  recommendationScore: 94,
  confidence: 91,
  availabilityLabel: "12 listed",
  priceLabel: "$32 median",
  sourceTrackCount: 4,
};

describe("wishlist record normalization", () => {
  it("adds default buying controls to older wishlist records", () => {
    const record = normalizeWishlistRecord(baseWishlistRecord);

    expect(record?.buyingControls).toEqual({
      priority: null,
      tags: [],
      maxItemPrice: null,
      maxShipping: null,
      conditionPreference: null,
      sellerFilter: null,
      regionFilter: null,
      ignoredListingState: "none",
      ignoredListingNote: null,
      updatedAt: null,
    });
  });

  it("adds explicit unknown priceBreakdown states to older wishlist records", () => {
    const record = normalizeWishlistRecord(baseWishlistRecord);

    expect(record?.priceBreakdown).toEqual({
      itemPrice: {
        state: "unknown",
        reason: "legacy_record",
        source: "unknown",
        checkedAt: null,
        freshForSeconds: null,
      },
      shipping: {
        state: "unknown",
        reason: "legacy_record",
        source: "unknown",
        checkedAt: null,
        freshForSeconds: null,
      },
      taxImport: {
        state: "not_calculated",
      },
    });
  });

  it("normalizes buying controls for storage", () => {
    const controls = normalizeWishlistBuyingControls({
      priority: "grail",
      tags: ["jazz", " clean-copy ", "jazz", ""],
      maxItemPrice: " $45 ",
      maxShipping: " $8 ",
      conditionPreference: "VG+ or better",
      sellerFilter: "trusted sellers",
      regionFilter: "US",
      ignoredListingState: "watch_relist",
      ignoredListingNote: "Relisted twice above ceiling",
      updatedAt: "2026-06-30T21:56:00.000Z",
    });

    expect(controls).toEqual({
      priority: "grail",
      tags: ["jazz", "clean-copy"],
      maxItemPrice: "$45",
      maxShipping: "$8",
      conditionPreference: "VG+ or better",
      sellerFilter: "trusted sellers",
      regionFilter: "US",
      ignoredListingState: "watch_relist",
      ignoredListingNote: "Relisted twice above ceiling",
      updatedAt: "2026-06-30T21:56:00.000Z",
    });
  });

  it("rejects unsupported buying-control enum values", () => {
    const controls = normalizeWishlistBuyingControls({
      priority: "urgent",
      ignoredListingState: "blocked",
    });

    expect(controls.priority).toBeNull();
    expect(controls.ignoredListingState).toBe("none");
  });

  it("normalizes malformed priceBreakdown values to explicit unknown states", () => {
    const record = normalizeWishlistRecord({
      ...baseWishlistRecord,
      priceBreakdown: {
        itemPrice: {
          state: "known",
          amountCents: "3200",
          currency: "USD",
          label: "From $32",
          source: "discogs_marketplace_stats",
          checkedAt: "2026-07-09T10:00:00.000Z",
          freshForSeconds: 900,
        },
        shipping: {
          state: "known",
          amountCents: 0,
          currency: "USD",
          label: "$0",
          source: "provider",
          checkedAt: null,
          freshForSeconds: null,
        },
      },
    });

    expect(record?.priceBreakdown.itemPrice).toMatchObject({
      state: "unknown",
      reason: "legacy_record",
      source: "unknown",
    });
    expect(record?.priceBreakdown.shipping).toMatchObject({
      state: "unknown",
      reason: "legacy_record",
      source: "unknown",
    });
  });

  it("normalizes known item prices with malformed checkedAt values to unknown", () => {
    const record = normalizeWishlistRecord({
      ...baseWishlistRecord,
      priceBreakdown: {
        itemPrice: {
          state: "known",
          amountCents: 3200,
          currency: "USD",
          label: "From $32",
          source: "discogs_marketplace_stats",
          checkedAt: "yesterday",
          freshForSeconds: 900,
        },
        shipping: {
          state: "unknown",
          reason: "not_supported_by_source",
          source: "unknown",
          checkedAt: null,
          freshForSeconds: null,
        },
        taxImport: {
          state: "not_calculated",
        },
      },
    });

    expect(record?.priceBreakdown).toEqual({
      itemPrice: {
        state: "unknown",
        reason: "legacy_record",
        source: "unknown",
        checkedAt: null,
        freshForSeconds: null,
      },
      shipping: {
        state: "unknown",
        reason: "legacy_record",
        source: "unknown",
        checkedAt: null,
        freshForSeconds: null,
      },
      taxImport: {
        state: "not_calculated",
      },
    });
  });

  it("creates marketplace-stat item price evidence while keeping shipping unknown", () => {
    const priceBreakdown = createPriceBreakdownFromMarketplaceStats({
      value: 24,
      currency: "USD",
      label: "From $24",
      checkedAt: "2026-07-09T10:00:00.000Z",
      freshForSeconds: 900,
    });

    expect(priceBreakdown).toMatchObject({
      itemPrice: {
        state: "known",
        amountCents: 2400,
        currency: "USD",
        label: "From $24",
        source: "discogs_marketplace_stats",
        checkedAt: "2026-07-09T10:00:00.000Z",
        freshForSeconds: 900,
      },
      shipping: {
        state: "unknown",
        reason: "not_supported_by_source",
        source: "unknown",
        checkedAt: null,
        freshForSeconds: null,
      },
      taxImport: {
        state: "not_calculated",
      },
    });
  });

  it("preserves marketplace source evidence when stats have no usable lowest price", () => {
    const priceBreakdown = createPriceBreakdownFromMarketplaceStats({
      value: null,
      currency: null,
      label: "Price unavailable",
      checkedAt: "2026-07-09T10:00:00.000Z",
      freshForSeconds: 900,
    });

    expect(priceBreakdown.itemPrice).toEqual({
      state: "unknown",
      reason: "not_available_from_source",
      source: "discogs_marketplace_stats",
      checkedAt: "2026-07-09T10:00:00.000Z",
      freshForSeconds: 900,
    });
    expect(priceBreakdown.shipping).toMatchObject({
      state: "unknown",
      reason: "not_supported_by_source",
    });
    expect(getEstimatedDeliveredCost(priceBreakdown)).toMatchObject({
      canShow: false,
      reason: "item_price_unknown",
    });
  });

  it("keeps legacy priceLabel independent of detailed priceBreakdown for compact rows", () => {
    const record = normalizeWishlistRecord({
      ...baseWishlistRecord,
      priceLabel: "Price stale",
      priceBreakdown: createPriceBreakdownFromMarketplaceStats({
        value: null,
        currency: null,
        label: "Price unavailable",
        checkedAt: "2026-07-09T10:00:00.000Z",
        freshForSeconds: 900,
      }),
    });

    expect(record?.priceLabel).toBe("Price stale");
    expect(record?.priceBreakdown.itemPrice).toMatchObject({
      state: "unknown",
      source: "discogs_marketplace_stats",
    });
  });

  it("shows a legacy price hint without using it for estimated delivered cost", () => {
    const display = getPriceBreakdownDisplay(
      createUnknownPriceBreakdown("legacy_record"),
      new Date("2026-07-09T10:10:00.000Z"),
      {
        legacyPriceLabel: "From €20",
      },
    );

    expect(display.itemPrice).toMatchObject({
      label: "No sourced item price stored",
      sourceLabel: "Unknown",
      freshness: "unknown",
      checkedAt: null,
      metaLabel: "No source or checked time stored",
    });
    expect(display.legacyPriceHint).toEqual({
      label: "From €20",
      explanation:
        "Not used for estimated delivered cost because source and checked time are unknown.",
    });
    expect(display.estimatedDeliveredCost).toMatchObject({
      canShow: false,
      reason: "item_price_unknown",
      amountCents: null,
      currency: null,
    });
  });

  it("does not show a legacy price hint when sourced item price exists", () => {
    const display = getPriceBreakdownDisplay(
      createPriceBreakdownFromMarketplaceStats({
        value: 24,
        currency: "USD",
        label: "From $24",
        checkedAt: "2026-07-09T10:00:00.000Z",
        freshForSeconds: 900,
      }),
      new Date("2026-07-09T10:10:00.000Z"),
      {
        legacyPriceLabel: "From $20",
      },
    );

    expect(display.itemPrice.label).toBe("From $24");
    expect(display.legacyPriceHint).toBeNull();
  });

  it("does not treat unknown shipping as zero when deriving estimated total", () => {
    const priceBreakdown = createPriceBreakdownFromMarketplaceStats({
      value: 24,
      currency: "USD",
      label: "From $24",
      checkedAt: "2026-07-09T10:00:00.000Z",
      freshForSeconds: 900,
    });

    expect(getEstimatedDeliveredCost(priceBreakdown)).toEqual({
      canShow: false,
      reason: "shipping_unknown",
      amountCents: null,
      currency: null,
      label: "Not available because shipping is unknown",
    });
  });

  it("shows estimated total only when item price and shipping are defensible", () => {
    const priceBreakdown = {
      itemPrice: {
        state: "known" as const,
        amountCents: 2400,
        currency: "USD",
        label: "From $24",
        source: "discogs_marketplace_stats" as const,
        checkedAt: "2026-07-09T10:00:00.000Z",
        freshForSeconds: 900,
      },
      shipping: {
        state: "known" as const,
        amountCents: 650,
        currency: "USD",
        label: "$6.50",
        source: "provider" as const,
        checkedAt: "2026-07-09T10:00:00.000Z",
        freshForSeconds: 900,
      },
      taxImport: {
        state: "not_calculated" as const,
      },
    };

    expect(getEstimatedDeliveredCost(priceBreakdown)).toEqual({
      canShow: true,
      reason: null,
      amountCents: 3050,
      currency: "USD",
      label: "$30.50",
    });

    expect(
      getEstimatedDeliveredCost({
        ...priceBreakdown,
        shipping: {
          ...priceBreakdown.shipping,
          currency: "EUR",
        },
      }),
    ).toMatchObject({
      canShow: false,
      reason: "currency_mismatch",
      amountCents: null,
    });
  });

  it("computes freshness from checkedAt and fresh threshold", () => {
    const now = new Date("2026-07-09T10:30:00.000Z");

    expect(
      getPriceBreakdownFreshness("2026-07-09T10:15:00.000Z", 900, now),
    ).toBe("fresh");
    expect(
      getPriceBreakdownFreshness("2026-07-09T10:14:59.000Z", 900, now),
    ).toBe("aging");
    expect(
      getPriceBreakdownFreshness("2026-07-08T10:30:00.000Z", 900, now),
    ).toBe("aging");
    expect(
      getPriceBreakdownFreshness("2026-07-08T10:29:59.000Z", 900, now),
    ).toBe("stale");
    expect(getPriceBreakdownFreshness(null, 900, now)).toBe("unknown");
  });

  it("builds inspector display copy with caveats and without final-total claims", () => {
    const display = getPriceBreakdownDisplay(
      createPriceBreakdownFromMarketplaceStats({
        value: 24,
        currency: "USD",
        label: "From $24",
        checkedAt: "2026-07-09T10:00:00.000Z",
        freshForSeconds: 900,
      }),
      new Date("2026-07-09T10:10:00.000Z"),
    );

    expect(display.itemPrice.label).toBe("From $24");
    expect(display.itemPrice.sourceLabel).toBe("Discogs marketplace stats");
    expect(display.shipping.label).toBe("No shipping source stored");
    expect(display.estimatedDeliveredCost.label).toBe(
      "Not available because shipping is unknown",
    );
    expect(display.caveats.join(" ")).toContain(
      "Taxes and import duty are not calculated.",
    );
    expect(display.caveats.join(" ")).toContain(
      "Discogs checkout changes, seller terms, and final cart totals are not included or guaranteed.",
    );
    expect(display.caveats.join(" ")).not.toMatch(/checkout total|final total/i);
  });
});
