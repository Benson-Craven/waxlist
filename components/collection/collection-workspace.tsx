"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Download,
  Loader2,
  Plus,
  Star,
} from "lucide-react";

import { AddVinylDialog } from "@/components/app-shell/add-vinyl-dialog";
import { CollectionToolbar } from "@/components/collection/collection-toolbar";
import { GroupDialog } from "@/components/collection/group-dialog";
import { ShelvingGrid } from "@/components/collection/shelving-grid";
import { VinylGridSection } from "@/components/collection/vinyl-grid-section";
import { WantlistShelf } from "@/components/collection/wantlist-shelf";
import { VinylOrbitCarousel } from "@/components/profile/vinyl-orbit-carousel";
import { Button } from "@/components/ui/button";
import {
  CollectionActionError,
  requestDeleteCollectionRecord,
  requestRemoveCollectionGroup,
  type CollectionGroupAssignment,
} from "@/lib/collection/actions";
import {
  collectionFormatOptions,
  collectionTabCount,
  countActiveCollectionFilters,
  DEFAULT_COLLECTION_FILTERS,
  DEFAULT_COLLECTION_SORT,
  filterCollectionRecords,
  type CollectionFilters,
  type CollectionSort,
  type CollectionTab,
} from "@/lib/collection/browse";
import {
  selectFeaturedCollectionRecords,
  type FeaturedCollectionReason,
} from "@/lib/collection/featured";
import {
  sanitizeRestrictedCollectionDataForOwner,
  type CollectionRecord,
} from "@/lib/collection/record";
import {
  buildShelfGroupBuckets,
  listShelfGroupNames,
  ownedShelfRecords,
} from "@/lib/collection/shelf";
import {
  SELECTED_RECORD_CHANGED_EVENT,
  selectedRecordFromCollection,
  type SelectedRecord,
} from "@/lib/workspace/selected-record";

type CollectionPayload = {
  records?: unknown;
  insertedCount?: unknown;
  error?: {
    message?: string;
  };
};

type DiscogsImportProgress = {
  id: string;
  status: "running" | "rate_limited" | "completed" | "failed";
  discogsUsername: string | null;
  nextPage: number;
  perPage: number;
  totalPages: number | null;
  totalItems: number | null;
  importedCount: number;
  failedCount: number;
  failures: Array<{
    page: number;
    releaseId: number | null;
    instanceId: number | null;
    message: string;
  }>;
  rateLimit: {
    limit: number | null;
    used: number | null;
    remaining: number | null;
  } | null;
  retryAfterSeconds: number | null;
};

type DiscogsImportPayload = CollectionPayload & {
  progress?: DiscogsImportProgress | null;
};

type GroupDialogState = {
  open: boolean;
  group: string;
  selectedIds: string[];
};

const CLOSED_GROUP_DIALOG: GroupDialogState = {
  open: false,
  group: "",
  selectedIds: [],
};

const COLLECTION_CACHE_KEY = "waxlist:digging:collection:v2";

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

function normalizeCollectionRecords(
  value: unknown,
  showRestrictedData = false,
) {
  const records = Array.isArray(value) ? value.filter(isCollectionRecord) : [];

  // The carousel and shelving are the owner's own shelf, so stored artwork
  // survives here while conditions, prices, and Discogs instance identifiers
  // stay stripped.
  return showRestrictedData
    ? records
    : records.map(sanitizeRestrictedCollectionDataForOwner);
}

async function readCollectionResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as CollectionPayload | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? "Collection records could not be loaded.",
    );
  }

  return payload;
}

async function readDiscogsImportResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | DiscogsImportPayload
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? "Discogs collection import could not run.",
    );
  }

  return payload;
}

function isDiscogsImportProgress(value: unknown): value is DiscogsImportProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const progress = value as Partial<DiscogsImportProgress>;

  return (
    typeof progress.id === "string" &&
    (progress.status === "running" ||
      progress.status === "rate_limited" ||
      progress.status === "completed" ||
      progress.status === "failed") &&
    typeof progress.nextPage === "number" &&
    typeof progress.importedCount === "number" &&
    typeof progress.failedCount === "number"
  );
}

