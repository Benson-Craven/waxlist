import type { CollectionRecord } from "@/lib/collection/record";

export type CollectionLocationField = "room" | "unit" | "shelf" | "slot";

export type CollectionLocation = Pick<
  CollectionRecord,
  CollectionLocationField
>;

export const COLLECTION_LOCATION_FIELDS: Array<{
  key: CollectionLocationField;
  label: string;
  placeholder: string;
}> = [
  { key: "room", label: "Room", placeholder: "Music room" },
  { key: "unit", label: "Unit", placeholder: "Kallax" },
  { key: "shelf", label: "Shelf", placeholder: "A" },
  { key: "slot", label: "Slot", placeholder: "03" },
];

function cleanLocationPart(value: string | null) {
  return value?.trim() ?? "";
}

export function formatCollectionLocation(location: CollectionLocation) {
  return COLLECTION_LOCATION_FIELDS.map(({ key }) => cleanLocationPart(location[key]))
    .filter(Boolean)
    .join(" / ");
}

export function hasCollectionLocation(location: CollectionLocation) {
  return formatCollectionLocation(location).length > 0;
}

export function isMissingCollectionLocation(location: CollectionLocation) {
  return !hasCollectionLocation(location);
}

export function getCollectionLocationGroup(record: CollectionRecord) {
  const room = cleanLocationPart(record.room) || "Unassigned room";
  const unit = cleanLocationPart(record.unit) || "Unassigned unit";
  const shelf = cleanLocationPart(record.shelf) || "Unassigned shelf";

  return `${room} / ${unit} / ${shelf}`;
}
