import { describe, expect, test } from "vitest";

import { classifyCollectionGap } from "@/lib/listening/collection-gap";

describe("collection gap classification", () => {
  test("treats any owned pressing in the matched master family as owned", () => {
    expect(
      classifyCollectionGap({
        candidateMetadataQuality: "complete",
        match: {
          confidence: 93,
          releaseId: 100,
          masterId: 42,
        },
        collection: [
          {
            status: "owned",
            discogsReleaseId: 101,
            discogsMasterId: 42,
          },
        ],
      }),
    ).toBe("owned");
  });

  test("falls back to exact release identity when no master is available", () => {
    expect(
      classifyCollectionGap({
        candidateMetadataQuality: "complete",
        match: {
          confidence: 88,
          releaseId: 100,
          masterId: null,
        },
        collection: [
          {
            status: "owned",
            discogsReleaseId: 100,
            discogsMasterId: 99,
          },
        ],
      }),
    ).toBe("owned");
  });

  test("preserves wanted state before calling a strong match missing", () => {
    expect(
      classifyCollectionGap({
        candidateMetadataQuality: "complete",
        match: {
          confidence: 86,
          releaseId: 100,
          masterId: 42,
        },
        collection: [
          {
            status: "wanted",
            discogsReleaseId: 102,
            discogsMasterId: 42,
          },
        ],
      }),
    ).toBe("wanted");
  });

  test("requires review for incomplete evidence or weak matches", () => {
    expect(
      classifyCollectionGap({
        candidateMetadataQuality: "review",
        match: {
          confidence: 95,
          releaseId: 100,
          masterId: 42,
        },
        collection: [],
      }),
    ).toBe("review");

    expect(
      classifyCollectionGap({
        candidateMetadataQuality: "complete",
        match: {
          confidence: 74,
          releaseId: 100,
          masterId: 42,
        },
        collection: [],
      }),
    ).toBe("review");
  });

  test("distinguishes unmatched from a strong missing album", () => {
    expect(
      classifyCollectionGap({
        candidateMetadataQuality: "complete",
        match: null,
        collection: [],
      }),
    ).toBe("unmatched");

    expect(
      classifyCollectionGap({
        candidateMetadataQuality: "complete",
        match: {
          confidence: 90,
          releaseId: 100,
          masterId: 42,
        },
        collection: [],
      }),
    ).toBe("missing");
  });
});
