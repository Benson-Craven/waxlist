import { describe, expect, it } from "vitest";

import { selectFeaturedCollectionRecords } from "@/lib/collection/featured";
import type { RecordPriceSummary } from "@/lib/collection/pricing";
import type { CollectionRecord } from "@/lib/collection/record";

function price(
  currentCents: number,
  currency = "GBP",
): RecordPriceSummary {
  return {
    currentCents,
    currency,
    source: "manual",
    observedAt: "2026-01-01T00:00:00.000Z",
    previousCents: null,
    changeCents: null,
    changePercent: null,
  };
}

function record(
  id: string,
  options: {
    favourite?: boolean;
    rating?: number | null;
    status?: "owned" | "wanted";
    updatedAt?: string;
    pricing?: RecordPriceSummary | null;
  } = {},
): CollectionRecord {
  const updatedAt = options.updatedAt ?? "2026-01-01T00:00:00.000Z";

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
    rating: options.rating ?? null,
    favourite: options.favourite ?? false,
    status: options.status ?? "owned",
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
    pricing: options.pricing ?? null,
  };
}

function ids(entries: ReturnType<typeof selectFeaturedCollectionRecords>) {
  return entries.map((entry) => entry.record.id);
}

describe("featured collection records", () => {
  it("keeps only starred records when no value is recorded", () => {
    const featured = selectFeaturedCollectionRecords([
      record("1", { rating: 5 }),
      record("2", { favourite: true, rating: 3 }),
      record("3", { favourite: true, rating: null }),
    ]);

    expect(ids(featured)).toEqual(["2", "3"]);
  });

  it("orders the starred shelf by rating, then most recently updated", () => {
    const featured = selectFeaturedCollectionRecords([
      record("1", {
        favourite: true,
        rating: 3,
        updatedAt: "2026-01-05T00:00:00.000Z",
      }),
      record("2", {
        favourite: true,
        rating: 5,
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      record("3", {
        favourite: true,
        rating: 3,
        updatedAt: "2026-01-06T00:00:00.000Z",
      }),
    ]);

    expect(ids(featured)).toEqual(["2", "3", "1"]);
  });

  it("stays eligible for wanted favourites", () => {
    const featured = selectFeaturedCollectionRecords([
      record("1", { favourite: true, status: "wanted" }),
      record("2", { favourite: true, status: "owned" }),
    ]);

    expect(ids(featured)).toEqual(["1", "2"]);
  });

  it("caps the starred shelf at the requested size", () => {
    const featured = selectFeaturedCollectionRecords(
      [
        record("1", { favourite: true, rating: 5 }),
        record("2", { favourite: true, rating: 4 }),
        record("3", { favourite: true, rating: 3 }),
      ],
      2,
    );

    expect(ids(featured)).toEqual(["1", "2"]);
  });

  it("does not fall back to unstarred records without a recorded value", () => {
    expect(
      selectFeaturedCollectionRecords([
        record("1", { rating: 5 }),
        record("2", { rating: 4 }),
      ]),
    ).toEqual([]);
  });

  it("adds the most and least expensive owned records", () => {
    const featured = selectFeaturedCollectionRecords([
      record("1", { favourite: true, rating: 5 }),
      record("2", { pricing: price(1200) }),
      record("3", { pricing: price(5600) }),
      record("4", { pricing: price(900) }),
    ]);

    expect(ids(featured)).toEqual(["1", "3", "4"]);
    expect(featured.map((entry) => entry.reasons)).toEqual([
      ["starred"],
      ["most-expensive"],
      ["least-expensive"],
    ]);
  });

  it("keeps the five-record starred shelf and adds both extremes", () => {
    const featured = selectFeaturedCollectionRecords([
      record("1", { favourite: true, rating: 5 }),
      record("2", { favourite: true, rating: 4 }),
      record("3", { favourite: true, rating: 3 }),
      record("4", { favourite: true, rating: 2 }),
      record("5", { favourite: true, rating: 1 }),
      record("6", { pricing: price(1200) }),
      record("7", { pricing: price(5600) }),
    ]);

    expect(ids(featured)).toEqual(["1", "2", "3", "4", "5", "7", "6"]);
  });

  it("does not duplicate a starred extreme", () => {
    const featured = selectFeaturedCollectionRecords([
      record("1", { favourite: true, rating: 5, pricing: price(5600) }),
      record("2", { favourite: true, rating: 4 }),
      record("3", { pricing: price(1200) }),
    ]);

    expect(ids(featured)).toEqual(["1", "2", "3"]);
    expect(featured.map((entry) => entry.reasons)).toEqual([
      ["starred", "most-expensive"],
      ["starred"],
      ["least-expensive"],
    ]);
  });

  it("keeps priced wanted records eligible for the value extremes", () => {
    const featured = selectFeaturedCollectionRecords([
      record("1", { status: "wanted", pricing: price(100_000) }),
      record("2", { status: "owned", pricing: price(1200) }),
      record("3", { status: "wanted", pricing: price(5600) }),
    ]);

    expect(ids(featured)).toEqual(["1", "2"]);
    expect(featured.map((entry) => entry.reasons)).toEqual([
      ["most-expensive"],
      ["least-expensive"],
    ]);
  });

  it("compares recorded values only inside the dominant currency", () => {
    const featured = selectFeaturedCollectionRecords([
      record("1", { pricing: price(10_000, "USD") }),
      record("2", { pricing: price(20_000, "USD") }),
      record("3", { pricing: price(100_000, "GBP") }),
    ]);

    expect(ids(featured)).toEqual(["2", "1"]);
  });

  it("names one priced record as both extremes", () => {
    const featured = selectFeaturedCollectionRecords([
      record("1", { pricing: price(5600) }),
    ]);

    expect(ids(featured)).toEqual(["1"]);
    expect(featured[0]?.reasons).toEqual([
      "most-expensive",
      "least-expensive",
    ]);
  });
});
