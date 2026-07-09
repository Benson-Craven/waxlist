"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Disc3,
  Loader2,
  Map as MapIcon,
  MapPin,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatCollectionLocation,
  getCollectionLocationGroup,
  isMissingCollectionLocation,
} from "@/lib/collection/location";
import type { CollectionRecord } from "@/lib/collection/record";
import { cn } from "@/lib/utils";
import {
  SELECTED_RECORD_CHANGED_EVENT,
  selectedRecordFromCollection,
  type SelectedRecord,
} from "@/lib/workspace/selected-record";

type CollectionPayload = {
  records?: unknown;
  record?: unknown;
  error?: {
    message?: string;
  };
};

type ShelfFilter = "missing" | "located" | "all";

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

function writeCollectionCache(records: CollectionRecord[]) {
  try {
    window.localStorage.setItem(COLLECTION_CACHE_KEY, JSON.stringify(records));
  } catch {
    // Location edits should not fail just because the browser cache is blocked.
  }
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
    tags: selected.tags,
    notes: selected.notes,
    room: selected.room,
    unit: selected.unit,
    shelf: selected.shelf,
    slot: selected.slot,
  };
}

function ShelfStats({ records }: { records: CollectionRecord[] }) {
  const missingCount = records.filter(isMissingCollectionLocation).length;
  const locatedCount = records.length - missingCount;
  const rooms = new Set(
    records
      .map((record) => record.room?.trim())
      .filter((room): room is string => Boolean(room)),
  );

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[#FFF4E8]/9 bg-[#101014] p-4">
        <dt className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
          Located
        </dt>
        <dd className="mt-2 text-2xl font-semibold text-[#FFF4E8]">
          {locatedCount.toLocaleString()}
        </dd>
      </div>
      <div className="rounded-xl border border-[#F08A4B]/18 bg-[#F08A4B]/8 p-4">
        <dt className="text-xs uppercase tracking-[0.18em] text-[#FFD4B5]/58">
          Missing
        </dt>
        <dd className="mt-2 text-2xl font-semibold text-[#FFD4B5]">
          {missingCount.toLocaleString()}
        </dd>
      </div>
      <div className="rounded-xl border border-[#FFF4E8]/9 bg-[#101014] p-4">
        <dt className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
          Rooms
        </dt>
        <dd className="mt-2 text-2xl font-semibold text-[#FFF4E8]">
          {rooms.size.toLocaleString()}
        </dd>
      </div>
    </dl>
  );
}

