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
  Plus,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelBadge } from "@/components/ui/label-badge";
import {
  RecordQuickActions,
  RecordStatusToggle,
} from "@/components/records/record-actions";
import { PressingIdentificationWorkspace } from "@/components/pressing-proof/pressing-identification-workspace";
import { ShelfLocationSummary } from "@/components/shelf/shelf-location";
import { isMissingCollectionLocation } from "@/lib/collection/location";
import {
  sanitizeRestrictedCollectionData,
  type CollectionRecord,
} from "@/lib/collection/record";
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

const DIGGING_CACHE_KEY = "waxlist:digging:collection:v2";

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

  return showRestrictedData
    ? records
    : records.map(sanitizeRestrictedCollectionData);
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
    record.group,
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
    favourite: selected.favourite,
    tags: selected.tags,
    notes: selected.notes,
    group: selected.group,
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
    <LabelBadge
      size="lg"
      className="min-h-8"
      tone={tone === "warn" ? "attention" : tone === "muted" ? "quiet" : "neutral"}
    >
      {children}
    </LabelBadge>
  );
}

function DiggingResultCard({
  match,
  isSelected,
  onOpenInspector,
  showRestrictedData,
}: {
  match: DiggingMatch;
  isSelected: boolean;
  onOpenInspector: (record: CollectionRecord) => void;
  showRestrictedData: boolean;
}) {
  const { record, duplicateCount } = match;
  const isOwned = record.status === "owned";
  const isWanted = record.status === "wanted";

  return (
    <article
      className={cn(
        "rounded-xl bg-[#101014] p-4 transition",
        isSelected ? "bg-[#17151a]" : "",
      )}
    >
      <div className="flex gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#160A24]">
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
            #{record.discogsReleaseId}
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
        {isOwned ? (
          <SignalPill tone="good">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Owned
          </SignalPill>
        ) : null}
        {isWanted ? (
          <SignalPill tone="good">
            <Heart className="size-3.5" aria-hidden="true" />
            Wanted
          </SignalPill>
        ) : null}
        {duplicateCount > 1 ? (
          <SignalPill tone="warn">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {duplicateCount.toLocaleString()} copies
          </SignalPill>
        ) : null}
        {isOwned ? (
          <SignalPill tone={isMissingCollectionLocation(record) ? "warn" : "muted"}>
            <ShelfLocationSummary location={record} />
          </SignalPill>
        ) : null}
        {showRestrictedData ? (
          <SignalPill
            tone={record.priceHintLabel || record.priceHintCents ? "good" : "muted"}
          >
            {formatPriceHint(record)}
          </SignalPill>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <RecordStatusToggle record={record} />
        <div className="flex items-center gap-1">
          <RecordQuickActions record={record} />
          <Button
            type="button"
            onClick={() => onOpenInspector(record)}
            variant="outline"
            className="rounded-full border-transparent bg-[#FFF4E8]/7 px-4 text-[#FFF4E8]/70 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
          >
            Open
          </Button>
        </div>
      </div>
    </article>
  );
}

export function DiggingWorkspaceFrame({
  initialQuery = "",
  selectedRecord,
  onSelectRecord,
  showRestrictedData = false,
  allowPressingProof = false,
}: {
  initialQuery?: string;
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: SelectedRecord | null) => void;
  showRestrictedData?: boolean;
  allowPressingProof?: boolean;
}) {
  const [records, setRecords] = useState<CollectionRecord[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    return normalizeCollectionRecords(
      JSON.parse(window.localStorage.getItem(DIGGING_CACHE_KEY) ?? "[]"),
      showRestrictedData,
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
      showRestrictedData,
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
        showRestrictedData,
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

        const nextRecords = normalizeCollectionRecords(
          payload?.records,
          showRestrictedData,
        );
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
  }, [hasCachedRecordsAtLoad, showRestrictedData]);

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
              : sanitizeRestrictedCollectionData(record),
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
  }, [showRestrictedData]);

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

  function handleOpenInspector(record: CollectionRecord) {
    onSelectRecord(selectedRecordFromCollection(record));
  }

  function clearQuery() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div className="grid min-w-0 gap-5">
      {allowPressingProof ? (
        <PressingIdentificationWorkspace authenticated compact />
      ) : null}
    <section className="min-w-0" aria-label="Digging lookup">
      <div className="grid gap-5">
        <div className="min-w-0">
          <p className="text-right text-xs tabular-nums text-[#FFF4E8]/38">
            {sourceLabel} · {records.length.toLocaleString()} records
          </p>

          <div className="mt-2 rounded-xl bg-[#101014] p-3 sm:p-4">
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
                  Scan or search while you dig
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/42">
                  Owned, wanted, duplicates, and shelf location appear as you
                  type.
                </p>
                {records.length === 0 && showRestrictedData ? (
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
                <p className="px-1 text-lg font-semibold text-[#FFF4E8]">
                  {topMatch.record.status === "owned"
                    ? "You already own this."
                    : "This is already wanted."}
                </p>
              ) : null}

              {matches.map((match) => (
                <DiggingResultCard
                  key={match.record.id}
                  match={match}
                  isSelected={selectedRecord?.collectionId === match.record.id}
                  onOpenInspector={handleOpenInspector}
                  showRestrictedData={showRestrictedData}
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
                Not in your collection
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/42">
                Use Add vinyl to search Discogs, or import your collection.
              </p>
            </div>
          )}
        </div>

      </div>
    </section>
    </div>
  );
}
