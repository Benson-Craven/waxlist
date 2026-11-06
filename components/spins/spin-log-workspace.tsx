"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  Disc3,
  Flame,
  History,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelBadge } from "@/components/ui/label-badge";
import { ShelfLocationSummary } from "@/components/shelf/shelf-location";
import type { CollectionRecord } from "@/lib/collection/record";
import {
  selectedRecordFromCollection,
  type SelectedRecord,
} from "@/lib/workspace/selected-record";
import {
  SPIN_NOTE_MAX_LENGTH,
  SPIN_SIDES,
  buildSpinStats,
  buildSpinSuggestions,
  formatSpinTime,
  groupSpinsByDay,
  type SpinLogEntry,
  type SpinSide,
} from "@/lib/spins/record";
import { cn } from "@/lib/utils";

type SpinsPayload = {
  spins?: unknown;
  error?: {
    message?: string;
  };
};

type SpinPayload = {
  spin?: unknown;
  error?: {
    message?: string;
  };
};

type CollectionPayload = {
  records?: unknown;
  error?: {
    message?: string;
  };
};

const SIDE_OPTIONS: Array<{ value: SpinSide | null; label: string }> = [
  { value: null, label: "Full album" },
  ...SPIN_SIDES.map((side) => ({ value: side, label: side })),
];

function isSpinLogEntry(value: unknown): value is SpinLogEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<SpinLogEntry>;

  return (
    typeof entry.id === "string" &&
    typeof entry.collectionItemId === "string" &&
    typeof entry.spunAt === "string" &&
    (entry.side === null ||
      entry.side === undefined ||
      typeof entry.side === "string") &&
    (entry.note === null || entry.note === undefined || typeof entry.note === "string")
  );
}

