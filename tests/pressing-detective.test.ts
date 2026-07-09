import { describe, expect, test } from "vitest";

import {
  rankPressingCandidates,
  selectNextPressingDiscriminator,
  type PressingCandidate,
} from "@/lib/pressing-detective/matching";

function candidate(
  overrides: Partial<PressingCandidate> & Pick<PressingCandidate, "id">,
): PressingCandidate {
  return {
    id: overrides.id,
    masterId: 10,
    title: `Candidate ${overrides.id}`,
    artist: "The Example Band",
    country: "UK",
    year: 1979,
    formats: ["Vinyl", "LP"],
    labels: ["Island Records"],
    catalogNumbers: ["ILPS 9103"],
    barcodes: ["0 12345 67890 5"],
    matrixRunouts: ["A-3U"],
    pressingPlants: [],
    masteringCredits: [],
    identifiers: [
      {
        type: "Matrix / Runout",
        value: "A-3U",
        description: "Side A",
      },
      {
        type: "Barcode",
        value: "0 12345 67890 5",
        description: null,
      },
    ],
    notes: null,
    imageUrl: null,
    uri: null,
    resourceUrl: null,
    detailLoaded: true,
    ...overrides,
  };
}

describe("pressing detective matching", () => {
  test("ranks an exact catalogue number match above a conflicting version", () => {
    const ranked = rankPressingCandidates(
      [
        candidate({ id: 2, catalogNumbers: ["ILPS 9999"] }),
        candidate({ id: 1, catalogNumbers: ["ILPS 9103"] }),
      ],
      {
        catalogNumber: "ilps 9103",
      },
    );

    expect(ranked[0].id).toBe(1);
    expect(ranked[0].matchedSignals).toContain(
      "Exact catalogue number match.",
    );
    expect(ranked[1].isViable).toBe(false);
  });

  test("normalizes barcode spacing and punctuation for exact matches", () => {
    const ranked = rankPressingCandidates([candidate({ id: 1 })], {
      barcode: "012345678905",
    });

    expect(ranked[0]).toMatchObject({
      id: 1,
      isViable: true,
      confidenceState: "Likely match",
    });
    expect(ranked[0].matchedSignals).toContain("Exact barcode match.");
  });

  test("normalizes matrix/runout casing and whitespace for exact matches", () => {
    const ranked = rankPressingCandidates([candidate({ id: 1 })], {
      matrixRunout: "  a-3u  ",
    });

    expect(ranked[0].matchedSignals).toContain("Exact matrix/runout match.");
  });

  test("recognizes partial matrix/runout token overlap", () => {
    const ranked = rankPressingCandidates(
      [candidate({ id: 1, matrixRunouts: ["A-3U"] })],
      {
        matrixRunout: "A-3U B-2U",
      },
    );

    expect(ranked[0].matchedSignals).toContain(
      "Partial matrix/runout token overlap.",
    );
    expect(ranked[0].confidenceState).toBe("Possible match");
  });

  test("keeps country and year conflicts explainable without hard filtering", () => {
    const ranked = rankPressingCandidates(
      [
        candidate({ id: 1, country: "UK", year: 1979 }),
        candidate({ id: 2, country: "Germany", year: 1982 }),
      ],
      {
        country: "UK",
        year: 1979,
      },
    );

    expect(ranked[0].id).toBe(1);
    expect(ranked[1].isViable).toBe(true);
    expect(ranked[1].conflictingSignals).toEqual([
      "Country differs from this version.",
      "Release year differs from this version.",
    ]);
  });

  test("treats missing Discogs fields as uncertainty, not conflict", () => {
    const ranked = rankPressingCandidates(
      [candidate({ id: 1, barcodes: [], identifiers: [] })],
      {
        barcode: "012345678905",
      },
    );

    expect(ranked[0].isViable).toBe(true);
    expect(ranked[0].missingSignals).toContain(
      "Discogs does not list a barcode for this version.",
    );
    expect(ranked[0].confidenceState).toBe("Insufficient evidence");
  });

  test("keeps tied candidates stable by release id", () => {
    const ranked = rankPressingCandidates(
      [candidate({ id: 11 }), candidate({ id: 10 })],
      {
        catalogNumber: "ILPS 9103",
      },
    );

    expect(ranked.map((entry) => entry.id)).toEqual([10, 11]);
    expect(ranked[0].score).toBe(ranked[1].score);
  });

  test("marks candidates with conflicting hard evidence as not viable", () => {
    const ranked = rankPressingCandidates(
      [
        candidate({ id: 1, barcodes: ["999"] }),
        candidate({ id: 2, barcodes: ["888"] }),
      ],
      {
        barcode: "012345678905",
      },
    );

    expect(ranked.every((entry) => !entry.isViable)).toBe(true);
  });

  test("selects a real metadata difference for what to check next", () => {
    const ranked = rankPressingCandidates(
      [
        candidate({ id: 1, matrixRunouts: ["A-3U"] }),
        candidate({ id: 2, matrixRunouts: ["A-5"] }),
      ],
      {
        catalogNumber: "ILPS 9103",
      },
    );
    const discriminator = selectNextPressingDiscriminator(ranked, {
      catalogNumber: "ILPS 9103",
    });

    expect(discriminator).toMatchObject({
      field: "matrixRunout",
      title: "Check the matrix/runout",
    });
    expect(discriminator?.examples.map((example) => example.value)).toEqual([
      "A-3U",
      "A-5",
    ]);
  });
});
