import { describe, expect, it } from "vitest";

import type { DiscogsMarketplaceListing } from "@/lib/discogs/client";
import {
  buildSellerScoutRun,
  selectSellerScoutWantedRecords,
} from "@/lib/wishlist/seller-scout";
import {
  createUnknownPriceBreakdown,
  type WishlistRecord,
} from "@/lib/wishlist/record";

function wantedRecord(overrides: Partial<WishlistRecord> = {}): WishlistRecord {
  const releaseId = overrides.discogsReleaseId ?? 100;

  return {
    id: `release:${releaseId}`,
    savedAt: "2026-07-09T10:00:00.000Z",
    spotifyAlbum: "Diamond Life",
    spotifyArtist: "Sade",
    spotifyAlbumId: null,
    spotifyAlbumUrl: null,
    discogsReleaseId: releaseId,
    discogsTitle: "Diamond Life",
    discogsArtist: "Sade",
    discogsUri: `https://www.discogs.com/release/${releaseId}`,
    thumb: null,
    format: ["Vinyl", "LP"],
    year: 1984,
    country: "UK",
    recommendationScore: 90,
    confidence: 90,
    availabilityLabel: "3 listed",
    priceLabel: "From $20",
    sourceTrackCount: 4,
    buyingControls: {
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
    },
    priceBreakdown: createUnknownPriceBreakdown("legacy_record"),
    ...overrides,
  };
}

function listing(
  overrides: Partial<DiscogsMarketplaceListing> = {},
): DiscogsMarketplaceListing {
  return {
    id: 500,
    status: "For Sale",
    uri: "https://www.discogs.com/sell/item/500",
    resourceUrl: "https://api.discogs.com/marketplace/listings/500",
    condition: "Very Good Plus (VG+)",
    sleeveCondition: "Very Good Plus (VG+)",
    comments: "Clean copy",
    shipsFrom: "United States",
    price: {
      value: 20,
      currency: "USD",
    },
    shippingPrice: null,
    originalShippingPrice: null,
    shippingIsBlocked: false,
    seller: {
      username: "great-seller",
      stats: {
        rating: "99.8",
        stars: 5,
        total: 1200,
      },
      minOrderTotal: 0,
      shipping: "Combined shipping available at checkout.",
    },
    release: {
      id: 100,
      title: "Sade - Diamond Life",
    },
    ...overrides,
  };
}

function listingInput(
  record: WishlistRecord,
  listings: DiscogsMarketplaceListing[],
  overrides: {
    checkedAt?: string;
    freshForSeconds?: number | null;
  } = {},
) {
  return {
    releaseId: record.discogsReleaseId,
    wantedRecord: record,
    listings,
    checkedAt: overrides.checkedAt ?? "2026-07-09T12:00:00.000Z",
    freshForSeconds: overrides.freshForSeconds ?? 900,
  };
}

