"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  Disc3,
  Heart,
  Loader2,
  MapPin,
  PanelRight,
  Plus,
  Search,
  StickyNote,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCollectionLocation } from "@/lib/collection/location";
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

type DiggingMatch = {
  record: CollectionRecord;
  duplicateCount: number;
  score: number;
};

const DIGGING_CACHE_KEY = "waxlist:digging:collection:v1";

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

function normalizeSearchValue(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function recordIdentity(record: CollectionRecord) {
  return `${normalizeSearchValue(record.artist)}::${normalizeSearchValue(
    record.title,
  )}`;
}

function formatPriceHint(record: CollectionRecord) {
  if (record.priceHintLabel) {
    return record.priceHintLabel;
  }

  if (record.priceHintCents && record.priceHintCurrency) {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: record.priceHintCurrency,
    }).format(record.priceHintCents / 100);
  }

  return "No price hint";
}

function searchableText(record: CollectionRecord) {
  return [
    record.artist,
    record.title,
    record.label,
    record.catalogNumber,
    record.barcode,
    record.discogsReleaseId,
    record.discogsMasterId,
    record.year,
    record.room,
    record.unit,
    record.shelf,
    record.slot,
    ...record.tags,
  ]
    .filter(Boolean)
    .map(normalizeSearchValue)
    .join(" ");
}

function scoreRecord(record: CollectionRecord, normalizedQuery: string) {
  const artist = normalizeSearchValue(record.artist);
  const title = normalizeSearchValue(record.title);
  const barcode = normalizeSearchValue(record.barcode);
  const catalogNumber = normalizeSearchValue(record.catalogNumber);
  const releaseId = normalizeSearchValue(record.discogsReleaseId);
  const combinedTitle = `${artist} ${title}`.trim();
  const text = searchableText(record);

  if (!normalizedQuery) {
    return 0;
  }

  if (
    barcode === normalizedQuery ||
    catalogNumber === normalizedQuery ||
    releaseId === normalizedQuery
  ) {
    return 100;
  }

  if (combinedTitle === normalizedQuery || title === normalizedQuery) {
    return 92;
  }

  if (combinedTitle.includes(normalizedQuery)) {
    return 82;
  }

  if (artist.includes(normalizedQuery) || title.includes(normalizedQuery)) {
    return 72;
  }

  if (text.includes(normalizedQuery)) {
    return 58;
  }

  return 0;
}

function buildMatches(records: CollectionRecord[], query: string): DiggingMatch[] {
  const normalizedQuery = normalizeSearchValue(query);
  const duplicateCounts = records.reduce<Map<string, number>>((counts, record) => {
    const key = recordIdentity(record);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map());

  if (normalizedQuery.length < 2) {
    return [];
  }

  return records
    .map((record) => ({
      record,
      duplicateCount: duplicateCounts.get(recordIdentity(record)) ?? 1,
      score: scoreRecord(record, normalizedQuery),
    }))
    .filter((match) => match.score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return first.record.artist.localeCompare(second.record.artist);
    })
    .slice(0, 6);
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

function SignalPill({
  tone,
  children,
}: {
  tone: "good" | "warn" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium",
        tone === "good" &&
          "border-[#1DB954]/28 bg-[#1DB954]/12 text-[#BDF7CE]",
        tone === "warn" &&
          "border-[#F08A4B]/26 bg-[#F08A4B]/11 text-[#FFD4B5]",
        tone === "muted" &&
          "border-[#FFF4E8]/10 bg-[#FFF4E8]/6 text-[#FFF4E8]/62",
      )}
    >
      {children}
    </span>
  );
}