function normalizeSpinEntries(value: unknown): SpinLogEntry[] {
  return Array.isArray(value) ? value.filter(isSpinLogEntry) : [];
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

function normalizeCollectionRecords(value: unknown): CollectionRecord[] {
  return Array.isArray(value) ? value.filter(isCollectionRecord) : [];
}

function recordSearchText(record: CollectionRecord) {
  return [
    record.artist,
    record.title,
    record.label,
    record.catalogNumber,
    record.barcode,
    record.year,
    ...record.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function relativeSpinDayLabel(daysSinceLastSpin: number | null) {
  if (daysSinceLastSpin === null) {
    return "Never spun";
  }

  if (daysSinceLastSpin === 0) {
    return "Spun today";
  }

  if (daysSinceLastSpin === 1) {
    return "Last spun yesterday";
  }

  return `Last spun ${daysSinceLastSpin} days ago`;
}

function SpinStatsGrid({
  totalSpins,
  spinsLast7Days,
  uniqueRecords,
  currentStreakDays,
}: {
  totalSpins: number;
  spinsLast7Days: number;
  uniqueRecords: number;
  currentStreakDays: number;
}) {
  const cards = [
    {
      id: "total",
      label: "Spins logged",
      value: totalSpins,
      icon: History,
    },
    {
      id: "week",
      label: "Last 7 days",
      value: spinsLast7Days,
      icon: CalendarDays,
    },
    {
      id: "records",
      label: "Records spun",
      value: uniqueRecords,
      icon: Disc3,
    },
    {
      id: "streak",
      label: "Day streak",
      value: currentStreakDays,
      icon: Flame,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.id}
            className="rounded-xl border border-[#FFF4E8]/9 bg-[#101014] p-3"
          >
            <dt className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-[#FFF4E8]/42">
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              {card.label}
            </dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-[#FFF4E8]">
              {card.value.toLocaleString()}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function SpinLogWorkspaceFrame({
  onSelectRecord,
}: {
  onSelectRecord?: (record: SelectedRecord | null) => void;
}) {
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [spins, setSpins] = useState<SpinLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [recordQuery, setRecordQuery] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    null,
  );
  const [side, setSide] = useState<SpinSide | null>(null);
  const [note, setNote] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSpinLog() {
      const [spinsResult, collectionResult] = await Promise.allSettled([
        fetch("/api/spins", { cache: "no-store" }),
        fetch("/api/collection", { cache: "no-store" }),
      ]);

      if (!isActive) {
        return;
      }

      if (spinsResult.status === "rejected") {
        setLoadError("Spin log could not be loaded. Try again.");
        setIsLoading(false);
        return;
      }

      const spinsPayload = (await spinsResult.value
        .json()
        .catch(() => null)) as SpinsPayload | null;

      if (!spinsResult.value.ok) {
        setLoadError(
          spinsPayload?.error?.message ?? "Spin log could not be loaded.",
        );
        setIsLoading(false);
        return;
      }

      setSpins(normalizeSpinEntries(spinsPayload?.spins));

      if (collectionResult.status === "rejected") {
        setCollectionError(
          "Collection records could not be loaded, so the record picker is unavailable.",
        );
      } else {
        const collectionPayload = (await collectionResult.value
          .json()
          .catch(() => null)) as CollectionPayload | null;

        if (collectionResult.value.ok) {
          setRecords(normalizeCollectionRecords(collectionPayload?.records));
        } else {
          setCollectionError(
            collectionPayload?.error?.message ??
              "Collection records could not be loaded, so the record picker is unavailable.",
          );
        }
      }

      setIsLoading(false);
    }

    void loadSpinLog();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => setNotice(null), 5000);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const ownedRecords = useMemo(
    () =>
      records
        .filter((record) => record.status === "owned")
        .sort((left, right) =>
          `${left.artist} ${left.title}`.localeCompare(
            `${right.artist} ${right.title}`,
          ),
        ),
    [records],
  );
  const recordsById = useMemo(
    () => new Map(records.map((record) => [record.id, record])),
    [records],
  );
  const stats = useMemo(() => buildSpinStats(spins), [spins]);
  const groups = useMemo(() => groupSpinsByDay(spins), [spins]);
  const suggestions = useMemo(
    () => buildSpinSuggestions(ownedRecords, spins),
    [ownedRecords, spins],
  );
  const spunRecordIds = useMemo(
    () => new Set(spins.map((spin) => spin.collectionItemId)),
    [spins],
  );
  const neverSpunCount = ownedRecords.filter(
    (record) => !spunRecordIds.has(record.id),
  ).length;
  const selectedRecord = selectedRecordId
    ? recordsById.get(selectedRecordId) ?? null
    : null;
  const matchingRecords = useMemo(() => {
    const normalizedQuery = recordQuery.trim().toLowerCase();
    const matches = normalizedQuery
      ? ownedRecords.filter((record) =>
          recordSearchText(record).includes(normalizedQuery),
        )
      : ownedRecords;

    return matches.slice(0, normalizedQuery ? 8 : 5);
  }, [ownedRecords, recordQuery]);

  async function readSpinResponse(response: Response) {
    const payload = (await response.json().catch(() => null)) as
      | SpinPayload
      | null;

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Spin could not be saved.");
    }

    return isSpinLogEntry(payload?.spin) ? payload.spin : null;
  }

  async function logSpin(input: {
    collectionItemId: string;
    side: SpinSide | null;
    note: string | null;
  }) {
    if (isLogging) {
      return false;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setFormError("Logging a spin needs a connection. Try again when online.");
      return false;
    }

    setIsLogging(true);
    setFormError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/spins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionItemId: input.collectionItemId,
          side: input.side,
          note: input.note,
          spunAt: new Date().toISOString(),
        }),
      });
      const spin = await readSpinResponse(response);

      if (!spin) {
        throw new Error("Spin could not be saved.");
      }

      setSpins((currentSpins) => [spin, ...currentSpins]);

      const record = recordsById.get(spin.collectionItemId);
      setNotice(
        record
          ? `Logged ${record.artist} — ${record.title}.`
          : "Spin logged.",
      );

      return true;
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Spin could not be saved.",
      );
      return false;
    } finally {
      setIsLogging(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRecordId) {
      setFormError("Choose a record from your shelf first.");
      return;
    }

    const saved = await logSpin({
      collectionItemId: selectedRecordId,
      side,
      note,
    });

    if (saved) {
      setNote("");
    }
  }

  async function handleDelete(spin: SpinLogEntry) {
    if (pendingDeleteId) {
      return;
    }

    setPendingDeleteId(spin.id);
    setFormError(null);

    try {
      const response = await fetch(`/api/spins/${spin.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | SpinsPayload
          | null;

        throw new Error(
          payload?.error?.message ?? "Spin could not be removed.",
        );
      }

      setSpins((currentSpins) =>
        currentSpins.filter((entry) => entry.id !== spin.id),
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Spin could not be removed.",
      );
    } finally {
      setPendingDeleteId(null);
    }
  }

  if (isLoading) {
    return (
      <section
        className="rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48 p-6"
        aria-label="Spin log"
      >
        <div className="flex items-center gap-3 text-sm text-[#FFF4E8]/58">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading your spin log.
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section
        className="rounded-2xl border border-[#F08A4B]/24 bg-[#F08A4B]/8 p-6"
        aria-label="Spin log"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-[#F08A4B]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-semibold text-[#FFF4E8]">
              Spin log unavailable
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[#FFF4E8]/62">
              {loadError}
            </p>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
            >
              Try again
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 space-y-5 py-1" aria-label="Spin log">
      <div className="grid min-w-0 gap-5">
        <section
          className="min-w-0 rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48 p-5"
          aria-labelledby="log-a-spin-heading"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#F08A4B]/76">
                  Needle drop
                </p>
                <h2
                  id="log-a-spin-heading"
                  className="mt-2 text-xl font-semibold text-[#FFF4E8]"
                >
                  Log a spin
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[#FFF4E8]/56">
                  A diary for the records you own. Pick one, note the side,
                  keep the habit.
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-[#FFF4E8]/14 bg-[#FFF4E8]/7 text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
              >
                <Link href="/app?view=collection">
                  <Disc3 className="size-4" aria-hidden="true" />
                  Open collection
                </Link>
              </Button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="spin-record-search"
                  className="text-xs font-medium uppercase tracking-[0.16em] text-[#FFF4E8]/48"
                >
                  Record
                </label>

                {selectedRecord ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[#FFF4E8]/14 bg-[#FFF4E8]/7 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#FFF4E8]/14 bg-[#05030A]/56 text-[#FFF4E8]/72">
                        <Disc3 className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#FFF4E8]">
                          {selectedRecord.artist}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-[#FFF4E8]/58">
                          {selectedRecord.title}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedRecordId(null);
                        setRecordQuery("");
                      }}
                      className="shrink-0 rounded-full text-[#FFF4E8]/62 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8]"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/34"
                        aria-hidden="true"
                      />
                      <Input
                        id="spin-record-search"
                        value={recordQuery}
                        onChange={(event) =>
                          setRecordQuery(event.target.value)
                        }
                        placeholder="Search your shelf by artist, title, label, or barcode"
                        autoComplete="off"
                        className="h-10 rounded-xl border-transparent bg-[#160A24]/56 pl-9 text-sm text-[#FFF4E8] ring-1 ring-[#FFF4E8]/12 ring-inset placeholder:text-[#FFF4E8]/32 focus-visible:ring-2 focus-visible:ring-[#F08A4B]/60"
                      />
                    </div>

                    {collectionError ? (
                      <p className="mt-2 text-sm text-[#FFD4B5]">
                        {collectionError}
                      </p>
                    ) : ownedRecords.length === 0 ? (
                      <p className="mt-3 rounded-xl border border-dashed border-[#FFF4E8]/14 bg-[#FFF4E8]/4 px-3 py-4 text-sm text-[#FFF4E8]/56">
                        Add an owned record first.
                      </p>
                    ) : (
                      <div
                        className="mt-2 max-h-60 overflow-y-auto rounded-xl bg-[#0A0610]/72 ring-1 ring-[#FFF4E8]/8 ring-inset"
                        role="group"
                        aria-label="Owned records"
                      >
                        {matchingRecords.length > 0 ? (
                          matchingRecords.map((record) => (
                            <button
                              key={record.id}
                              type="button"
                              onClick={() => {
                                setSelectedRecordId(record.id);
                                setFormError(null);
                              }}
                              className="flex w-full items-center justify-between gap-3 border-b border-[#FFF4E8]/6 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-[#FFF4E8]/7 focus-visible:bg-[#FFF4E8]/7 focus-visible:outline-none"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-[#FFF4E8]">
                                  {record.artist}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-[#FFF4E8]/54">
                                  {record.title}
                                </span>
                              </span>
                              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.14em] text-[#FFF4E8]/30">
                                {record.year ?? "—"}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-4 text-sm text-[#FFF4E8]/50">
                            No owned record matches “{recordQuery.trim()}”.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#FFF4E8]/48">
                    Side played
                  </p>
                  <div
                    className="mt-2 flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Side played"
                  >
                    {SIDE_OPTIONS.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={side === option.value}
                        onClick={() => setSide(option.value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          side === option.value
                            ? "border-[#FFF4E8]/32 bg-[#FFF4E8] text-[#08030f]"
                            : "border-[#FFF4E8]/12 bg-[#FFF4E8]/5 text-[#FFF4E8]/62 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8]",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="spin-note"
                    className="text-xs font-medium uppercase tracking-[0.16em] text-[#FFF4E8]/48"
                  >
                    Note
                  </label>
                  <Input
                    id="spin-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={SPIN_NOTE_MAX_LENGTH}
                    placeholder="Sunday morning, side A, first press…"
                    className="mt-2 h-10 rounded-xl border-transparent bg-[#160A24]/56 text-sm text-[#FFF4E8] ring-1 ring-[#FFF4E8]/12 ring-inset placeholder:text-[#FFF4E8]/32 focus-visible:ring-2 focus-visible:ring-[#F08A4B]/60"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-sm" aria-live="polite">
                  {formError ? (
                    <p role="alert" className="text-[#FFD4B5]">
                      {formError}
                    </p>
                  ) : notice ? (
                    <p role="status" className="text-[#C8F7D8]">
                      {notice}
                    </p>
                  ) : (
                    <p className="text-[#FFF4E8]/42">
                      {ownedRecords.length > 0
                        ? `${ownedRecords.length.toLocaleString()} owned record${ownedRecords.length === 1 ? "" : "s"} ready to spin.`
                        : "Owned records appear here after import."}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={!selectedRecordId || isLogging}
                  className="rounded-full bg-[#FFF4E8] px-5 text-[#08030f] hover:bg-[#f6dfc9]"
                >
                  {isLogging ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Disc3 className="size-4" aria-hidden="true" />
                  )}
                  Log spin
                </Button>
              </div>
            </form>
          </section>

        <aside className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
          <section
            className="rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48 p-4"
            aria-labelledby="spin-stats-heading"
          >
            <h2
              id="spin-stats-heading"
              className="text-xs uppercase tracking-[0.22em] text-[#FFF4E8]/42"
            >
              At a glance
            </h2>
            <div className="mt-3">
              <SpinStatsGrid
                totalSpins={stats.totalSpins}
                spinsLast7Days={stats.spinsLast7Days}
                uniqueRecords={stats.uniqueRecords}
                currentStreakDays={stats.currentStreakDays}
              />
            </div>
          </section>

          <section
            className="rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48 p-4"
            aria-labelledby="spin-suggestions-heading"
          >
            <div className="flex items-center gap-2 text-[#F08A4B]/76">
              <Sparkles className="size-4" aria-hidden="true" />
              <h2
                id="spin-suggestions-heading"
                className="text-xs uppercase tracking-[0.22em]"
              >
                Worth another spin
              </h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#FFF4E8]/46">
              {neverSpunCount > 0
                ? `${neverSpunCount.toLocaleString()} owned record${neverSpunCount === 1 ? "" : "s"} ${neverSpunCount === 1 ? "has" : "have"} never had a turn.`
                : "Records that haven't had a spin in a week."}
            </p>

            {suggestions.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.record.id}
                    className="rounded-xl border border-[#FFF4E8]/8 bg-[#FFF4E8]/4 p-3"
                  >
                    <p className="truncate text-sm font-medium text-[#FFF4E8]">
                      {suggestion.record.artist}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#FFF4E8]/54">
                      {suggestion.record.title}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[0.68rem] uppercase tracking-[0.1em] text-[#FFF4E8]/34">
                        {relativeSpinDayLabel(suggestion.daysSinceLastSpin)}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isLogging}
                        onClick={() =>
                          logSpin({
                            collectionItemId: suggestion.record.id,
                            side: null,
                            note: null,
                          })
                        }
                        className="h-7 rounded-full border-[#FFF4E8]/14 bg-[#FFF4E8]/6 text-xs text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
                      >
                        Log
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-[#FFF4E8]/12 px-3 py-4 text-xs leading-5 text-[#FFF4E8]/46">
                {ownedRecords.length === 0
                  ? "Add owned records and they'll show up here."
                  : "Everything's had a spin this week."}
              </p>
            )}
          </section>
        </aside>

        <section
          className="min-w-0 rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48"
          aria-labelledby="spin-timeline-heading"
        >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#FFF4E8]/8 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#FFF4E8]/42">
                  Listening diary
                </p>
                <h2
                  id="spin-timeline-heading"
                  className="mt-2 text-xl font-semibold text-[#FFF4E8]"
                >
                  Spin timeline
                </h2>
              </div>
              <p className="text-xs text-[#FFF4E8]/42">
                {stats.totalSpins.toLocaleString()} spin
                {stats.totalSpins === 1 ? "" : "s"} logged
              </p>
            </div>

            {groups.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <History
                  className="size-9 text-[#FFF4E8]/32"
                  aria-hidden="true"
                />
                <p className="mt-4 text-sm font-medium text-[#FFF4E8]">
                  Nothing spun yet
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/54">
                  Pick a record above and log the side. Your listening history
                  starts here.
                </p>
              </div>
            ) : (
              <div>
                {groups.map((group) => (
                  <section key={group.key} aria-label={group.label}>
                    <div className="flex items-baseline justify-between gap-3 border-b border-[#FFF4E8]/6 bg-[#FFF4E8]/4 px-5 py-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FFF4E8]/62">
                        {group.label}
                      </h3>
                      <p className="text-[0.68rem] uppercase tracking-[0.12em] text-[#FFF4E8]/32">
                        {group.spins.length} spin
                        {group.spins.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ol>
                      {group.spins.map((spin) => {
                        const record = recordsById.get(spin.collectionItemId);

                        const recordArtist =
                          record?.artist ??
                          (collectionError
                            ? "Record details unavailable"
                            : "Record removed");
                        const recordTitle =
                          record?.title ??
                          (collectionError
                            ? "Only the spin log could load"
                            : "No longer in collection");
                        const isDeleting = pendingDeleteId === spin.id;

                        return (
                          <li
                            key={spin.id}
                            className="border-b border-[#FFF4E8]/6 px-5 py-4 last:border-b-0"
                          >
                            <div className="flex gap-4">
                              <time
                                dateTime={spin.spunAt}
                                className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-[#FFF4E8]/36"
                              >
                                {formatSpinTime(spin.spunAt)}
                              </time>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-[#FFF4E8]">
                                    {recordArtist}
                                  </p>
                                  {spin.side ? (
                                    <LabelBadge size="xs" tone="quiet">
                                      Side {spin.side}
                                    </LabelBadge>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 text-sm text-[#FFF4E8]/66">
                                  {recordTitle}
                                </p>
                                {spin.note ? (
                                  <p className="mt-2 border-l border-[#FFF4E8]/14 pl-3 text-sm leading-6 text-[#FFF4E8]/56">
                                    {spin.note}
                                  </p>
                                ) : null}
                                {record ? (
                                  <p className="mt-2 text-xs text-[#FFF4E8]/38">
                                    <ShelfLocationSummary location={record} />
                                  </p>
                                ) : null}
                                <div className="mt-3 flex flex-wrap items-center gap-1">
                                  {record && onSelectRecord ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onSelectRecord(
                                          selectedRecordFromCollection(record),
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-full border border-[#FFF4E8]/12 bg-[#FFF4E8]/5 px-3 py-1.5 text-xs font-medium text-[#FFF4E8]/62 transition hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8]"
                                    >
                                      <Disc3
                                        className="size-3.5"
                                        aria-hidden="true"
                                      />
                                      View record
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      logSpin({
                                        collectionItemId:
                                          spin.collectionItemId,
                                        side: spin.side,
                                        note: null,
                                      })
                                    }
                                    disabled={isLogging || record?.status !== "owned"}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[#FFF4E8]/12 bg-[#FFF4E8]/5 px-3 py-1.5 text-xs font-medium text-[#FFF4E8]/62 transition hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <RotateCcw
                                      className="size-3.5"
                                      aria-hidden="true"
                                    />
                                    Spin again
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(spin)}
                                    disabled={isDeleting}
                                    aria-label={`Remove spin of ${recordArtist} ${recordTitle}`.trim()}
                                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[#FFF4E8]/38 transition hover:bg-[#D34278]/12 hover:text-[#FFD7E4] disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {isDeleting ? (
                                      <Loader2
                                        className="size-3.5 animate-spin"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Trash2
                                        className="size-3.5"
                                        aria-hidden="true"
                                      />
                                    )}
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            )}
        </section>
      </div>
    </section>
  );
}
