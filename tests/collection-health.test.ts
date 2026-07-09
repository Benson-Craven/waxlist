import { describe, expect, it } from "vitest";

import {
  buildCollectionAuditFindings,
  buildCollectionHealth,
} from "@/lib/collection/health";
import type { CollectionRecord } from "@/lib/collection/record";

function record(overrides: Partial<CollectionRecord>): CollectionRecord {
  const value = <Key extends keyof CollectionRecord>(
    key: Key,
    fallback: CollectionRecord[Key],
  ) => (Object.hasOwn(overrides, key) ? overrides[key] : fallback);

  return {
    id: value("id", "record-1"),
    userId: "user-1",
    discogsReleaseId: value("discogsReleaseId", 100),
    discogsMasterId: value("discogsMasterId", null),
    discogsInstanceId: value("discogsInstanceId", null),
    discogsFolderId: value("discogsFolderId", null),
    artist: value("artist", "Sade"),
    title: value("title", "Diamond Life"),
    format: value("format", ["Vinyl", "LP"]),
    year: value("year", 1984),
    label: value("label", "Epic"),
    catalogNumber: value("catalogNumber", "EPC 26044"),
    barcode: value("barcode", null),
    imageUrl: null,
    mediaCondition: value("mediaCondition", "Very Good Plus (VG+)"),
    sleeveCondition: value("sleeveCondition", "Very Good (VG)"),
    status: value("status", "owned"),
    tags: value("tags", []),
    notes: value("notes", null),
    room: value("room", "Music room"),
    unit: value("unit", "Kallax"),
    shelf: value("shelf", "A"),
    slot: value("slot", "01"),
    priceHintCents: value("priceHintCents", null),
    priceHintCurrency: value("priceHintCurrency", null),
    priceHintLabel: value("priceHintLabel", null),
    syncedAt: value("syncedAt", "2026-07-01T10:00:00.000Z"),
    createdAt: value("createdAt", "2026-07-01T10:00:00.000Z"),
    updatedAt: value("updatedAt", "2026-07-01T10:00:00.000Z"),
  };
}