describe("seller scout", () => {
  it("groups seller opportunities by distinct wanted releases", () => {
    const firstRecord = wantedRecord({ discogsReleaseId: 100 });
    const secondRecord = wantedRecord({
      discogsReleaseId: 200,
      discogsTitle: "Promise",
    });
    const run = buildSellerScoutRun({
      records: [firstRecord, secondRecord],
      listingInputs: [
        listingInput(firstRecord, [
          listing({ id: 1 }),
          listing({ id: 2, price: { value: 18, currency: "USD" } }),
        ]),
        listingInput(secondRecord, [
          listing({ id: 3, release: { id: 200, title: "Sade - Promise" } }),
        ]),
      ],
      checkedAt: "2026-07-09T12:00:00.000Z",
      maxWants: 25,
      maxListingsPerWant: 5,
    });

    expect(run.opportunities).toHaveLength(1);
    expect(run.opportunities[0]).toMatchObject({
      sellerUsername: "great-seller",
      coverageCount: 2,
      listingCount: 3,
    });
    expect(run.opportunities[0]?.listings.map((entry) => entry.wantedRecordId)).toEqual([
      "release:100",
      "release:200",
    ]);
  });

  it("does not inflate bundle coverage from duplicate listings for one want", () => {
    const record = wantedRecord({ discogsReleaseId: 100 });
    const run = buildSellerScoutRun({
      records: [record],
      listingInputs: [
        listingInput(record, [listing({ id: 1 }), listing({ id: 2 })]),
      ],
      checkedAt: "2026-07-09T12:00:00.000Z",
      maxWants: 25,
      maxListingsPerWant: 5,
    });

    expect(run.opportunities).toHaveLength(0);
    expect(run.singleSellerMatches).toHaveLength(1);
    expect(run.singleSellerMatches[0]?.coverageCount).toBe(1);
  });

  it("keeps unknown shipping unknown instead of zero", () => {
    const firstRecord = wantedRecord({ discogsReleaseId: 100 });
    const secondRecord = wantedRecord({ discogsReleaseId: 200 });
    const run = buildSellerScoutRun({
      records: [firstRecord, secondRecord],
      listingInputs: [
        listingInput(firstRecord, [listing({ id: 1, shippingPrice: null })]),
        listingInput(secondRecord, [
          listing({ id: 2, release: { id: 200, title: "Promise" } }),
        ]),
      ],
      checkedAt: "2026-07-09T12:00:00.000Z",
      maxWants: 25,
      maxListingsPerWant: 5,
    });

    expect(run.opportunities[0]?.shippingSummary).toMatchObject({
      knownCount: 0,
      blockedCount: 0,
      unknownCount: 2,
      label: "Shipping not returned by Discogs",
    });
    expect(run.opportunities[0]?.listings[0]?.shipping).toMatchObject({
      state: "unknown",
      amountCents: null,
      label: "Shipping not returned by Discogs",
    });
  });

  it("surfaces blocked and explicit listing-level shipping evidence", () => {
    const firstRecord = wantedRecord({ discogsReleaseId: 100 });
    const secondRecord = wantedRecord({ discogsReleaseId: 200 });
    const run = buildSellerScoutRun({
      records: [firstRecord, secondRecord],
      listingInputs: [
        listingInput(firstRecord, [
          listing({
            id: 1,
            shippingIsBlocked: true,
          }),
        ]),
        listingInput(secondRecord, [
          listing({
            id: 2,
            release: { id: 200, title: "Promise" },
            shippingPrice: {
              value: 5.5,
              currency: "USD",
            },
          }),
        ]),
      ],
      checkedAt: "2026-07-09T12:00:00.000Z",
      maxWants: 25,
      maxListingsPerWant: 5,
    });

    expect(run.opportunities[0]?.shippingSummary).toMatchObject({
      knownCount: 1,
      blockedCount: 1,
    });
    expect(
      run.opportunities[0]?.listings
        .map((entry) => entry.shipping.state)
        .sort(),
    ).toEqual(["blocked", "known"]);
  });

  it("does not show item subtotal across mixed currencies", () => {
    const firstRecord = wantedRecord({ discogsReleaseId: 100 });
    const secondRecord = wantedRecord({ discogsReleaseId: 200 });
    const run = buildSellerScoutRun({
      records: [firstRecord, secondRecord],
      listingInputs: [
        listingInput(firstRecord, [
          listing({ id: 1, price: { value: 20, currency: "USD" } }),
        ]),
        listingInput(secondRecord, [
          listing({
            id: 2,
            release: { id: 200, title: "Promise" },
            price: { value: 18, currency: "EUR" },
          }),
        ]),
      ],
      checkedAt: "2026-07-09T12:00:00.000Z",
      maxWants: 25,
      maxListingsPerWant: 5,
    });

    expect(run.opportunities[0]?.itemSubtotal).toEqual({
      canShow: false,
      reason: "currency_mismatch",
      amountCents: null,
      currency: null,
      label: "Subtotal unavailable across mixed currencies",
    });
  });

  it("preserves conservative checked time and freshness from listing evidence", () => {
    const firstRecord = wantedRecord({ discogsReleaseId: 100 });
    const secondRecord = wantedRecord({ discogsReleaseId: 200 });
    const run = buildSellerScoutRun({
      records: [firstRecord, secondRecord],
      listingInputs: [
        listingInput(firstRecord, [listing({ id: 1 })], {
          checkedAt: "2026-07-09T12:00:00.000Z",
          freshForSeconds: 900,
        }),
        listingInput(secondRecord, [
          listing({ id: 2, release: { id: 200, title: "Promise" } }),
        ], {
          checkedAt: "2026-07-09T11:30:00.000Z",
          freshForSeconds: 300,
        }),
      ],
      checkedAt: "2026-07-09T12:00:00.000Z",
      maxWants: 25,
      maxListingsPerWant: 5,
    });

    expect(run.opportunities[0]).toMatchObject({
      checkedAt: "2026-07-09T11:30:00.000Z",
      freshForSeconds: 300,
    });
    expect(run.opportunities[0]?.listings[0]).toMatchObject({
      checkedAt: "2026-07-09T12:00:00.000Z",
      freshForSeconds: 900,
    });
  });

  it("counts failed attempted releases as scanned wants", () => {
    const firstRecord = wantedRecord({ discogsReleaseId: 100 });
    const secondRecord = wantedRecord({ discogsReleaseId: 200 });
    const run = buildSellerScoutRun({
      records: [firstRecord, secondRecord],
      listingInputs: [listingInput(firstRecord, [listing({ id: 1 })])],
      failures: [
        {
          releaseId: 200,
          wantedRecordId: secondRecord.id,
          message: "Discogs is rate limiting requests.",
          retryAfterSeconds: 30,
        },
      ],
      checkedAt: "2026-07-09T12:00:00.000Z",
      maxWants: 25,
      maxListingsPerWant: 5,
    });

    expect(run.wantsScanned).toBe(2);
    expect(run.failures[0]).toMatchObject({
      wantedRecordId: "release:200",
      retryAfterSeconds: 30,
    });
  });

  it("uses saved buying controls to rank listing candidates", () => {
    const record = wantedRecord({
      discogsReleaseId: 100,
      buyingControls: {
        ...wantedRecord().buyingControls,
        tags: ["clean-copy"],
        maxItemPrice: "$25",
        maxShipping: "$8",
        conditionPreference: "VG+ or better",
        regionFilter: "United States",
      },
    });
    const run = buildSellerScoutRun({
      records: [record],
      listingInputs: [
        listingInput(record, [
          listing({
            id: 1,
            condition: "Good (G)",
            shipsFrom: "Germany",
            price: { value: 80, currency: "USD" },
            shippingPrice: { value: 12, currency: "USD" },
          }),
          listing({
            id: 2,
            condition: "Very Good Plus (VG+)",
            shipsFrom: "United States",
            price: { value: 20, currency: "USD" },
            shippingPrice: { value: 6, currency: "USD" },
          }),
        ]),
      ],
      checkedAt: "2026-07-09T12:00:00.000Z",
      maxWants: 25,
      maxListingsPerWant: 5,
    });

    expect(run.singleSellerMatches[0]?.listings[0]).toMatchObject({
      listingId: 2,
      controlWarnings: [],
    });
  });

  it("selects prioritized non-ignored wants for bounded scans", () => {
    const selected = selectSellerScoutWantedRecords(
      [
        wantedRecord({
          discogsReleaseId: 1,
          savedAt: "2026-07-09T10:00:00.000Z",
        }),
        wantedRecord({
          discogsReleaseId: 2,
          buyingControls: {
            ...wantedRecord().buyingControls,
            priority: "grail",
          },
        }),
        wantedRecord({
          discogsReleaseId: 3,
          buyingControls: {
            ...wantedRecord().buyingControls,
            ignoredListingState: "ignored",
          },
        }),
      ],
      2,
    );

    expect(selected.map((record) => record.discogsReleaseId)).toEqual([2, 1]);
  });
});
