import { describe, expect, test } from "vitest";

import {
  resolvePressingCandidates,
  type PressingResolutionContext,
} from "@/lib/pressing-proof/resolution";
import type { PressingCandidate } from "@/lib/pressing-detective/matching";

function candidate(
  overrides: Partial<PressingCandidate> & Pick<PressingCandidate, "id">,
): PressingCandidate {
  return {
    masterId: 10,
    title: `The Example Band - Candidate ${overrides.id}`,
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
    ],
    notes: null,
    imageUrl: null,
    uri: `/release/${overrides.id}`,
    resourceUrl: `https://api.discogs.com/releases/${overrides.id}`,
    detailLoaded: true,
    ...overrides,
  };
}

function completeContext(
  overrides: Partial<PressingResolutionContext> = {},
): PressingResolutionContext {
  return {
    totalCandidates: 2,
    returnedCandidates: 2,
    truncated: false,
    failedCandidateIds: [],
    ...overrides,
  };
}

describe("pressing-proof resolution", () => {
  test("keeps a shared barcode as a shortlist and asks for the lowest-effort discriminator", () => {
    const resolution = resolvePressingCandidates({
      candidates: [
        candidate({ id: 1, catalogNumbers: ["ILPS 9103"] }),
        candidate({ id: 2, catalogNumbers: ["ILPS 9103-A"] }),
      ],
      evidence: {
        barcode: "012345678905",
      },
      context: completeContext(),
    });

    expect(resolution.kind).toBe("shortlist");
    expect(resolution.remainingCandidates.map(({ id }) => id)).toEqual([1, 2]);
    expect(resolution.nextQuestion).toMatchObject({
      field: "catalogNumber",
      title: "Check the catalogue number",
    });
  });

  test("returns exact only for one uniquely supported candidate in a complete comparison", () => {
    const resolution = resolvePressingCandidates({
      candidates: [
        candidate({ id: 1, matrixRunouts: ["A-3U"] }),
        candidate({ id: 2, matrixRunouts: ["A-5"] }),
      ],
      evidence: {
        barcode: "012345678905",
        matrixRunout: " a-3u ",
      },
      context: completeContext(),
    });

    expect(resolution).toMatchObject({
      kind: "exact",
      resolvedReleaseId: 1,
      remainingCandidates: [{ id: 1 }],
    });
  });

  test("never returns exact from a truncated comparison", () => {
    const resolution = resolvePressingCandidates({
      candidates: [
        candidate({ id: 1, matrixRunouts: ["A-3U"] }),
        candidate({ id: 2, matrixRunouts: ["A-5"] }),
      ],
      evidence: {
        matrixRunout: "A-3U",
      },
      context: completeContext({
        totalCandidates: 12,
        returnedCandidates: 2,
        truncated: true,
      }),
    });

    expect(resolution).toMatchObject({
      kind: "unknown",
      resolvedReleaseId: null,
      reason: "comparison_incomplete",
    });
  });

  test("does not eliminate a candidate when Discogs metadata is missing", () => {
    const resolution = resolvePressingCandidates({
      candidates: [
        candidate({ id: 1, catalogNumbers: ["ILPS 9103"] }),
        candidate({ id: 2, catalogNumbers: [], country: "US" }),
      ],
      evidence: {
        catalogNumber: "ILPS 9103",
      },
      context: completeContext(),
    });

    expect(resolution.kind).toBe("shortlist");
    expect(resolution.remainingCandidates.map(({ id }) => id)).toEqual([1, 2]);
    expect(
      resolution.remainingCandidates.find(({ id }) => id === 2)
        ?.unavailableEvidence,
    ).toContain("Discogs does not list a catalogue number.");
  });

  test("returns unknown when supplied evidence conflicts with every candidate", () => {
    const resolution = resolvePressingCandidates({
      candidates: [
        candidate({ id: 1, catalogNumbers: ["ILPS 1"] }),
        candidate({ id: 2, catalogNumbers: ["ILPS 2"] }),
      ],
      evidence: {
        catalogNumber: "ILPS 9999",
      },
      context: completeContext(),
    });

    expect(resolution).toMatchObject({
      kind: "unknown",
      reason: "evidence_conflict",
      remainingCandidates: [],
    });
  });

  test("reports unknown when candidate metadata failed to load", () => {
    const resolution = resolvePressingCandidates({
      candidates: [
        candidate({ id: 1, matrixRunouts: ["A-3U"] }),
        candidate({ id: 2, matrixRunouts: ["A-5"], detailLoaded: false }),
      ],
      evidence: {
        matrixRunout: "A-3U",
      },
      context: completeContext({
        failedCandidateIds: [2],
      }),
    });

    expect(resolution).toMatchObject({
      kind: "unknown",
      reason: "comparison_incomplete",
      resolvedReleaseId: null,
    });
  });

  test("does not treat a partial manufacturing or mastering clue as exact proof", () => {
    const resolution = resolvePressingCandidates({
      candidates: [
        candidate({
          id: 1,
          barcodes: ["111"],
          masteringCredits: ["Tim Young"],
        }),
        candidate({ id: 2, barcodes: ["222"] }),
      ],
      evidence: {
        barcode: "111",
        identifierText: "Tim",
      },
      context: completeContext(),
    });

    expect(resolution).toMatchObject({
      kind: "unknown",
      reason: "insufficient_evidence",
      resolvedReleaseId: null,
    });
  });
});
