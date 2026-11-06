import { isMissingCollectionLocation } from "@/lib/collection/location";
import type { CollectionRecord } from "@/lib/collection/record";

export type CollectionTab = "all" | "owned" | "wanted" | "missingLocation";

export type CollectionSort =
  | "newest"
  | "recent"
  | "artist"
  | "title"
  | "rating";

export type CollectionRatingFilter = "any" | "rated" | "unrated";

export type CollectionFilters = {
  rating: CollectionRatingFilter;
  format: string | null;
};

export type CollectionBrowseState = {
  tab: CollectionTab;
  query: string;
  filters: CollectionFilters;
  sort: CollectionSort;
};

export const COLLECTION_TABS: Array<{ id: CollectionTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "owned", label: "Owned" },
  { id: "wanted", label: "Wanted" },
  { id: "missingLocation", label: "Unsorted" },
];

export function isCollectionTab(value: unknown): value is CollectionTab {
  return COLLECTION_TABS.some((tab) => tab.id === value);
}

export const COLLECTION_SORTS: Array<{ id: CollectionSort; label: string }> = [
  { id: "newest", label: "Newest added" },
  { id: "recent", label: "Recently updated" },
  { id: "artist", label: "Artist A–Z" },
  { id: "title", label: "Title A–Z" },
  { id: "rating", label: "Highest rated" },
];

export const COLLECTION_RATING_FILTERS: Array<{
  id: CollectionRatingFilter;
  label: string;
}> = [
  { id: "any", label: "Any" },
  { id: "rated", label: "Rated" },
  { id: "unrated", label: "Unrated" },
];

export const DEFAULT_COLLECTION_FILTERS: CollectionFilters = {
  rating: "any",
  format: null,
};

export const DEFAULT_COLLECTION_SORT: CollectionSort = "newest";

// "Vinyl" is the medium rather than a distinguishing format, so it would only
// ever match every record.
const GENERIC_FORMAT_TOKENS = new Set(["vinyl"]);

export function collectionTabMatches(
  record: CollectionRecord,
  tab: CollectionTab,
) {
  if (tab === "all") {
    return true;
  }

  if (tab === "missingLocation") {
    // Wanted records are not shelved yet, so "no group" is not a filing gap
    // for them. This keeps the Unsorted tab aligned with the Shelving grid,
    // Health, and the dashboard summary, which all count owned records only.
    return record.status === "owned" && isMissingCollectionLocation(record);
  }

  return record.status === tab;
}

export function collectionSearchText(record: CollectionRecord) {
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
    .toLowerCase();
}

export function collectionTabCount(
  records: CollectionRecord[],
  tab: CollectionTab,
) {
  return records.filter((record) => collectionTabMatches(record, tab)).length;
}

/**
 * Format chips come from the collection itself, ordered by how many records
 * carry the token so the most common pressing types surface first.
 */
export function collectionFormatOptions(records: CollectionRecord[]) {
  const options = new Map<string, { id: string; label: string; count: number }>();

  for (const record of records) {
    for (const token of record.format) {
      const label = token.trim();

      if (!label || GENERIC_FORMAT_TOKENS.has(label.toLowerCase())) {
        continue;
      }

      const key = label.toLowerCase();
      const existing = options.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        options.set(key, { id: key, label, count: 1 });
      }
    }
  }

  return [...options.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    )
    .slice(0, 8);
}

function timeValue(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortCollectionRecords(
  records: CollectionRecord[],
  sort: CollectionSort,
) {
  const sorted = [...records];

  switch (sort) {
    case "newest":
      return sorted.sort(
        (left, right) => timeValue(right.createdAt) - timeValue(left.createdAt),
      );
    case "recent":
      return sorted.sort(
        (left, right) => timeValue(right.updatedAt) - timeValue(left.updatedAt),
      );
    case "artist":
      return sorted.sort(
        (left, right) =>
          left.artist.localeCompare(right.artist) ||
          left.title.localeCompare(right.title),
      );
    case "title":
      return sorted.sort((left, right) => left.title.localeCompare(right.title));
    case "rating":
      return sorted.sort(
        (left, right) =>
          (right.rating ?? 0) - (left.rating ?? 0) ||
          timeValue(right.updatedAt) - timeValue(left.updatedAt),
      );
    default:
      return sorted;
  }
}

export function filterCollectionRecords(
  records: CollectionRecord[],
  state: CollectionBrowseState,
) {
  const query = state.query.trim().toLowerCase();
  const format = state.filters.format?.toLowerCase() ?? null;

  const matches = records.filter((record) => {
    if (!collectionTabMatches(record, state.tab)) {
      return false;
    }

    if (state.filters.rating === "rated" && record.rating === null) {
      return false;
    }

    if (state.filters.rating === "unrated" && record.rating !== null) {
      return false;
    }

    if (
      format &&
      !record.format.some((token) => token.trim().toLowerCase() === format)
    ) {
      return false;
    }

    if (query && !collectionSearchText(record).includes(query)) {
      return false;
    }

    return true;
  });

  return sortCollectionRecords(matches, state.sort);
}

export function countActiveCollectionFilters(state: {
  tab: CollectionTab;
  query: string;
  filters: CollectionFilters;
}) {
  let count = 0;

  if (state.tab !== "all") {
    count += 1;
  }

  if (state.query.trim().length > 0) {
    count += 1;
  }

  if (state.filters.rating !== "any") {
    count += 1;
  }

  if (state.filters.format) {
    count += 1;
  }

  return count;
}
