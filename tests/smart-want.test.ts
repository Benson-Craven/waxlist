import { describe, expect, test } from "vitest";

import {
  buildSmartWantPreview,
  compareDiscogsConditions,
  evaluateReleaseAgainstSmartWant,
  evaluateSmartWantCandidates,
  getSmartWantRuleSummary,
  type SmartWantReleaseCandidate,
  type SmartWantRules,
} from "@/lib/wishlist/smart-want";

const baseRules: SmartWantRules = {
  formats: ["Vinyl"],
  countries: [],
  yearFrom: null,
  yearTo: null,
  excludedTags: [],
  excludeOwned: false,
  exactPressingRequired: false,
  maxItemPrice: null,
  minMediaCondition: null,
  minSleeveCondition: null,
};

function candidate(
  overrides: Partial<SmartWantReleaseCandidate> = {},
): SmartWantReleaseCandidate {
  return {
    id: 100,
    masterId: 10,
    title: "Fleetwood Mac - Rumours",
    artist: "Fleetwood Mac",
    country: "UK",
    year: 1977,
    formats: ["Vinyl", "LP", "Album"],
    labels: ["Warner Bros. Records"],
    catalogNumbers: ["K56344"],
    imageUrl: null,
    uri: "https://www.discogs.com/release/100",
    resourceUrl: null,
    notes: null,
    detailLoaded: true,
    ...overrides,
  };
}

function evaluate(
  rules: Partial<SmartWantRules>,
  candidateOverrides: Partial<SmartWantReleaseCandidate> = {},
) {
  return evaluateReleaseAgainstSmartWant(candidate(candidateOverrides), {
    ...baseRules,
    ...rules,
  });
}

