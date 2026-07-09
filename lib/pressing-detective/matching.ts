export type PressingEvidence = {
  format?: string;
  country?: string;
  year?: number | null;
  label?: string;
  catalogNumber?: string;
  barcode?: string;
  matrixRunout?: string;
  identifierText?: string;
};

export type PressingIdentifier = {
  type: string;
  value: string;
  description: string | null;
};

export type PressingCandidate = {
  id: number;
  masterId: number | null;
  title: string;
  artist: string | null;
  country: string | null;
  year: number | null;
  formats: string[];
  labels: string[];
  catalogNumbers: string[];
  barcodes: string[];
  matrixRunouts: string[];
  pressingPlants: string[];
  masteringCredits: string[];
  identifiers: PressingIdentifier[];
  notes: string | null;
  imageUrl: string | null;
  uri: string | null;
  resourceUrl: string | null;
  detailLoaded: boolean;
};

export type PressingConfidenceState =
  | "Strong match"
  | "Likely match"
  | "Possible match"
  | "Insufficient evidence";

export type RankedPressingCandidate = PressingCandidate & {
  score: number;
  confidenceState: PressingConfidenceState;
  isViable: boolean;
  matchedSignals: string[];
  conflictingSignals: string[];
  missingSignals: string[];
};

export type PressingDiscriminator = {
  field: string;
  title: string;
  description: string;
  examples: Array<{
    candidateId: number;
    candidateTitle: string;
    value: string;
  }>;
} | null;

export type PressingComparisonRow = {
  field: string;
  label: string;
  values: Array<{
    candidateId: number;
    value: string;
    differs: boolean;
  }>;
};

const FIELD_WEIGHTS = {
  barcode: 30,
  catalogNumber: 24,
  matrixRunout: 30,
  label: 8,
  format: 6,
  country: 8,
  year: 6,
  identifierText: 8,
} as const;

function cleanText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeComparable(value: string) {
  return cleanText(value).toUpperCase().replace(/\s+/g, " ");
}

export function normalizeCatalogNumber(value: string) {
  return normalizeComparable(value).replace(/\s*([-/])\s*/g, "$1");
}

export function normalizeBarcode(value: string) {
  return normalizeComparable(value).replace(/[^A-Z0-9]/g, "");
}

export function normalizeMatrixRunout(value: string) {
  return normalizeComparable(value)
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ");
}

function normalizeSoft(value: string) {
  return normalizeComparable(value)
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ");
}

function uniqueClean(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map(cleanText).filter((value) => value.length > 0)),
  );
}

function hasEvidence(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return cleanText(value).length > 0;
}

function normalizedValues(
  values: string[],
  normalizer: (value: string) => string,
) {
  return values.map(normalizer).filter((value) => value.length > 0);
}

function exactMatch(
  evidence: string,
  values: string[],
  normalizer: (value: string) => string,
) {
  const normalizedEvidence = normalizer(evidence);

  return (
    normalizedEvidence.length > 0 &&
    normalizedValues(values, normalizer).includes(normalizedEvidence)
  );
}

function softMatch(evidence: string, values: string[]) {
  const normalizedEvidence = normalizeSoft(evidence);

  if (!normalizedEvidence) {
    return false;
  }

  return values.some((value) => {
    const normalizedValue = normalizeSoft(value);

    return (
      normalizedValue === normalizedEvidence ||
      normalizedValue.includes(normalizedEvidence) ||
      normalizedEvidence.includes(normalizedValue)
    );
  });
}

