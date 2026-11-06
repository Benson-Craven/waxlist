"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Disc3,
  GitCompare,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LabelBadge } from "@/components/ui/label-badge";
import {
  COLLECTION_AUDIT_CATEGORY_LABELS,
  COLLECTION_AUDIT_SEVERITY_LABELS,
  COLLECTION_AUDIT_TYPE_LABELS,
  buildCollectionHealth,
  type CollectionAuditFinding,
  type CollectionAuditFindingType,
  type CollectionAuditSeverity,
} from "@/lib/collection/health";
import {
  sanitizeRestrictedCollectionData,
  type CollectionRecord,
} from "@/lib/collection/record";
import { cn } from "@/lib/utils";
import {
  selectedRecordFromCollection,
  type SelectedRecord,
} from "@/lib/workspace/selected-record";

type CollectionPayload = {
  records?: unknown;
  error?: {
    message?: string;
  };
};

const COLLECTION_CACHE_KEY = "waxlist:digging:collection:v2";
const VISIBLE_RECORDS_PER_FINDING = 6;
const SEVERITY_FILTER_ORDER: CollectionAuditSeverity[] = [
  "high_attention",
  "review_recommended",
  "informational",
];
const TYPE_FILTER_OPTIONS: Array<{
  id: "all" | CollectionAuditFindingType;
  label: string;
}> = [
  { id: "all", label: "All findings" },
  ...Object.entries(COLLECTION_AUDIT_TYPE_LABELS).map(([id, label]) => ({
    id: id as CollectionAuditFindingType,
    label,
  })),
];

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

function writeCollectionCache(records: CollectionRecord[]) {
  try {
    window.localStorage.setItem(COLLECTION_CACHE_KEY, JSON.stringify(records));
  } catch {
    // Health can still render from the live response without browser cache.
  }
}

function formatPrice(record: CollectionRecord) {
  if (record.priceHintLabel) {
    return record.priceHintLabel;
  }

  if (typeof record.priceHintCents !== "number") {
    return "Price unavailable";
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: record.priceHintCurrency ?? "USD",
      maximumFractionDigits: 0,
    }).format(record.priceHintCents / 100);
  } catch {
    return `${(record.priceHintCents / 100).toFixed(0)} ${
      record.priceHintCurrency ?? ""
    }`.trim();
  }
}