function writeCollectionCache(records: CollectionRecord[]) {
  try {
    window.localStorage.setItem(COLLECTION_CACHE_KEY, JSON.stringify(records));
  } catch {
    // The live collection remains usable if local storage is unavailable.
  }
}

function readCollectionCache(showRestrictedData = false) {
  try {
    return normalizeCollectionRecords(
      JSON.parse(window.localStorage.getItem(COLLECTION_CACHE_KEY) ?? "[]"),
      showRestrictedData,
    );
  } catch {
    return [];
  }
}

function applySelectedRecordToCollectionRecord(
  record: CollectionRecord,
  selected: SelectedRecord,
): CollectionRecord {
  if (selected.collectionId !== record.id) {
    return record;
  }

  return {
    ...record,
    status: selected.status === "wanted" ? "wanted" : "owned",
    favourite: selected.favourite,
    tags: selected.tags,
    notes: selected.notes,
    group: selected.group,
    unit: selected.unit,
    shelf: selected.shelf,
    slot: selected.slot,
  };
}

function formatImportProgress(progress: DiscogsImportProgress | null) {
  if (!progress) {
    return "No import yet.";
  }

  if (progress.status === "completed") {
    return `Imported ${progress.importedCount.toLocaleString()} records.`;
  }

  if (progress.status === "rate_limited") {
    return progress.retryAfterSeconds
      ? `Discogs paused us. Try again in ${progress.retryAfterSeconds.toLocaleString()} seconds.`
      : "Discogs paused us. Try again shortly.";
  }

  if (progress.status === "failed") {
    return "Stopped after an error. Check the failures and retry.";
  }

  const total = progress.totalItems
    ? ` of ${progress.totalItems.toLocaleString()}`
    : "";

  return `Imported ${progress.importedCount.toLocaleString()}${total} records.`;
}

function getImportButtonLabel(progress: DiscogsImportProgress | null) {
  if (!progress) {
    return "Import Discogs";
  }

  if (progress.status === "completed") {
    return "Refresh Discogs";
  }

  if (progress.status === "rate_limited" || progress.status === "failed") {
    return "Resume import";
  }

  return "Continue import";
}

