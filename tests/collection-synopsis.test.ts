import { describe, expect, it } from "vitest";

import { buildCollectionSynopsis } from "@/lib/collection/synopsis";
import type { CollectionRecord } from "@/lib/collection/record";

function record(overrides: Partial<CollectionRecord>): CollectionRecord {
  const value = <Key extends keyof CollectionRecord>(
    key: Key,
    fallback: CollectionRecord[Key],
  ) =>
    Object.hasOwn(overrides, key)
      ? (overrides[key] as CollectionRecord[Key])
      : fallback;

  return {
    id: value("id", "record-1"),
    userId: "user-1",
    discogsReleaseId: value("discogsReleaseId", 100),
    discogsMasterId: value("discogsMasterId", null),
    discogsInstanceId: value("discogsInstanceId", null),
    discogsFolderId: value("discogsFolderId", null),
    artist: value("artist", "Sade"),
    title: value("title", "Diamond Life"),
    format: value("format", ["Vinyl", "LP", "Album"]),
    year: value("year", 1984),
    label: value("label", "Epic"),
    catalogNumber: value("catalogNumber", null),
    barcode: value("barcode", null),
    imageUrl: null,
    mediaCondition: value("mediaCondition", null),
    sleeveCondition: value("sleeveCondition", null),
    rating: value("rating", null),
    favourite: value("favourite", false),
    status: value("status", "owned"),
    tags: value("tags", []),
    notes: value("notes", null),
    group: value("group", null),
    unit: value("unit", null),
    shelf: value("shelf", null),
    slot: value("slot", null),
    priceHintCents: null,
    priceHintCurrency: null,
    priceHintLabel: null,
    syncedAt: value("syncedAt", "2026-07-01T10:00:00.000Z"),
    createdAt: value("createdAt", "2026-07-01T10:00:00.000Z"),
    updatedAt: value("updatedAt", "2026-07-01T10:00:00.000Z"),
  };
}

function fact(synopsis: ReturnType<typeof buildCollectionSynopsis>, id: string) {
  return synopsis?.facts.find((entry) => entry.id === id) ?? null;
}

describe("collection synopsis", () => {
  it("stays null until the collector owns a record", () => {
    expect(buildCollectionSynopsis([])).toBeNull();
    expect(
      buildCollectionSynopsis([
        record({ status: "wanted", artist: "Björk", title: "Homogenic" }),
      ]),
    ).toBeNull();
  });

  it("describes the dominant format, era, artist, and ratings", () => {
    const synopsis = buildCollectionSynopsis([
      record({ id: "a", artist: "Sade", year: 1984, rating: 4 }),
      record({ id: "b", artist: "Radiohead", year: 1997, rating: 5 }),
      record({ id: "c", artist: "Radiohead", year: 1999, rating: null }),
      record({ id: "d", artist: "Björk", year: 1993, rating: 3 }),
    ]);

    expect(synopsis?.headline).toBe(
      "Mostly LPs from the 1990s, led by Radiohead.",
    );
    expect(fact(synopsis, "format")).toMatchObject({
      label: "Format",
      value: "LP",
      detail: "4 of 4",
    });
    expect(fact(synopsis, "era")).toMatchObject({
      label: "Era",
      value: "1990s",
      detail: "1993–1999",
    });
    expect(fact(synopsis, "artist")).toMatchObject({
      label: "Most collected",
      value: "Radiohead",
      detail: "2 records",
    });
    expect(fact(synopsis, "rating")).toMatchObject({
      label: "Average rating",
      value: "4.0",
      detail: "3 rated",
    });
  });

  it("keeps the headline honest when no format or era has a majority", () => {
    const synopsis = buildCollectionSynopsis([
      record({ id: "a", artist: "Sade", format: ["Vinyl", "LP"], year: 1984 }),
      record({ id: "b", artist: "Björk", format: ["Vinyl", "LP"], year: 1997 }),
      record({
        id: "c",
        artist: "Autechre",
        format: ["Vinyl", '7"', "Single"],
        year: 2003,
      }),
      record({
        id: "d",
        artist: "Aphex Twin",
        format: ["Vinyl", '7"', "Single"],
        year: 2012,
      }),
    ]);

    expect(synopsis?.headline).toBe(
      "A mixed shelf that is still taking shape.",
    );
    expect(fact(synopsis, "format")).toMatchObject({
      value: "Mixed",
      detail: "2 formats",
    });
  });

  it("falls back to a year span when no decade leads", () => {
    const synopsis = buildCollectionSynopsis([
      record({ id: "a", year: 1974 }),
      record({ id: "b", year: 1982 }),
    ]);

    expect(fact(synopsis, "era")).toMatchObject({
      label: "Era",
      value: "1974–1982",
      detail: "2 decades",
    });
  });

  it("introduces a one-record shelf by name", () => {
    const synopsis = buildCollectionSynopsis([
      record({ artist: "Sade", title: "Diamond Life", rating: null }),
    ]);

    expect(synopsis?.headline).toBe(
      "The shelf starts with Sade — Diamond Life.",
    );
    expect(fact(synopsis, "format")).toMatchObject({
      value: "LP",
      detail: null,
    });
    expect(fact(synopsis, "rating")).toMatchObject({
      value: "Unrated",
      detail: null,
    });
  });

  it("reads comma-joined Discogs format strings", () => {
    const synopsis = buildCollectionSynopsis([
      record({ id: "a", format: ["Vinyl, LP, Album, Stereo"] }),
      record({ id: "b", format: ["Vinyl, LP, Album"] }),
      record({ id: "c", format: ["Vinyl", '12"', "Single"] }),
    ]);

    expect(fact(synopsis, "format")).toMatchObject({
      value: "LP",
      detail: "2 of 3",
    });
  });

  it("counts only owned records", () => {
    const synopsis = buildCollectionSynopsis([
      record({ id: "a", artist: "Sade", rating: 5 }),
      record({ id: "b", artist: "Sade", status: "wanted", rating: 1 }),
    ]);

    expect(fact(synopsis, "artist")).toBeNull();
    expect(fact(synopsis, "rating")).toMatchObject({
      value: "5.0",
      detail: "1 rated",
    });
  });
});