function formatDate(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Date unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatDateTime(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Not checked yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function getHealthStateCopy(
  state: ReturnType<typeof buildCollectionHealth>["auditSummary"]["healthState"],
) {
  if (state === "healthy") {
    return {
      label: "Healthy",
      body: "Nothing needs your attention right now.",
      icon: CheckCircle2,
      panelClass: "bg-[#FFF4E8]/5",
      iconClass: "bg-[#FFF4E8]/10 text-[#FFF4E8]/68",
    };
  }

  if (state === "mostly_healthy") {
    return {
      label: "Mostly healthy",
      body: "A few tidy-up items. The collection is fine.",
      icon: ShieldCheck,
      panelClass: "bg-[#FFF4E8]/6",
      iconClass: "bg-[#FFF4E8]/10 text-[#FFF4E8]/68",
    };
  }

  return {
    label: "Needs attention",
    body: "A few things are worth a look before they cause confusion.",
    icon: AlertTriangle,
    panelClass: "bg-[#FFF4E8]/10",
    iconClass: "bg-[#FFF4E8]/16 text-[#FFF4E8]/86",
  };
}

function getSeverityPillTone(
  severity: CollectionAuditSeverity,
): "attention" | "neutral" | "quiet" {
  if (severity === "high_attention") {
    return "attention";
  }

  if (severity === "review_recommended") {
    return "neutral";
  }

  return "quiet";
}

function getFindingActionLabel(type: CollectionAuditFindingType) {
  switch (type) {
    case "exact_duplicate_release":
      return "Review copies";
    case "multiple_versions_master":
      return "Compare versions";
    case "missing_shelf_location":
      return "Group records";
    default:
      return "Review records";
  }
}

function recordMeta(record: CollectionRecord) {
  return `${record.artist} · Discogs #${record.discogsReleaseId}`;
}

function EmptyInline({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-[#FFF4E8]/4 px-3 py-4 text-xs leading-5 text-[#FFF4E8]/45">
      {children}
    </p>
  );
}

function VerdictMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[0.65rem] uppercase tracking-[0.18em] text-[#FFF4E8]/45">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums text-[#FFF4E8]">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function SeverityFilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-[#FFF4E8] text-[#08030f]"
          : "bg-[#FFF4E8]/7 text-[#FFF4E8]/64 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]",
      )}
    >
      {children}
      <span
        className={cn(
          "text-[0.65rem] tabular-nums",
          active ? "text-[#08030f]/55" : "text-[#FFF4E8]/34",
        )}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
}

function FindingRecordChip({
  record,
  selected,
  onSelect,
}: {
  record: CollectionRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={recordMeta(record)}
      aria-label={`${record.title} by ${record.artist}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition",
        selected
          ? "bg-[#FFF4E8] text-[#08030f]"
          : "bg-[#FFF4E8]/8 text-[#FFF4E8]/66 hover:bg-[#FFF4E8]/14 hover:text-[#FFF4E8]",
      )}
    >
      <span className="max-w-[14rem] truncate">{record.title}</span>
    </button>
  );
}

function FindingRow({
  finding,
  selectedRecord,
  onSelectRecord,
}: {
  finding: CollectionAuditFinding;
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: CollectionRecord) => void;
}) {
  const firstRecord = finding.records[0] ?? null;
  const isSelected = finding.records.some(
    (record) => selectedRecord?.collectionId === record.id,
  );
  const ActionIcon =
    finding.type === "multiple_versions_master" ? GitCompare : ArrowRight;
  const visibleRecords = finding.records.slice(0, VISIBLE_RECORDS_PER_FINDING);
  const hiddenRecordCount = finding.records.length - visibleRecords.length;

  return (
    <article
      className={cn(
        "rounded-2xl px-4 py-4 transition sm:px-5",
        isSelected ? "bg-[#FFF4E8]/10" : "bg-[#FFF4E8]/4",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <LabelBadge
              size="xs"
              tone={getSeverityPillTone(finding.severity)}
            >
              {COLLECTION_AUDIT_SEVERITY_LABELS[finding.severity]}
            </LabelBadge>
            <span className="text-xs text-[#FFF4E8]/42">
              {COLLECTION_AUDIT_CATEGORY_LABELS[finding.category]}
            </span>
          </div>

          <h3 className="mt-2 text-base font-semibold leading-snug text-[#FFF4E8]">
            {finding.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#FFF4E8]/56">
            {finding.explanation}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#FFF4E8]/40">
            {finding.evidence.join(" · ")}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {visibleRecords.map((record) => (
              <FindingRecordChip
                key={record.id}
                record={record}
                selected={selectedRecord?.collectionId === record.id}
                onSelect={() => onSelectRecord(record)}
              />
            ))}
            {hiddenRecordCount > 0 ? (
              <span className="px-1 text-xs text-[#FFF4E8]/42">
                +{hiddenRecordCount.toLocaleString()} more
              </span>
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          onClick={() => firstRecord && onSelectRecord(firstRecord)}
          disabled={!firstRecord}
          aria-label={`${getFindingActionLabel(finding.type)}: ${finding.title}`}
          variant="outline"
          className="shrink-0 rounded-full border-transparent bg-[#FFF4E8]/10 px-4 text-xs font-semibold text-[#FFF4E8]/86 hover:bg-[#FFF4E8]/16 hover:text-[#FFF4E8] disabled:opacity-45"
        >
          <ActionIcon className="size-3.5" aria-hidden="true" />
          {getFindingActionLabel(finding.type)}
        </Button>
      </div>
    </article>
  );
}

function InsightRecordRow({
  record,
  meta,
  selectedRecord,
  onSelectRecord,
}: {
  record: CollectionRecord;
  meta: string;
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: CollectionRecord) => void;
}) {
  const isSelected = selectedRecord?.collectionId === record.id;

  return (
    <button
      type="button"
      onClick={() => onSelectRecord(record)}
      className={cn(
        "-mx-2 flex w-full items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition",
        isSelected ? "bg-[#FFF4E8]/10" : "hover:bg-[#FFF4E8]/6",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm text-[#FFF4E8]/86">
          {record.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[#FFF4E8]/42">
          {record.artist}
        </span>
      </span>
      <span className="shrink-0 pt-0.5 text-xs text-[#FFF4E8]/42">{meta}</span>
    </button>
  );
}

function InsightColumn({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <span
        className="block h-px w-full bg-[#FFF4E8]/10"
        aria-hidden="true"
      />
      <div className="mt-3 flex items-center gap-2">
        <Icon className="size-4 text-[#FFF4E8]/42" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-[#FFF4E8]/86">{title}</h3>
        <span className="ml-auto text-xs tabular-nums text-[#FFF4E8]/38">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="mt-2 grid gap-0.5">{children}</div>
    </section>
  );
}

export function HealthWorkspaceFrame({
  selectedRecord,
  onSelectRecord,
  showRestrictedData = false,
}: {
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: SelectedRecord | null) => void;
  showRestrictedData?: boolean;
}) {
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] =
    useState<"all" | CollectionAuditFindingType>("all");
  const [severityFilter, setSeverityFilter] =
    useState<"all" | CollectionAuditSeverity>("all");
  const health = useMemo(() => buildCollectionHealth(records), [records]);
  const stateCopy = getHealthStateCopy(health.auditSummary.healthState);
  const StateIcon = stateCopy.icon;
  const missingLocationCount =
    health.auditFindings.find(
      (finding) => finding.type === "missing_shelf_location",
    )?.records.length ?? 0;
  const filteredFindings = useMemo(
    () =>
      health.auditFindings.filter((finding) => {
        const matchesType = typeFilter === "all" || finding.type === typeFilter;
        const matchesSeverity =
          severityFilter === "all" || finding.severity === severityFilter;

        return matchesType && matchesSeverity;
      }),
    [health.auditFindings, severityFilter, typeFilter],
  );
  const hasActiveFilter = typeFilter !== "all" || severityFilter !== "all";

  useEffect(() => {
    let isMounted = true;

    async function loadRecords() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/collection");
        const payload = await readCollectionResponse(response);
        const nextRecords = normalizeCollectionRecords(
          payload?.records,
          showRestrictedData,
        );

        if (!isMounted) {
          return;
        }

        setRecords(nextRecords);
        setIsUsingCache(false);
        writeCollectionCache(nextRecords);
      } catch (caught) {
        if (!isMounted) {
          return;
        }

        const cachedRecords = readCollectionCache(showRestrictedData);

        if (cachedRecords.length > 0) {
          setRecords(cachedRecords);
          setIsUsingCache(true);
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Collection health could not be loaded.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRecords();

    return () => {
      isMounted = false;
    };
  }, [showRestrictedData]);

  const selectRecord = (record: CollectionRecord) =>
    onSelectRecord(selectedRecordFromCollection(record));

  return (
    <section className="min-w-0 py-1" aria-label="Collection health">
      {error && records.length > 0 ? (
        <div className="mb-4 rounded-xl bg-[#F08A4B]/8 px-4 py-3 text-sm leading-6 text-[#FFD4B5]">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {isUsingCache ? "Using saved collection data" : "Health is unavailable"}
          </p>
          <p className="mt-1 text-[#FFF4E8]/56">{error}</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid min-h-[30rem] place-items-center">
          <p className="flex items-center gap-3 text-sm text-[#FFF4E8]/58">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Reading collection health
          </p>
        </div>
      ) : records.length === 0 ? (
        <div className="grid min-h-[30rem] place-items-center rounded-2xl bg-[#FFF4E8]/4 px-6 text-center">
          <div>
            {error ? (
              <>
                <AlertTriangle
                  className="mx-auto size-8 text-[#F08A4B]/60"
                  aria-hidden="true"
                />
                <p className="mt-4 text-sm font-medium text-[#FFF4E8]/72">
                  Health could not be checked
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/45">
                  {error}
                </p>
                <Button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-5 rounded-full bg-[#FFF4E8] px-5 text-[#08030f] hover:bg-[#f6dfc9]"
                >
                  Try again
                </Button>
              </>
            ) : (
              <>
                <Disc3
                  className="mx-auto size-8 text-[#FFF4E8]/28"
                  aria-hidden="true"
                />
                <p className="mt-4 text-sm font-medium text-[#FFF4E8]/72">
                  No collection to check yet
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/45">
                  Mark a few albums owned or wanted from a crate, then come back.
                </p>
                <Button
                  asChild
                  className="mt-5 rounded-full bg-[#FFF4E8] px-5 text-[#08030f] hover:bg-[#f6dfc9]"
                >
                  <Link href="/app?view=crate&source=spotify">
                    <Search className="size-4" aria-hidden="true" />
                    Build a crate
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-8">
          <section
            className={cn("rounded-2xl p-5 sm:p-6", stateCopy.panelClass)}
            aria-labelledby="health-verdict-heading"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    stateCopy.iconClass,
                  )}
                >
                  <StateIcon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="health-verdict-heading"
                    className="text-2xl font-semibold text-[#FFF4E8]"
                  >
                    {stateCopy.label}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[#FFF4E8]/62">
                    {stateCopy.body}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#FFF4E8]/42">
                    {pluralize(health.totalRecords, "record")} ·{" "}
                    {health.ownedCount.toLocaleString()} owned ·{" "}
                    {health.wantedCount.toLocaleString()} wanted
                  </p>
                </div>
              </div>

            </div>

            <div className="mt-6">
              <span
                className="block h-px w-full bg-[#FFF4E8]/10"
                aria-hidden="true"
              />
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                <VerdictMetric
                  label="Findings"
                  value={health.auditSummary.totalFindings}
                />
                <VerdictMetric
                  label="High attention"
                  value={
                    health.auditSummary.countsBySeverity.high_attention
                  }
                />
                <VerdictMetric
                  label="Duplicate releases"
                  value={health.duplicateGroups.length}
                />
                <VerdictMetric label="Unsorted" value={missingLocationCount} />
              </dl>
            </div>

            <p className="mt-5 text-xs leading-5 text-[#FFF4E8]/40">
              Checked {formatDateTime(health.auditSummary.lastCheckedAt)}.{" "}
              {health.auditSummary.remoteVerification.reason}
            </p>
          </section>

          {health.auditFindings.length > 0 ? (
            <section className="min-w-0" aria-labelledby="health-findings-heading">
              <h2
                id="health-findings-heading"
                className="text-lg font-semibold text-[#FFF4E8]"
              >
                What needs attention
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Filter findings by severity"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <SeverityFilterChip
                    active={severityFilter === "all"}
                    count={health.auditSummary.totalFindings}
                    onClick={() => setSeverityFilter("all")}
                  >
                    All
                  </SeverityFilterChip>
                  {SEVERITY_FILTER_ORDER.map((severity) => (
                    <SeverityFilterChip
                      key={severity}
                      active={severityFilter === severity}
                      count={health.auditSummary.countsBySeverity[severity]}
                      onClick={() => setSeverityFilter(severity)}
                    >
                      {COLLECTION_AUDIT_SEVERITY_LABELS[severity]}
                    </SeverityFilterChip>
                  ))}
                </div>

                <div className="ml-auto flex items-center gap-3">
                  {hasActiveFilter ? (
                    <span className="text-xs tabular-nums text-[#FFF4E8]/38">
                      {filteredFindings.length.toLocaleString()} shown
                    </span>
                  ) : null}
                  <label className="flex items-center gap-2 text-xs font-medium text-[#FFF4E8]/50">
                    <span className="sr-only">Filter findings by type</span>
                    <select
                      value={typeFilter}
                      onChange={(event) =>
                        setTypeFilter(
                          event.target.value as
                            | "all"
                            | CollectionAuditFindingType,
                        )
                      }
                      className="h-8 cursor-pointer rounded-full border border-transparent bg-[#1b1b20] px-3 text-sm text-[#FFF4E8]/78 transition hover:bg-[#24242a] hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#FFF4E8]/30"
                    >
                      {TYPE_FILTER_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {filteredFindings.length > 0 ? (
                  filteredFindings.map((finding) => (
                    <FindingRow
                      key={finding.id}
                      finding={finding}
                      selectedRecord={selectedRecord}
                      onSelectRecord={selectRecord}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl bg-[#FFF4E8]/4 px-4 py-6 text-center">
                    <p className="text-sm font-medium text-[#FFF4E8]/72">
                      No findings match these filters
                    </p>
                    <p className="mt-1 text-sm text-[#FFF4E8]/45">
                      Clear a filter to see the rest of the audit.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setTypeFilter("all");
                        setSeverityFilter("all");
                      }}
                      className="mt-3 rounded-full text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8]"
                    >
                      Clear filters
                    </Button>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <section className="min-w-0" aria-labelledby="health-more-heading">
            <h2
              id="health-more-heading"
              className="text-lg font-semibold text-[#FFF4E8]"
            >
              Worth a look
            </h2>

            <div className="mt-4 grid gap-6 sm:grid-cols-3">
              <InsightColumn
                title="Recently added"
                icon={Clock3}
                count={health.recentlyAddedRecords.length}
              >
                {health.recentlyAddedRecords.length > 0 ? (
                  health.recentlyAddedRecords.map((record) => (
                    <InsightRecordRow
                      key={record.id}
                      record={record}
                      meta={formatDate(record.createdAt)}
                      selectedRecord={selectedRecord}
                      onSelectRecord={selectRecord}
                    />
                  ))
                ) : (
                  <EmptyInline>No recent additions.</EmptyInline>
                )}
              </InsightColumn>

              <InsightColumn
                title="From artists you collect"
                icon={Sparkles}
                count={health.collectedArtistGapRecords.length}
              >
                {health.collectedArtistGapRecords.length > 0 ? (
                  health.collectedArtistGapRecords.map((record) => (
                    <InsightRecordRow
                      key={record.id}
                      record={record}
                      meta="Wanted"
                      selectedRecord={selectedRecord}
                      onSelectRecord={selectRecord}
                    />
                  ))
                ) : (
                  <EmptyInline>
                    No wanted albums from artists already on your shelf.
                  </EmptyInline>
                )}
              </InsightColumn>

              {showRestrictedData ? (
                <InsightColumn
                  title="High-value records"
                  icon={Trophy}
                  count={health.highValueRecords.length}
                >
                  {health.highValueRecords.length > 0 ? (
                    health.highValueRecords.map((record) => (
                      <InsightRecordRow
                        key={record.id}
                        record={record}
                        meta={formatPrice(record)}
                        selectedRecord={selectedRecord}
                        onSelectRecord={selectRecord}
                      />
                    ))
                  ) : (
                    <EmptyInline>No value data on these records yet.</EmptyInline>
                  )}
                </InsightColumn>
              ) : null}
            </div>

            <p className="mt-5 text-xs leading-5 text-[#FFF4E8]/38">
              {health.listeningRecency.reason}
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
