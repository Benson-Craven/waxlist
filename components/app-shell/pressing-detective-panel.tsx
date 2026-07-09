"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Disc3,
  ExternalLink,
  GitCompare,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CollectionRecord } from "@/lib/collection/record";
import {
  getPressingComparisonRows,
  rankPressingCandidates,
  selectNextPressingDiscriminator,
  type PressingCandidate,
  type PressingEvidence,
} from "@/lib/pressing-detective/matching";
import {
  SELECTED_RECORD_CHANGED_EVENT,
  selectedRecordFromCollection,
  type SelectedRecord,
} from "@/lib/workspace/selected-record";
import { cn } from "@/lib/utils";

type IdentifyCopyPayload = {
  identifyRun?: {
    masterId: number;
    sourceReleaseId: number | null;
    totalVersions: number;
    returnedVersions: number;
    maxVersionCandidates: number;
    detailFetchLimit: number;
    detailReleaseIds: number[];
    truncated: boolean;
    candidates: PressingCandidate[];
    failures: Array<{
      releaseId: number | null;
      error: {
        message?: string;
      };
    }>;
  };
  error?: {
    message?: string;
  };
};

type EvidenceDraft = {
  format: string;
  country: string;
  year: string;
  label: string;
  catalogNumber: string;
  barcode: string;
  matrixRunout: string;
  identifierText: string;
};

const EMPTY_EVIDENCE: EvidenceDraft = {
  format: "",
  country: "",
  year: "",
  label: "",
  catalogNumber: "",
  barcode: "",
  matrixRunout: "",
  identifierText: "",
};

function emitSelectedRecordChange(record: SelectedRecord | null) {
  window.dispatchEvent(
    new CustomEvent(SELECTED_RECORD_CHANGED_EVENT, {
      detail: record,
    }),
  );
}

