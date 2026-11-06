import { describe, expect, it } from "vitest";

import type { CollectionRecord } from "@/lib/collection/record";
import {
  formatCollectionRating,
  normalizeCollectionRating,
  rankTopRatedCollectionRecords,
} from "@/lib/collection/rating";

function record(
  id: string,
  rating: number | null,
  updatedAt: string,
): CollectionRecord {
  return {
    id,
    userId: "user-1",
    discogsReleaseId: Number(id),
    discogsMasterId: null,
    discogsInstanceId: null,
    discogsFolderId: null,
    artist: "Artist",
    title: `Record ${id}`,
    format: ["Vinyl"],
    year: null,
    label: null,
    catalogNumber: null,
    barcode: null,
    imageUrl: null,
    mediaCondition: null,
    sleeveCondition: null,
    rating,
    favourite: false,
    status: "owned",
    tags: [],
    notes: null,
    group: null,
    unit: null,
    shelf: null,
    slot: null,
    priceHintCents: null,
    priceHintCurrency: null,
    priceHintLabel: null,
    syncedAt: updatedAt,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("collection ratings", () => {
  it("normalizes only whole-star ratings from 1 to 5", () => {
    expect(normalizeCollectionRating(5)).toBe(5);
    expect(normalizeCollectionRating("3")).toBe(3);
    expect(normalizeCollectionRating(2.6)).toBe(3);
    expect(normalizeCollectionRating(0)).toBeNull();
    expect(normalizeCollectionRating(6)).toBeNull();
    expect(normalizeCollectionRating("")).toBeNull();
    expect(normalizeCollectionRating(null)).toBeNull();
  });

  it("formats rated and unrated records", () => {
    expect(formatCollectionRating(4)).toBe("4 / 5");
    expect(formatCollectionRating(null)).toBe("Unrated");
  });

  it("ranks rated records first, newest first on ties, then unrated records", () => {
    const ranked = rankTopRatedCollectionRecords(
      [
        record("1", null, "2026-01-04T00:00:00.000Z"),
        record("2", 4, "2026-01-01T00:00:00.000Z"),
        record("3", 5, "2026-01-02T00:00:00.000Z"),
        record("4", 4, "2026-01-03T00:00:00.000Z"),
        record("5", 3, "2026-01-05T00:00:00.000Z"),
      ],
      5,
    );

    expect(ranked.map((item) => item.id)).toEqual(["3", "4", "2", "5", "1"]);
  });

  it("caps the shelf at the requested size", () => {
    const ranked = rankTopRatedCollectionRecords(
      [
        record("1", 5, "2026-01-01T00:00:00.000Z"),
        record("2", 4, "2026-01-01T00:00:00.000Z"),
        record("3", 3, "2026-01-01T00:00:00.000Z"),
      ],
      2,
    );

    expect(ranked).toHaveLength(2);
    expect(ranked.map((item) => item.id)).toEqual(["1", "2"]);
  });
});
