export type SmartWantExclusion =
  | "picture_disc"
  | "promo"
  | "unofficial"
  | "test_pressing"
  | "box_set"
  | "colored_vinyl";

export type DiscogsCondition =
  | "Mint (M)"
  | "Near Mint (NM or M-)"
  | "Very Good Plus (VG+)"
  | "Very Good (VG)"
  | "Good Plus (G+)"
  | "Good (G)"
  | "Fair (F)"
  | "Poor (P)";

export type SmartWantPriceRule = {
  amountCents: number;
  currency: string;
};

export type SmartWantRules = {
  formats: string[];
  countries: string[];
  yearFrom: number | null;
  yearTo: number | null;
  excludedTags: SmartWantExclusion[];
  excludeOwned: boolean;
  exactPressingRequired: boolean;
  maxItemPrice: SmartWantPriceRule | null;
  minMediaCondition: DiscogsCondition | null;
  minSleeveCondition: DiscogsCondition | null;
};

export type SmartWant = {
  id: string;
  masterReleaseId: number;
  sourceReleaseId: number | null;
  artist: string;
  title: string;
  imageUrl: string | null;
  sourceUri: string | null;
  rules: SmartWantRules;
  createdAt: string;
  updatedAt: string;
};

export type SmartWantInput = {
  masterReleaseId: number;
  sourceReleaseId: number | null;
  artist: string;
  title: string;
  imageUrl: string | null;
  sourceUri: string | null;
  rules: SmartWantRules;
};

export type SmartWantReleaseCandidate = {
  id: number;
  masterId: number | null;
  title: string;
  artist: string | null;
  country: string | null;
  year: number | null;
  formats: string[];
  labels: string[];
  catalogNumbers: string[];
  imageUrl: string | null;
  uri: string | null;
  resourceUrl: string | null;
  notes: string | null;
  detailLoaded: boolean;
  marketplace?: {
    itemPriceCents?: number | null;
    itemPriceCurrency?: string | null;
    mediaCondition?: string | null;
    sleeveCondition?: string | null;
  } | null;
};

export type SmartWantEvaluationStatus = "match" | "rejected" | "unknown";

export type SmartWantEvaluationReasonStatus =
  | "matched"
  | "rejected"
  | "unknown";

export type SmartWantEvaluationReason = {
  code: string;
  field: string;
  status: SmartWantEvaluationReasonStatus;
  message: string;
  expected?: string | number | boolean | null;
  actual?: string | number | boolean | null;
};

export type SmartWantEvaluation = {
  status: SmartWantEvaluationStatus;
  reasons: SmartWantEvaluationReason[];
};

export type SmartWantEvaluationContext = {
  ownedReleaseIds?: Set<number> | number[];
  ownedMasterIds?: Set<number> | number[];
};

export type SmartWantCandidateResult = {
  candidate: SmartWantReleaseCandidate;
  evaluation: SmartWantEvaluation;
  ownsExactRelease: boolean;
  ownsAnotherVersionFromMaster: boolean;
};

export type SmartWantPreview = {
  total: number;
  matchCount: number;
  rejectedCount: number;
  unknownCount: number;
};

