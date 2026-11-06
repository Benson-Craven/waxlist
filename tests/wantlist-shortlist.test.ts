import { describe, expect, test } from "vitest";

import type { CollectionRecord } from "@/lib/collection/record";
import {
  DEFAULT_SHORTLIST_TAB,
  isShortlistTab,
  shortlistTabCount,
  shortlistTabMatches,
} from "@/lib/wantlist/shortlist";

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
    group: null,
    unit: null,
    shelf: null,
    slot: null,
    priceHintCents: null,
    priceHintCurrency: null,
    priceHintLabel: null,
    syncedAt: "2026-07-01T10:00:00.000Z",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("wantlist shortlist", () => {
  test("wanted and favourited records are two lenses over one list", () => {
    const wanted = record({ id: "wanted", status: "wanted" });
    const favouriteOwned = record({
      id: "favourite-owned",
      status: "owned",
      favourite: true,
    });
    const favouriteWanted = record({
      id: "favourite-wanted",
      status: "wanted",
      favourite: true,
    });
    const plainOwned = record({ id: "plain-owned", status: "owned" });

    expect(shortlistTabMatches(wanted, "wanted")).toBe(true);
    expect(shortlistTabMatches(favouriteOwned, "wanted")).toBe(false);
    expect(shortlistTabMatches(favouriteWanted, "wanted")).toBe(true);
    expect(shortlistTabMatches(favouriteOwned, "favourites")).toBe(true);
    expect(shortlistTabMatches(favouriteWanted, "favourites")).toBe(true);
    expect(shortlistTabMatches(plainOwned, "favourites")).toBe(false);

    const records = [wanted, favouriteOwned, favouriteWanted, plainOwned];

    expect(shortlistTabCount(records, "wanted")).toBe(2);
    expect(shortlistTabCount(records, "favourites")).toBe(2);
  });

  test("only shortlist tab ids are accepted from the URL", () => {
    expect(isShortlistTab("wanted")).toBe(true);
    expect(isShortlistTab("favourites")).toBe(true);
    expect(isShortlistTab("owned")).toBe(false);
    expect(isShortlistTab(undefined)).toBe(false);
    expect(DEFAULT_SHORTLIST_TAB).toBe("wanted");
  });
});
