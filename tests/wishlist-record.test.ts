import { describe, expect, it } from "vitest";

import {
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
});