function DiscogsImportPanel({
  progress,
  isImporting,
  onRunImport,
}: {
  progress: DiscogsImportProgress | null;
  isImporting: boolean;
  onRunImport: () => void;
}) {
  const pagesDone =
    progress?.totalPages && progress.nextPage > 1
      ? Math.min(progress.totalPages, progress.nextPage - 1)
      : 0;
  const progressWidth =
    progress?.totalPages && progress.totalPages > 0
      ? `${Math.round((pagesDone / progress.totalPages) * 100)}%`
      : progress
        ? "12%"
        : "0%";
  const latestFailures = progress?.failures.slice(-3).reverse() ?? [];

  return (
    <div className="mt-12 rounded-2xl bg-[#FFF4E8]/4 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#FFF4E8]/38">
            Discogs import
          </p>
          <p className="mt-2 text-sm font-medium text-[#FFF4E8]">
            {formatImportProgress(progress)}
          </p>
          <p className="mt-1 text-xs text-[#FFF4E8]/44">
            {progress?.discogsUsername
              ? `Source: ${progress.discogsUsername}`
              : "Official Discogs API. Data stays on your device."}
            {progress?.rateLimit?.remaining !== null &&
            progress?.rateLimit?.remaining !== undefined
              ? ` · ${progress.rateLimit.remaining} API calls remaining`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          onClick={onRunImport}
          disabled={isImporting}
          className="rounded-full bg-[#FFF4E8] px-5 text-[#08030f] hover:bg-[#f6dfc9] disabled:opacity-50"
        >
          {isImporting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {getImportButtonLabel(progress)}
        </Button>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#FFF4E8]/8">
        <div
          className="h-full rounded-full bg-[#1DB954] transition-all"
          style={{ width: progressWidth }}
        />
      </div>

      {progress?.failedCount ? (
        <div className="mt-3 rounded-lg bg-[#F08A4B]/8 p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-[#FFD4B5]">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {progress.failedCount.toLocaleString()} import failure
            {progress.failedCount === 1 ? "" : "s"}
          </p>
          {latestFailures.length > 0 ? (
            <div className="mt-2 grid gap-1 text-xs leading-5 text-[#FFF4E8]/58">
              {latestFailures.map((failure, index) => (
                <p key={`${failure.page}-${failure.releaseId}-${index}`}>
                  Page {failure.page}
                  {failure.releaseId ? ` · Release ${failure.releaseId}` : ""}:{" "}
                  {failure.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type CollectionTabCounts = Record<CollectionTab, number>;

function EmptyCollection({
  onSeedFromWishlist,
  isSeeding,
  hasRecords,
  onResetFilters,
  importProgress,
  isUsingCache,
  allowWishlistSeed,
}: {
  onSeedFromWishlist: () => void;
  isSeeding: boolean;
  hasRecords: boolean;
  onResetFilters: () => void;
  importProgress: DiscogsImportProgress | null;
  isUsingCache: boolean;
  allowWishlistSeed: boolean;
}) {
  const emptyTitle = hasRecords
    ? "No records found"
    : isUsingCache
      ? "Nothing saved in this browser"
      : importProgress?.status === "failed"
        ? "Import failed before anything loaded"
        : importProgress
          ? "The last import added nothing"
          : "Your collection is empty";
  const emptyBody = hasRecords
    ? "Try another search or reset the filters."
    : isUsingCache
      ? "The live collection did not load, so this browser copy is showing."
      : importProgress?.status === "failed"
        ? "Resume the import to keep loading records."
        : importProgress
          ? "The last import added nothing. Check the status above."
          : allowWishlistSeed
            ? "Import your Discogs collection, or add records you already saved."
            : "Use Add vinyl to search Discogs, or import your collection.";

  return (
    <div className="grid min-h-[30rem] place-items-center px-6 text-center">
      <div>
        <Archive className="mx-auto size-8 text-[#FFF4E8]/26" aria-hidden="true" />
        <p className="mt-5 text-sm font-medium text-[#FFF4E8]/68">
          {emptyTitle}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/42">
          {emptyBody}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {hasRecords ? (
            <Button
              type="button"
              onClick={onResetFilters}
              className="rounded-full bg-[#1b1b1f] px-5 text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
            >
              Reset filters
            </Button>
          ) : allowWishlistSeed ? (
            <Button
              type="button"
              onClick={onSeedFromWishlist}
              disabled={isSeeding}
              className="rounded-full bg-[#1b1b1f] px-5 text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
            >
              {isSeeding ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Add wishlist records
            </Button>
          ) : (
            <AddVinylDialog />
          )}
        </div>
      </div>
    </div>
  );
}

export function CollectionWorkspaceFrame({
  initialQuery = "",
  initialTab = "all",
  query: controlledQuery,
  onQueryChange,
  selectedRecord,
  onSelectRecord,
  onRateRecord,
  allowDiscogsImport = false,
  showRestrictedData = false,
}: {
  initialQuery?: string;
  initialTab?: CollectionTab;
  query?: string;
  onQueryChange?: (query: string) => void;
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: SelectedRecord | null) => void;
  onRateRecord?: (
    record: CollectionRecord,
    rating: number | null,
  ) => Promise<void>;
  allowDiscogsImport?: boolean;
  showRestrictedData?: boolean;
}) {
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [internalQuery, setInternalQuery] = useState(initialQuery);
  const query = controlledQuery ?? internalQuery;
  const setQuery = onQueryChange ?? setInternalQuery;
  const [activeTab, setActiveTab] = useState<CollectionTab>(initialTab);
  const [sort, setSort] = useState<CollectionSort>(DEFAULT_COLLECTION_SORT);
  const [filters, setFilters] = useState<CollectionFilters>(
    DEFAULT_COLLECTION_FILTERS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<DiscogsImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState>(
    CLOSED_GROUP_DIALOG,
  );
  // The one cover action that talks to the API on its own, so the cover that
  // is being removed can show a spinner while the group list updates.
  const [removingGroupRecordId, setRemovingGroupRecordId] = useState<
    string | null
  >(null);
  // Same idea for the wantlist heart-off, which deletes the want outright.
  const [removingWantRecordId, setRemovingWantRecordId] = useState<
    string | null
  >(null);
  const tabCounts = useMemo<CollectionTabCounts>(
    () => ({
      all: records.length,
      owned: collectionTabCount(records, "owned"),
      wanted: collectionTabCount(records, "wanted"),
      missingLocation: collectionTabCount(records, "missingLocation"),
    }),
    [records],
  );
  const formatOptions = useMemo(() => collectionFormatOptions(records), [records]);
  const filteredRecords = useMemo(
    () =>
      filterCollectionRecords(records, {
        tab: activeTab,
        query,
        filters,
        sort,
      }),
    [activeTab, filters, query, records, sort],
  );
  const activeFilterCount = countActiveCollectionFilters({
    tab: activeTab,
    query,
    filters,
  });
  const ownedRecords = useMemo(() => ownedShelfRecords(records), [records]);
  const groupNames = useMemo(() => listShelfGroupNames(records), [records]);
  // Shelving and the wantlist stay complete. The browse controls above the
  // grid narrow the grid only, so a filter never makes a record look missing
  // from its physical group.
  const wantedRecords = useMemo(
    () => records.filter((record) => record.status === "wanted"),
    [records],
  );
  // A group can hold any vinyl. Wanted records keep their heart badge and
  // stay on the wantlist, but grouping them gives them a visible crate.
  const groupedRecords = useMemo(
    () =>
      records.filter(
        (record) => record.status === "owned" || Boolean(record.group?.trim()),
      ),
    [records],
  );
  const shelfGroups = useMemo(
    () => buildShelfGroupBuckets(groupedRecords),
    [groupedRecords],
  );
  const unsortedCount = useMemo(
    () => shelfGroups.find((group) => group.isUnsorted)?.recordCount ?? 0,
    [shelfGroups],
  );
  const groupCount = useMemo(
    () => shelfGroups.filter((group) => !group.isUnsorted).length,
    [shelfGroups],
  );
  const featuredEntries = useMemo(
    () => selectFeaturedCollectionRecords(records),
    [records],
  );
  const featuredRecords = useMemo(
    () => featuredEntries.map((entry) => entry.record),
    [featuredEntries],
  );
  const featuredReasons = useMemo(
    () =>
      Object.fromEntries(
        featuredEntries.map((entry) => [entry.record.id, entry.reasons]),
      ) as Record<string, FeaturedCollectionReason[]>,
    [featuredEntries],
  );
  const gridKey = `${activeTab}:${query.trim().toLowerCase()}:${sort}:${filters.rating}:${filters.format ?? ""}`;

  async function handleSeedFromWishlist() {
    setIsSeeding(true);
    setError(null);

    try {
      const response = await fetch("/api/collection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source: "wishlist" }),
      });
      const payload = await readCollectionResponse(response);
      const nextRecords = normalizeCollectionRecords(
        payload?.records,
        showRestrictedData,
      );

      setRecords(nextRecords);
      onSelectRecord(null);
      setIsUsingCache(false);
      writeCollectionCache(nextRecords);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Wishlist records could not be added.",
      );
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleDiscogsImport() {
    setIsImporting(true);
    setError(null);

    try {
      const response = await fetch("/api/discogs/import/collection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          runId:
            importProgress?.status === "running" ||
            importProgress?.status === "rate_limited" ||
            importProgress?.status === "failed"
              ? importProgress.id
              : undefined,
        }),
      });
      const payload = await readDiscogsImportResponse(response);
      const nextRecords = normalizeCollectionRecords(
        payload?.records,
        showRestrictedData,
      );

      if (isDiscogsImportProgress(payload?.progress)) {
        setImportProgress(payload.progress);
      }

      setRecords(nextRecords);
      onSelectRecord(null);
      setIsUsingCache(false);
      writeCollectionCache(nextRecords);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Discogs collection import could not run.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  function resetFilters() {
    setQuery("");
    setActiveTab("all");
    setSort(DEFAULT_COLLECTION_SORT);
    setFilters(DEFAULT_COLLECTION_FILTERS);
  }

  function openGroupDialog(options?: {
    group?: string;
    recordIds?: string[];
  }) {
    const unsortedIds = ownedRecords
      .filter((record) => !record.group?.trim())
      .map((record) => record.id);

    setGroupDialog({
      open: true,
      group: options?.group ?? "",
      // A new group starts from the unsorted pile, which is the usual thing
      // the collector wants to file. Every pick stays editable in the dialog.
      selectedIds:
        options?.recordIds ?? (options?.group ? [] : unsortedIds),
    });
  }

  function closeGroupDialog(open: boolean) {
    if (open) {
      return;
    }

    setGroupDialog((current) => ({ ...current, open: false }));
  }

  function handleGroupAssigned(updates: CollectionGroupAssignment[]) {
    if (updates.length === 0) {
      return;
    }

    const byId = new Map(updates.map((update) => [update.id, update]));
    const selectedId = selectedRecord?.collectionId ?? null;

    if (selectedId) {
      const current = records.find((record) => record.id === selectedId);
      const patch = byId.get(selectedId);

      if (current && patch) {
        window.dispatchEvent(
          new CustomEvent(SELECTED_RECORD_CHANGED_EVENT, {
            detail: selectedRecordFromCollection({
              ...current,
              group: patch.group,
              unit: patch.unit,
              shelf: patch.shelf,
              slot: patch.slot,
            }),
          }),
        );
      }
    }

    setRecords((currentRecords) => {
      const nextRecords = currentRecords.map((record) => {
        const patch = byId.get(record.id);

        return patch
          ? {
              ...record,
              group: patch.group,
              unit: patch.unit,
              shelf: patch.shelf,
              slot: patch.slot,
            }
          : record;
      });

      writeCollectionCache(nextRecords);
      return nextRecords;
    });
  }

  /**
   * The minus on a cover inside a group. It is the inverse of grouping, so it
   * saves immediately and the record drops back into `Unsorted` — no dialog,
   * because filing it again is one plus press away.
   */
  async function handleRemoveRecordFromGroup(record: CollectionRecord) {
    if (removingGroupRecordId) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Removing a record from a group needs a connection.");
      return;
    }

    setRemovingGroupRecordId(record.id);
    setError(null);

    try {
      const updates = await requestRemoveCollectionGroup([record.id]);
      handleGroupAssigned(updates);
    } catch (caught) {
      setError(
        caught instanceof CollectionActionError
          ? caught.message
          : "The record could not be removed from its group.",
      );
    } finally {
      setRemovingGroupRecordId(null);
    }
  }

  /**
   * The heart-off on a wantlist cover. Taking a want off the list is the
   * inverse of adding one, so it saves on a single press with no dialog. The
   * shell's collection-changed event keeps the counts, the Wantlist view, and
   * the inspector in step; the local filter makes the card leave immediately.
   */
  async function handleRemoveRecordFromWantlist(record: CollectionRecord) {
    if (removingWantRecordId || record.status !== "wanted") {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Removing a record from the wantlist needs a connection.");
      return;
    }

    setRemovingWantRecordId(record.id);
    setError(null);

    try {
      await requestDeleteCollectionRecord(record.id);

      setRecords((currentRecords) => {
        const nextRecords = currentRecords.filter(
          (candidate) => candidate.id !== record.id,
        );

        writeCollectionCache(nextRecords);
        return nextRecords;
      });

      if (selectedRecord?.collectionId === record.id) {
        onSelectRecord(null);
      }
    } catch (caught) {
      setError(
        caught instanceof CollectionActionError
          ? caught.message
          : "The record could not be removed from the wantlist.",
      );
    } finally {
      setRemovingWantRecordId(null);
    }
  }

  async function handleRateRecord(
    record: CollectionRecord,
    rating: number | null,
  ) {
    if (!onRateRecord) {
      return;
    }

    await onRateRecord(record, rating);

    setRecords((currentRecords) => {
      const nextRecords = currentRecords.map((candidate) =>
        candidate.id === record.id ? { ...candidate, rating } : candidate,
      );

      writeCollectionCache(nextRecords);
      return nextRecords;
    });
  }

  useEffect(() => {
    let isActive = true;

    fetch("/api/collection", {
      cache: "no-store",
    })
      .then(readCollectionResponse)
      .then((payload) => {
        if (!isActive) {
          return;
        }

        const nextRecords = normalizeCollectionRecords(
          payload?.records,
          showRestrictedData,
        );

        setRecords(nextRecords);
        onSelectRecord(null);
        setIsUsingCache(false);
        writeCollectionCache(nextRecords);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        const cachedRecords = readCollectionCache(showRestrictedData);

        if (cachedRecords.length > 0) {
          setRecords(cachedRecords);
          onSelectRecord(null);
          setIsUsingCache(true);
          setError("Live collection unavailable. Using cached collection data.");
        } else {
          setError(
            error instanceof Error
              ? error.message
              : "Collection records could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onSelectRecord, showRestrictedData]);

  useEffect(() => {
    function handleSelectedRecordChange(event: Event) {
      const selected = (event as CustomEvent<SelectedRecord | null>).detail;

      if (!selected?.collectionId) {
        return;
      }

      setRecords((currentRecords) => {
        const nextRecords = currentRecords
          .map((record) =>
            applySelectedRecordToCollectionRecord(record, selected),
          )
          .map((record) =>
            showRestrictedData
              ? record
              : sanitizeRestrictedCollectionDataForOwner(record),
          );

        writeCollectionCache(nextRecords);
        return nextRecords;
      });
      setIsUsingCache(false);
    }

    window.addEventListener(
      SELECTED_RECORD_CHANGED_EVENT,
      handleSelectedRecordChange,
    );

    return () => {
      window.removeEventListener(
        SELECTED_RECORD_CHANGED_EVENT,
        handleSelectedRecordChange,
      );
    };
  }, [showRestrictedData]);

  useEffect(() => {
    if (!allowDiscogsImport) {
      return;
    }

    let isActive = true;

    fetch("/api/discogs/import/collection", {
      cache: "no-store",
    })
      .then(readDiscogsImportResponse)
      .then((payload) => {
        if (!isActive) {
          return;
        }

        setImportProgress(
          isDiscogsImportProgress(payload?.progress) ? payload.progress : null,
        );
      })
      .catch(() => {
        if (isActive) {
          setImportProgress(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [allowDiscogsImport]);

  const ownedCountLabel = `${ownedRecords.length.toLocaleString()} owned · ${groupCount.toLocaleString()} ${
    groupCount === 1 ? "group" : "groups"
  }`;
  const shelvingMeta = [
    ownedCountLabel,
    unsortedCount > 0 ? `${unsortedCount.toLocaleString()} unsorted` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0">
      {error ? (
        <div className="mb-4 rounded-xl bg-[#D34278]/8 px-4 py-3 text-sm leading-6 text-[#FFF4E8]/78">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="wax-dashboard-surface grid min-h-[clamp(28rem,58svh,44rem)] place-items-center rounded-[28px] text-sm text-[#FFF4E8]/54">
          <span className="text-center">
            <Loader2
              className="mx-auto mb-3 size-5 animate-spin"
              aria-hidden="true"
            />
            Loading your collection
          </span>
        </div>
      ) : records.length === 0 ? (
        <section className="wax-dashboard-surface rounded-[28px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9 lg:py-10">
          <EmptyCollection
            onSeedFromWishlist={handleSeedFromWishlist}
            isSeeding={isSeeding}
            hasRecords={false}
            onResetFilters={resetFilters}
            importProgress={importProgress}
            isUsingCache={isUsingCache}
            allowWishlistSeed={showRestrictedData}
          />
          {allowDiscogsImport ? (
            <DiscogsImportPanel
              progress={importProgress}
              isImporting={isImporting}
              onRunImport={handleDiscogsImport}
            />
          ) : null}
        </section>
      ) : (
        <section
          className="wax-dashboard-surface relative overflow-hidden rounded-[28px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9 lg:py-10"
          aria-label="Collection and shelving"
        >
          {featuredRecords.length > 0 ? (
            <VinylOrbitCarousel
              fill
              flush
              records={featuredRecords}
              reasons={featuredReasons}
              onRate={onRateRecord ? handleRateRecord : undefined}
            />
          ) : (
            <section
              className="grid min-h-[11rem] place-items-center rounded-[24px] bg-[#FFF4E8]/4 px-6 py-10 text-center"
              aria-label="Featured vinyls"
            >
              <div>
                <Star
                  className="mx-auto size-5 text-[#FFF4E8]/30"
                  aria-hidden="true"
                />
                <p className="mt-4 text-sm font-medium text-[#FFF4E8]/68">
                  No featured vinyls yet
                </p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#FFF4E8]/42">
                  Star a record, or record its value, to feature it here.
                </p>
              </div>
            </section>
          )}

          <div className="mt-9">
            <CollectionToolbar
              tab={activeTab}
              tabCounts={tabCounts}
              onTabChange={setActiveTab}
              sort={sort}
              onSortChange={setSort}
              filters={filters}
              formatOptions={formatOptions}
              onFiltersChange={setFilters}
              onReset={resetFilters}
              activeFilterCount={activeFilterCount}
              visibleCount={filteredRecords.length}
              totalCount={records.length}
              actions={
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full bg-[#FFF4E8]/6 px-4 text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8]"
                  >
                    <Link href="/app?view=insights">
                      <BarChart3 className="size-4" aria-hidden="true" />
                      Health
                    </Link>
                  </Button>
                  {showRestrictedData ? (
                    <Button
                      type="button"
                      onClick={handleSeedFromWishlist}
                      disabled={isSeeding}
                      variant="outline"
                      className="rounded-full bg-[#FFF4E8]/6 px-4 text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] disabled:opacity-45"
                    >
                      {isSeeding ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Plus className="size-4" aria-hidden="true" />
                      )}
                      Add wishlist
                    </Button>
                  ) : null}
                </>
              }
            />
          </div>

          <VinylGridSection
            key={gridKey}
            records={filteredRecords}
            selectedRecordId={selectedRecord?.collectionId ?? null}
            onSelectRecord={(record) =>
              onSelectRecord(selectedRecordFromCollection(record))
            }
            onGroupRecord={(record) =>
              openGroupDialog({ recordIds: [record.id] })
            }
            onReset={resetFilters}
          />

          <section
            id="shelving"
            className="mt-14 scroll-mt-6"
            aria-labelledby="shelving-heading"
          >
            <div className="rounded-[26px] bg-[#FFF4E8]/[0.045] p-5 sm:p-7">
              <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="shelving-heading"
                    className="font-serif text-3xl italic leading-none tracking-[-0.02em] text-[#FFF4E8] sm:text-4xl"
                  >
                    Shelving
                  </h2>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[#FFF4E8]/38">
                    {shelvingMeta}
                  </p>
                  <p className="mt-3 max-w-md text-[11px] leading-5 text-[#FFF4E8]/36">
                    One tile per group, with its vinyls stacked behind each
                    other. Open a tile to flip through the records filed there.
                  </p>
                </div>

                {ownedRecords.length > 0 ? (
                  <Button
                    type="button"
                    onClick={() => openGroupDialog()}
                    className="rounded-full bg-[#FFF4E8] px-4 text-[#08030F] hover:bg-[#f6dfc9]"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    New group
                  </Button>
                ) : null}
              </header>

              <div className="mt-7">
                {shelfGroups.length === 0 ? (
                  <p className="rounded-2xl bg-[#FFF4E8]/4 px-5 py-8 text-center text-sm text-[#FFF4E8]/46">
                    Nothing grouped yet. Add a record, then create a group.
                  </p>
                ) : (
                  <ShelvingGrid
                    groups={shelfGroups}
                    selectedRecordId={selectedRecord?.collectionId ?? null}
                    onSelectRecord={(record) =>
                      onSelectRecord(selectedRecordFromCollection(record))
                    }
                    onOpenGroupDialog={openGroupDialog}
                    onRemoveRecordFromGroup={handleRemoveRecordFromGroup}
                    removingRecordId={removingGroupRecordId}
                  />
                )}
              </div>
            </div>
          </section>

          {wantedRecords.length > 0 ? (
            <WantlistShelf
              records={wantedRecords}
              selectedRecordId={selectedRecord?.collectionId ?? null}
              onSelectRecord={(record) =>
                onSelectRecord(selectedRecordFromCollection(record))
              }
              onGroupRecord={(record) =>
                openGroupDialog({ recordIds: [record.id] })
              }
              onRemoveRecord={handleRemoveRecordFromWantlist}
              removingRecordId={removingWantRecordId}
            />
          ) : null}

          {allowDiscogsImport ? (
            <DiscogsImportPanel
              progress={importProgress}
              isImporting={isImporting}
              onRunImport={handleDiscogsImport}
            />
          ) : null}

          {groupDialog.open ? (
            <GroupDialog
              open
              onOpenChange={closeGroupDialog}
              request={groupDialog}
              records={records}
              groupNames={groupNames}
              onAssigned={handleGroupAssigned}
            />
          ) : null}
        </section>
      )}
    </div>
  );
}