function cleanString(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function firstValue(values: string[]) {
  return values.find((value) => value.trim().length > 0) ?? null;
}

function toEvidence(draft: EvidenceDraft): PressingEvidence {
  const parsedYear = Number.parseInt(draft.year, 10);

  return {
    format: cleanString(draft.format) || undefined,
    country: cleanString(draft.country) || undefined,
    year: Number.isInteger(parsedYear) && parsedYear > 0 ? parsedYear : null,
    label: cleanString(draft.label) || undefined,
    catalogNumber: cleanString(draft.catalogNumber) || undefined,
    barcode: cleanString(draft.barcode) || undefined,
    matrixRunout: cleanString(draft.matrixRunout) || undefined,
    identifierText: cleanString(draft.identifierText) || undefined,
  };
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

function formatCandidateMeta(candidate: PressingCandidate) {
  return [
    candidate.country,
    candidate.year,
    candidate.formats.slice(0, 2).join(", "),
    candidate.labels[0],
    candidate.catalogNumbers[0],
  ]
    .filter(Boolean)
    .join(" / ");
}

function getCandidateRecordPatch(candidate: PressingCandidate) {
  return {
    discogsReleaseId: candidate.id,
    discogsMasterId: candidate.masterId,
    artist: candidate.artist,
    title: candidate.title,
    format: candidate.formats,
    year: candidate.year,
    label: firstValue(candidate.labels),
    catalogNumber: firstValue(candidate.catalogNumbers),
    barcode: firstValue(candidate.barcodes),
    imageUrl: candidate.imageUrl,
  };
}

function selectedRecordFromCandidate(
  record: SelectedRecord,
  candidate: PressingCandidate,
): SelectedRecord {
  return {
    ...record,
    id: record.source === "collection" ? record.id : `crate:discogs:${candidate.id}`,
    discogsReleaseId: candidate.id,
    discogsMasterId: candidate.masterId ?? record.discogsMasterId,
    artist: candidate.artist ?? record.artist,
    title: candidate.title,
    format: candidate.formats,
    year: candidate.year,
    label: firstValue(candidate.labels),
    catalogNumber: firstValue(candidate.catalogNumbers),
    barcode: firstValue(candidate.barcodes),
    imageUrl: candidate.imageUrl ?? record.imageUrl,
    discogsUri: candidate.uri ?? `https://www.discogs.com/release/${candidate.id}`,
  };
}

export function PressingDetectivePanel({
  record,
  onRecordChange,
}: {
  record: SelectedRecord;
  onRecordChange: (record: SelectedRecord | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingCandidate, setIsSettingCandidate] = useState<number | null>(
    null,
  );
  const [evidenceDraft, setEvidenceDraft] =
    useState<EvidenceDraft>(EMPTY_EVIDENCE);
  const [candidates, setCandidates] = useState<PressingCandidate[]>([]);
  const [summary, setSummary] = useState<IdentifyCopyPayload["identifyRun"] | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const evidence = useMemo(() => toEvidence(evidenceDraft), [evidenceDraft]);
  const rankedCandidates = useMemo(
    () => rankPressingCandidates(candidates, evidence),
    [candidates, evidence],
  );
  const topCandidates = rankedCandidates.slice(0, 5);
  const comparisonCandidates = rankedCandidates
    .filter((candidate) => candidate.isViable)
    .slice(0, 3);
  const comparisonRows = getPressingComparisonRows(comparisonCandidates);
  const nextCheck = selectNextPressingDiscriminator(
    comparisonCandidates,
    evidence,
  );
  const hasNoViableMatches =
    rankedCandidates.length > 0 &&
    rankedCandidates.every((candidate) => !candidate.isViable);

  function updateEvidence(key: keyof EvidenceDraft, value: string) {
    setEvidenceDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function loadCandidates() {
    setIsOpen(true);
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/discogs/identify-copy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          releaseId: record.discogsReleaseId,
          masterId: record.discogsMasterId,
          evidence,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | IdentifyCopyPayload
        | null;

      if (!response.ok || !payload?.identifyRun) {
        throw new Error(
          payload?.error?.message ?? "Discogs versions could not be loaded.",
        );
      }

      setCandidates(payload.identifyRun.candidates);
      setSummary(payload.identifyRun);
      setMessage(
        payload.identifyRun.failures.length > 0
          ? "Some detailed Discogs identifiers could not load, so WAXLIST is keeping uncertainty visible."
          : "Candidate releases loaded.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Discogs versions could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSetCandidate(candidate: PressingCandidate) {
    setIsSettingCandidate(candidate.id);
    setMessage(null);

    try {
      let nextRecord = selectedRecordFromCandidate(record, candidate);

      if (record.collectionId) {
        const response = await fetch(`/api/collection/${record.collectionId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(getCandidateRecordPatch(candidate)),
        });
        const payload = (await response.json().catch(() => null)) as
          | { record?: unknown; error?: { message?: string } }
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ?? "Collection record could not be updated.",
          );
        }

        if (isCollectionRecord(payload?.record)) {
          nextRecord = selectedRecordFromCollection(payload.record);
        }
      }

      onRecordChange(nextRecord);
      emitSelectedRecordChange(nextRecord);
      setMessage(
        record.collectionId
          ? "Collection record updated to this exact Discogs release."
          : "Exact release loaded in the inspector.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Exact release could not be applied.",
      );
    } finally {
      setIsSettingCandidate(null);
    }
  }

  return (
    <section
      className="mt-4 rounded-xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/5 p-3"
      aria-labelledby="pressing-detective-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#FFF4E8]/48">
            <Search className="size-3.5" aria-hidden="true" />
            <p className="text-xs uppercase tracking-[0.2em]">
              Identify copy
            </p>
          </div>
          <h3
            id="pressing-detective-heading"
            className="mt-2 text-sm font-semibold text-[#FFF4E8]"
          >
            Pressing Detective
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#FFF4E8]/54">
            Narrow Discogs versions using the physical details in your hand.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            if (!isOpen || candidates.length === 0) {
              void loadCandidates();
            } else {
              setIsOpen((current) => !current);
            }
          }}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="rounded-full border-[#FFF4E8]/12 bg-[#FFF4E8]/8 text-[#FFF4E8]/76 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Disc3 className="size-3.5" aria-hidden="true" />
          )}
          {isOpen ? "Hide" : "Start"}
        </Button>
      </div>

      {isOpen ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
              Format
              <Input
                value={evidenceDraft.format}
                onChange={(event) => updateEvidence("format", event.target.value)}
                placeholder="LP, 12 inch, repress"
                className="h-9 rounded-lg border-[#FFF4E8]/14 bg-[#05030A]/45 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/32 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
              Country
              <Input
                value={evidenceDraft.country}
                onChange={(event) => updateEvidence("country", event.target.value)}
                placeholder="UK, Germany, US"
                className="h-9 rounded-lg border-[#FFF4E8]/14 bg-[#05030A]/45 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/32 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
              Year
              <Input
                inputMode="numeric"
                value={evidenceDraft.year}
                onChange={(event) => updateEvidence("year", event.target.value)}
                placeholder="1979"
                className="h-9 rounded-lg border-[#FFF4E8]/14 bg-[#05030A]/45 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/32 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
              Label
              <Input
                value={evidenceDraft.label}
                onChange={(event) => updateEvidence("label", event.target.value)}
                placeholder="Island, Blue Note"
                className="h-9 rounded-lg border-[#FFF4E8]/14 bg-[#05030A]/45 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/32 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
              Catalogue number
              <Input
                value={evidenceDraft.catalogNumber}
                onChange={(event) =>
                  updateEvidence("catalogNumber", event.target.value)
                }
                placeholder="ILPS 9103"
                className="h-9 rounded-lg border-[#FFF4E8]/14 bg-[#05030A]/45 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/32 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
              Barcode
              <Input
                value={evidenceDraft.barcode}
                onChange={(event) => updateEvidence("barcode", event.target.value)}
                placeholder="0 12345 67890 5"
                className="h-9 rounded-lg border-[#FFF4E8]/14 bg-[#05030A]/45 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/32 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
            Matrix/runout
            <textarea
              value={evidenceDraft.matrixRunout}
              onChange={(event) =>
                updateEvidence("matrixRunout", event.target.value)
              }
              rows={2}
              placeholder="Side A / dead wax text"
              className="resize-none rounded-lg border border-[#FFF4E8]/14 bg-[#05030A]/45 px-3 py-2 text-sm text-[#FFF4E8] outline-none placeholder:text-[#FFF4E8]/32 focus:border-[#FFF4E8]/30"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
            Other identifier text
            <Input
              value={evidenceDraft.identifierText}
              onChange={(event) =>
                updateEvidence("identifierText", event.target.value)
              }
              placeholder="Pressing plant, mastering mark, label note"
              className="h-9 rounded-lg border-[#FFF4E8]/14 bg-[#05030A]/45 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/32 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
            />
          </label>

          <Button
            type="button"
            onClick={() => void loadCandidates()}
            disabled={isLoading}
            variant="outline"
            className="rounded-full border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/76 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Refresh candidate details
          </Button>

          {summary ? (
            <p className="rounded-lg border border-[#FFF4E8]/8 bg-[#05030A]/40 px-3 py-2 text-xs leading-5 text-[#FFF4E8]/48">
              Loaded {summary.returnedVersions.toLocaleString()} of{" "}
              {summary.totalVersions.toLocaleString()} Discogs versions. Detailed
              identifiers loaded for{" "}
              {summary.detailReleaseIds.length.toLocaleString()} candidates.
              {summary.truncated
                ? ` The first ${summary.maxVersionCandidates.toLocaleString()} versions are shown for this MVP.`
                : ""}
            </p>
          ) : null}

          {hasNoViableMatches ? (
            <div className="rounded-xl border border-[#D34278]/20 bg-[#D34278]/8 p-3 text-xs leading-5 text-[#FFD7E4]">
              No candidate currently matches the hard evidence. Try removing a
              barcode or catalogue-number value if it may have been mistyped.
            </div>
          ) : null}

          {nextCheck ? (
            <div className="rounded-xl border border-[#F08A4B]/22 bg-[#F08A4B]/8 p-3">
              <div className="flex items-center gap-2 text-[#FFE1C7]">
                <Lightbulb className="size-4" aria-hidden="true" />
                <p className="text-sm font-semibold">{nextCheck.title}</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#FFE1C7]/72">
                {nextCheck.description}
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-[#FFE1C7]/62">
                {nextCheck.examples.map((example) => (
                  <li key={example.candidateId}>
                    <span className="font-medium text-[#FFE1C7]/86">
                      #{example.candidateId}
                    </span>
                    : {example.value}
                  </li>
                ))}
              </ul>
            </div>
          ) : rankedCandidates.length > 1 ? (
            <div className="rounded-xl border border-[#FFF4E8]/10 bg-[#05030A]/36 p-3 text-xs leading-5 text-[#FFF4E8]/52">
              WAXLIST does not see a useful next discriminator in the loaded
              metadata yet.
            </div>
          ) : null}

          {topCandidates.length > 0 ? (
            <div className="grid gap-2">
              {topCandidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className={cn(
                    "rounded-xl border p-3",
                    candidate.isViable
                      ? "border-[#FFF4E8]/10 bg-[#05030A]/42"
                      : "border-[#D34278]/18 bg-[#D34278]/7",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#FFF4E8]/38">
                        Discogs #{candidate.id}
                      </p>
                      <h4 className="mt-1 text-sm font-semibold text-[#FFF4E8]">
                        {candidate.title}
                      </h4>
                      {formatCandidateMeta(candidate) ? (
                        <p className="mt-1 text-xs leading-5 text-[#FFF4E8]/50">
                          {formatCandidateMeta(candidate)}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-1 text-[0.68rem]",
                        candidate.confidenceState === "Strong match"
                          ? "border-[#1DB954]/24 bg-[#1DB954]/10 text-[#C8F7D8]"
                          : candidate.confidenceState === "Likely match"
                            ? "border-[#F08A4B]/24 bg-[#F08A4B]/10 text-[#FFE1C7]"
                            : candidate.isViable
                              ? "border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/62"
                              : "border-[#D34278]/24 bg-[#D34278]/10 text-[#FFD7E4]",
                      )}
                    >
                      {candidate.isViable
                        ? candidate.confidenceState
                        : "Conflicting evidence"}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs leading-5">
                    {candidate.matchedSignals.slice(0, 3).map((signal) => (
                      <p key={signal} className="flex gap-2 text-[#C8F7D8]/78">
                        <CheckCircle2
                          className="mt-0.5 size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {signal}
                      </p>
                    ))}
                    {candidate.conflictingSignals.slice(0, 2).map((signal) => (
                      <p key={signal} className="flex gap-2 text-[#FFD7E4]/78">
                        <AlertTriangle
                          className="mt-0.5 size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {signal}
                      </p>
                    ))}
                    {candidate.missingSignals.slice(0, 2).map((signal) => (
                      <p key={signal} className="text-[#FFF4E8]/42">
                        {signal}
                      </p>
                    ))}
                    {candidate.matchedSignals.length === 0 &&
                    candidate.conflictingSignals.length === 0 ? (
                      <p className="text-[#FFF4E8]/42">
                        Add physical evidence to rank this candidate.
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row xl:flex-col">
                    <Button
                      type="button"
                      onClick={() => void handleSetCandidate(candidate)}
                      disabled={isSettingCandidate === candidate.id}
                      className="rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
                    >
                      {isSettingCandidate === candidate.id ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                      )}
                      Set as my copy
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-full border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/76 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
                    >
                      <a
                        href={
                          candidate.uri ??
                          `https://www.discogs.com/release/${candidate.id}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open release
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : candidates.length === 0 && !isLoading ? (
            <div className="rounded-xl border border-dashed border-[#FFF4E8]/12 bg-[#05030A]/36 p-4 text-center text-xs leading-5 text-[#FFF4E8]/50">
              Load candidate versions to begin identifying this copy.
            </div>
          ) : null}

          {comparisonRows.length > 0 ? (
            <div className="rounded-xl border border-[#FFF4E8]/10 bg-[#05030A]/36 p-3">
              <div className="flex items-center gap-2 text-[#FFF4E8]/62">
                <GitCompare className="size-4" aria-hidden="true" />
                <p className="text-sm font-semibold text-[#FFF4E8]">
                  Compare remaining candidates
                </p>
              </div>
              <div className="mt-3 grid gap-2">
                {comparisonRows.slice(0, 6).map((row) => (
                  <div
                    key={row.field}
                    className="rounded-lg border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 p-2"
                  >
                    <p className="text-xs font-medium text-[#FFF4E8]/72">
                      {row.label}
                    </p>
                    <div className="mt-2 grid gap-1.5">
                      {row.values.map((value) => (
                        <p
                          key={`${row.field}:${value.candidateId}`}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs leading-5",
                            value.differs
                              ? "bg-[#F08A4B]/10 text-[#FFE1C7]"
                              : "bg-[#FFF4E8]/5 text-[#FFF4E8]/48",
                          )}
                        >
                          <span className="font-medium">
                            #{value.candidateId}
                          </span>
                          : {value.value}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {message ? (
            <p className="text-xs leading-5 text-[#FFF4E8]/56" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
