import {
  COLLECTION_LOCATION_FIELDS,
  type CollectionLocationField,
} from "@/lib/collection/location";

export const MAX_BULK_LOCATION_RECORDS = 250;
export const MAX_LOCATION_FIELD_LENGTH = 80;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CollectionLocationUpdatePayload = Record<
  CollectionLocationField,
  string | null
>;

/**
 * `replace` overwrites all four fields (the physical shelf editor).
 * `group` only moves records between shelf groups and leaves their shelf detail
 * alone (the merged Collection page's add-to-group control).
 * `ungroup` is the inverse of `group`: the record leaves its group and every
 * shelf detail with it, because a unit/shelf/slot only means something inside
 * a group.
 */
export type BulkLocationMode = "replace" | "group" | "ungroup";

export const CLEARED_COLLECTION_LOCATION: CollectionLocationUpdatePayload = {
  group: null,
  unit: null,
  shelf: null,
  slot: null,
};

export type BulkLocationRequest = {
  ids: string[];
  location: CollectionLocationUpdatePayload;
  mode: BulkLocationMode;
};

export type BulkLocationParseResult =
  | { ok: true; value: BulkLocationRequest }
  | { ok: false; reason: string };

/**
 * The physical shelf editor replaces all four location fields at once. A
 * missing or empty field clears that part of the location, which is what the
 * form shows when the user submits only a shelf value. Group mode is narrower:
 * it only moves records into a group and preserves their shelf detail.
 * Ungroup mode takes no location at all: it sends the records back to
 * `Unsorted` and clears the spot they held inside their group.
 */
export function normalizeBulkLocationRequest(
  payload: unknown,
): BulkLocationParseResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Location update payload is invalid." };
  }

  const { ids, location, mode: requestedMode } = payload as {
    ids?: unknown;
    location?: unknown;
    mode?: unknown;
  };

  if (
    requestedMode !== undefined &&
    requestedMode !== "replace" &&
    requestedMode !== "group" &&
    requestedMode !== "ungroup"
  ) {
    return { ok: false, reason: "Choose how the location should be saved." };
  }

  const mode: BulkLocationMode =
    requestedMode === "group"
      ? "group"
      : requestedMode === "ungroup"
        ? "ungroup"
        : "replace";

  if (!Array.isArray(ids)) {
    return { ok: false, reason: "Select the records to update." };
  }

  const uniqueIds = Array.from(
    new Set(
      ids
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => UUID_PATTERN.test(id)),
    ),
  );

  if (uniqueIds.length === 0) {
    return { ok: false, reason: "Select at least one collection record." };
  }

  if (uniqueIds.length > MAX_BULK_LOCATION_RECORDS) {
    return {
      ok: false,
      reason: `Update ${MAX_BULK_LOCATION_RECORDS} records at a time.`,
    };
  }

  if (mode === "ungroup") {
    return {
      ok: true,
      value: {
        ids: uniqueIds,
        location: { ...CLEARED_COLLECTION_LOCATION },
        mode,
      },
    };
  }

  if (!location || typeof location !== "object") {
    return { ok: false, reason: "Choose the shelf location to apply." };
  }

  const source = location as Record<string, unknown>;

  if (mode === "group") {
    const value = source.group;

    if (typeof value !== "string") {
      return { ok: false, reason: "Name the group to add records to." };
    }

    const group = value.trim();

    if (group.length === 0) {
      return { ok: false, reason: "Name the group to add records to." };
    }

    if (group.length > MAX_LOCATION_FIELD_LENGTH) {
      return {
        ok: false,
        reason: `Keep the group name under ${MAX_LOCATION_FIELD_LENGTH} characters.`,
      };
    }

    return {
      ok: true,
      value: {
        ids: uniqueIds,
        location: {
          group,
          unit: null,
          shelf: null,
          slot: null,
        },
        mode,
      },
    };
  }

  const next = {} as CollectionLocationUpdatePayload;
  let hasValue = false;

  for (const { key } of COLLECTION_LOCATION_FIELDS) {
    const value = source[key];

    if (value === undefined || value === null) {
      next[key] = null;
      continue;
    }

    if (typeof value !== "string") {
      return { ok: false, reason: "Shelf fields must be text." };
    }

    const trimmed = value.trim();

    if (trimmed.length > MAX_LOCATION_FIELD_LENGTH) {
      return {
        ok: false,
        reason: `Keep each shelf field under ${MAX_LOCATION_FIELD_LENGTH} characters.`,
      };
    }

    next[key] = trimmed.length > 0 ? trimmed : null;

    if (trimmed.length > 0) {
      hasValue = true;
    }
  }

  if (!hasValue) {
    return {
      ok: false,
      reason: "Enter at least one shelf field before applying.",
    };
  }

  return {
    ok: true,
    value: {
      ids: uniqueIds,
      location: next,
      mode,
    },
  };
}