describe("collection health", () => {
  it("builds duplicate, value, recent, location, and artist-gap signals", () => {
    const health = buildCollectionHealth(
      [
        record({
          id: "owned-a",
          discogsReleaseId: 100,
          priceHintCents: 2200,
          createdAt: "2026-07-01T10:00:00.000Z",
        }),
        record({
          id: "owned-b",
          discogsReleaseId: 100,
          priceHintCents: 4100,
          createdAt: "2026-06-10T10:00:00.000Z",
        }),
        record({
          id: "owned-missing-location",
          discogsReleaseId: 200,
          artist: "Sade",
          title: "Promise",
          room: null,
          unit: null,
          shelf: null,
          slot: null,
          createdAt: "2026-01-01T10:00:00.000Z",
        }),
        record({
          id: "wanted-gap",
          discogsReleaseId: 300,
          artist: "Sade",
          title: "Stronger Than Pride",
          status: "wanted",
          room: null,
          unit: null,
          shelf: null,
          slot: null,
        }),
        record({
          id: "wanted-uncollected-artist",
          discogsReleaseId: 400,
          artist: "Kate Bush",
          title: "Hounds Of Love",
          status: "wanted",
        }),
      ],
      { now: new Date("2026-07-05T12:00:00.000Z") },
    );

    expect(health.totalRecords).toBe(5);
    expect(health.ownedCount).toBe(3);
    expect(health.wantedCount).toBe(2);
    expect(health.duplicateGroups).toHaveLength(1);
    expect(health.auditSummary.countsByType.exact_duplicate_release).toBe(1);
    expect(health.auditSummary.countsByType.missing_shelf_location).toBe(1);
    expect(health.duplicateGroups[0]?.records).toHaveLength(2);
    expect(health.highValueRecords.map((item) => item.id)).toEqual([
      "owned-b",
      "owned-a",
    ]);
    expect(health.recentlyAddedRecords.map((item) => item.id)).toContain(
      "owned-a",
    );
    expect(health.recentlyAddedRecords.map((item) => item.id)).not.toContain(
      "owned-missing-location",
    );
    expect(health.missingLocationRecords.map((item) => item.id)).toEqual([
      "owned-missing-location",
    ]);
    expect(health.collectedArtistGapRecords.map((item) => item.id)).toEqual([
      "wanted-gap",
    ]);
    expect(health.listeningRecency.status).toBe("unavailable");
    expect(health.streamedArtistGaps.status).toBe("unavailable");
  });

  it("distinguishes exact release duplicates from multiple master versions", () => {
    const findings = buildCollectionAuditFindings(
      [
        record({
          id: "copy-a",
          discogsReleaseId: 100,
          discogsMasterId: 10,
          catalogNumber: "EPC 1",
        }),
        record({
          id: "copy-b",
          discogsReleaseId: 100,
          discogsMasterId: 10,
          catalogNumber: "EPC 1",
        }),
        record({
          id: "reissue",
          discogsReleaseId: 101,
          discogsMasterId: 10,
          catalogNumber: "EPC 2",
        }),
      ],
      "2026-07-05T12:00:00.000Z",
    );

    const exactDuplicate = findings.find(
      (finding) => finding.type === "exact_duplicate_release",
    );
    const multipleVersions = findings.find(
      (finding) => finding.type === "multiple_versions_master",
    );

    expect(exactDuplicate?.affectedDiscogsReleaseIds).toEqual([100]);
    expect(exactDuplicate?.affectedCollectionItemIds).toEqual([
      "copy-a",
      "copy-b",
    ]);
    expect(multipleVersions?.affectedDiscogsReleaseIds).toEqual([100, 101]);
    expect(multipleVersions?.affectedDiscogsMasterIds).toEqual([10]);
  });

  it("does not create a possible duplicate album from records without master ids", () => {
    const findings = buildCollectionAuditFindings(
      [
        record({
          id: "release-a",
          discogsReleaseId: 200,
          discogsMasterId: null,
          title: "Promise",
        }),
        record({
          id: "release-b",
          discogsReleaseId: 201,
          discogsMasterId: null,
          title: "Promise",
        }),
      ],
      "2026-07-05T12:00:00.000Z",
    );

    expect(
      findings.some((finding) => finding.type === "multiple_versions_master"),
    ).toBe(false);
  });

  it("groups missing media and sleeve conditions into actionable metadata findings", () => {
    const findings = buildCollectionAuditFindings(
      [
        record({
          id: "missing-media",
          discogsReleaseId: 300,
          mediaCondition: null,
          sleeveCondition: "Near Mint (NM or M-)",
        }),
        record({
          id: "missing-sleeve",
          discogsReleaseId: 301,
          mediaCondition: "Near Mint (NM or M-)",
          sleeveCondition: null,
        }),
      ],
      "2026-07-05T12:00:00.000Z",
    );

    expect(
      findings.find((finding) => finding.type === "missing_media_condition")
        ?.affectedCollectionItemIds,
    ).toEqual(["missing-media"]);
    expect(
      findings.find((finding) => finding.type === "missing_sleeve_condition")
        ?.affectedCollectionItemIds,
    ).toEqual(["missing-sleeve"]);
  });

  it("surfaces missing shelf location and incomplete release metadata", () => {
    const findings = buildCollectionAuditFindings(
      [
        record({
          id: "missing-location",
          discogsReleaseId: 400,
          room: null,
          unit: null,
          shelf: null,
          slot: null,
        }),
        record({
          id: "missing-metadata",
          discogsReleaseId: 401,
          label: null,
          catalogNumber: null,
          year: null,
        }),
      ],
      "2026-07-05T12:00:00.000Z",
    );

    expect(
      findings.find((finding) => finding.type === "missing_shelf_location")
        ?.affectedCollectionItemIds,
    ).toEqual(["missing-location"]);
    expect(
      findings.find((finding) => finding.type === "incomplete_release_metadata")
        ?.evidence,
    ).toEqual([
      "1 record missing year",
      "1 record missing label",
      "1 record missing catalogue number",
    ]);
  });

  it("returns no audit findings for a healthy minimal owned collection", () => {
    const health = buildCollectionHealth(
      [
        record({
          id: "healthy",
          discogsReleaseId: 500,
          discogsMasterId: 50,
          label: "Epic",
          catalogNumber: "EPC 500",
          year: 1984,
          mediaCondition: "Near Mint (NM or M-)",
          sleeveCondition: "Very Good Plus (VG+)",
        }),
      ],
      { now: new Date("2026-07-05T12:00:00.000Z") },
    );

    expect(health.auditFindings).toEqual([]);
    expect(health.auditSummary.healthState).toBe("healthy");
  });

  it("keeps grouping stable for large collections without pairwise comparison", () => {
    const records = Array.from({ length: 1200 }, (_, index) =>
      record({
        id: `record-${index}`,
        discogsReleaseId: index < 3 ? 900 : 1000 + index,
        discogsMasterId: index < 12 ? 90 : 2000 + index,
        catalogNumber: `CAT ${index}`,
      }),
    );
    const findings = buildCollectionAuditFindings(
      records,
      "2026-07-05T12:00:00.000Z",
    );

    expect(
      findings.find((finding) => finding.type === "exact_duplicate_release")
        ?.affectedCollectionItemIds,
    ).toEqual(["record-0", "record-1", "record-2"]);
    expect(
      findings.find((finding) => finding.type === "multiple_versions_master")
        ?.affectedDiscogsReleaseIds,
    ).toEqual([900, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011]);
  });
});
