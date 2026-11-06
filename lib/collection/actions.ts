"use client";

import type { CollectionRecord } from "@/lib/collection/record";

export const COLLECTION_CHANGED_EVENT = "waxlist:collection-changed";

export type CollectionChangeReason = "added" | "deleted" | "patched";

export type CollectionChangeDetail = {
  reason: CollectionChangeReason;
  collectionId?: string;
  record?: CollectionRecord;
};

type CollectionMutationPayload = {
  record?: unknown;
  existed?: unknown;
  deleted?: unknown;
  error?: {
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
  };
};

export class CollectionActionError extends Error {
  constructor(
    message: string,
    public readonly code: string | null = null,
    public readonly status = 0,
  ) {
    super(message);
    this.name = "CollectionActionError";
  }
}

function isCollectionRecord(value: unknown): value is CollectionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<CollectionRecord>;

  return (
    typeof record.id === "string" &&
    typeof record.artist === "string" &&
    typeof record.title === "string" &&
    typeof record.discogsReleaseId === "number" &&
    (record.status === "owned" || record.status === "wanted")
  );
}

async function readPayload(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | CollectionMutationPayload
    | null;

  if (!response.ok) {
    throw new CollectionActionError(
      payload?.error?.message ?? "The record could not be saved.",
      payload?.error?.code ?? null,
      response.status,
    );
  }

  return payload;
}

export function announceCollectionChange(detail: CollectionChangeDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<CollectionChangeDetail>(COLLECTION_CHANGED_EVENT, {
      detail,
    }),
  );
}

export async function requestPatchCollectionRecord(
  recordId: string,
  patch: Partial<
    Pick<CollectionRecord, "favourite" | "status" | "rating" | "tags" | "notes">
  >,
) {
  const response = await fetch(`/api/collection/${recordId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  const payload = await readPayload(response);
  const record = isCollectionRecord(payload?.record) ? payload.record : null;

  if (!record) {
    throw new CollectionActionError("The saved record could not be read.");
  }

  announceCollectionChange({
    reason: "patched",
    collectionId: record.id,
    record,
  });

  return record;
}

export type CollectionGroupAssignment = {
  id: string;
  group: string | null;
  unit: string | null;
  shelf: string | null;
  slot: string | null;
};

function isGroupAssignment(value: unknown): value is CollectionGroupAssignment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<CollectionGroupAssignment>;

  return (
    typeof record.id === "string" &&
    (record.group === null || typeof record.group === "string") &&
    (record.unit === null || typeof record.unit === "string") &&
    (record.shelf === null || typeof record.shelf === "string") &&
    (record.slot === null || typeof record.slot === "string")
  );
}

/**
 * Groups records into a shelf group without touching their unit/shelf/slot
 * detail. The API's replace mode is reserved for the physical shelf editor.
 */
export async function requestAssignCollectionGroup(
  ids: string[],
  group: string,
) {
  return requestLocationChange(
    ids,
    { location: { group }, mode: "group" },
    "The records could not be grouped.",
  );
}

/**
 * The inverse of `requestAssignCollectionGroup`: the record leaves its group,
 * and the shelf spot it held inside that group is cleared with it. Used by the
 * minus control on a cover inside a shelving group.
 */
export async function requestRemoveCollectionGroup(ids: string[]) {
  return requestLocationChange(
    ids,
    { mode: "ungroup" },
    "The record could not be removed from its group.",
  );
}

async function requestLocationChange(
  ids: string[],
  body:
    | { location: { group: string }; mode: "group" }
    | { mode: "ungroup" },
  fallbackMessage: string,
) {
  const response = await fetch("/api/collection/locations", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids, ...body }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { updated?: unknown; records?: unknown; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new CollectionActionError(
      payload?.error?.message ?? fallbackMessage,
    );
  }

  const records = Array.isArray(payload?.records)
    ? payload.records.filter(isGroupAssignment)
    : [];

  if (records.length === 0) {
    throw new CollectionActionError("No owned records matched that selection.");
  }

  return records;
}

export async function requestDeleteCollectionRecord(recordId: string) {
  const response = await fetch(`/api/collection/${recordId}`, {
    method: "DELETE",
  });
  const payload = await readPayload(response);

  if (payload?.deleted !== true) {
    throw new CollectionActionError("The record could not be deleted.");
  }

  announceCollectionChange({ reason: "deleted", collectionId: recordId });
}

export async function requestAddCollectionRecord(input: {
  discogsReleaseId: number;
  status: "owned" | "wanted";
  favourite?: boolean;
}) {
  const response = await fetch("/api/collection", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await readPayload(response);
  const record = isCollectionRecord(payload?.record) ? payload.record : null;

  if (!record) {
    throw new CollectionActionError("The added record could not be read.");
  }

  announceCollectionChange({
    reason: "added",
    collectionId: record.id,
    record,
  });

  return { record, existed: payload?.existed === true };
}

export type CatalogueSearchCandidate = {
  id: number;
  masterId: number | null;
  title: string;
  year: number | null;
  formats: string[];
  country: string | null;
  label: string | null;
  catalogNumber: string | null;
};

function isCatalogueCandidate(
  value: unknown,
): value is CatalogueSearchCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CatalogueSearchCandidate>;

  return (
    typeof candidate.id === "number" &&
    typeof candidate.title === "string" &&
    (candidate.year === null || typeof candidate.year === "number") &&
    Array.isArray(candidate.formats)
  );
}

export async function requestCatalogueSearch(query: string) {
  const response = await fetch("/api/discogs/catalogue/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { candidates?: unknown; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new CollectionActionError(
      payload?.error?.message ?? "Discogs search could not run.",
      null,
      response.status,
    );
  }

  return Array.isArray(payload?.candidates)
    ? payload.candidates.filter(isCatalogueCandidate)
    : [];
}
