import { describe, expect, it } from "vitest";

import {
  createWishlistRecordFromSelected,
  type SelectedRecord,
} from "@/lib/workspace/selected-record";
import {
  createPriceBreakdownFromMarketplaceStats,
  normalizeWishlistBuyingControls,
  type WishlistRecord,
} from "@/lib/wishlist/record";

describe("selected record wishlist conversion", () => {
  it("preserves existing priceBreakdown when updating a wantlist record", () => {
    const priceBreakdown = createPriceBreakdownFromMarketplaceStats({
      value: 24,
      currency: "USD",
      label: "From $24",
      checkedAt: "2026-07-09T10:00:00.000Z",
      freshForSeconds: 900,
    });
    const wishlistRecord: WishlistRecord = {
      id: "release:123",
      savedAt: "2026-06-30T21:55:00.000Z",
      spotifyAlbum: "Diamond Life",
      spotifyArtist: "Sade",
      spotifyAlbumId: "spotify-album-1",
      spotifyAlbumUrl: "https://open.spotify.com/album/1",
      discogsReleaseId: 123,
      discogsTitle: "Sade - Diamond Life",
      discogsArtist: "Sade",
      discogsUri: "https://www.discogs.com/release/123",
      thumb: null,
      format: ["Vinyl", "LP"],
      year: 1984,
      country: "UK",
      recommendationScore: 94,
      confidence: 91,
      availabilityLabel: "12 for sale",
      priceLabel: "From $24",
      sourceTrackCount: 4,
      buyingControls: normalizeWishlistBuyingControls(null),
      priceBreakdown,
    };
    const selectedRecord: SelectedRecord = {
      source: "wishlist",
      id: "wishlist:release:123",
      collectionId: null,
      wishlistId: "release:123",
      discogsReleaseId: 123,
      discogsMasterId: null,
      artist: "Sade",
      title: "Sade - Diamond Life",
      format: ["Vinyl", "LP"],
      year: 1984,
      label: null,
      catalogNumber: null,
      barcode: null,
      imageUrl: null,
      mediaCondition: null,
      sleeveCondition: null,
      status: "wanted",
      tags: ["clean-copy"],
      notes: "Avoid noisy copies",
      room: null,
      unit: null,
      shelf: null,
      slot: null,
      priceHintLabel: "From $24",
      discogsUri: "https://www.discogs.com/release/123",
      sourceContext: "Sade - Diamond Life",
      savedAt: "2026-06-30T21:55:00.000Z",
      wishlistRecord,
    };

    const nextRecord = createWishlistRecordFromSelected(selectedRecord);

    expect(nextRecord.buyingControls.tags).toEqual(["clean-copy"]);
    expect(nextRecord.buyingControls.ignoredListingNote).toBe(
      "Avoid noisy copies",
    );
    expect(nextRecord.priceBreakdown).toEqual(priceBreakdown);
  });
});