const DEFAULT_RULES: SmartWantRules = {
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

const EXCLUSION_LABELS: Record<SmartWantExclusion, string> = {
  picture_disc: "picture discs",
  promo: "promos",
  unofficial: "unofficial releases",
  test_pressing: "test pressings",
  box_set: "box sets",
  colored_vinyl: "coloured vinyl",
};

const EXCLUSION_TERMS: Record<SmartWantExclusion, string[]> = {
  picture_disc: ["picture disc", "pic disc", "picture vinyl"],
  promo: ["promo", "promotional"],
  unofficial: ["unofficial", "bootleg"],
  test_pressing: ["test pressing", "test press"],
  box_set: ["box set", "boxset"],
  colored_vinyl: ["colored vinyl", "coloured vinyl", "colored", "coloured"],
};

const CONDITION_RANKS: Record<string, number> = {
  "Mint (M)": 8,
  "Near Mint (NM or M-)": 7,
  "Very Good Plus (VG+)": 6,
  "Very Good (VG)": 5,
  "Good Plus (G+)": 4,
  "Good (G)": 3,
  "Fair (F)": 2,
  "Poor (P)": 1,
};

const CONDITION_ALIASES: Array<[RegExp, DiscogsCondition]> = [
  [/^(m|mint)$/i, "Mint (M)"],
  [/^(nm|near mint|m-)$/i, "Near Mint (NM or M-)"],
  [/^(vg\+|very good plus)$/i, "Very Good Plus (VG+)"],
  [/^(vg|very good)$/i, "Very Good (VG)"],
  [/^(g\+|good plus)$/i, "Good Plus (G+)"],
  [/^(g|good)$/i, "Good (G)"],
  [/^(f|fair)$/i, "Fair (F)"],
  [/^(p|poor)$/i, "Poor (P)"],
];

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  const nextValue = stringValue(value);

  return nextValue.length > 0 ? nextValue : null;
}

function positiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function nonNegativeInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

function normalizedStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => stringValue(item))
        .filter((item) => item.length > 0),
    ),
  );
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedNumberSet(value: Set<number> | number[] | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Set ? value : new Set(value);
}

function normalizeExclusion(value: unknown): SmartWantExclusion | null {
  return value === "picture_disc" ||
    value === "promo" ||
    value === "unofficial" ||
    value === "test_pressing" ||
    value === "box_set" ||
    value === "colored_vinyl"
    ? value
    : null;
}

function normalizeCondition(value: unknown): DiscogsCondition | null {
  const nextValue = nullableString(value);

  if (!nextValue) {
    return null;
  }

  if (nextValue in CONDITION_RANKS) {
    return nextValue as DiscogsCondition;
  }

  const normalized = nextValue
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, condition] of CONDITION_ALIASES) {
    if (pattern.test(normalized)) {
      return condition;
    }
  }

  return null;
}

function normalizePriceRule(value: unknown): SmartWantPriceRule | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rule = value as Partial<SmartWantPriceRule>;
  const amountCents = nonNegativeInteger(rule.amountCents);
  const currency = nullableString(rule.currency)?.toUpperCase() ?? null;

  if (amountCents === null || !currency) {
    return null;
  }

  return {
    amountCents,
    currency,
  };
}

export function getDefaultSmartWantRules(): SmartWantRules {
  return {
    ...DEFAULT_RULES,
    formats: [...DEFAULT_RULES.formats],
    countries: [...DEFAULT_RULES.countries],
    excludedTags: [...DEFAULT_RULES.excludedTags],
  };
}

export function normalizeSmartWantRules(value: unknown): SmartWantRules {
  if (!value || typeof value !== "object") {
    return getDefaultSmartWantRules();
  }

  const rules = value as Partial<SmartWantRules>;
  const yearFrom = positiveInteger(rules.yearFrom);
  const yearTo = positiveInteger(rules.yearTo);
  const [normalizedYearFrom, normalizedYearTo] =
    yearFrom && yearTo && yearFrom > yearTo
      ? [yearTo, yearFrom]
      : [yearFrom, yearTo];

  return {
    formats: normalizedStringList(rules.formats),
    countries: normalizedStringList(rules.countries),
    yearFrom: normalizedYearFrom,
    yearTo: normalizedYearTo,
    excludedTags: Array.from(
      new Set(
        (Array.isArray(rules.excludedTags) ? rules.excludedTags : [])
          .map(normalizeExclusion)
          .filter((tag): tag is SmartWantExclusion => Boolean(tag)),
      ),
    ),
    excludeOwned: rules.excludeOwned === true,
    exactPressingRequired: rules.exactPressingRequired === true,
    maxItemPrice: normalizePriceRule(rules.maxItemPrice),
    minMediaCondition: normalizeCondition(rules.minMediaCondition),
    minSleeveCondition: normalizeCondition(rules.minSleeveCondition),
  };
}