function runoutTokens(value: string) {
  return normalizeMatrixRunout(value)
    .split(/[\s/,;|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getRunoutOverlap(evidence: string, values: string[]) {
  const evidenceTokens = new Set(runoutTokens(evidence));

  if (evidenceTokens.size === 0) {
    return 0;
  }

  let bestOverlap = 0;

  for (const value of values) {
    const valueTokens = new Set(runoutTokens(value));
    const overlap = Array.from(evidenceTokens).filter((token) =>
      valueTokens.has(token),
    ).length;

    bestOverlap = Math.max(bestOverlap, overlap / evidenceTokens.size);
  }

  return bestOverlap;
}

function anyIdentifierTextMatch(evidence: string, candidate: PressingCandidate) {
  const haystack = [
    ...candidate.identifiers.flatMap((identifier) => [
      identifier.type,
      identifier.value,
      identifier.description,
    ]),
    candidate.notes,
    ...candidate.pressingPlants,
    ...candidate.masteringCredits,
  ]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" ");

  return softMatch(evidence, [haystack]);
}

function scoreCandidate(
  candidate: PressingCandidate,
  evidence: PressingEvidence,
): RankedPressingCandidate {
  const matchedSignals: string[] = [];
  const conflictingSignals: string[] = [];
  const missingSignals: string[] = [];
  let possibleScore = 0;
  let matchedScore = 0;
  let hardConflict = false;

  if (hasEvidence(evidence.barcode)) {
    possibleScore += FIELD_WEIGHTS.barcode;

    if (candidate.barcodes.length === 0) {
      missingSignals.push("Discogs does not list a barcode for this version.");
    } else if (
      exactMatch(evidence.barcode ?? "", candidate.barcodes, normalizeBarcode)
    ) {
      matchedScore += FIELD_WEIGHTS.barcode;
      matchedSignals.push("Exact barcode match.");
    } else {
      hardConflict = true;
      conflictingSignals.push("Barcode conflicts with this version.");
    }
  }

  if (hasEvidence(evidence.catalogNumber)) {
    possibleScore += FIELD_WEIGHTS.catalogNumber;

    if (candidate.catalogNumbers.length === 0) {
      missingSignals.push("Discogs does not list a catalogue number.");
    } else if (
      exactMatch(
        evidence.catalogNumber ?? "",
        candidate.catalogNumbers,
        normalizeCatalogNumber,
      )
    ) {
      matchedScore += FIELD_WEIGHTS.catalogNumber;
      matchedSignals.push("Exact catalogue number match.");
    } else {
      hardConflict = true;
      conflictingSignals.push("Catalogue number conflicts with this version.");
    }
  }

  if (hasEvidence(evidence.matrixRunout)) {
    possibleScore += FIELD_WEIGHTS.matrixRunout;

    if (candidate.matrixRunouts.length === 0) {
      missingSignals.push("Discogs does not list matrix/runout data.");
    } else if (
      exactMatch(
        evidence.matrixRunout ?? "",
        candidate.matrixRunouts,
        normalizeMatrixRunout,
      )
    ) {
      matchedScore += FIELD_WEIGHTS.matrixRunout;
      matchedSignals.push("Exact matrix/runout match.");
    } else {
      const overlap = getRunoutOverlap(
        evidence.matrixRunout ?? "",
        candidate.matrixRunouts,
      );

      if (overlap >= 0.5) {
        matchedScore += Math.round(FIELD_WEIGHTS.matrixRunout * 0.62);
        matchedSignals.push("Partial matrix/runout token overlap.");
      } else {
        conflictingSignals.push("Matrix/runout does not match this version.");
      }
    }
  }

  if (hasEvidence(evidence.label)) {
    possibleScore += FIELD_WEIGHTS.label;

    if (candidate.labels.length === 0) {
      missingSignals.push("Discogs does not list a label for this version.");
    } else if (softMatch(evidence.label ?? "", candidate.labels)) {
      matchedScore += FIELD_WEIGHTS.label;
      matchedSignals.push("Label matches.");
    } else {
      conflictingSignals.push("Label differs from this version.");
    }
  }

  if (hasEvidence(evidence.format)) {
    possibleScore += FIELD_WEIGHTS.format;

    if (candidate.formats.length === 0) {
      missingSignals.push("Discogs does not list format details.");
    } else if (softMatch(evidence.format ?? "", candidate.formats)) {
      matchedScore += FIELD_WEIGHTS.format;
      matchedSignals.push("Format matches.");
    } else {
      conflictingSignals.push("Format differs from this version.");
    }
  }

  if (hasEvidence(evidence.country)) {
    possibleScore += FIELD_WEIGHTS.country;

    if (!candidate.country) {
      missingSignals.push("Discogs does not list a country.");
    } else if (softMatch(evidence.country ?? "", [candidate.country])) {
      matchedScore += FIELD_WEIGHTS.country;
      matchedSignals.push("Country matches.");
    } else {
      conflictingSignals.push("Country differs from this version.");
    }
  }

  if (hasEvidence(evidence.year)) {
    possibleScore += FIELD_WEIGHTS.year;

    if (!candidate.year) {
      missingSignals.push("Discogs does not list a release year.");
    } else if (candidate.year === evidence.year) {
      matchedScore += FIELD_WEIGHTS.year;
      matchedSignals.push("Release year matches.");
    } else {
      conflictingSignals.push("Release year differs from this version.");
    }
  }

  if (hasEvidence(evidence.identifierText)) {
    possibleScore += FIELD_WEIGHTS.identifierText;

    if (anyIdentifierTextMatch(evidence.identifierText ?? "", candidate)) {
      matchedScore += FIELD_WEIGHTS.identifierText;
      matchedSignals.push("Identifier text appears in Discogs metadata.");
    } else if (!candidate.detailLoaded) {
      missingSignals.push("Detailed identifiers have not loaded for this version.");
    } else {
      conflictingSignals.push("Identifier text was not found in this version.");
    }
  }

  const rawScore =
    possibleScore === 0 ? 0 : Math.round((matchedScore / possibleScore) * 100);
  const score = hardConflict ? Math.min(rawScore, 44) : rawScore;
  const evidenceCount = [
    evidence.barcode,
    evidence.catalogNumber,
    evidence.matrixRunout,
    evidence.label,
    evidence.format,
    evidence.country,
    evidence.year,
    evidence.identifierText,
  ].filter(hasEvidence).length;
  const hasUsefulEvidence = evidenceCount > 0;
  const conflictPenalty =
    conflictingSignals.length > 0 && matchedSignals.length === 0 ? 12 : 0;
  const adjustedScore = Math.max(0, score - conflictPenalty);
  const onlyPartialRunoutSignal =
    matchedSignals.length === 1 &&
    matchedSignals[0] === "Partial matrix/runout token overlap.";

  let confidenceState: PressingConfidenceState = "Insufficient evidence";

  if (hasUsefulEvidence && matchedSignals.length > 0) {
    if (adjustedScore >= 82 && !hardConflict && evidenceCount >= 2) {
      confidenceState = "Strong match";
    } else if (adjustedScore >= 62 && !hardConflict && !onlyPartialRunoutSignal) {
      confidenceState = "Likely match";
    } else {
      confidenceState = "Possible match";
    }
  }

  return {
    ...candidate,
    score: adjustedScore,
    confidenceState,
    isViable: !hardConflict,
    matchedSignals,
    conflictingSignals,
    missingSignals,
  };
}

export function normalizePressingEvidence(
  evidence: PressingEvidence,
): PressingEvidence {
  const year =
    typeof evidence.year === "number" && Number.isInteger(evidence.year)
      ? evidence.year
      : null;

  return {
    format: cleanText(evidence.format) || undefined,
    country: cleanText(evidence.country) || undefined,
    year,
    label: cleanText(evidence.label) || undefined,
    catalogNumber: cleanText(evidence.catalogNumber) || undefined,
    barcode: cleanText(evidence.barcode) || undefined,
    matrixRunout: cleanText(evidence.matrixRunout) || undefined,
    identifierText: cleanText(evidence.identifierText) || undefined,
  };
}

export function rankPressingCandidates(
  candidates: PressingCandidate[],
  evidence: PressingEvidence,
) {
  const normalizedEvidence = normalizePressingEvidence(evidence);

  return candidates
    .map((candidate) => scoreCandidate(candidate, normalizedEvidence))
    .sort((first, second) => {
      if (first.isViable !== second.isViable) {
        return first.isViable ? -1 : 1;
      }

      if (second.score !== first.score) {
        return second.score - first.score;
      }

      if (second.matchedSignals.length !== first.matchedSignals.length) {
        return second.matchedSignals.length - first.matchedSignals.length;
      }

      return first.id - second.id;
    });
}

function listValue(values: string[]) {
  const cleaned = uniqueClean(values);

  return cleaned.length > 0 ? cleaned.join(", ") : "Not listed";
}

function candidateFieldValue(candidate: PressingCandidate, field: string) {
  if (field === "matrixRunout") {
    return listValue(candidate.matrixRunouts.slice(0, 3));
  }

  if (field === "barcode") {
    return listValue(candidate.barcodes);
  }

  if (field === "catalogNumber") {
    return listValue(candidate.catalogNumbers);
  }

  if (field === "country") {
    return candidate.country ?? "Not listed";
  }

  if (field === "year") {
    return candidate.year ? String(candidate.year) : "Not listed";
  }

  if (field === "label") {
    return listValue(candidate.labels);
  }

  if (field === "format") {
    return listValue(candidate.formats);
  }

  if (field === "pressingPlant") {
    return listValue(candidate.pressingPlants);
  }

  if (field === "masteringCredits") {
    return listValue(candidate.masteringCredits);
  }

  if (field === "identifiers") {
    return listValue(
      candidate.identifiers
        .filter((identifier) => identifier.type && identifier.value)
        .map((identifier) => `${identifier.type}: ${identifier.value}`)
        .slice(0, 3),
    );
  }

  return "Not listed";
}

const COMPARISON_FIELDS = [
  {
    field: "matrixRunout",
    label: "Matrix/runout",
    title: "Check the matrix/runout",
    description: "Compare the etched or stamped text in the dead wax.",
  },
  {
    field: "barcode",
    label: "Barcode",
    title: "Check the barcode",
    description: "Compare the barcode printed on the sleeve or rear cover.",
  },
  {
    field: "catalogNumber",
    label: "Catalogue number",
    title: "Check the catalogue number",
    description: "Compare the label or spine catalogue number.",
  },
  {
    field: "country",
    label: "Country",
    title: "Check the centre label",
    description: "The remaining versions list different countries.",
  },
  {
    field: "year",
    label: "Year",
    title: "Check the release year",
    description: "The remaining versions list different release years.",
  },
  {
    field: "label",
    label: "Label",
    title: "Check the label imprint",
    description: "Compare the label name printed on the centre label or sleeve.",
  },
  {
    field: "format",
    label: "Format",
    title: "Check the format notes",
    description: "Compare LP, 12 inch, album, repress, or reissue details.",
  },
  {
    field: "pressingPlant",
    label: "Pressing plant",
    title: "Check the pressing plant clue",
    description: "Discogs lists different pressing/manufacturing credits.",
  },
  {
    field: "masteringCredits",
    label: "Mastering",
    title: "Check the mastering credit",
    description: "Discogs lists different mastering or lacquer-cut credits.",
  },
  {
    field: "identifiers",
    label: "Identifiers",
    title: "Check the listed identifiers",
    description: "Discogs lists different non-barcode identifiers.",
  },
] as const;

function hasUsefulDifference(values: string[]) {
  const unique = new Set(values.map(normalizeSoft));
  const listedCount = values.filter((value) => value !== "Not listed").length;

  return listedCount > 0 && unique.size > 1;
}

export function getPressingComparisonRows(
  candidates: Array<PressingCandidate | RankedPressingCandidate>,
): PressingComparisonRow[] {
  const comparisonCandidates = candidates.slice(0, 4);

  return COMPARISON_FIELDS.flatMap(({ field, label }) => {
    const values = comparisonCandidates.map((candidate) => ({
      candidateId: candidate.id,
      value: candidateFieldValue(candidate, field),
      differs: false,
    }));

    if (!hasUsefulDifference(values.map((value) => value.value))) {
      return [];
    }

    return [
      {
        field,
        label,
        values: values.map((value) => ({
          ...value,
          differs: value.value !== "Not listed",
        })),
      },
    ];
  });
}

export function selectNextPressingDiscriminator(
  candidates: Array<PressingCandidate | RankedPressingCandidate>,
  evidence: PressingEvidence = {},
): PressingDiscriminator {
  const remainingCandidates = candidates.slice(0, 4);

  if (remainingCandidates.length < 2) {
    return null;
  }

  const normalizedEvidence = normalizePressingEvidence(evidence);
  const answeredFields = new Set(
    [
      ["matrixRunout", normalizedEvidence.matrixRunout],
      ["barcode", normalizedEvidence.barcode],
      ["catalogNumber", normalizedEvidence.catalogNumber],
      ["country", normalizedEvidence.country],
      ["year", normalizedEvidence.year],
      ["label", normalizedEvidence.label],
      ["format", normalizedEvidence.format],
      ["identifiers", normalizedEvidence.identifierText],
    ]
      .filter(([, value]) => hasEvidence(value))
      .map(([field]) => field),
  );

  for (const fieldConfig of COMPARISON_FIELDS) {
    if (answeredFields.has(fieldConfig.field)) {
      continue;
    }

    const values = remainingCandidates.map((candidate) =>
      candidateFieldValue(candidate, fieldConfig.field),
    );

    if (!hasUsefulDifference(values)) {
      continue;
    }

    return {
      field: fieldConfig.field,
      title: fieldConfig.title,
      description: fieldConfig.description,
      examples: remainingCandidates.slice(0, 3).map((candidate) => ({
        candidateId: candidate.id,
        candidateTitle: candidate.title,
        value: candidateFieldValue(candidate, fieldConfig.field),
      })),
    };
  }

  return null;
}