function DiggingResultCard({
  match,
  isSelected,
  onOpenInspector,
  onPatchRecord,
}: {
  match: DiggingMatch;
  isSelected: boolean;
  onOpenInspector: (record: CollectionRecord) => void;
  onPatchRecord: (
    record: CollectionRecord,
    patch: Partial<
      Pick<
        CollectionRecord,
        "notes" | "status" | "room" | "unit" | "shelf" | "slot"
      >
    >,
  ) => Promise<void>;
}) {
  const { record, duplicateCount } = match;
  const [isSavingWanted, setIsSavingWanted] = useState(false);
  const shelfLocation = formatCollectionLocation(record);
  const isOwned = record.status === "owned";
  const isWanted = record.status === "wanted";
  const duplicateLabel =
    duplicateCount > 1
      ? `${duplicateCount.toLocaleString()} copies`
      : "No duplicate";

  async function handleAddWanted() {
    setIsSavingWanted(true);

    try {
      await onPatchRecord(record, { status: "wanted" });
      onOpenInspector({ ...record, status: "wanted" });
    } finally {
      setIsSavingWanted(false);
    }
  }

  return (
    <article
      className={cn(
        "rounded-xl border bg-[#101014] p-4 transition",
        isSelected
          ? "border-[#FFF4E8]/22 bg-[#17151a]"
          : "border-[#FFF4E8]/9",
      )}
    >
      <div className="flex gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#FFF4E8]/10 bg-[#160A24]">
          {record.imageUrl ? (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${record.imageUrl})` }}
              aria-label={`${record.title} cover`}
              role="img"
            />
          ) : (
            <Disc3 className="size-7 text-[#FFF4E8]/42" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/38">
            Discogs #{record.discogsReleaseId}
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-[#FFF4E8]">
            {record.title}
          </h2>
          <p className="mt-1 truncate text-sm text-[#FFF4E8]/62">
            {record.artist}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <SignalPill tone={isOwned ? "good" : "muted"}>
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {isOwned ? "Owned" : "Not owned"}
        </SignalPill>
        <SignalPill tone={isWanted ? "good" : "muted"}>
          <Heart className="size-3.5" aria-hidden="true" />
          {isWanted ? "Wanted" : "Not wanted"}
        </SignalPill>
        <SignalPill tone={duplicateCount > 1 ? "warn" : "muted"}>
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          {duplicateLabel}
        </SignalPill>
        <SignalPill tone={shelfLocation ? "good" : "warn"}>
          <MapPin className="size-3.5" aria-hidden="true" />
          {shelfLocation || "No shelf"}
        </SignalPill>
        <SignalPill tone={record.priceHintLabel || record.priceHintCents ? "good" : "muted"}>
          {formatPriceHint(record)}
        </SignalPill>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button
          type="button"
          onClick={handleAddWanted}
          disabled={isWanted || isSavingWanted}
          className="rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9] disabled:opacity-45"
        >
          {isSavingWanted ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Heart className="size-4" aria-hidden="true" />
          )}
          {isWanted ? "Wanted" : "Add wanted"}
        </Button>
        <Button
          type="button"
          onClick={() => onOpenInspector(record)}
          variant="outline"
          className="rounded-full border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/76 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
        >
          <StickyNote className="size-4" aria-hidden="true" />
          Add note
        </Button>
        <Button
          type="button"
          onClick={() => onOpenInspector(record)}
          variant="outline"
          className="col-span-2 rounded-full border-[#FFF4E8]/12 bg-transparent text-[#FFF4E8]/68 hover:bg-[#FFF4E8]/8 hover:text-[#FFF4E8]"
        >
          <PanelRight className="size-4" aria-hidden="true" />
          Open inspector
        </Button>
      </div>
    </article>
  );
}

export function DiggingWorkspaceFrame({
  initialQuery = "",
  selectedRecord,
  onSelectRecord,
}: {
  initialQuery?: string;
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: SelectedRecord | null) => void;
}) {
  const [records, setRecords] = useState<CollectionRecord[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    return normalizeCollectionRecords(
      JSON.parse(window.localStorage.getItem(DIGGING_CACHE_KEY) ?? "[]"),
    );
  });
  const [query, setQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState(() => {
    if (typeof window === "undefined") {
      return "Loading collection";
    }

    const cachedRecords = normalizeCollectionRecords(
      JSON.parse(window.localStorage.getItem(DIGGING_CACHE_KEY) ?? "[]"),
    );

    return cachedRecords.length > 0 ? "Cached collection" : "Loading collection";
  });
  const [hasCachedRecordsAtLoad] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      normalizeCollectionRecords(
        JSON.parse(window.localStorage.getItem(DIGGING_CACHE_KEY) ?? "[]"),
      ).length > 0
    );
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => buildMatches(records, query), [query, records]);
  const topMatch = matches[0] ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        setSourceLabel("Live collection");
        window.localStorage.setItem(
          DIGGING_CACHE_KEY,
          JSON.stringify(nextRecords),
        );
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Digging data could not be loaded.",
        );
        setSourceLabel(hasCachedRecordsAtLoad ? "Cached collection" : "Offline");
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [hasCachedRecordsAtLoad]);

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

        window.localStorage.setItem(DIGGING_CACHE_KEY, JSON.stringify(nextRecords));
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
      setSourceLabel("Live collection");
      window.localStorage.setItem(DIGGING_CACHE_KEY, JSON.stringify(nextRecords));
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

  async function patchRecord(
    record: CollectionRecord,
    patch: Partial<
      Pick<
        CollectionRecord,
        "notes" | "status" | "room" | "unit" | "shelf" | "slot"
      >
    >,
  ) {
    const response = await fetch(`/api/collection/${record.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    const payload = await readCollectionResponse(response);
    const updatedRecord = isCollectionRecord(payload?.record)
      ? payload.record
      : null;

    if (!updatedRecord) {
      throw new Error("Collection update returned an invalid record.");
    }

    setRecords((currentRecords) => {
      const nextRecords = currentRecords.map((currentRecord) =>
        currentRecord.id === updatedRecord.id ? updatedRecord : currentRecord,
      );

      window.localStorage.setItem(DIGGING_CACHE_KEY, JSON.stringify(nextRecords));
      return nextRecords;
    });
    if (selectedRecord?.collectionId === updatedRecord.id) {
      onSelectRecord(selectedRecordFromCollection(updatedRecord));
    }
  }

  function handleOpenInspector(record: CollectionRecord) {
    onSelectRecord(selectedRecordFromCollection(record));
  }

  function clearQuery() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <section className="min-w-0" aria-label="Digging lookup">
      <div className="grid gap-5">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[#FFF4E8]/48">
              <Barcode className="size-4" aria-hidden="true" />
              <p className="text-xs uppercase tracking-[0.24em]">
                Shop lookup
              </p>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#FFF4E8]/42 sm:text-right">
              {sourceLabel} / {records.length.toLocaleString()} records
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#FFF4E8]/10 bg-[#101014] p-3 sm:p-4">
            <label className="sr-only" htmlFor="digging-search">
              Search artist, title, barcode, catalog, or Discogs ID
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#FFF4E8]/48"
                aria-hidden="true"
              />
              <Input
                ref={inputRef}
                id="digging-search"
                type="search"
                inputMode="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Scan barcode or search artist, title, catalog"
                className="h-16 rounded-xl border-[#FFF4E8]/12 bg-[#05030A] pl-12 pr-12 text-lg text-[#FFF4E8] placeholder:text-[#FFF4E8]/34 focus-visible:border-[#FFF4E8]/28 focus-visible:ring-[#FFF4E8]/10"
              />
              {query ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={clearQuery}
                  className="absolute right-3 top-1/2 size-9 -translate-y-1/2 rounded-full border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/60 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
                  aria-label="Clear search"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-[#F08A4B]/24 bg-[#F08A4B]/9 p-4 text-sm leading-6 text-[#FFF4E8]/72">
              {error}
            </div>
          ) : null}

          {isLoading && records.length === 0 ? (
            <div className="grid min-h-[22rem] place-items-center text-sm text-[#FFF4E8]/54">
              <div className="text-center">
                <Loader2
                  className="mx-auto mb-3 size-5 animate-spin"
                  aria-hidden="true"
                />
                Loading shop lookup data
              </div>
            </div>
          ) : query.trim().length < 2 ? (
            <div className="grid min-h-[22rem] place-items-center rounded-xl border border-dashed border-[#FFF4E8]/10 text-center">
              <div className="px-6">
                <Barcode
                  className="mx-auto size-9 text-[#FFF4E8]/28"
                  aria-hidden="true"
                />
                <p className="mt-4 text-sm font-medium text-[#FFF4E8]/72">
                  Scan or search while you browse
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/45">
                  Results will show owned state, wantlist state, duplicates,
                  shelf location, and stored price hints instantly.
                </p>
                {records.length === 0 ? (
                  <Button
                    type="button"
                    onClick={handleSeedFromWishlist}
                    disabled={isSeeding}
                    className="mt-5 rounded-full bg-[#1b1b1f] px-5 text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
                  >
                    {isSeeding ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    Add wishlist records
                  </Button>
                ) : null}
              </div>
            </div>
          ) : matches.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {topMatch ? (
                <div className="rounded-xl border border-[#1DB954]/22 bg-[#1DB954]/8 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#BDF7CE]/72">
                    Instant answer
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[#FFF4E8]">
                    {topMatch.record.status === "owned"
                      ? "You already own this."
                      : "This is already wanted."}
                  </p>
                </div>
              ) : null}

              {matches.map((match) => (
                <DiggingResultCard
                  key={match.record.id}
                  match={match}
                  isSelected={selectedRecord?.collectionId === match.record.id}
                  onOpenInspector={handleOpenInspector}
                  onPatchRecord={patchRecord}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[#FFF4E8]/10 bg-[#101014] p-6 text-center">
              <Disc3
                className="mx-auto size-8 text-[#FFF4E8]/28"
                aria-hidden="true"
              />
              <p className="mt-4 text-sm font-medium text-[#FFF4E8]/72">
                No local match found
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/45">
                Add/import the record before WAXLIST can answer owned, wanted,
                duplicate, shelf, and price states from local data.
              </p>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
