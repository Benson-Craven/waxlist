import type { CollectionRecord } from "@/lib/collection/record";

export type CollectionLocationField = "group" | "unit" | "shelf" | "slot";

export type CollectionLocation = Pick<
  CollectionRecord,
  CollectionLocationField
>;

export const UNSORTED_SHELF_LABEL = "Unsorted";

export const COLLECTION_LOCATION_FIELDS: Array<{
  key: CollectionLocationField;
  label: string;
  placeholder: string;
}> = [
  { key: "group", label: "Group", placeholder: "Studio" },
  { key: "unit", label: "Unit", placeholder: "Kallax" },
  { key: "shelf", label: "Shelf", placeholder: "A" },
  { key: "slot", label: "Slot", placeholder: "03" },
];

function cleanLocationPart(value: string | null) {
  return value?.trim() ?? "";
}

/**
 * A record is shelved once it names a group. The unit, shelf, and slot are the
 * precise spot inside that group, but a group alone is enough to file a record
 * where the collector expects to find it.
 */
export function isOnShelf(location: CollectionLocation) {
  return Boolean(cleanLocationPart(location.group));
}

export function isMissingCollectionLocation(location: CollectionLocation) {
  return !isOnShelf(location);
}

/** The readable shelf code without the group, e.g. `Kallax · A · 03`. */
export function formatShelfCode(location: CollectionLocation) {
  return [location.unit, location.shelf, location.slot]
    .map(cleanLocationPart)
    .filter(Boolean)
    .join(" · ");
}

/** One location string for search, pills, and timeline rows. */
export function formatCollectionLocation(location: CollectionLocation) {
  return [location.group, location.unit, location.shelf, location.slot]
    .map(cleanLocationPart)
    .filter(Boolean)
    .join(" · ");
}

export function describeShelfLocation(location: CollectionLocation) {
  const isPlaced = isOnShelf(location);

  return {
    isPlaced,
    group: isPlaced ? cleanLocationPart(location.group) : "",
    code: isPlaced ? formatShelfCode(location) : "",
    label: isPlaced
      ? formatCollectionLocation(location)
      : UNSORTED_SHELF_LABEL,
  };
}
