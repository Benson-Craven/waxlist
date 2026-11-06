import { describe, expect, test } from "vitest";

import type { CollectionRecord } from "@/lib/collection/record";
import {
  describeShelfLocation,
  formatShelfCode,
  isOnShelf,
} from "@/lib/collection/location";
import {
  buildShelfGroupBuckets,
  buildShelfGroups,
  filterShelfRecords,
  listShelfGroupNames,
  ownedShelfRecords,
  summarizeShelf,
} from "@/lib/collection/shelf";

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

describe("shelf layout", () => {
  test("groups records into groups and physical shelf rows", () => {
    const groups = buildShelfGroups([
      record({ id: "a", group: "Music group", unit: "Kallax", shelf: "A" }),
      record({ id: "b", group: "Music group", unit: "Kallax", shelf: "A" }),
      record({ id: "c", group: "Music group", unit: "Kallax", shelf: "B" }),
      record({ id: "d", group: "Studio", unit: "Ikea", shelf: "1" }),
    ]);

    expect(groups.map((group) => group.label)).toEqual(["Music group", "Studio"]);
    expect(groups[0].recordCount).toBe(3);
    expect(groups[0].rows.map((row) => row.label)).toEqual([
      "Kallax · A",
      "Kallax · B",
    ]);
    expect(groups[0].rows[0].records.map((entry) => entry.id)).toEqual([
      "a",
      "b",
    ]);
  });

  test("keeps the unsorted group last and out of the group count", () => {
    const groups = buildShelfGroups([
      record({ id: "loose", group: null, unit: null, shelf: null, slot: null }),
      record({ id: "shelved", group: "Studio", unit: "Ikea", shelf: "1" }),
      record({ id: "partial", group: null, unit: null, shelf: "a", slot: "03" }),
    ]);

    expect(groups.map((group) => group.label)).toEqual(["Studio", "Unsorted"]);
    expect(groups[1].rows[0].label).toBe("No shelf");
    expect(summarizeShelf(groups)).toEqual({
      recordCount: 3,
      groupCount: 1,
      unsortedCount: 2,
    });
  });

  test("a group is enough to shelve a record", () => {
    expect(
      isOnShelf(record({ group: "Music group", unit: null, shelf: null })),
    ).toBe(true);
    expect(
      isOnShelf(record({ group: "Music group", unit: "Kallax", shelf: null })),
    ).toBe(true);
    expect(
      isOnShelf(record({ group: "Music group", unit: null, shelf: "A" })),
    ).toBe(true);
    expect(isOnShelf(record({ group: null, unit: null, shelf: "A" }))).toBe(
      false,
    );
    expect(
      isOnShelf(record({ group: null, unit: "Kallax", shelf: "A" })),
    ).toBe(false);
  });

  test("groups the grid by group and keeps the group order", () => {
    const groups = buildShelfGroupBuckets([
      record({ id: "studio", group: "Studio", unit: null, shelf: null }),
      record({ id: "loose", group: null, unit: null, shelf: null, slot: null }),
      record({ id: "music-a", group: "Music group", unit: "Kallax", shelf: "A" }),
      record({ id: "music-b", group: "Music group", unit: "Kallax", shelf: "A" }),
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      "Music group",
      "Studio",
      "Unsorted",
    ]);
    expect(groups[0].records.map((entry) => entry.id)).toEqual([
      "music-a",
      "music-b",
    ]);
    expect(groups[1].records.map((entry) => entry.id)).toEqual(["studio"]);
  });

  test("lists group names for the add-to-group suggestions", () => {
    expect(
      listShelfGroupNames([
        record({ id: "a", group: "Music group" }),
        record({ id: "b", group: "music group" }),
        record({ id: "c", group: "Studio" }),
        record({ id: "d", group: null }),
      ]),
    ).toEqual(["Music group", "Studio"]);
  });

  test("describes the shelf plate and unsorted state", () => {
    expect(
      describeShelfLocation({
        group: "Music group",
        unit: "Kallax",
        shelf: "A",
        slot: "03",
      }),
    ).toEqual({
      isPlaced: true,
      group: "Music group",
      code: "Kallax · A · 03",
      label: "Music group · Kallax · A · 03",
    });
    expect(
      formatShelfCode({
        group: "Music group",
        unit: "Kallax",
        shelf: "A",
        slot: null,
      }),
    ).toBe("Kallax · A");
    expect(
      describeShelfLocation({
        group: null,
        unit: "Kallax",
        shelf: "A",
        slot: "03",
      }),
    ).toEqual({
      isPlaced: false,
      group: "",
      code: "",
      label: "Unsorted",
    });
    expect(
      describeShelfLocation({
        group: "Music group",
        unit: null,
        shelf: null,
        slot: "03",
      }),
    ).toEqual({
      isPlaced: true,
      group: "Music group",
      code: "03",
      label: "Music group · 03",
    });
  });

  test("orders records by slot before artist", () => {
    const groups = buildShelfGroups([
      record({ id: "third", slot: "03", artist: "A" }),
      record({ id: "first", slot: "01", artist: "Z" }),
      record({ id: "second", slot: "02", artist: "M" }),
    ]);

    expect(groups[0].rows[0].records.map((entry) => entry.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  test("only owned records reach the shelf", () => {
    const records = [
      record({ id: "owned" }),
      record({ id: "wanted", status: "wanted" }),
    ];

    expect(ownedShelfRecords(records).map((entry) => entry.id)).toEqual([
      "owned",
    ]);
  });

  test("filters by title, artist, and location", () => {
    const records = [
      record({ id: "sade", artist: "Sade", title: "Diamond Life" }),
      record({
        id: "bjork",
        artist: "Björk",
        title: "Homogenic",
        group: "Studio",
        unit: "Ikea",
        shelf: "2",
      }),
    ];

    expect(filterShelfRecords(records, "sade")).toHaveLength(1);
    expect(filterShelfRecords(records, "studio")[0].id).toBe("bjork");
    expect(filterShelfRecords(records, "  ")).toHaveLength(2);
  });
});
