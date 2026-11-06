import type { CollectionRecord } from "@/lib/collection/record";

/**
 * The Wantlist is the shortlist. Wanted and favourited records are two lenses
 * over one surface, so a starred record keeps its owned/wanted status but no
 * longer needs a second home in Collection.
 */
export type ShortlistTab = "wanted" | "favourites";

export const SHORTLIST_TABS: Array<{ id: ShortlistTab; label: string }> = [
  { id: "wanted", label: "Wanted" },
  { id: "favourites", label: "Favourites" },
];

export const DEFAULT_SHORTLIST_TAB: ShortlistTab = "wanted";

export function isShortlistTab(value: unknown): value is ShortlistTab {
  return SHORTLIST_TABS.some((tab) => tab.id === value);
}

export function shortlistTabMatches(
  record: CollectionRecord,
  tab: ShortlistTab,
) {
  return tab === "favourites" ? record.favourite : record.status === "wanted";
}

export function shortlistTabCount(
  records: CollectionRecord[],
  tab: ShortlistTab,
) {
  return records.filter((record) => shortlistTabMatches(record, tab)).length;
}
