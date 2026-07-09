import { isMissingCollectionLocation } from "@/lib/collection/location";
import type { CollectionRecord } from "@/lib/collection/record";

export type DuplicateRecordGroup = {
  key: string;
  artist: string;
  title: string;
  releaseId: number;
  records: CollectionRecord[];
};

export type CollectionAuditSeverity =
  | "high_attention"
  | "review_recommended"
  | "informational";

export type CollectionAuditCategory =
  | "duplicates"
  | "metadata"
  | "locations"
  | "identification"
  | "unresolved";

export type CollectionAuditFindingType =
  | "exact_duplicate_release"
  | "multiple_versions_master"
  | "missing_media_condition"
  | "missing_sleeve_condition"
  | "missing_shelf_location"
  | "incomplete_release_metadata";

export type CollectionAuditFinding = {
  id: string;
  type: CollectionAuditFindingType;
  category: CollectionAuditCategory;
  severity: CollectionAuditSeverity;
  affectedCollectionItemIds: string[];
  affectedDiscogsReleaseIds: number[];
  affectedDiscogsMasterIds: number[];
  title: string;
  explanation: string;
  evidence: string[];
  suggestedAction: string;
  actionHref: string;
  dismissible: boolean;
  detectedAt: string;
  records: CollectionRecord[];
};

export type CollectionHealthState =
  | "healthy"
  | "mostly_healthy"
  | "review_recommended";

export type CollectionAuditSummary = {
  totalFindings: number;
  healthState: CollectionHealthState;
  countsBySeverity: Record<CollectionAuditSeverity, number>;
  countsByType: Record<CollectionAuditFindingType, number>;
  countsByCategory: Record<CollectionAuditCategory, number>;
  lastCheckedAt: string;
  remoteVerification: {
    status: "not_started";
    reason: string;
  };
};

export const COLLECTION_AUDIT_SEVERITY_LABELS = {
  high_attention: "High attention",
  review_recommended: "Review recommended",
  informational: "Informational",
} as const satisfies Record<CollectionAuditSeverity, string>;

export const COLLECTION_AUDIT_TYPE_LABELS = {
  exact_duplicate_release: "Exact duplicate release",
  multiple_versions_master: "Multiple versions",
  missing_media_condition: "Missing media condition",
  missing_sleeve_condition: "Missing sleeve condition",
  missing_shelf_location: "Missing shelf location",
  incomplete_release_metadata: "Incomplete metadata",
} as const satisfies Record<CollectionAuditFindingType, string>;

export const COLLECTION_AUDIT_CATEGORY_LABELS = {
  duplicates: "Duplicates",
  metadata: "Metadata",
  locations: "Locations",
  identification: "Identification",
  unresolved: "Unresolved",
} as const satisfies Record<CollectionAuditCategory, string>;

export type CollectionHealth = {
  totalRecords: number;
  ownedCount: number;
  wantedCount: number;
  auditFindings: CollectionAuditFinding[];
  auditSummary: CollectionAuditSummary;
  duplicateGroups: DuplicateRecordGroup[];
  highValueRecords: CollectionRecord[];
  recentlyAddedRecords: CollectionRecord[];
  missingLocationRecords: CollectionRecord[];
  collectedArtistGapRecords: CollectionRecord[];
  listeningRecency: {
    status: "unavailable";
    reason: string;
  };
  streamedArtistGaps: {
    status: "unavailable";
    reason: string;
  };
};

type CollectionHealthOptions = {
  now?: Date;
  recentWindowDays?: number;
  highValueLimit?: number;
  recentLimit?: number;
  missingLocationLimit?: number;
  collectedArtistGapLimit?: number;
};

const DEFAULT_RECENT_WINDOW_DAYS = 45;
const DEFAULT_RECORD_LIMIT = 8;
const AUDIT_SEVERITIES: CollectionAuditSeverity[] = [
  "high_attention",
  "review_recommended",
  "informational",
];
const AUDIT_TYPES: CollectionAuditFindingType[] = [
  "exact_duplicate_release",
  "multiple_versions_master",
  "missing_media_condition",
  "missing_sleeve_condition",
  "missing_shelf_location",
  "incomplete_release_metadata",
];
const AUDIT_CATEGORIES: CollectionAuditCategory[] = [
  "duplicates",
  "metadata",
  "locations",
  "identification",
  "unresolved",
];

function normalizeSearchKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function getRecordTimestamp(record: CollectionRecord, key: "createdAt" | "updatedAt" | "syncedAt") {
  const timestamp = Date.parse(record[key]);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortByRecordAdded(first: CollectionRecord, second: CollectionRecord) {
  return (
    getRecordTimestamp(second, "createdAt") -
    getRecordTimestamp(first, "createdAt")
  );
}

function sortByPriceDesc(first: CollectionRecord, second: CollectionRecord) {
  return (second.priceHintCents ?? 0) - (first.priceHintCents ?? 0);
}

function sortByTitle(first: CollectionRecord, second: CollectionRecord) {
  return `${first.artist} ${first.title}`.localeCompare(
    `${second.artist} ${second.title}`,
  );
}

function sortByStableRecordIdentity(first: CollectionRecord, second: CollectionRecord) {
  if (first.discogsReleaseId !== second.discogsReleaseId) {
    return first.discogsReleaseId - second.discogsReleaseId;
  }

  return sortByTitle(first, second) || first.id.localeCompare(second.id);
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values)).sort((first, second) => first - second);
}

function groupOwnedRecordsBy(
  records: CollectionRecord[],
  getKey: (record: CollectionRecord) => string | null,
) {
  const groups = new Map<string, CollectionRecord[]>();

  for (const record of records) {
    if (record.status !== "owned") {
      continue;
    }

    const key = getKey(record);

    if (!key) {
      continue;
    }

    const group = groups.get(key);

    if (group) {
      group.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  return groups;
}

function buildDuplicateGroups(records: CollectionRecord[]) {
  const groups = groupOwnedRecordsBy(
    records,
    (record) => `release:${record.discogsReleaseId}`,
  );

  return Array.from(groups.entries())
    .map(([key, groupRecords]) => {
      const [firstRecord] = groupRecords;

      return firstRecord
        ? {
            key,
            artist: firstRecord.artist,
            title: firstRecord.title,
            releaseId: firstRecord.discogsReleaseId,
            records: groupRecords.slice().sort(sortByRecordAdded),
          }
        : null;
    })
    .filter((group): group is DuplicateRecordGroup =>
      Boolean(group && group.records.length > 1),
    )
    .sort((first, second) => second.records.length - first.records.length);
}

function missingCondition(value: string | null | undefined) {
  return cleanText(value).length === 0;
}

function missingMetadataFields(record: CollectionRecord) {
  const missingFields: string[] = [];

  if (!record.year) {
    missingFields.push("year");
  }

  if (!cleanText(record.label)) {
    missingFields.push("label");
  }

  if (!cleanText(record.catalogNumber)) {
    missingFields.push("catalogue number");
  }

  return missingFields;
}

function buildFinding(input: {
  type: CollectionAuditFindingType;
  category: CollectionAuditCategory;
  severity: CollectionAuditSeverity;
  key: string;
  records: CollectionRecord[];
  title: string;
  explanation: string;
  evidence: string[];
  suggestedAction: string;
  actionHref: string;
  detectedAt: string;
}): CollectionAuditFinding {
  const records = input.records.slice().sort(sortByStableRecordIdentity);

  return {
    id: `${input.type}:${input.key}`,
    type: input.type,
    category: input.category,
    severity: input.severity,
    affectedCollectionItemIds: records.map((record) => record.id).sort(),
    affectedDiscogsReleaseIds: uniqueNumbers(
      records.map((record) => record.discogsReleaseId),
    ),
    affectedDiscogsMasterIds: uniqueNumbers(
      records
        .map((record) => record.discogsMasterId)
        .filter((id): id is number => typeof id === "number"),
    ),
    title: input.title,
    explanation: input.explanation,
    evidence: input.evidence,
    suggestedAction: input.suggestedAction,
    actionHref: input.actionHref,
    dismissible: false,
    detectedAt: input.detectedAt,
    records,
  };
}

export function detectExactDuplicateReleases(
  records: CollectionRecord[],
  detectedAt: string,
) {
  return buildDuplicateGroups(records).map((group) =>
    buildFinding({
      type: "exact_duplicate_release",
      category: "duplicates",
      severity: "high_attention",
      key: `release:${group.releaseId}`,
      records: group.records,
      title: `${group.records.length.toLocaleString()} copies of the same exact release`,
      explanation:
        "These owned records point at the same Discogs release. That may be intentional, so WAXLIST is surfacing the copies for review instead of treating them as an error.",
      evidence: [
        `Same Discogs release id: ${group.releaseId}`,
        `Affected records: ${pluralize(group.records.length, "copy", "copies")}`,
        `Stored conditions: ${group.records
          .map(
            (record) =>
              `${record.mediaCondition ?? "media unset"} / ${
                record.sleeveCondition ?? "sleeve unset"
              }`,
          )
          .join("; ")}`,
      ],
      suggestedAction: `Review ${pluralize(group.records.length, "copy", "copies")}`,
      actionHref: "/app?view=collection",
      detectedAt,
    }),
  );
}

export function detectMultipleVersionsOfMaster(
  records: CollectionRecord[],
  detectedAt: string,
) {
  const groups = groupOwnedRecordsBy(records, (record) =>
    record.discogsMasterId ? `master:${record.discogsMasterId}` : null,
  );

  return Array.from(groups.entries())
    .flatMap(([key, groupRecords]) => {
      const releaseIds = uniqueNumbers(
        groupRecords.map((record) => record.discogsReleaseId),
      );
      const masterId = groupRecords[0]?.discogsMasterId;

      if (!masterId || releaseIds.length < 2) {
        return [];
      }

      return [
        buildFinding({
          type: "multiple_versions_master",
          category: "duplicates",
          severity: "review_recommended",
          key,
          records: groupRecords,
          title: "Multiple versions of the same album",
          explanation:
            "These owned records belong to the same Discogs master release but are saved as different exact releases. This can be intentional, such as an original pressing plus a reissue.",
          evidence: [
            `Discogs master id: ${masterId}`,
            `Different release ids: ${releaseIds.join(", ")}`,
            `Affected records: ${pluralize(groupRecords.length, "record")}`,
          ],
          suggestedAction: "Compare versions or identify physical copies",
          actionHref: "/app?view=collection",
          detectedAt,
        }),
      ];
    })
    .sort((first, second) => second.records.length - first.records.length);
}

export function detectMissingConditionFindings(
  records: CollectionRecord[],
  detectedAt: string,
) {
  const ownedRecords = records.filter((record) => record.status === "owned");
  const mediaRecords = ownedRecords
    .filter((record) => missingCondition(record.mediaCondition))
    .sort(sortByTitle);
  const sleeveRecords = ownedRecords
    .filter((record) => missingCondition(record.sleeveCondition))
    .sort(sortByTitle);
  const findings: CollectionAuditFinding[] = [];

  if (mediaRecords.length > 0) {
    findings.push(
      buildFinding({
        type: "missing_media_condition",
        category: "metadata",
        severity: "review_recommended",
        key: "media",
        records: mediaRecords,
        title: `${pluralize(mediaRecords.length, "record")} missing media condition`,
        explanation:
          "Media condition has not been recorded on these owned records. WAXLIST can show the affected records, but it will not guess or write condition values automatically.",
        evidence: [
          "The stored media condition field is blank.",
          `Affected records: ${pluralize(mediaRecords.length, "record")}`,
        ],
        suggestedAction: "Open affected records and add condition where available",
        actionHref: "/app?view=collection",
        detectedAt,
      }),
    );
  }

  if (sleeveRecords.length > 0) {
    findings.push(
      buildFinding({
        type: "missing_sleeve_condition",
        category: "metadata",
        severity: "review_recommended",
        key: "sleeve",
        records: sleeveRecords,
        title: `${pluralize(sleeveRecords.length, "record")} missing sleeve condition`,
        explanation:
          "Sleeve condition has not been recorded on these owned records. The audit groups them so the collection can be reviewed without producing one card per record.",
        evidence: [
          "The stored sleeve condition field is blank.",
          `Affected records: ${pluralize(sleeveRecords.length, "record")}`,
        ],
        suggestedAction: "Open affected records and add sleeve condition where available",
        actionHref: "/app?view=collection",
        detectedAt,
      }),
    );
  }

  return findings;
}

export function detectMissingLocationFinding(
  records: CollectionRecord[],
  detectedAt: string,
) {
  const locationRecords = records
    .filter(
      (record) =>
        record.status === "owned" && isMissingCollectionLocation(record),
    )
    .sort(sortByTitle);

  return locationRecords.length > 0
    ? [
        buildFinding({
          type: "missing_shelf_location",
          category: "locations",
          severity: "informational",
          key: "shelf-location",
          records: locationRecords,
          title: `${pluralize(locationRecords.length, "record")} not assigned to a shelf`,
          explanation:
            "These owned records do not have room, unit, shelf, or slot data. This is useful shelf work, not a destructive cleanup task.",
          evidence: [
            "Room, unit, shelf, and slot are all blank.",
            `Affected records: ${pluralize(locationRecords.length, "record")}`,
          ],
          suggestedAction: "Assign shelf location",
          actionHref: "/app?view=shelf",
          detectedAt,
        }),
      ]
    : [];
}

export function detectIncompleteMetadataFinding(
  records: CollectionRecord[],
  detectedAt: string,
) {
  const incompleteRecords = records
    .filter((record) => record.status === "owned")
    .filter((record) => missingMetadataFields(record).length > 0)
    .sort(sortByTitle);

  if (incompleteRecords.length === 0) {
    return [];
  }

  const fieldCounts = new Map<string, number>();

  for (const record of incompleteRecords) {
    for (const field of missingMetadataFields(record)) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    }
  }

  return [
    buildFinding({
      type: "incomplete_release_metadata",
      category: "metadata",
      severity: "informational",
      key: "release-metadata",
      records: incompleteRecords,
      title: `${pluralize(incompleteRecords.length, "record")} missing release metadata`,
      explanation:
        "Some optional release metadata is blank. WAXLIST can still use these records, but search, comparison, and identification flows work better when label, catalogue number, and year are present.",
      evidence: Array.from(fieldCounts.entries()).map(
        ([field, count]) => `${pluralize(count, "record")} missing ${field}`,
      ),
      suggestedAction: "Review release metadata",
      actionHref: "/app?view=collection",
      detectedAt,
    }),
  ];
}

export function buildCollectionAuditFindings(
  records: CollectionRecord[],
  detectedAt: string,
) {
  return [
    ...detectExactDuplicateReleases(records, detectedAt),
    ...detectMultipleVersionsOfMaster(records, detectedAt),
    ...detectMissingConditionFindings(records, detectedAt),
    ...detectMissingLocationFinding(records, detectedAt),
    ...detectIncompleteMetadataFinding(records, detectedAt),
  ].sort((first, second) => {
    const severityOrder: Record<CollectionAuditSeverity, number> = {
      high_attention: 0,
      review_recommended: 1,
      informational: 2,
    };

    return (
      severityOrder[first.severity] - severityOrder[second.severity] ||
      first.type.localeCompare(second.type) ||
      first.id.localeCompare(second.id)
    );
  });
}

function emptyRecord<T extends string>(keys: T[]) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

function buildCollectionAuditSummary(
  findings: CollectionAuditFinding[],
  detectedAt: string,
): CollectionAuditSummary {
  const countsBySeverity = emptyRecord(AUDIT_SEVERITIES);
  const countsByType = emptyRecord(AUDIT_TYPES);
  const countsByCategory = emptyRecord(AUDIT_CATEGORIES);

  for (const finding of findings) {
    countsBySeverity[finding.severity] += 1;
    countsByType[finding.type] += 1;
    countsByCategory[finding.category] += 1;
  }

  const healthState: CollectionHealthState =
    countsBySeverity.high_attention > 0 || countsBySeverity.review_recommended > 0
      ? "review_recommended"
      : countsBySeverity.informational > 0
        ? "mostly_healthy"
        : "healthy";

  return {
    totalFindings: findings.length,
    healthState,
    countsBySeverity,
    countsByType,
    countsByCategory,
    lastCheckedAt: detectedAt,
    remoteVerification: {
      status: "not_started",
      reason:
        "This MVP runs local checks from the currently loaded collection. Remote Discogs release verification is deferred to a bounded follow-up pass.",
    },
  };
}

function buildCollectedArtistGaps(records: CollectionRecord[], limit: number) {
  const ownedArtistKeys = new Set(
    records
      .filter((record) => record.status === "owned")
      .map((record) => normalizeSearchKey(record.artist))
      .filter(Boolean),
  );
  const ownedAlbumKeys = new Set(
    records
      .filter((record) => record.status === "owned")
      .map(
        (record) =>
          `${normalizeSearchKey(record.artist)}::${normalizeSearchKey(record.title)}`,
      ),
  );

  return records
    .filter((record) => {
      if (record.status !== "wanted") {
        return false;
      }

      const artistKey = normalizeSearchKey(record.artist);
      const albumKey = `${artistKey}::${normalizeSearchKey(record.title)}`;

      return ownedArtistKeys.has(artistKey) && !ownedAlbumKeys.has(albumKey);
    })
    .sort(sortByTitle)
    .slice(0, limit);
}

export function buildCollectionHealth(
  records: CollectionRecord[],
  options: CollectionHealthOptions = {},
): CollectionHealth {
  const now = options.now ?? new Date();
  const recentWindowDays = options.recentWindowDays ?? DEFAULT_RECENT_WINDOW_DAYS;
  const highValueLimit = options.highValueLimit ?? DEFAULT_RECORD_LIMIT;
  const recentLimit = options.recentLimit ?? DEFAULT_RECORD_LIMIT;
  const missingLocationLimit =
    options.missingLocationLimit ?? DEFAULT_RECORD_LIMIT;
  const collectedArtistGapLimit =
    options.collectedArtistGapLimit ?? DEFAULT_RECORD_LIMIT;
  const recentCutoff = now.getTime() - recentWindowDays * 24 * 60 * 60 * 1000;
  const detectedAt = now.toISOString();
  const auditFindings = buildCollectionAuditFindings(records, detectedAt);
  const auditSummary = buildCollectionAuditSummary(auditFindings, detectedAt);

  return {
    totalRecords: records.length,
    ownedCount: records.filter((record) => record.status === "owned").length,
    wantedCount: records.filter((record) => record.status === "wanted").length,
    auditFindings,
    auditSummary,
    duplicateGroups: buildDuplicateGroups(records),
    highValueRecords: records
      .filter((record) => typeof record.priceHintCents === "number")
      .sort(sortByPriceDesc)
      .slice(0, highValueLimit),
    recentlyAddedRecords: records
      .filter((record) => getRecordTimestamp(record, "createdAt") >= recentCutoff)
      .sort(sortByRecordAdded)
      .slice(0, recentLimit),
    missingLocationRecords: records
      .filter(
        (record) =>
          record.status === "owned" && isMissingCollectionLocation(record),
      )
      .sort(sortByTitle)
      .slice(0, missingLocationLimit),
    collectedArtistGapRecords: buildCollectedArtistGaps(
      records,
      collectedArtistGapLimit,
    ),
    listeningRecency: {
      status: "unavailable",
      reason:
        "Spotify listening timestamps are not persisted with collection records yet.",
    },
    streamedArtistGaps: {
      status: "unavailable",
      reason:
        "Spotify streamed-artist album history is not persisted for health analysis yet.",
    },
  };
}