function ShelfGroups({ records }: { records: CollectionRecord[] }) {
  const groups = Array.from(
    records.reduce<Map<string, number>>((currentGroups, record) => {
      if (isMissingCollectionLocation(record)) {
        return currentGroups;
      }

      const key = getCollectionLocationGroup(record);
      currentGroups.set(key, (currentGroups.get(key) ?? 0) + 1);
      return currentGroups;
    }, new Map()),
  )
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(0, 8);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[#FFF4E8]/9 bg-[#101014] p-4">
      <div className="flex items-center gap-2 text-[#FFF4E8]/48">
        <MapIcon className="size-4" aria-hidden="true" />
        <h2 className="text-xs uppercase tracking-[0.22em]">Shelf map</h2>
      </div>
      <div className="mt-4 grid gap-2">
        {groups.map(([group, count]) => (
          <div
            key={group}
            className="flex items-center justify-between gap-3 rounded-lg bg-[#FFF4E8]/5 px-3 py-2"
          >
            <span className="min-w-0 truncate text-sm text-[#FFF4E8]/72">
              {group}
            </span>
            <span className="shrink-0 text-xs text-[#FFF4E8]/42">
              {count.toLocaleString()} record{count === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShelfRecordList({
  records,
  selectedRecord,
  onSelectRecord,
}: {
  records: CollectionRecord[];
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: CollectionRecord) => void;
}) {
  return (
    <div className="overflow-hidden border-t border-[#FFF4E8]/10">
      {records.map((record) => {
        const location = formatCollectionLocation(record);
        const isMissing = isMissingCollectionLocation(record);
        const isSelected = selectedRecord?.collectionId === record.id;

        return (
          <button
            key={record.id}
            type="button"
            onClick={() => onSelectRecord(record)}
            className={cn(
              "grid w-full gap-3 px-2 py-4 text-left transition md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_7rem]",
              isSelected ? "bg-[#FFF4E8]/8" : "hover:bg-[#FFF4E8]/5",
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
            <span
              className={cn(
                "flex items-center gap-2 text-xs md:self-center",
                isMissing ? "text-[#FFD4B5]" : "text-[#FFF4E8]/58",
              )}
            >
              {isMissing ? (
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{location || "No location set"}</span>
            </span>
            <span className="text-xs capitalize text-[#FFF4E8]/48 md:self-center md:text-right">
              {record.status}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ShelfWorkspaceFrame({
  initialQuery = "",
  selectedRecord,
  onSelectRecord,
}: {
  initialQuery?: string;
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: SelectedRecord | null) => void;
}) {
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<ShelfFilter>("missing");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return records.filter((record) => {
      const isMissing = isMissingCollectionLocation(record);
      const matchesFilter =
        filter === "all" ||
        (filter === "missing" && isMissing) ||
        (filter === "located" && !isMissing);

      if (!matchesFilter) {
        return false;
      }

      return normalizedQuery
        ? recordSearchText(record).includes(normalizedQuery)
        : true;
    });
  }, [filter, query, records]);

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
        const firstRecord =
          nextRecords.find((record) => isMissingCollectionLocation(record)) ??
          nextRecords[0] ??
          null;
        setRecords(nextRecords);
        onSelectRecord(firstRecord ? selectedRecordFromCollection(firstRecord) : null);
        writeCollectionCache(nextRecords);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Shelf records could not be loaded.",
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
  }, [onSelectRecord]);

  useEffect(() => {
    function handleSelectedRecordChange(event: Event) {
      const selected = (event as CustomEvent<SelectedRecord | null>).detail;

      if (!selected?.collectionId) {
        return;
      }

      setRecords((currentRecords) => {
        const nextRecords = currentRecords.map((record) =>
          applySelectedRecordToCollectionRecord(record, selected),
        );

        writeCollectionCache(nextRecords);
        return nextRecords;
      });
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
  }, []);

  return (
    <section className="min-w-0" aria-label="Shelf location management">
      <div className="grid gap-5">
        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-2 text-[#FFF4E8]/48">
            <MapIcon className="size-4" aria-hidden="true" />
            <p className="text-xs uppercase tracking-[0.24em]">
              Location management
            </p>
          </div>

          <ShelfStats records={records} />

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 rounded-xl border border-[#FFF4E8]/9 bg-[#101014] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/48"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search artist, title, barcode, or shelf"
                    className="h-11 rounded-full border-transparent bg-[#1b1b20] pl-11 pr-4 text-[#FFF4E8] placeholder:text-[#FFF4E8]/38 focus-visible:border-[#FFF4E8]/18 focus-visible:ring-[#FFF4E8]/8"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    ["missing", "Missing"],
                    ["located", "Located"],
                    ["all", "All"],
                  ].map(([id, label]) => (
                    <Button
                      key={id}
                      type="button"
                      variant="outline"
                      onClick={() => setFilter(id as ShelfFilter)}
                      className={cn(
                        "rounded-full border-transparent px-4",
                        filter === id
                          ? "bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
                          : "bg-[#1b1b20] text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]",
                      )}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-[#D34278]/24 bg-[#D34278]/8 p-4 text-sm leading-6 text-[#FFF4E8]/78">
                  {error}
                </div>
              ) : null}

              {isLoading ? (
                <div className="grid min-h-[28rem] place-items-center text-sm text-[#FFF4E8]/54">
                  <div className="text-center">
                    <Loader2
                      className="mx-auto mb-3 size-5 animate-spin"
                      aria-hidden="true"
                    />
                    Loading shelf records
                  </div>
                </div>
              ) : filteredRecords.length > 0 ? (
                <ShelfRecordList
                  records={filteredRecords}
                  selectedRecord={selectedRecord}
                  onSelectRecord={(record) =>
                    onSelectRecord(selectedRecordFromCollection(record))
                  }
                />
              ) : (
                <div className="grid min-h-[28rem] place-items-center text-center">
                  <div className="px-6">
                    <Disc3
                      className="mx-auto size-8 text-[#FFF4E8]/28"
                      aria-hidden="true"
                    />
                    <p className="mt-4 text-sm font-medium text-[#FFF4E8]/72">
                      No shelf records found
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/45">
                      Adjust the search or location filter after importing or
                      seeding collection records.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <ShelfGroups records={records} />
          </div>
        </div>
      </div>
    </section>
  );
}
