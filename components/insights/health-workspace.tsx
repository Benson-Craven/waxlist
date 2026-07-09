"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Disc3,
  GitCompare,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  COLLECTION_AUDIT_CATEGORY_LABELS,
  COLLECTION_AUDIT_SEVERITY_LABELS,
  COLLECTION_AUDIT_TYPE_LABELS,
  buildCollectionHealth,
  type CollectionAuditFinding,
  type CollectionAuditFindingType,
  type CollectionAuditSeverity,
  type DuplicateRecordGroup,
} from "@/lib/collection/health";
import { formatCollectionLocation } from "@/lib/collection/location";
import type { CollectionRecord } from "@/lib/collection/record";
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

const COLLECTION_CACHE_KEY = "waxlist:digging:collection:v1";
const AUDIT_TYPE_FILTER_OPTIONS: Array<{
  id: "all" | CollectionAuditFindingType;
  label: string;
}> = [
  { id: "all", label: "All types" },
  ...Object.entries(COLLECTION_AUDIT_TYPE_LABELS).map(([id, label]) => ({
    id: id as CollectionAuditFindingType,
    label,
  })),
];
const AUDIT_SEVERITY_FILTER_OPTIONS: Array<{
  id: "all" | CollectionAuditSeverity;
  label: string;
}> = [
  { id: "all", label: "All severities" },
  ...Object.entries(COLLECTION_AUDIT_SEVERITY_LABELS).map(([id, label]) => ({
    id: id as CollectionAuditSeverity,
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

function readCollectionCache() {
  try {
    return normalizeCollectionRecords(
      JSON.parse(window.localStorage.getItem(COLLECTION_CACHE_KEY) ?? "[]"),
    );
  } catch {
    return [];
  }
}

function writeCollectionCache(records: CollectionRecord[]) {
  try {
    window.localStorage.setItem(COLLECTION_CACHE_KEY, JSON.stringify(records));
  } catch {
    // Insights can still render from the live response without browser cache.
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

function getHealthStateCopy(state: ReturnType<typeof buildCollectionHealth>["auditSummary"]["healthState"]) {
  if (state === "healthy") {
    return {
      label: "Healthy",
      body: "No collection integrity issues were found by the local checks currently available.",
      icon: CheckCircle2,
      tone: "border-[#1DB954]/22 bg-[#1DB954]/9 text-[#C8F7D8]",
    };
  }

  if (state === "mostly_healthy") {
    return {
      label: "Mostly healthy",
      body: "Only informational clean-up items were found. Your collection remains usable.",
      icon: ShieldCheck,
      tone: "border-[#F08A4B]/22 bg-[#F08A4B]/8 text-[#FFE1C7]",
    };
  }

  return {
    label: "Needs attention",
    body: "WAXLIST found review items that may affect duplicate, metadata, or identification confidence.",
    icon: AlertTriangle,
    tone: "border-[#D34278]/24 bg-[#D34278]/9 text-[#FFD7E4]",
  };
}

function getSeverityTone(severity: CollectionAuditSeverity) {
  if (severity === "high_attention") {
    return "border-[#D34278]/24 bg-[#D34278]/10 text-[#FFD7E4]";
  }

  if (severity === "review_recommended") {
    return "border-[#F08A4B]/24 bg-[#F08A4B]/10 text-[#FFE1C7]";
  }

  return "border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/62";
}

function formatRecordIssueMeta(record: CollectionRecord) {
  return [
    record.year,
    record.label,
    record.catalogNumber,
    record.mediaCondition ? `Media ${record.mediaCondition}` : null,
    record.sleeveCondition ? `Sleeve ${record.sleeveCondition}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#FFF4E8]/12 bg-[#FFF4E8]/4 p-5 text-sm">
      <p className="font-medium text-[#FFF4E8]/72">{title}</p>
      <p className="mt-2 leading-6 text-[#FFF4E8]/48">{body}</p>
      {href && cta ? (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#FFF4E8]/66 hover:text-[#FFF4E8]"
        >
          {cta}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-[#FFF4E8]/9 bg-[#101014] p-4">
      <dt className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold text-[#FFF4E8]">
        {value.toLocaleString()}
      </dd>
      <p className="mt-2 text-xs leading-5 text-[#FFF4E8]/42">{hint}</p>
    </div>
  );
}

function AuditStatePanel({
  health,
}: {
  health: ReturnType<typeof buildCollectionHealth>;
}) {
  const stateCopy = getHealthStateCopy(health.auditSummary.healthState);
  const Icon = stateCopy.icon;

  return (
    <section
      className={`rounded-2xl border p-5 ${stateCopy.tone}`}
      aria-labelledby="audit-state-heading"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="size-5" aria-hidden="true" />
            <p className="text-xs uppercase tracking-[0.22em]">
              Collection Health
            </p>
          </div>
          <h2
            id="audit-state-heading"
            className="mt-3 text-2xl font-semibold text-[#FFF4E8]"
          >
            {stateCopy.label}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#FFF4E8]/62">
            {stateCopy.body}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[26rem]">
          <div className="rounded-xl border border-current/12 bg-[#05030A]/24 p-3">
            <dt className="text-xs text-[#FFF4E8]/48">Findings</dt>
            <dd className="mt-1 text-xl font-semibold text-[#FFF4E8]">
              {health.auditSummary.totalFindings.toLocaleString()}
            </dd>
          </div>
          <div className="rounded-xl border border-current/12 bg-[#05030A]/24 p-3">
            <dt className="text-xs text-[#FFF4E8]/48">High attention</dt>
            <dd className="mt-1 text-xl font-semibold text-[#FFF4E8]">
              {health.auditSummary.countsBySeverity.high_attention.toLocaleString()}
            </dd>
          </div>
          <div className="rounded-xl border border-current/12 bg-[#05030A]/24 p-3">
            <dt className="text-xs text-[#FFF4E8]/48">Review</dt>
            <dd className="mt-1 text-xl font-semibold text-[#FFF4E8]">
              {health.auditSummary.countsBySeverity.review_recommended.toLocaleString()}
            </dd>
          </div>
          <div className="rounded-xl border border-current/12 bg-[#05030A]/24 p-3">
            <dt className="text-xs text-[#FFF4E8]/48">Last checked</dt>
            <dd className="mt-1 text-xs font-medium leading-5 text-[#FFF4E8]">
              {formatDateTime(health.auditSummary.lastCheckedAt)}
            </dd>
          </div>
        </dl>
      </div>
      <p className="mt-4 rounded-lg border border-current/10 bg-[#05030A]/20 px-3 py-2 text-xs leading-5 text-[#FFF4E8]/50">
        {health.auditSummary.remoteVerification.reason}
      </p>
    </section>
  );
}

function AuditFindingCard({
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
  const actionIcon =
    finding.type === "multiple_versions_master" ? GitCompare : ArrowRight;
  const ActionIcon = actionIcon;

  return (
    <article
      className={`rounded-2xl border p-4 ${
        isSelected
          ? "border-[#FFF4E8]/24 bg-[#FFF4E8]/9"
          : "border-[#FFF4E8]/10 bg-[#101014]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs ${getSeverityTone(
                finding.severity,
              )}`}
            >
              {COLLECTION_AUDIT_SEVERITY_LABELS[finding.severity]}
            </span>
            <span className="rounded-full border border-[#FFF4E8]/10 bg-[#FFF4E8]/6 px-2.5 py-1 text-xs text-[#FFF4E8]/56">
              {COLLECTION_AUDIT_CATEGORY_LABELS[finding.category]}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-[#FFF4E8]">
            {finding.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#FFF4E8]/60">
            {finding.explanation}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => firstRecord && onSelectRecord(firstRecord)}
          disabled={!firstRecord}
          className="rounded-full bg-[#FFF4E8] px-4 text-[#08030f] hover:bg-[#f6dfc9] disabled:opacity-45"
        >
          <ActionIcon className="size-4" aria-hidden="true" />
          {finding.suggestedAction}
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
            Evidence
          </p>
          <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-[#FFF4E8]/58">
            {finding.evidence.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#FFF4E8]/34" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
            Affected records
          </p>
          <div className="mt-2 grid gap-2">
            {finding.records.slice(0, 4).map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelectRecord(record)}
                className={`rounded-lg px-3 py-2 text-left transition ${
                  selectedRecord?.collectionId === record.id
                    ? "bg-[#FFF4E8]/12"
                    : "bg-[#FFF4E8]/5 hover:bg-[#FFF4E8]/8"
                }`}
              >
                <span className="block truncate text-sm font-medium text-[#FFF4E8]">
                  {record.title}
                </span>
                <span className="mt-1 block truncate text-xs text-[#FFF4E8]/48">
                  {record.artist} · Discogs #{record.discogsReleaseId}
                </span>
                {formatRecordIssueMeta(record) ? (
                  <span className="mt-1 block truncate text-xs text-[#FFF4E8]/42">
                    {formatRecordIssueMeta(record)}
                  </span>
                ) : null}
              </button>
            ))}
            {finding.records.length > 4 ? (
              <p className="text-xs text-[#FFF4E8]/42">
                +{(finding.records.length - 4).toLocaleString()} more affected
                records. Use the action above or filters in Collection to review
                the full set.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function RecordRow({
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
    <li>
      <button
        type="button"
        onClick={() => onSelectRecord(record)}
        className={`flex w-full items-start justify-between gap-4 rounded-lg px-3 py-3 text-left transition ${
          isSelected
            ? "bg-[#FFF4E8]/10"
            : "bg-[#FFF4E8]/5 hover:bg-[#FFF4E8]/8"
        }`}
      >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-[#FFF4E8]">
          {record.title}
        </span>
        <span className="mt-1 block truncate text-xs text-[#FFF4E8]/50">
          {record.artist}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs text-[#FFF4E8]/48">
        {meta}
      </span>
      </button>
    </li>
  );
}

function DuplicateRow({
  group,
  selectedRecord,
  onSelectRecord,
}: {
  group: DuplicateRecordGroup;
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: CollectionRecord) => void;
}) {
  const firstRecord = group.records[0];
  const isSelected = firstRecord
    ? selectedRecord?.collectionId === firstRecord.id
    : false;

  return (
    <li>
      <button
        type="button"
        onClick={() => firstRecord && onSelectRecord(firstRecord)}
        className={`w-full rounded-lg px-3 py-3 text-left transition ${
          isSelected
            ? "bg-[#FFF4E8]/10"
            : "bg-[#FFF4E8]/5 hover:bg-[#FFF4E8]/8"
        }`}
      >
      <div className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-[#FFF4E8]">
            {group.title}
          </span>
          <span className="mt-1 block truncate text-xs text-[#FFF4E8]/50">
            {group.artist} · Discogs #{group.releaseId}
          </span>
        </span>
        <span className="rounded-full border border-[#F08A4B]/18 bg-[#F08A4B]/10 px-2.5 py-1 text-xs text-[#FFD4B5]">
          {group.records.length} copies
        </span>
      </div>
      </button>
    </li>
  );
}

function InsightPanel({
  title,
  eyebrow,
  icon: Icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#FFF4E8]/10 bg-[#101014] p-4">
      <div className="flex items-center gap-2 text-[#FFF4E8]/48">
        <Icon className="size-4" aria-hidden="true" />
        <p className="text-xs uppercase tracking-[0.22em]">{eyebrow}</p>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-[#FFF4E8]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HealthWorkspaceFrame({
  selectedRecord,
  onSelectRecord,
}: {
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: SelectedRecord | null) => void;
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
  const missingLocationFinding = health.auditFindings.find(
    (finding) => finding.type === "missing_shelf_location",
  );
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

  useEffect(() => {
    let isMounted = true;

    async function loadRecords() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/collection");
        const payload = await readCollectionResponse(response);
        const nextRecords = normalizeCollectionRecords(payload?.records);

        if (!isMounted) {
          return;
        }

        setRecords(nextRecords);
        setIsUsingCache(false);
        writeCollectionCache(nextRecords);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const cachedRecords = readCollectionCache();

        if (cachedRecords.length > 0) {
          setRecords(cachedRecords);
          setIsUsingCache(true);
        }

        setError(
          error instanceof Error
            ? error.message
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
  }, []);

  return (
    <section className="min-w-0 py-1" aria-label="Collection health">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[#FFF4E8]/48">
          <BarChart3 className="size-4" aria-hidden="true" />
          <p className="text-xs uppercase tracking-[0.24em]">
            Collection health
          </p>
        </div>
        <Button
          asChild
          className="rounded-full bg-[#FFF4E8] px-5 text-[#08030f] hover:bg-[#f6dfc9]"
        >
          <Link href="/app?view=collection">
            <Search className="size-4" aria-hidden="true" />
            Open collection
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid min-h-[30rem] place-items-center rounded-2xl border border-[#FFF4E8]/10 bg-[#101014]">
          <p className="flex items-center gap-3 text-sm text-[#FFF4E8]/58">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Reading collection health
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {error ? (
            <div className="rounded-xl border border-[#F08A4B]/20 bg-[#F08A4B]/8 p-4 text-sm text-[#FFD4B5]">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {isUsingCache ? "Using cached collection data" : "Insights unavailable"}
              </p>
              <p className="mt-2 leading-6 text-[#FFF4E8]/56">{error}</p>
            </div>
          ) : null}

          <AuditStatePanel health={health} />

          {records.length > 0 ? (
            <section
              className="rounded-2xl border border-[#FFF4E8]/10 bg-[#101014] p-4"
              aria-labelledby="audit-findings-heading"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[#FFF4E8]/48">
                    <SlidersHorizontal className="size-4" aria-hidden="true" />
                    <p className="text-xs uppercase tracking-[0.22em]">
                      Audit findings
                    </p>
                  </div>
                  <h2
                    id="audit-findings-heading"
                    className="mt-3 text-lg font-semibold text-[#FFF4E8]"
                  >
                    Issues found
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#FFF4E8]/56">
                    Each finding explains what WAXLIST detected, why it was
                    surfaced, which records are affected, and the safest next
                    action.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[24rem]">
                  <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/56">
                    Finding type
                    <select
                      value={typeFilter}
                      onChange={(event) =>
                        setTypeFilter(
                          event.target.value as "all" | CollectionAuditFindingType,
                        )
                      }
                      className="h-10 rounded-lg border border-[#FFF4E8]/14 bg-[#120a1d] px-3 text-sm text-[#FFF4E8] outline-none focus:border-[#FFF4E8]/30"
                    >
                      {AUDIT_TYPE_FILTER_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/56">
                    Severity
                    <select
                      value={severityFilter}
                      onChange={(event) =>
                        setSeverityFilter(
                          event.target.value as "all" | CollectionAuditSeverity,
                        )
                      }
                      className="h-10 rounded-lg border border-[#FFF4E8]/14 bg-[#120a1d] px-3 text-sm text-[#FFF4E8] outline-none focus:border-[#FFF4E8]/30"
                    >
                      {AUDIT_SEVERITY_FILTER_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {filteredFindings.length > 0 ? (
                  filteredFindings.map((finding) => (
                    <AuditFindingCard
                      key={finding.id}
                      finding={finding}
                      selectedRecord={selectedRecord}
                      onSelectRecord={(record) =>
                        onSelectRecord(selectedRecordFromCollection(record))
                      }
                    />
                  ))
                ) : health.auditFindings.length > 0 ? (
                  <EmptyState
                    title="No findings match the current filters"
                    body="Reset the finding type or severity filter to review the rest of the audit."
                  />
                ) : (
                  <EmptyState
                    title="No integrity issues found"
                    body="The local checks currently available did not find duplicate release groups, multiple versions, missing condition data, missing shelf locations, or incomplete core metadata."
                  />
                )}
              </div>
            </section>
          ) : null}

          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Owned"
              value={health.ownedCount}
              hint="Records available for duplicate, shelf, and value checks."
            />
            <MetricCard
              label="Wanted"
              value={health.wantedCount}
              hint="Buying-intent records that can expose artist gaps."
            />
            <MetricCard
              label="Duplicates"
              value={health.duplicateGroups.length}
              hint="Owned Discogs releases with more than one copy."
            />
            <MetricCard
              label="Missing location"
              value={missingLocationFinding?.records.length ?? 0}
              hint="Owned records without room, unit, shelf, or slot."
            />
          </dl>

          {records.length === 0 ? (
            <EmptyState
              title="No collection data yet"
              body="Import Discogs records or seed saved wishlist records before the health dashboard can produce useful signals."
              href="/app?view=collection"
              cta="Start collection import"
            />
          ) : null}

          <div className="grid gap-5 xl:grid-cols-2">
            <InsightPanel
              eyebrow="Duplicate summary"
              title="Duplicate records"
              icon={Disc3}
            >
              {health.duplicateGroups.length > 0 ? (
                <ul className="grid gap-2">
                  {health.duplicateGroups.slice(0, 8).map((group) => (
                    <DuplicateRow
                      key={group.key}
                      group={group}
                      selectedRecord={selectedRecord}
                      onSelectRecord={(record) =>
                        onSelectRecord(selectedRecordFromCollection(record))
                      }
                    />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No duplicate copies found"
                  body="WAXLIST groups owned records by Discogs release id and flags releases with multiple owned copies."
                />
              )}
            </InsightPanel>

            <InsightPanel
              eyebrow="Highest median"
              title="High-value records"
              icon={Trophy}
            >
              {health.highValueRecords.length > 0 ? (
                <ul className="grid gap-2">
                  {health.highValueRecords.map((record) => (
                    <RecordRow
                      key={record.id}
                      record={record}
                      meta={formatPrice(record)}
                      selectedRecord={selectedRecord}
                      onSelectRecord={(record) =>
                        onSelectRecord(selectedRecordFromCollection(record))
                      }
                    />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No value data yet"
                  body="High-value records appear after Discogs import or matching provides price hints."
                />
              )}
            </InsightPanel>

            <InsightPanel
              eyebrow="Recent adds"
              title="Recently added"
              icon={Clock3}
            >
              {health.recentlyAddedRecords.length > 0 ? (
                <ul className="grid gap-2">
                  {health.recentlyAddedRecords.map((record) => (
                    <RecordRow
                      key={record.id}
                      record={record}
                      meta={formatDate(record.createdAt)}
                      selectedRecord={selectedRecord}
                      onSelectRecord={(record) =>
                        onSelectRecord(selectedRecordFromCollection(record))
                      }
                    />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No recent imports"
                  body="Records added within the recent health window will appear here."
                />
              )}
            </InsightPanel>

            <InsightPanel
              eyebrow="Shelf work"
              title="Missing location"
              icon={MapPin}
            >
              {health.missingLocationRecords.length > 0 ? (
                <ul className="grid gap-2">
                  {health.missingLocationRecords.map((record) => (
                    <RecordRow
                      key={record.id}
                      record={record}
                      meta={formatCollectionLocation(record) || "No shelf set"}
                      selectedRecord={selectedRecord}
                      onSelectRecord={(record) =>
                        onSelectRecord(selectedRecordFromCollection(record))
                      }
                    />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Owned records are located"
                  body="No owned record is currently missing room, unit, shelf, or slot data."
                  href="/app?view=shelf"
                  cta="Open shelf"
                />
              )}
            </InsightPanel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <InsightPanel
              eyebrow="Collection gaps"
              title="Missing albums from collected artists"
              icon={Sparkles}
            >
              {health.collectedArtistGapRecords.length > 0 ? (
                <ul className="grid gap-2">
                  {health.collectedArtistGapRecords.map((record) => (
                    <RecordRow
                      key={record.id}
                      record={record}
                      meta="Wanted"
                      selectedRecord={selectedRecord}
                      onSelectRecord={(record) =>
                        onSelectRecord(selectedRecordFromCollection(record))
                      }
                    />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No collected-artist gaps found"
                  body="Wanted records by artists already in your owned collection will appear here as missing shelf targets."
                />
              )}
            </InsightPanel>

            <InsightPanel
              eyebrow="Spotify inference"
              title="Listening freshness"
              icon={BarChart3}
            >
              <div className="grid gap-3">
                <EmptyState
                  title="Not-recently-listened is gated"
                  body={health.listeningRecency.reason}
                />
                <EmptyState
                  title="Streamed-artist gaps need history"
                  body={health.streamedArtistGaps.reason}
                />
              </div>
            </InsightPanel>
          </div>
        </div>
      )}
    </section>
  );
}
