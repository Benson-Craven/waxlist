import { describe, expect, it } from "vitest";

import {
  normalizeCollectionItem,
  normalizeCollectionItemInput,
  normalizeCollectionItemPatch,
  sanitizeRestrictedCollectionData,
  sanitizeRestrictedCollectionDataForOwner,
  serializeCollectionItem,
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
        rating: "5",
        status: "wanted",
        tags: ["soul", " shop-check ", "soul"],
        notes: "Find clean copy",
        group: "Music group",
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
      rating: 5,
      favourite: false,
      status: "wanted",
      tags: ["soul", "shop-check"],
      notes: "Find clean copy",
      group: "Music group",
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
    expect(record?.rating).toBeNull();
    expect(record?.tags).toEqual([]);
    expect(record?.createdAt.toISOString()).toBe("2026-06-30T20:40:00.000Z");
  });

  it("stores a favourite flag and patches it independently", () => {
    const base = {
      userId: "user-1",
      discogsReleaseId: 12345,
      artist: "Sade",
      title: "Diamond Life",
    };

    expect(normalizeCollectionItemInput(base)?.favourite).toBe(false);
    expect(
      normalizeCollectionItemInput({ ...base, favourite: true })?.favourite,
    ).toBe(true);
    expect(normalizeCollectionItemPatch({ favourite: true })).toEqual({
      favourite: true,
    });
    expect(normalizeCollectionItemPatch({ favourite: false })).toEqual({
      favourite: false,
    });
  });

  it("keeps only whole-star ratings from 1 to 5", () => {
    const base = {
      userId: "user-1",
      discogsReleaseId: 12345,
      artist: "Sade",
      title: "Diamond Life",
    };

    expect(normalizeCollectionItemInput({ ...base, rating: 4 })?.rating).toBe(4);
    expect(normalizeCollectionItemInput({ ...base, rating: "2" })?.rating).toBe(2);
    expect(normalizeCollectionItemInput({ ...base, rating: 0 })?.rating).toBeNull();
    expect(normalizeCollectionItemInput({ ...base, rating: 6 })?.rating).toBeNull();
    expect(normalizeCollectionItemInput({ ...base, rating: null })?.rating).toBeNull();
  });

  it("formats and detects missing collection locations", () => {
    expect(
      formatCollectionLocation({
        group: "Music group",
        unit: "Kallax",
        shelf: "A",
        slot: "03",
      }),
    ).toBe("Music group · Kallax · A · 03");
    expect(
      isMissingCollectionLocation({
        group: null,
        unit: "",
        shelf: null,
        slot: null,
      }),
    ).toBe(true);
  });

  it("removes Discogs user and marketplace fields from public records", () => {
    const normalized = normalizeCollectionItem({
      id: "item-1",
      userId: "user-1",
      discogsReleaseId: 12345,
      discogsInstanceId: 99,
      discogsFolderId: 7,
      artist: "Sade",
      title: "Diamond Life",
      imageUrl: "https://img.example/release.jpg",
      mediaCondition: "Very Good Plus (VG+)",
      sleeveCondition: "Very Good (VG)",
      rating: 4,
      priceHintCents: 3200,
      priceHintCurrency: "USD",
      priceHintLabel: "$32 median",
      status: "owned",
      createdAt: "2026-06-30T20:40:00.000Z",
      updatedAt: "2026-06-30T20:41:00.000Z",
    });

    expect(normalized).not.toBeNull();
    const sanitized = sanitizeRestrictedCollectionData(
      serializeCollectionItem(normalized!),
    );

    expect(sanitized).toMatchObject({
      discogsInstanceId: null,
      discogsFolderId: null,
      imageUrl: null,
      mediaCondition: null,
      sleeveCondition: null,
      priceHintCents: null,
      priceHintCurrency: null,
      priceHintLabel: null,
      rating: 4,
    });
  });

  it("keeps only artwork for the authenticated owner's shelf", () => {
    const normalized = normalizeCollectionItem({
      id: "item-1",
      userId: "user-1",
      discogsReleaseId: 12345,
      discogsInstanceId: 99,
      discogsFolderId: 7,
      artist: "Sade",
      title: "Diamond Life",
      imageUrl: "https://img.example/release.jpg",
      mediaCondition: "Very Good Plus (VG+)",
      sleeveCondition: "Very Good (VG)",
      rating: 4,
      priceHintCents: 3200,
      priceHintCurrency: "USD",
      priceHintLabel: "$32 median",
      status: "owned",
      createdAt: "2026-06-30T20:40:00.000Z",
      updatedAt: "2026-06-30T20:41:00.000Z",
    });

    expect(normalized).not.toBeNull();
    const sanitized = sanitizeRestrictedCollectionDataForOwner(
      serializeCollectionItem(normalized!),
    );

    expect(sanitized).toMatchObject({
      discogsInstanceId: null,
      discogsFolderId: null,
      imageUrl: "https://img.example/release.jpg",
      mediaCondition: null,
      sleeveCondition: null,
      priceHintCents: null,
      priceHintCurrency: null,
      priceHintLabel: null,
      rating: 4,
    });
  });
});