describe("smart want evaluation", () => {
  test("matches accepted format", () => {
    expect(evaluate({ formats: ["Vinyl"] }).status).toBe("match");
  });

  test("rejects unsupported format", () => {
    const result = evaluate({ formats: ["Vinyl"] }, { formats: ["CD"] });

    expect(result.status).toBe("rejected");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "FORMAT_REJECTED" }),
    );
  });

  test("matches exact year", () => {
    expect(evaluate({ yearFrom: 1977, yearTo: 1977 }).status).toBe("match");
  });

  test("matches year range", () => {
    expect(evaluate({ yearFrom: 1970, yearTo: 1989 }).status).toBe("match");
  });

  test("rejects year outside range", () => {
    expect(evaluate({ yearFrom: 1980, yearTo: 1989 }).status).toBe("rejected");
  });

  test("matches accepted country", () => {
    expect(evaluate({ countries: ["UK", "Germany"] }).status).toBe("match");
  });

  test("rejects unaccepted country", () => {
    expect(evaluate({ countries: ["Germany"] }).status).toBe("rejected");
  });

  test("rejects excluded picture disc", () => {
    const result = evaluate(
      { excludedTags: ["picture_disc"] },
      { formats: ["Vinyl", "LP", "Picture Disc"] },
    );

    expect(result.status).toBe("rejected");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "EXCLUDED_PICTURE_DISC" }),
    );
  });

  test("rejects excluded promo", () => {
    const result = evaluate(
      { excludedTags: ["promo"] },
      { formats: ["Vinyl", "LP", "Promo"] },
    );

    expect(result.status).toBe("rejected");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "EXCLUDED_PROMO" }),
    );
  });

  test("treats missing metadata as unknown when an exclusion needs detail", () => {
    const result = evaluate(
      { excludedTags: ["unofficial"] },
      { detailLoaded: false, formats: ["Vinyl"] },
    );

    expect(result.status).toBe("unknown");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "EXCLUSION_UNOFFICIAL_UNKNOWN" }),
    );
  });

  test("rejects an owned exact release when excludeOwned is enabled", () => {
    const result = evaluateReleaseAgainstSmartWant(
      candidate({ id: 100, masterId: 10 }),
      { ...baseRules, excludeOwned: true },
      { ownedReleaseIds: [100], ownedMasterIds: [10] },
    );

    expect(result.status).toBe("rejected");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "OWNED_EXACT_RELEASE" }),
    );
  });

  test("does not reject another pressing from an owned master", () => {
    const result = evaluateReleaseAgainstSmartWant(
      candidate({ id: 101, masterId: 10 }),
      { ...baseRules, excludeOwned: true },
      { ownedReleaseIds: [100], ownedMasterIds: [10] },
    );

    expect(result.status).toBe("match");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "NOT_OWNED_EXACT_RELEASE" }),
    );
  });

  test("minimum VG+ accepts NM", () => {
    expect(
      compareDiscogsConditions("Near Mint (NM or M-)", "Very Good Plus (VG+)"),
    ).toBe(true);
  });

  test("minimum VG+ accepts VG+", () => {
    expect(compareDiscogsConditions("VG+", "VG+")).toBe(true);
  });

  test("minimum VG+ rejects VG", () => {
    expect(compareDiscogsConditions("Very Good (VG)", "VG+")).toBe(false);
  });

  test("matches max price boundary", () => {
    const result = evaluate(
      {
        maxItemPrice: {
          amountCents: 3500,
          currency: "EUR",
        },
      },
      {
        marketplace: {
          itemPriceCents: 3500,
          itemPriceCurrency: "EUR",
        },
      },
    );

    expect(result.status).toBe("match");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "ITEM_PRICE_ACCEPTED" }),
    );
  });

  test("does not fabricate a price match when price is missing", () => {
    const result = evaluate({
      maxItemPrice: {
        amountCents: 3500,
        currency: "EUR",
      },
    });

    expect(result.status).toBe("unknown");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "ITEM_PRICE_UNKNOWN" }),
    );
  });

  test("matches when multiple criteria all pass", () => {
    const withOwnership = evaluateReleaseAgainstSmartWant(
      candidate(),
      {
        ...baseRules,
        formats: ["Vinyl"],
        countries: ["UK"],
        yearFrom: 1970,
        yearTo: 1979,
        excludedTags: ["picture_disc"],
        excludeOwned: true,
      },
      { ownedReleaseIds: [] },
    );

    expect(withOwnership.status).toBe("match");
  });

  test("one hard rejection rejects the candidate", () => {
    const result = evaluate({
      formats: ["Vinyl"],
      countries: ["UK"],
      yearFrom: 1980,
      yearTo: 1989,
    });

    expect(result.status).toBe("rejected");
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "YEAR_REJECTED" }),
    );
  });

  test("generates a stable deterministic rule summary", () => {
    expect(
      getSmartWantRuleSummary({
        ...baseRules,
        countries: ["UK", "Germany"],
        yearFrom: 1970,
        yearTo: 1989,
        excludedTags: ["picture_disc", "promo"],
        excludeOwned: true,
      }),
    ).toBe(
      "Vinyl · UK, Germany · 1970-1989 · No picture discs · No promos · Exclude owned versions",
    );
  });

  test("builds candidate count previews", () => {
    const results = evaluateSmartWantCandidates(
      [
        candidate({ id: 1 }),
        candidate({ id: 2, country: "Germany" }),
        candidate({ id: 3, year: null }),
      ],
      {
        ...baseRules,
        countries: ["UK"],
        yearFrom: 1970,
        yearTo: 1979,
      },
    );

    expect(buildSmartWantPreview(results)).toEqual({
      total: 3,
      matchCount: 1,
      rejectedCount: 1,
      unknownCount: 1,
    });
  });

  test("large candidate preview evaluates linearly by candidate", () => {
    const candidates = Array.from({ length: 1_000 }, (_, index) =>
      candidate({
        id: index + 1,
        country: index % 2 === 0 ? "UK" : "Germany",
      }),
    );
    const results = evaluateSmartWantCandidates(candidates, {
      ...baseRules,
      countries: ["UK"],
    });

    expect(results).toHaveLength(1_000);
    expect(buildSmartWantPreview(results)).toMatchObject({
      total: 1_000,
      matchCount: 500,
      rejectedCount: 500,
      unknownCount: 0,
    });
  });
});
