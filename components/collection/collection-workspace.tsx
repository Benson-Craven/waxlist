"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Disc3,
  Download,
  Filter,
  Heart,
  ListFilter,
  Loader2,
  MapPin,
  PanelRight,
  Plus,
  Save,
  Search,
  Tag,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COLLECTION_LOCATION_FIELDS,
  formatCollectionLocation,
  isMissingCollectionLocation,
} from "@/lib/collection/location";
import type { CollectionRecord } from "@/lib/collection/record";
import { cn } from "@/lib/utils";

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

const COLLECTION_CACHE_KEY = "waxlist:digging:collection:v1";

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

function normalizeCollectionRecords(value: unknown) {
  return Array.isArray(value) ? value.filter(isCollectionRecord) : [];
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

function formatRecordYear(record: CollectionRecord) {
  return record.year ? String(record.year) : "Year unknown";
}

function recordSearchText(record: CollectionRecord) {
  return [
    record.artist,
    record.title,
    record.label,
  record.catalogNumber,
  record.barcode,
  record.discogsReleaseId,
  record.room,
  record.unit,
  record.shelf,
  record.slot,
  ...record.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatImportProgress(progress: DiscogsImportProgress | null) {
  if (!progress) {
    return "No Discogs import has run yet.";
  }

  if (progress.status === "completed") {
    return `Imported ${progress.importedCount.toLocaleString()} records.`;
  }

  if (progress.status === "rate_limited") {
    return progress.retryAfterSeconds
      ? `Rate limited. Retry in about ${progress.retryAfterSeconds.toLocaleString()} seconds.`
      : "Rate limited. Retry in a moment.";
  }

  if (progress.status === "failed") {
    return "Import paused after an error. Review failures and retry.";
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
    <div className="mt-5 rounded-xl border border-[#FFF4E8]/10 bg-[#101014] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-[#FFF4E8]/42">
            Discogs import
          </p>
          <p className="mt-2 text-sm font-medium text-[#FFF4E8]">
            {formatImportProgress(progress)}
          </p>
          <p className="mt-1 text-xs text-[#FFF4E8]/48">
            {progress?.discogsUsername
              ? `Source: ${progress.discogsUsername}`
              : "Uses the official Discogs API and stores owned releases locally."}
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
        <div className="mt-3 rounded-lg border border-[#F08A4B]/20 bg-[#F08A4B]/8 p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-[#FFD4B5]">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {progress.failedCount.toLocaleString()} partial import failure
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

type CollectionTab = "all" | "owned" | "wanted" | "missingLocation";

const COLLECTION_TABS: Array<{
  id: CollectionTab;
  label: string;
}> = [
  { id: "all", label: "All Records" },
  { id: "owned", label: "Owned" },
  { id: "wanted", label: "Wanted" },
  { id: "missingLocation", label: "Missing Location" },
];

function CollectionList({
  records,
  selectedRecord,
  onSelectRecord,
}: {
  records: CollectionRecord[];
  selectedRecord: CollectionRecord | null;
  onSelectRecord: (record: CollectionRecord) => void;
}) {
  return (
    <div className="overflow-hidden border-t border-[#FFF4E8]/10">
      {records.length > 0 ? (
        <div className="divide-y divide-[#FFF4E8]/8">
          {records.map((record) => {
              const isSelected = selectedRecord?.id === record.id;
              const shelfLocation = formatCollectionLocation(record);

              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => onSelectRecord(record)}
                  className={cn(
                    "grid w-full gap-3 px-2 py-4 text-left transition sm:grid-cols-[minmax(0,1.2fr)_7rem_9rem_9rem]",
                    isSelected
                      ? "bg-[#FFF4E8]/8"
                      : "hover:bg-[#FFF4E8]/5",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#FFF4E8]">
                      {record.artist}
                    </span>
                    <span className="mt-1 block truncate text-sm text-[#FFF4E8]/62">
                      {record.title}
                    </span>
                  </span>
                  <span className="text-xs capitalize text-[#FFF4E8]/54 sm:self-center">
                    {record.status}
                  </span>
                  <span className="text-xs text-[#FFF4E8]/54 sm:self-center">
                    {formatRecordYear(record)}
                    {record.format.length ? ` · ${record.format[0]}` : ""}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[#FFF4E8]/52 sm:justify-end">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {shelfLocation || "No shelf set"}
                    </span>
                  </span>
                </button>
              );
          })}
        </div>
      ) : null}
    </div>
  );
}

function EmptyCollection({
  onSeedFromWishlist,
  isSeeding,
  hasRecords,
  onResetFilters,
}: {
  onSeedFromWishlist: () => void;
  isSeeding: boolean;
  hasRecords: boolean;
  onResetFilters: () => void;
}) {
  return (
    <div className="grid min-h-[34rem] place-items-center text-center">
      <div>
        <Archive className="mx-auto size-8 text-[#FFF4E8]/26" aria-hidden="true" />
        <p className="mt-5 text-sm font-medium text-[#FFF4E8]/68">
          {hasRecords ? "No records found" : "No collection records yet"}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/42">
          {hasRecords
            ? "Adjust search, tabs, or filters to find a record."
            : "Seed wanted items from saved wishlist records before full Discogs collection import."}
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
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

function CollectionInspector({
  record,
  onRecordUpdated,
}: {
  record: CollectionRecord | null;
  onRecordUpdated: (record: CollectionRecord) => void;
}) {
  return (
    <aside
      className="flex min-h-[24rem] flex-col rounded-2xl border border-[#FFF4E8]/10 bg-[#101014] p-4 shadow-2xl shadow-black/20"
      aria-labelledby="record-inspector-heading"
    >
      <div className="flex items-center gap-2 text-[#FFF4E8]/48">
        <PanelRight className="size-4" aria-hidden="true" />
        <p className="text-xs uppercase tracking-[0.24em]">Inspector</p>
      </div>

      {record ? (
        <CollectionInspectorForm
          key={record.id}
          record={record}
          onRecordUpdated={onRecordUpdated}
        />
      ) : (
        <div className="mt-8 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#FFF4E8]/12 bg-[#FFF4E8]/4 px-5 text-center">
          <Disc3 className="size-9 text-[#FFF4E8]/38" aria-hidden="true" />
          <h2
            id="record-inspector-heading"
            className="mt-4 text-base font-semibold text-[#FFF4E8]"
          >
            No record selected
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-[#FFF4E8]/58">
            Select a collection record to edit status, tags, notes, and shelf
            location.
          </p>
        </div>
      )}
    </aside>
  );
}

function CollectionInspectorForm({
  record,
  onRecordUpdated,
}: {
  record: CollectionRecord;
  onRecordUpdated: (record: CollectionRecord) => void;
}) {
  const [status, setStatus] = useState<CollectionRecord["status"]>(
    record.status,
  );
  const [tags, setTags] = useState(record.tags.join(", "));
  const [notes, setNotes] = useState(record.notes ?? "");
  const [room, setRoom] = useState(record.room ?? "");
  const [unit, setUnit] = useState(record.unit ?? "");
  const [shelf, setShelf] = useState(record.shelf ?? "");
  const [slot, setSlot] = useState(record.slot ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locationValues = { room, unit, shelf, slot };
  const locationSetters = { room: setRoom, unit: setUnit, shelf: setShelf, slot: setSlot };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/collection/${record.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes,
          room,
          unit,
          shelf,
          slot,
        }),
      });
      const payload = await readCollectionResponse(response);
      const updatedRecord = isCollectionRecord(
        (payload as { record?: unknown }).record,
      )
        ? ((payload as { record: CollectionRecord }).record)
        : null;

      if (!updatedRecord) {
        throw new Error("Collection update returned an invalid record.");
      }

      onRecordUpdated(updatedRecord);
      setMessage("Record updated.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Record could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-1 flex-col">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
              Discogs #{record.discogsReleaseId}
            </p>
            <h2
              id="record-inspector-heading"
              className="mt-2 text-lg font-semibold text-[#FFF4E8]"
            >
              {record.title}
            </h2>
            <p className="mt-1 text-sm text-[#FFF4E8]/62">{record.artist}</p>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as CollectionRecord["status"])
                }
                className="h-10 rounded-lg border border-[#FFF4E8]/14 bg-[#120a1d] px-3 text-sm text-[#FFF4E8] outline-none focus:border-[#FFF4E8]/30"
              >
                <option value="owned">Owned</option>
                <option value="wanted">Wanted</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              {COLLECTION_LOCATION_FIELDS.map(({ key, label, placeholder }) => (
                <label
                  key={label}
                  className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62"
                >
                  {label}
                  <Input
                    value={locationValues[key]}
                    onChange={(event) => locationSetters[key](event.target.value)}
                    placeholder={placeholder}
                    className="h-10 rounded-lg border-[#FFF4E8]/14 bg-[#FFF4E8]/8 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
                  />
                </label>
              ))}
            </div>

            <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
              Tags
              <Input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="jazz, first press, shop-check"
                className="h-10 rounded-lg border-[#FFF4E8]/14 bg-[#FFF4E8]/8 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
              Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className="resize-none rounded-lg border border-[#FFF4E8]/14 bg-[#FFF4E8]/8 px-3 py-2 text-sm text-[#FFF4E8] outline-none placeholder:text-[#FFF4E8]/36 focus:border-[#FFF4E8]/30"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-2 text-xs text-[#FFF4E8]/54">
            <p className="flex items-center gap-2">
              <Disc3 className="size-3.5" aria-hidden="true" />
              {record.format.length ? record.format.join(", ") : "Format unknown"}
            </p>
            <p className="flex items-center gap-2">
              <Tag className="size-3.5" aria-hidden="true" />
              {record.label ?? "Label unknown"}
            </p>
            <p className="flex items-center gap-2">
              {record.status === "owned" ? (
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
              ) : (
                <Heart className="size-3.5" aria-hidden="true" />
              )}
              {record.priceHintLabel ?? "Price hint unavailable"}
            </p>
          </div>

          <div className="mt-auto pt-5">
            {message ? (
              <p className="mb-3 text-xs text-[#FFF4E8]/58">{message}</p>
            ) : null}
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Save record
            </Button>
          </div>
        </form>
  );
}

export function CollectionWorkspaceFrame() {
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CollectionRecord | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CollectionTab>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] =
    useState<DiscogsImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ownedCount = records.filter((record) => record.status === "owned").length;
  const wantedCount = records.filter(
    (record) => record.status === "wanted",
  ).length;
  const missingLocationCount = records.filter(
    (record) => isMissingCollectionLocation(record),
  ).length;
  const filteredRecords = useMemo(() => {
    const nextQuery = query.trim().toLowerCase();

    return records.filter((record) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "owned" && record.status === "owned") ||
        (activeTab === "wanted" && record.status === "wanted") ||
        (activeTab === "missingLocation" && isMissingCollectionLocation(record));

      if (!matchesTab) {
        return false;
      }

      if (!nextQuery) {
        return true;
      }

      return recordSearchText(record).includes(nextQuery);
    });
  }, [activeTab, query, records]);
  const hasActiveFilters = query.trim().length > 0 || activeTab !== "all";

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
      const nextRecords = normalizeCollectionRecords(payload?.records);

      setRecords(nextRecords);
      setSelectedRecord(null);
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
      const nextRecords = normalizeCollectionRecords(payload?.records);

      if (isDiscogsImportProgress(payload?.progress)) {
        setImportProgress(payload.progress);
      }

      setRecords(nextRecords);
      setSelectedRecord(null);
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

  function handleRecordUpdated(updatedRecord: CollectionRecord) {
    setRecords((currentRecords) => {
      const nextRecords = currentRecords.map((record) =>
        record.id === updatedRecord.id ? updatedRecord : record,
      );

      writeCollectionCache(nextRecords);

      return nextRecords;
    });
    setSelectedRecord(updatedRecord);
  }

  function resetFilters() {
    setQuery("");
    setActiveTab("all");
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

        const nextRecords = normalizeCollectionRecords(payload?.records);

        setRecords(nextRecords);
        setSelectedRecord(null);
        writeCollectionCache(nextRecords);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Collection records could not be loaded.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
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
  }, []);

  return (
    <div className="min-w-0">
      <section aria-labelledby="collection-view-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1
            id="collection-view-heading"
            className="text-3xl font-semibold tracking-[-0.01em] text-[#FFF4E8]"
          >
            Collection
          </h1>
          <Button
            type="button"
            onClick={handleSeedFromWishlist}
            disabled={isSeeding}
            variant="outline"
            className="rounded-full border-[#FFF4E8]/12 bg-transparent px-4 text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/8 hover:text-[#FFF4E8] disabled:opacity-45"
          >
            {isSeeding ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            Add wishlist
          </Button>
        </div>

        <DiscogsImportPanel
          progress={importProgress}
          isImporting={isImporting}
          onRunImport={handleDiscogsImport}
        />

        <div className="mt-5 flex gap-7 overflow-x-auto border-b border-[#FFF4E8]/10">
          {COLLECTION_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count =
              tab.id === "all"
                ? records.length
                : tab.id === "owned"
                  ? ownedCount
                  : tab.id === "wanted"
                    ? wantedCount
                    : missingLocationCount;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative min-w-max pb-3 text-sm font-medium transition",
                  isActive
                    ? "text-[#FFF4E8]"
                    : "text-[#FFF4E8]/50 hover:text-[#FFF4E8]/78",
                )}
              >
                {tab.label}
                <span className="ml-2 text-xs text-[#FFF4E8]/36">{count}</span>
                {isActive ? (
                  <span className="absolute inset-x-0 bottom-0 h-px bg-[#FFF4E8]" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/48"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-11 rounded-full border-transparent bg-[#1b1b20] pl-11 pr-4 text-[#FFF4E8] placeholder:text-[#FFF4E8]/38 focus-visible:border-[#FFF4E8]/18 focus-visible:ring-[#FFF4E8]/8"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-transparent bg-[#1b1b20] px-4 text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
            >
              <Filter className="size-4" aria-hidden="true" />
              Filters ({hasActiveFilters ? 1 : 0})
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-transparent bg-[#1b1b20] px-4 text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
            >
              <ListFilter className="size-4" aria-hidden="true" />
              Newest
            </Button>
            {hasActiveFilters ? (
              <Button
                type="button"
                onClick={resetFilters}
                variant="outline"
                className="rounded-full border-transparent bg-transparent px-3 text-[#FFF4E8]/58 hover:bg-[#FFF4E8]/8 hover:text-[#FFF4E8]"
              >
                <X className="size-4" aria-hidden="true" />
                Reset
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          {error ? (
            <div className="rounded-xl border border-[#D34278]/24 bg-[#D34278]/8 p-4 text-sm leading-6 text-[#FFF4E8]/78">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid min-h-[34rem] place-items-center text-sm text-[#FFF4E8]/54">
              <Loader2
                className="mx-auto mb-3 size-5 animate-spin"
                aria-hidden="true"
              />
              Loading collection records
            </div>
          ) : filteredRecords.length > 0 ? (
            <CollectionList
              records={filteredRecords}
              selectedRecord={selectedRecord}
              onSelectRecord={setSelectedRecord}
            />
          ) : (
            <EmptyCollection
              onSeedFromWishlist={handleSeedFromWishlist}
              isSeeding={isSeeding}
              hasRecords={records.length > 0}
              onResetFilters={resetFilters}
            />
          )}
        </div>
      </section>

      {selectedRecord ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="hidden xl:block" />
          <CollectionInspector
            record={selectedRecord}
            onRecordUpdated={handleRecordUpdated}
          />
        </div>
      ) : null}
    </div>
  );
}
