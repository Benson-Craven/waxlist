import { describe, expect, test } from "vitest";

import {
  collectionFormatOptions,
  collectionSearchText,
  collectionTabCount,
  countActiveCollectionFilters,
  DEFAULT_COLLECTION_FILTERS,
  filterCollectionRecords,
  sortCollectionRecords,
} from "@/lib/collection/browse";
import type { CollectionRecord } from "@/lib/collection/record";

function record(overrides: Partial<CollectionRecord> = {}): CollectionRecord {
  return {
    id: "record-1",
    userId: "user-1",
    discogsReleaseId: 100,
    discogsMasterId: null,
    discogsInstanceId: null,
    discogsFolderId: null,
    artist: "Sade",
    title: "Diamond Life",
    format: ["Vinyl", "LP"],
    year: 1984,
    label: "Epic",
    catalogNumber: "EPC 26044",
    barcode: null,
    imageUrl: null,
    mediaCondition: null,
    sleeveCondition: null,
    rating: null,
    favourite: false,
    status: "owned",
    tags: [],
    notes: null,
    group: "Music group",
    unit: "Kallax",
    shelf: "A",
    slot: "01",
    priceHintCents: null,
    priceHintCurrency: null,
    priceHintLabel: null,
    syncedAt: "2026-07-01T10:00:00.000Z",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("collection browse", () => {
  test("counts each status tab", () => {
    const records = [
      record({ id: "a" }),
      record({ id: "b", status: "wanted", favourite: true }),
      record({ id: "c", group: null, unit: null, shelf: null, slot: null }),
      record({
        id: "d",
        status: "wanted",
        group: null,
        unit: null,
        shelf: null,
        slot: null,
      }),
    ];

    expect(collectionTabCount(records, "all")).toBe(4);
    expect(collectionTabCount(records, "owned")).toBe(2);
    expect(collectionTabCount(records, "wanted")).toBe(2);
    expect(collectionTabCount(records, "missingLocation")).toBe(1);
  });

  test("sorts by added date, artist, title, and rating", () => {
    const older = record({
      id: "older",
      artist: "Sade",
      title: "Diamond Life",
      rating: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
    const newer = record({
      id: "newer",
      artist: "Björk",
      title: "Homogenic",
      rating: 5,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    });

    expect(sortCollectionRecords([older, newer], "newest").map((r) => r.id)).toEqual([
      "newer",
      "older",
    ]);
    expect(sortCollectionRecords([older, newer], "artist").map((r) => r.id)).toEqual([
      "newer",
      "older",
    ]);
    expect(sortCollectionRecords([older, newer], "title").map((r) => r.id)).toEqual([
      "older",
      "newer",
    ]);
    expect(sortCollectionRecords([older, newer], "rating").map((r) => r.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  test("filters by rating, format, status, and search text", () => {
    const rated = record({ id: "rated", rating: 4, tags: ["jazz"] });
    const unrated = record({
      id: "unrated",
      format: ["Vinyl", '7"'],
      status: "wanted",
      title: "Cherish the Day",
    });
    const records = [rated, unrated];
    const state = {
      tab: "all" as const,
      query: "",
      filters: DEFAULT_COLLECTION_FILTERS,
      sort: "artist" as const,
    };

    expect(
      filterCollectionRecords(records, {
        ...state,
        filters: { ...state.filters, rating: "rated" },
      }).map((r) => r.id),
    ).toEqual(["rated"]);

    expect(
      filterCollectionRecords(records, {
        ...state,
        filters: { ...state.filters, rating: "unrated" },
      }).map((r) => r.id),
    ).toEqual(["unrated"]);

    expect(
      filterCollectionRecords(records, {
        ...state,
        filters: { ...state.filters, format: '7"' },
      }).map((r) => r.id),
    ).toEqual(["unrated"]);

    expect(
      filterCollectionRecords(records, { ...state, tab: "wanted" }).map((r) => r.id),
    ).toEqual(["unrated"]);

    expect(
      filterCollectionRecords(records, { ...state, query: "jazz" }).map((r) => r.id),
    ).toEqual(["rated"]);

    expect(
      filterCollectionRecords(records, { ...state, query: "cherish" }).map((r) => r.id),
    ).toEqual(["unrated"]);
  });

  test("builds format options from the collection without the vinyl medium", () => {
    const options = collectionFormatOptions([
      record({ id: "a", format: ["Vinyl", "LP"] }),
      record({ id: "b", format: ["Vinyl", "LP", "Album"] }),
      record({ id: "c", format: ["Vinyl", '7"'] }),
    ]);

    expect(options.map((option) => option.label)).toEqual(["LP", "7\"", "Album"]);
    expect(options[0].count).toBe(2);
    expect(options.map((option) => option.id)).not.toContain("vinyl");
  });

  test("counts the active filters the toolbar shows", () => {
    expect(
      countActiveCollectionFilters({
        tab: "all",
        query: "  ",
        filters: DEFAULT_COLLECTION_FILTERS,
      }),
    ).toBe(0);

    expect(
      countActiveCollectionFilters({
        tab: "wanted",
        query: "sade",
        filters: { rating: "rated", format: "lp" },
      }),
    ).toBe(4);
  });

  test("search text includes shelf location and tags", () => {
    const text = collectionSearchText(
      record({ tags: ["night"], group: "Studio" }),
    );

    expect(text).toContain("studio");
    expect(text).toContain("night");
  });
});
