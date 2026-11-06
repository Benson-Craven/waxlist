import {
  UNSORTED_SHELF_LABEL,
  isOnShelf,
} from "@/lib/collection/location";
import type { CollectionRecord } from "@/lib/collection/record";

export type ShelfGroupRow = {
  id: string;
  unit: string;
  shelf: string;
  label: string;
  records: CollectionRecord[];
};

export type ShelfGroup = {
  id: string;
  group: string;
  label: string;
  isUnsorted: boolean;
  recordCount: number;
  rows: ShelfGroupRow[];
};

function cleanPart(value: string | null) {
  return value?.trim() ?? "";
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortRecords(records: CollectionRecord[]) {
  return [...records].sort((first, second) => {
    const firstSlot = cleanPart(first.slot);
    const secondSlot = cleanPart(second.slot);

    if (firstSlot !== secondSlot) {
      if (!firstSlot) return 1;
      if (!secondSlot) return -1;
      return compareText(firstSlot, secondSlot);
    }

    return (
      compareText(first.artist, second.artist) ||
      compareText(first.title, second.title)
    );
  });
}

function rowLabel(unit: string, shelf: string) {
  return [unit, shelf].filter(Boolean).join(" · ");
}

export function buildShelfGroups(records: CollectionRecord[]): ShelfGroup[] {
  const groups = new Map<string, ShelfGroup>();

  for (const record of records) {
    const isPlaced = isOnShelf(record);
    const group = isPlaced ? cleanPart(record.group) : UNSORTED_SHELF_LABEL;
    const groupKey = group.toLowerCase();
    const unit = isPlaced ? cleanPart(record.unit) : "";
    const shelf = isPlaced ? cleanPart(record.shelf) : "";
    const rowKey = `${unit}\u0000${shelf}`;

    let shelfGroup = groups.get(groupKey);

    if (!shelfGroup) {
      shelfGroup = {
        id: `group:${groupKey}`,
        group,
        label: group,
        isUnsorted: !isPlaced,
        recordCount: 0,
        rows: [],
      };
      groups.set(groupKey, shelfGroup);
    }

    let row = shelfGroup.rows.find(
      (entry) => entry.id === `row:${groupKey}:${rowKey}`,
    );

    if (!row) {
      row = {
        id: `row:${groupKey}:${rowKey}`,
        unit,
        shelf,
        label: rowLabel(unit, shelf) || "No shelf",
        records: [],
      };
      shelfGroup.rows.push(row);
    }

    row.records.push(record);
    shelfGroup.recordCount += 1;
  }

  return [...groups.values()]
    .sort((first, second) => {
      if (first.isUnsorted !== second.isUnsorted) {
        return first.isUnsorted ? 1 : -1;
      }

      return compareText(first.group, second.group);
    })
    .map((shelfGroup) => ({
      ...shelfGroup,
      rows: shelfGroup.rows
        .sort(
          (first, second) =>
            compareText(first.unit, second.unit) ||
            compareText(first.shelf, second.shelf),
        )
        .map((row) => ({ ...row, records: sortRecords(row.records) })),
    }));
}

export type ShelfGroupBucket = Omit<ShelfGroup, "rows"> & {
  records: CollectionRecord[];
};

/**
 * The merged Collection page shelves records as one grid per group. The group
 * builder still owns ordering (group, then unit/shelf, then slot), so the grid
 * inherits the same sequence as the physical shelf without rendering rows.
 */
export function buildShelfGroupBuckets(
  records: CollectionRecord[],
): ShelfGroupBucket[] {
  return buildShelfGroups(records).map(({ rows, ...group }) => ({
    ...group,
    records: rows.flatMap((row) => row.records),
  }));
}

/** Existing group names, used for the add-to-group suggestions. */
export function listShelfGroupNames(records: CollectionRecord[]) {
  const names = new Map<string, string>();

  for (const record of records) {
    if (!isOnShelf(record)) {
      continue;
    }

    const name = cleanPart(record.group);

    if (name && !names.has(name.toLowerCase())) {
      names.set(name.toLowerCase(), name);
    }
  }

  return [...names.values()].sort((first, second) =>
    compareText(first, second),
  );
}

function recordMatchesQuery(record: CollectionRecord, query: string) {
  return [
    record.artist,
    record.title,
    record.label,
    record.catalogNumber,
    record.barcode,
    record.discogsReleaseId,
    record.group,
    record.unit,
    record.shelf,
    record.slot,
    ...record.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function filterShelfRecords(records: CollectionRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return normalizedQuery
    ? records.filter((record) => recordMatchesQuery(record, normalizedQuery))
    : records;
}

export function summarizeShelf(groups: ShelfGroup[]) {
  return {
    recordCount: groups.reduce((total, group) => total + group.recordCount, 0),
    groupCount: groups.filter((group) => !group.isUnsorted).length,
    unsortedCount:
      groups.find((group) => group.isUnsorted)?.recordCount ?? 0,
  };
}

export function ownedShelfRecords(records: CollectionRecord[]) {
  return records.filter((record) => record.status === "owned");
}
