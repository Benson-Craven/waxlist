import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type { collectionItems } from "@/lib/db/schema";

export type CollectionItemStatus = "owned" | "wanted";

export type CollectionItemRow = InferSelectModel<typeof collectionItems>;
export type NewCollectionItemRow = InferInsertModel<typeof collectionItems>;

export type CollectionItemInput = {
  userId: string;
  discogsReleaseId: number;
  discogsMasterId: number | null;
  discogsInstanceId: number | null;
  discogsFolderId: number | null;
  artist: string;
  title: string;
  format: string[];
  year: number | null;
  label: string | null;
  catalogNumber: string | null;
  barcode: string | null;
  imageUrl: string | null;
  status: CollectionItemStatus;
  tags: string[];
  notes: string | null;
  room: string | null;
  unit: string | null;
  shelf: string | null;
  slot: string | null;
  priceHintCents: number | null;
  priceHintCurrency: string | null;
  priceHintLabel: string | null;
  syncedAt: Date;
};

export type CollectionItem = CollectionItemInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CollectionRecord = Omit<
  CollectionItem,
  "syncedAt" | "createdAt" | "updatedAt"
> & {
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CollectionItemPatch = Partial<
  Pick<
    CollectionItemInput,
    | "status"
    | "tags"
    | "notes"
    | "room"
    | "unit"
    | "shelf"
    | "slot"
    | "priceHintCents"
    | "priceHintCurrency"
    | "priceHintLabel"
  >
>;

type NormalizeOptions = {
  now?: Date;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  const nextValue = stringValue(value);

  return nextValue.length > 0 ? nextValue : null;
}

function nullableInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

function positiveInteger(value: unknown) {
  const parsed = nullableInteger(value);

  return parsed && parsed > 0 ? parsed : null;
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

function normalizedStatus(value: unknown): CollectionItemStatus {
  return value === "wanted" ? "wanted" : "owned";
}

function optionalStatus(value: unknown): CollectionItemStatus | undefined {
  if (value === "owned" || value === "wanted") {
    return value;
  }

  return undefined;
}

function nullableDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);

    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  return null;
}

export function normalizeCollectionItemInput(
  value: unknown,
  options: NormalizeOptions = {},
): CollectionItemInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<CollectionItemInput>;
  const userId = nullableString(record.userId);
  const discogsReleaseId = positiveInteger(record.discogsReleaseId);
  const artist = nullableString(record.artist);
  const title = nullableString(record.title);

  if (!userId || !discogsReleaseId || !artist || !title) {
    return null;
  }

  return {
    userId,
    discogsReleaseId,
    discogsMasterId: positiveInteger(record.discogsMasterId),
    discogsInstanceId: positiveInteger(record.discogsInstanceId),
    discogsFolderId: positiveInteger(record.discogsFolderId),
    artist,
    title,
    format: normalizedStringList(record.format),
    year: positiveInteger(record.year),
    label: nullableString(record.label),
    catalogNumber: nullableString(record.catalogNumber),
    barcode: nullableString(record.barcode),
    imageUrl: nullableString(record.imageUrl),
    status: normalizedStatus(record.status),
    tags: normalizedStringList(record.tags),
    notes: nullableString(record.notes),
    room: nullableString(record.room),
    unit: nullableString(record.unit),
    shelf: nullableString(record.shelf),
    slot: nullableString(record.slot),
    priceHintCents: positiveInteger(record.priceHintCents),
    priceHintCurrency: nullableString(record.priceHintCurrency),
    priceHintLabel: nullableString(record.priceHintLabel),
    syncedAt: nullableDate(record.syncedAt) ?? options.now ?? new Date(),
  };
}

export function normalizeCollectionItem(
  value: unknown,
  options: NormalizeOptions = {},
): CollectionItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<CollectionItem>;
  const input = normalizeCollectionItemInput(record, options);
  const id = nullableString(record.id);
  const createdAt = nullableDate(record.createdAt);
  const updatedAt = nullableDate(record.updatedAt);

  if (!input || !id || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    ...input,
    createdAt,
    updatedAt,
  };
}

export function serializeCollectionItem(item: CollectionItem): CollectionRecord {
  return {
    ...item,
    syncedAt: item.syncedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function normalizeCollectionItemPatch(
  value: unknown,
): CollectionItemPatch | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<CollectionItemPatch>;
  const patch: CollectionItemPatch = {};
  const status = optionalStatus(record.status);

  if (status) {
    patch.status = status;
  }

  if ("tags" in record) {
    patch.tags = normalizedStringList(record.tags);
  }

  for (const key of [
    "notes",
    "room",
    "unit",
    "shelf",
    "slot",
    "priceHintCurrency",
    "priceHintLabel",
  ] as const) {
    if (key in record) {
      patch[key] = nullableString(record[key]);
    }
  }

  if ("priceHintCents" in record) {
    patch.priceHintCents = positiveInteger(record.priceHintCents);
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