export function normalizeSmartWantInput(value: unknown): SmartWantInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as Partial<SmartWantInput>;
  const masterReleaseId = positiveInteger(input.masterReleaseId);
  const artist = nullableString(input.artist);
  const title = nullableString(input.title);

  if (!masterReleaseId || !artist || !title) {
    return null;
  }

  return {
    masterReleaseId,
    sourceReleaseId: positiveInteger(input.sourceReleaseId),
    artist,
    title,
    imageUrl: nullableString(input.imageUrl),
    sourceUri: nullableString(input.sourceUri),
    rules: normalizeSmartWantRules(input.rules),
  };
}

export function normalizeSmartWant(value: unknown): SmartWant | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<SmartWant>;
  const id = nullableString(record.id);
  const input = normalizeSmartWantInput(record);
  const createdAt = nullableString(record.createdAt);
  const updatedAt = nullableString(record.updatedAt);

  if (!id || !input || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    ...input,
    createdAt,
    updatedAt,
  };
}

function reason(
  input: Omit<SmartWantEvaluationReason, "status"> & {
    status: SmartWantEvaluationReasonStatus;
  },
): SmartWantEvaluationReason {
  return input;
}

function candidateMetadata(candidate: SmartWantReleaseCandidate) {
  return [
    candidate.title,
    candidate.artist,
    candidate.country,
    candidate.notes,
    ...candidate.formats,
    ...candidate.labels,
    ...candidate.catalogNumbers,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function candidateHasFormat(candidate: SmartWantReleaseCandidate, format: string) {
  const expected = normalizeComparable(format);

  if (!expected) {
    return false;
  }

  return candidate.formats.some((candidateFormat) => {
    const actual = normalizeComparable(candidateFormat);

    return actual === expected || actual.includes(expected);
  });
}

function formatCandidateList(candidate: SmartWantReleaseCandidate) {
  return candidate.formats.length ? candidate.formats.join(", ") : null;
}

function hasExcludedMetadata(
  candidate: SmartWantReleaseCandidate,
  exclusion: SmartWantExclusion,
) {
  const metadata = normalizeComparable(candidateMetadata(candidate));

  return EXCLUSION_TERMS[exclusion].some((term) =>
    metadata.includes(normalizeComparable(term)),
  );
}

export function compareDiscogsConditions(
  actualValue: string | null | undefined,
  minimumValue: string | null | undefined,
) {
  const actual = normalizeCondition(actualValue);
  const minimum = normalizeCondition(minimumValue);

  if (!actual || !minimum) {
    return null;
  }

  return CONDITION_RANKS[actual] >= CONDITION_RANKS[minimum];
}

function getConditionReason(input: {
  actual: string | null | undefined;
  expected: DiscogsCondition;
  field: "mediaCondition" | "sleeveCondition";
  label: string;
}) {
  const result = compareDiscogsConditions(input.actual, input.expected);

  if (result === null) {
    return reason({
      code: `${input.field.toUpperCase()}_UNKNOWN`,
      field: input.field,
      status: "unknown",
      expected: input.expected,
      actual: input.actual ?? null,
      message: `${input.label} condition is not available in the current listing data.`,
    });
  }

  return reason({
    code: result
      ? `${input.field.toUpperCase()}_ACCEPTED`
      : `${input.field.toUpperCase()}_REJECTED`,
    field: input.field,
    status: result ? "matched" : "rejected",
    expected: input.expected,
    actual: input.actual ?? null,
    message: result
      ? `${input.label} condition satisfies ${input.expected} or better.`
      : `${input.label} condition is below ${input.expected}.`,
  });
}

export function evaluateReleaseAgainstSmartWant(
  candidate: SmartWantReleaseCandidate,
  smartWant: Pick<SmartWant, "rules"> | SmartWantRules,
  context: SmartWantEvaluationContext = {},
): SmartWantEvaluation {
  const rules = "rules" in smartWant ? smartWant.rules : smartWant;
  const normalizedRules = normalizeSmartWantRules(rules);
  const reasons: SmartWantEvaluationReason[] = [];

  if (normalizedRules.formats.length > 0) {
    if (candidate.formats.length === 0) {
      reasons.push(
        reason({
          code: "FORMAT_UNKNOWN",
          field: "format",
          status: "unknown",
          expected: normalizedRules.formats.join(", "),
          actual: null,
          message: "Discogs does not list enough format data for this version.",
        }),
      );
    } else if (
      normalizedRules.formats.some((format) =>
        candidateHasFormat(candidate, format),
      )
    ) {
      reasons.push(
        reason({
          code: "FORMAT_ACCEPTED",
          field: "format",
          status: "matched",
          expected: normalizedRules.formats.join(", "),
          actual: formatCandidateList(candidate),
          message: `${formatCandidateList(candidate)} matches the accepted format.`,
        }),
      );
    } else {
      reasons.push(
        reason({
          code: "FORMAT_REJECTED",
          field: "format",
          status: "rejected",
          expected: normalizedRules.formats.join(", "),
          actual: formatCandidateList(candidate),
          message: `${formatCandidateList(candidate) ?? "Unknown format"} is not accepted.`,
        }),
      );
    }
  }

  if (normalizedRules.countries.length > 0) {
    if (!candidate.country) {
      reasons.push(
        reason({
          code: "COUNTRY_UNKNOWN",
          field: "country",
          status: "unknown",
          expected: normalizedRules.countries.join(", "),
          actual: null,
          message: "Discogs does not list a release country for this version.",
        }),
      );
    } else if (
      normalizedRules.countries.some(
        (country) =>
          normalizeComparable(country) === normalizeComparable(candidate.country ?? ""),
      )
    ) {
      reasons.push(
        reason({
          code: "COUNTRY_ACCEPTED",
          field: "country",
          status: "matched",
          expected: normalizedRules.countries.join(", "),
          actual: candidate.country,
          message: `${candidate.country} is an accepted release country.`,
        }),
      );
    } else {
      reasons.push(
        reason({
          code: "COUNTRY_REJECTED",
          field: "country",
          status: "rejected",
          expected: normalizedRules.countries.join(", "),
          actual: candidate.country,
          message: `${candidate.country} is not an accepted release country.`,
        }),
      );
    }
  }

  if (normalizedRules.yearFrom || normalizedRules.yearTo) {
    const expected =
      normalizedRules.yearFrom && normalizedRules.yearTo
        ? normalizedRules.yearFrom === normalizedRules.yearTo
          ? String(normalizedRules.yearFrom)
          : `${normalizedRules.yearFrom}-${normalizedRules.yearTo}`
        : normalizedRules.yearFrom
          ? `${normalizedRules.yearFrom} or later`
          : `${normalizedRules.yearTo} or earlier`;

    if (!candidate.year) {
      reasons.push(
        reason({
          code: "YEAR_UNKNOWN",
          field: "year",
          status: "unknown",
          expected,
          actual: null,
          message: "Discogs does not list a release year for this version.",
        }),
      );
    } else if (
      (!normalizedRules.yearFrom || candidate.year >= normalizedRules.yearFrom) &&
      (!normalizedRules.yearTo || candidate.year <= normalizedRules.yearTo)
    ) {
      reasons.push(
        reason({
          code: "YEAR_ACCEPTED",
          field: "year",
          status: "matched",
          expected,
          actual: candidate.year,
          message: `${candidate.year} is inside the accepted year range.`,
        }),
      );
    } else {
      reasons.push(
        reason({
          code: "YEAR_REJECTED",
          field: "year",
          status: "rejected",
          expected,
          actual: candidate.year,
          message: `${candidate.year} is outside the accepted year range.`,
        }),
      );
    }
  }

  for (const exclusion of normalizedRules.excludedTags) {
    if (hasExcludedMetadata(candidate, exclusion)) {
      reasons.push(
        reason({
          code: `EXCLUDED_${exclusion.toUpperCase()}`,
          field: "exclusion",
          status: "rejected",
          expected: `No ${EXCLUSION_LABELS[exclusion]}`,
          actual: EXCLUSION_LABELS[exclusion],
          message: `This version appears to be ${EXCLUSION_LABELS[exclusion]}.`,
        }),
      );
    } else if (!candidate.detailLoaded) {
      reasons.push(
        reason({
          code: `EXCLUSION_${exclusion.toUpperCase()}_UNKNOWN`,
          field: "exclusion",
          status: "unknown",
          expected: `No ${EXCLUSION_LABELS[exclusion]}`,
          actual: null,
          message:
            "Discogs summary data does not fully prove this exclusion either way.",
        }),
      );
    } else {
      reasons.push(
        reason({
          code: `EXCLUSION_${exclusion.toUpperCase()}_ACCEPTED`,
          field: "exclusion",
          status: "matched",
          expected: `No ${EXCLUSION_LABELS[exclusion]}`,
          actual: null,
          message: `No ${EXCLUSION_LABELS[exclusion]} marker found.`,
        }),
      );
    }
  }

  if (normalizedRules.excludeOwned) {
    const ownedReleaseIds = normalizedNumberSet(context.ownedReleaseIds);

    if (!ownedReleaseIds) {
      reasons.push(
        reason({
          code: "OWNERSHIP_UNKNOWN",
          field: "ownership",
          status: "unknown",
          expected: true,
          actual: null,
          message:
            "Collection ownership is unavailable, so WAXLIST cannot verify this exact release.",
        }),
      );
    } else if (ownedReleaseIds.has(candidate.id)) {
      reasons.push(
        reason({
          code: "OWNED_EXACT_RELEASE",
          field: "ownership",
          status: "rejected",
          expected: false,
          actual: true,
          message: "You already own this exact release.",
        }),
      );
    } else {
      reasons.push(
        reason({
          code: "NOT_OWNED_EXACT_RELEASE",
          field: "ownership",
          status: "matched",
          expected: false,
          actual: false,
          message: "You do not own this exact release.",
        }),
      );
    }
  }

  if (normalizedRules.maxItemPrice) {
    const price = candidate.marketplace?.itemPriceCents;
    const currency = candidate.marketplace?.itemPriceCurrency?.toUpperCase() ?? null;

    if (typeof price !== "number" || !currency) {
      reasons.push(
        reason({
          code: "ITEM_PRICE_UNKNOWN",
          field: "price",
          status: "unknown",
          expected: normalizedRules.maxItemPrice.amountCents,
          actual: null,
          message: "Current item price is not available for this candidate.",
        }),
      );
    } else if (currency !== normalizedRules.maxItemPrice.currency) {
      reasons.push(
        reason({
          code: "ITEM_PRICE_CURRENCY_UNKNOWN",
          field: "price",
          status: "unknown",
          expected: normalizedRules.maxItemPrice.currency,
          actual: currency,
          message:
            "WAXLIST cannot compare item prices across currencies in this MVP.",
        }),
      );
    } else if (price <= normalizedRules.maxItemPrice.amountCents) {
      reasons.push(
        reason({
          code: "ITEM_PRICE_ACCEPTED",
          field: "price",
          status: "matched",
          expected: normalizedRules.maxItemPrice.amountCents,
          actual: price,
          message: "The item price is within your maximum.",
        }),
      );
    } else {
      reasons.push(
        reason({
          code: "ITEM_PRICE_REJECTED",
          field: "price",
          status: "rejected",
          expected: normalizedRules.maxItemPrice.amountCents,
          actual: price,
          message: "The item price is above your maximum.",
        }),
      );
    }
  }

  if (normalizedRules.minMediaCondition) {
    reasons.push(
      getConditionReason({
        actual: candidate.marketplace?.mediaCondition,
        expected: normalizedRules.minMediaCondition,
        field: "mediaCondition",
        label: "Media",
      }),
    );
  }

  if (normalizedRules.minSleeveCondition) {
    reasons.push(
      getConditionReason({
        actual: candidate.marketplace?.sleeveCondition,
        expected: normalizedRules.minSleeveCondition,
        field: "sleeveCondition",
        label: "Sleeve",
      }),
    );
  }

  if (reasons.some((entry) => entry.status === "rejected")) {
    return {
      status: "rejected",
      reasons,
    };
  }

  if (reasons.some((entry) => entry.status === "unknown")) {
    return {
      status: "unknown",
      reasons,
    };
  }

  return {
    status: "match",
    reasons,
  };
}

export function evaluateSmartWantCandidates(
  candidates: SmartWantReleaseCandidate[],
  smartWant: Pick<SmartWant, "rules"> | SmartWantRules,
  context: SmartWantEvaluationContext = {},
): SmartWantCandidateResult[] {
  const ownedReleaseIds = normalizedNumberSet(context.ownedReleaseIds);
  const ownedMasterIds = normalizedNumberSet(context.ownedMasterIds);

  return candidates.map((candidate) => ({
    candidate,
    evaluation: evaluateReleaseAgainstSmartWant(candidate, smartWant, context),
    ownsExactRelease: ownedReleaseIds?.has(candidate.id) ?? false,
    ownsAnotherVersionFromMaster:
      Boolean(candidate.masterId && ownedMasterIds?.has(candidate.masterId)) &&
      !(ownedReleaseIds?.has(candidate.id) ?? false),
  }));
}

export function buildSmartWantPreview(
  evaluations: SmartWantEvaluation[] | SmartWantCandidateResult[],
): SmartWantPreview {
  const preview: SmartWantPreview = {
    total: evaluations.length,
    matchCount: 0,
    rejectedCount: 0,
    unknownCount: 0,
  };

  for (const entry of evaluations) {
    const evaluation = "evaluation" in entry ? entry.evaluation : entry;

    if (evaluation.status === "match") {
      preview.matchCount += 1;
    } else if (evaluation.status === "rejected") {
      preview.rejectedCount += 1;
    } else {
      preview.unknownCount += 1;
    }
  }

  return preview;
}

export function getSmartWantRuleSummary(rules: SmartWantRules) {
  const normalizedRules = normalizeSmartWantRules(rules);
  const parts: string[] = [];

  if (normalizedRules.formats.length > 0) {
    parts.push(normalizedRules.formats.join(", "));
  } else {
    parts.push("Any format");
  }

  if (normalizedRules.countries.length > 0) {
    parts.push(normalizedRules.countries.join(", "));
  }

  if (normalizedRules.yearFrom || normalizedRules.yearTo) {
    if (
      normalizedRules.yearFrom &&
      normalizedRules.yearTo &&
      normalizedRules.yearFrom === normalizedRules.yearTo
    ) {
      parts.push(String(normalizedRules.yearFrom));
    } else if (normalizedRules.yearFrom && normalizedRules.yearTo) {
      parts.push(`${normalizedRules.yearFrom}-${normalizedRules.yearTo}`);
    } else if (normalizedRules.yearFrom) {
      parts.push(`${normalizedRules.yearFrom}+`);
    } else if (normalizedRules.yearTo) {
      parts.push(`Through ${normalizedRules.yearTo}`);
    }
  }

  if (normalizedRules.maxItemPrice) {
    parts.push(
      `Max ${normalizedRules.maxItemPrice.currency} ${(
        normalizedRules.maxItemPrice.amountCents / 100
      ).toFixed(2)}`,
    );
  }

  if (normalizedRules.minMediaCondition) {
    parts.push(`Media ${normalizedRules.minMediaCondition} or better`);
  }

  if (normalizedRules.minSleeveCondition) {
    parts.push(`Sleeve ${normalizedRules.minSleeveCondition} or better`);
  }

  for (const exclusion of normalizedRules.excludedTags) {
    parts.push(`No ${EXCLUSION_LABELS[exclusion]}`);
  }

  if (normalizedRules.excludeOwned) {
    parts.push("Exclude owned versions");
  }

  return parts.join(" · ");
}

export function getSmartWantExclusionLabel(exclusion: SmartWantExclusion) {
  return EXCLUSION_LABELS[exclusion];
}
