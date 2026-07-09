import { describe, expect, it } from "vitest";

import {
  normalizeCollectionItem,
  normalizeCollectionItemInput,
} from "@/lib/collection/record";
import {
  formatCollectionLocation,
  isMissingCollectionLocation,
} from "@/lib/collection/location";

describe("collection item normalization", () => {
  it("normalizes collection item input for import/storage", () => {
    const syncedAt = new Date("2026-06-30T20:40:00.000Z");
    const record = normalizeCollectionItemInput(
      {
        userId: "  user-1  ",
        discogsReleaseId: "12345",
        discogsMasterId: 678,
        discogsInstanceId: "987",
        artist: "  Sade  ",
        title: "  Diamond Life  ",
        format: ["Vinyl", " LP ", "", "Vinyl"],
        year: "1984",
        label: "Epic",
        catalogNumber: "EPC 26044",
        barcode: "074643957612",
        imageUrl: "https://img.example/release.jpg",
        mediaCondition: "Very Good Plus (VG+)",
        sleeveCondition: "Very Good (VG)",
        status: "wanted",
        tags: ["soul", " shop-check ", "soul"],
        notes: "Find clean copy",
        room: "Music room",
        unit: "Kallax",
        shelf: "A",
        slot: "03",
        priceHintCents: "3200",
        priceHintCurrency: "USD",
        priceHintLabel: "$32 median",
        syncedAt: syncedAt.toISOString(),
      },
      { now: new Date("2026-06-30T00:00:00.000Z") },
    );

    expect(record).toEqual({
      userId: "user-1",
      discogsReleaseId: 12345,
      discogsMasterId: 678,
      discogsInstanceId: 987,
      discogsFolderId: null,
      artist: "Sade",
      title: "Diamond Life",
      format: ["Vinyl", "LP"],
      year: 1984,
      label: "Epic",
      catalogNumber: "EPC 26044",
      barcode: "074643957612",
      imageUrl: "https://img.example/release.jpg",
      mediaCondition: "Very Good Plus (VG+)",
      sleeveCondition: "Very Good (VG)",
      status: "wanted",
      tags: ["soul", "shop-check"],
      notes: "Find clean copy",
      room: "Music room",
      unit: "Kallax",
      shelf: "A",
      slot: "03",
      priceHintCents: 3200,
      priceHintCurrency: "USD",
      priceHintLabel: "$32 median",
      syncedAt,
    });
  });

  it("rejects records without required owner, release, artist, or title", () => {
    expect(
      normalizeCollectionItemInput({
        userId: "user-1",
        discogsReleaseId: 12345,
        artist: "Sade",
      }),
    ).toBeNull();
    expect(
      normalizeCollectionItemInput({
        discogsReleaseId: 12345,
        artist: "Sade",
        title: "Diamond Life",
      }),
    ).toBeNull();
  });

  it("normalizes a persisted collection item row", () => {
    const record = normalizeCollectionItem({
      id: "item-1",
      userId: "user-1",
      discogsReleaseId: 12345,
      artist: "Sade",
      title: "Diamond Life",
      status: "owned",
      createdAt: "2026-06-30T20:40:00.000Z",
      updatedAt: "2026-06-30T20:41:00.000Z",
    });

    expect(record?.id).toBe("item-1");
    expect(record?.status).toBe("owned");
    expect(record?.format).toEqual([]);
    expect(record?.tags).toEqual([]);
    expect(record?.createdAt.toISOString()).toBe("2026-06-30T20:40:00.000Z");
  });

  it("formats and detects missing collection locations", () => {
    expect(
      formatCollectionLocation({
        room: "Music room",
        unit: "Kallax",
        shelf: "A",
        slot: "03",
      }),
    ).toBe("Music room / Kallax / A / 03");
    expect(
      isMissingCollectionLocation({
        room: null,
        unit: "",
        shelf: null,
        slot: null,
      }),
    ).toBe(true);
  });
});
