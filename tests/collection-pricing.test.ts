import { describe, expect, it } from "vitest";

import {
  formatPriceCents,
  getRecordPriceSummary,
  parsePriceToCents,
  summarizeCollectionPricing,
  type CollectionPriceSnapshot,
} from "@/lib/collection/pricing";
import type { CollectionRecord } from "@/lib/collection/record";

const NOW = new Date("2026-11-06T12:00:00.000Z");

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
    format: ["Vinyl", "LP", "Album"],
    year: 1984,
    label: "Epic",
    catalogNumber: null,
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
    pricing: null,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<CollectionPriceSnapshot> = {},
): CollectionPriceSnapshot {
  return {
    id: `snapshot-${overrides.collectionItemId ?? "record-1"}-${
      overrides.observedAt ?? "2026-11-01T10:00:00.000Z"
    }`,
    collectionItemId: "record-1",
    discogsReleaseId: 100,
    amountCents: 3000,
    currency: "GBP",
    source: "manual",
    observedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("record pricing", () => {
  it("parses user-entered money into cents and rejects ambiguous input", () => {
    expect(parsePriceToCents("24.5")).toBe(2450);
    expect(parsePriceToCents("£1,240.00")).toBe(124000);
    expect(parsePriceToCents(" 12 ")).toBe(1200);
    expect(parsePriceToCents("0")).toBeNull();
    expect(parsePriceToCents("12.345")).toBeNull();
    expect(parsePriceToCents("free")).toBeNull();
    expect(parsePriceToCents("-4")).toBeNull();
  });

  it("formats whole amounts without decimals", () => {
    expect(formatPriceCents(2400, "GBP")).toBe("£24");
    expect(formatPriceCents(2450, "GBP")).toBe("£24.50");
  });

  it("compares only observations in the latest currency", () => {
    const summary = getRecordPriceSummary([
      snapshot({ amountCents: 3000, observedAt: "2026-10-01T10:00:00.000Z" }),
      snapshot({ amountCents: 2400, observedAt: "2026-10-15T10:00:00.000Z" }),
      snapshot({
        amountCents: 5000,
        currency: "USD",
        observedAt: "2026-10-20T10:00:00.000Z",
      }),
      snapshot({
        amountCents: 2200,
        currency: "USD",
        observedAt: "2026-11-01T10:00:00.000Z",
      }),
    ]);

    expect(summary).toMatchObject({
      currentCents: 2200,
      currency: "USD",
      previousCents: 5000,
      changeCents: -2800,
    });
    expect(summary?.changePercent).toBeCloseTo(-56);
  });

  it("totals every valued vinyl and splits the moves by direction", () => {
    const summary = summarizeCollectionPricing(
      [
        record({ id: "a", title: "A", artist: "Artist A" }),
        record({ id: "b", title: "B", artist: "Artist B" }),
        record({ id: "c", title: "C", status: "wanted" }),
        record({ id: "d", title: "D", artist: "Artist D" }),
      ],
      [
        snapshot({
          collectionItemId: "a",
          amountCents: 3000,
          observedAt: "2026-10-27T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "a",
          amountCents: 2500,
          observedAt: "2026-11-05T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "b",
          amountCents: 5000,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "c",
          amountCents: 9000,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
      ],
      { now: NOW, windowDays: 30 },
    );

    expect(summary).toMatchObject({
      currency: "GBP",
      totalCents: 16500,
      pricedCount: 3,
      unpricedCount: 1,
      ownedPricedCount: 2,
      wantedPricedCount: 1,
      otherCurrencyCount: 0,
      changeCents: -500,
    });
    expect(summary?.changePercent).toBeCloseTo((-500 / 3000) * 100);
    expect(summary?.movements.drops).toHaveLength(1);
    expect(summary?.movements.drops[0]).toMatchObject({
      collectionItemId: "a",
      previousCents: 3000,
      currentCents: 2500,
      changeCents: -500,
      direction: "drop",
    });
    expect(summary?.movements.same.map((movement) => movement.collectionItemId)).toEqual([
      "b",
      "c",
    ]);
    expect(summary?.movements.increases).toHaveLength(0);
    expect(summary?.series.at(0)?.amountCents).toBe(3000);
    expect(summary?.series.at(-1)?.amountCents).toBe(16500);
  });

  it("values a wanted-only shortlist instead of returning null", () => {
    const summary = summarizeCollectionPricing(
      [record({ id: "want", status: "wanted", title: "Wanted One" })],
      [
        snapshot({
          collectionItemId: "want",
          amountCents: 4200,
          observedAt: "2026-11-05T10:00:00.000Z",
        }),
      ],
      { now: NOW },
    );

    expect(summary).toMatchObject({
      currency: "GBP",
      totalCents: 4200,
      pricedCount: 1,
      unpricedCount: 0,
      ownedPricedCount: 0,
      wantedPricedCount: 1,
    });
    expect(summary?.movements.same).toHaveLength(1);
    expect(summary?.movements.same[0]).toMatchObject({
      status: "wanted",
      previousCents: null,
      changeCents: null,
      direction: "same",
    });
  });

  it("sorts drops by size and treats a single check as a hold", () => {
    const summary = summarizeCollectionPricing(
      [
        record({ id: "a", title: "A" }),
        record({ id: "b", title: "B" }),
        record({ id: "c", title: "C" }),
        record({ id: "d", title: "D" }),
        record({ id: "e", title: "E" }),
      ],
      [
        snapshot({
          collectionItemId: "a",
          amountCents: 5000,
          observedAt: "2026-10-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "a",
          amountCents: 4500,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "b",
          amountCents: 5000,
          observedAt: "2026-10-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "b",
          amountCents: 3000,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "c",
          amountCents: 1000,
          observedAt: "2026-10-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "c",
          amountCents: 900,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "d",
          amountCents: 1000,
          observedAt: "2026-10-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "d",
          amountCents: 1000,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "e",
          amountCents: 700,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
      ],
      { now: NOW },
    );

    expect(summary?.movements.drops.map((movement) => movement.collectionItemId)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(summary?.movements.same.map((movement) => movement.collectionItemId)).toEqual([
      "d",
      "e",
    ]);
    expect(summary?.movements.same[0]).toMatchObject({
      changeCents: 0,
      previousCents: 1000,
    });
    expect(summary?.movements.same[1]).toMatchObject({
      changeCents: null,
      previousCents: null,
    });
    expect(summary?.movements.increases).toHaveLength(0);
  });

  it("separates increases from holds", () => {
    const summary = summarizeCollectionPricing(
      [record({ id: "a" }), record({ id: "b" })],
      [
        snapshot({
          collectionItemId: "a",
          amountCents: 2000,
          observedAt: "2026-10-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "a",
          amountCents: 2600,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "b",
          amountCents: 4000,
          observedAt: "2026-10-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "b",
          amountCents: 4000,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
      ],
      { now: NOW },
    );

    expect(summary?.movements.increases).toHaveLength(1);
    expect(summary?.movements.increases[0]).toMatchObject({
      collectionItemId: "a",
      changeCents: 600,
      direction: "increase",
    });
    expect(summary?.changeCents).toBe(600);
    expect(summary?.movements.drops).toHaveLength(0);
    expect(summary?.movements.same[0]).toMatchObject({
      collectionItemId: "b",
      changeCents: 0,
    });
  });

  it("carries the latest known value forward between checks", () => {
    const summary = summarizeCollectionPricing(
      [record({ id: "a" }), record({ id: "b" })],
      [
        snapshot({
          collectionItemId: "a",
          amountCents: 1000,
          observedAt: "2026-11-01T10:00:00.000Z",
        }),
        snapshot({
          collectionItemId: "b",
          amountCents: 2000,
          observedAt: "2026-11-03T10:00:00.000Z",
        }),
      ],
      { now: NOW, windowDays: 14 },
    );

    const points = new Map(
      summary?.series.map((point) => [point.date, point.amountCents]),
    );

    expect(points.get("2026-11-01")).toBe(1000);
    expect(points.get("2026-11-02")).toBe(1000);
    expect(points.get("2026-11-03")).toBe(3000);
    expect(points.get("2026-11-06")).toBe(3000);
  });

  it("keeps one dominant currency and counts the rest separately", () => {
    const summary = summarizeCollectionPricing(
      [record({ id: "a" }), record({ id: "b" })],
      [
        snapshot({ collectionItemId: "a", amountCents: 1000, currency: "GBP" }),
        snapshot({ collectionItemId: "b", amountCents: 2000, currency: "USD" }),
      ],
      { now: NOW },
    );

    expect(summary).toMatchObject({
      currency: "GBP",
      totalCents: 1000,
      pricedCount: 1,
      otherCurrencyCount: 1,
    });
  });

  it("returns null when nothing has a recorded value", () => {
    expect(summarizeCollectionPricing([], [], { now: NOW })).toBeNull();
    expect(
      summarizeCollectionPricing([record({ status: "wanted" })], [], {
        now: NOW,
      }),
    ).toBeNull();
  });
});
