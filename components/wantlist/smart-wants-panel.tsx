"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Disc3,
  Edit3,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getDefaultSmartWantRules,
  getSmartWantExclusionLabel,
  getSmartWantRuleSummary,
  normalizeSmartWant,
  normalizeSmartWantInput,
  type SmartWant,
  type SmartWantCandidateResult,
  type SmartWantExclusion,
  type SmartWantInput,
  type SmartWantRules,
} from "@/lib/wishlist/smart-want";
import type { SelectedRecord } from "@/lib/workspace/selected-record";

type SmartWantsPayload = {
  smartWants?: unknown;
  smartWant?: unknown;
  error?: {
    message?: string;
  };
};

type SmartWantCandidateRun = {
  smartWantId: string;
  masterReleaseId: number;
  totalVersions: number;
  returnedVersions: number;
  maxVersionCandidates: number;
  detailFetchLimit: number;
  truncated: boolean;
  preview: {
    total: number;
    matchCount: number;
    rejectedCount: number;
    unknownCount: number;
  };
  candidates: SmartWantCandidateResult[];
};

type SmartWantCandidatePayload = {
  candidateRun?: SmartWantCandidateRun;
  error?: {
    message?: string;
  };
};

type CandidateState =
  | {
      status: "idle";
      run: null;
      error: null;
    }
  | {
      status: "loading";
      run: SmartWantCandidateRun | null;
      error: null;
    }
  | {
      status: "loaded";
      run: SmartWantCandidateRun;
      error: null;
    }
  | {
      status: "error";
      run: SmartWantCandidateRun | null;
      error: string;
    };

type SmartWantDraft = {
  masterReleaseId: string;
  sourceReleaseId: string;
  artist: string;
  title: string;
  imageUrl: string;
  sourceUri: string;
  includeVinyl: boolean;
  countries: string;
  yearFrom: string;
  yearTo: string;
  excludedTags: SmartWantExclusion[];
  excludeOwned: boolean;
};

const EXCLUSIONS: SmartWantExclusion[] = [
  "picture_disc",
  "promo",
  "unofficial",
  "test_pressing",
  "box_set",
  "colored_vinyl",
];

const EMPTY_CANDIDATE_STATE: CandidateState = {
  status: "idle",
  run: null,
  error: null,
};

function normalizeSmartWants(value: unknown) {
  return Array.isArray(value)
    ? value
        .map(normalizeSmartWant)
        .filter((smartWant): smartWant is SmartWant => Boolean(smartWant))
    : [];
}

function readSmartWantResponse(response: Response) {
  return response.json().catch(() => null) as Promise<SmartWantsPayload | null>;
}

async function loadSmartWants() {
  const response = await fetch("/api/wishlist/smart-wants", {
    cache: "no-store",
  });
  const payload = await readSmartWantResponse(response);

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Smart Wants could not load.");
  }

  return normalizeSmartWants(payload?.smartWants);
}

async function saveSmartWant(input: SmartWantInput, smartWantId?: string) {
  const response = await fetch(
    smartWantId
      ? `/api/wishlist/smart-wants/${smartWantId}`
      : "/api/wishlist/smart-wants",
    {
      method: smartWantId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ smartWant: input }),
    },
  );
  const payload = await readSmartWantResponse(response);

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Smart Want could not save.");
  }

  const savedSmartWant = normalizeSmartWant(payload?.smartWant);

  if (!savedSmartWant) {
    throw new Error("Smart Want save returned invalid data.");
  }

  return savedSmartWant;
}

async function deleteSmartWant(smartWantId: string) {
  const response = await fetch(`/api/wishlist/smart-wants/${smartWantId}`, {
    method: "DELETE",
  });
  const payload = await readSmartWantResponse(response);

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Smart Want could not be deleted.");
  }
}

async function loadCandidateRun(smartWantId: string) {
  const response = await fetch(
    `/api/wishlist/smart-wants/${smartWantId}/candidates`,
    {
      cache: "no-store",
    },
  );
  const payload = (await response
    .json()
    .catch(() => null)) as SmartWantCandidatePayload | null;

  if (!response.ok || !payload?.candidateRun) {
    throw new Error(
      payload?.error?.message ?? "Smart Want candidates could not load.",
    );
  }

  return payload.candidateRun;
}

function draftFromSmartWant(smartWant: SmartWant | null): SmartWantDraft {
  const rules = smartWant?.rules ?? getDefaultSmartWantRules();

  return {
    masterReleaseId: smartWant ? String(smartWant.masterReleaseId) : "",
    sourceReleaseId: smartWant?.sourceReleaseId
      ? String(smartWant.sourceReleaseId)
      : "",
    artist: smartWant?.artist ?? "",
    title: smartWant?.title ?? "",
    imageUrl: smartWant?.imageUrl ?? "",
    sourceUri: smartWant?.sourceUri ?? "",
    includeVinyl:
      rules.formats.length === 0 ||
      rules.formats.some((format) => format.toLowerCase() === "vinyl"),
    countries: rules.countries.join(", "),
    yearFrom: rules.yearFrom ? String(rules.yearFrom) : "",
    yearTo: rules.yearTo ? String(rules.yearTo) : "",
    excludedTags: rules.excludedTags,
    excludeOwned: rules.excludeOwned,
  };
}

function draftFromSelectedRecord(record: SelectedRecord | null): SmartWantDraft {
  const draft = draftFromSmartWant(null);

  if (!record) {
    return draft;
  }

  return {
    ...draft,
    masterReleaseId: record.discogsMasterId ? String(record.discogsMasterId) : "",
    sourceReleaseId: String(record.discogsReleaseId),
    artist: record.artist,
    title: record.title,
    imageUrl: record.imageUrl ?? "",
    sourceUri:
      record.discogsUri ?? `https://www.discogs.com/release/${record.discogsReleaseId}`,
    includeVinyl:
      record.format.length === 0 ||
      record.format.some((format) => format.toLowerCase().includes("vinyl")),
  };
}

function positiveInteger(value: string) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function listFromText(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function draftToSmartWantInput(draft: SmartWantDraft) {
  const rules: SmartWantRules = {
    ...getDefaultSmartWantRules(),
    formats: draft.includeVinyl ? ["Vinyl"] : [],
    countries: listFromText(draft.countries),
    yearFrom: positiveInteger(draft.yearFrom),
    yearTo: positiveInteger(draft.yearTo),
    excludedTags: draft.excludedTags,
    excludeOwned: draft.excludeOwned,
  };
  const input = normalizeSmartWantInput({
    masterReleaseId: positiveInteger(draft.masterReleaseId),
    sourceReleaseId: positiveInteger(draft.sourceReleaseId),
    artist: draft.artist,
    title: draft.title,
    imageUrl: draft.imageUrl,
    sourceUri: draft.sourceUri,
    rules,
  });

  return input;
}

function formatCandidateMeta(result: SmartWantCandidateResult) {
  const candidate = result.candidate;

  return [
    candidate.year,
    candidate.country,
    candidate.formats.slice(0, 3).join(", "),
    candidate.labels[0],
    candidate.catalogNumbers[0],
  ]
    .filter(Boolean)
    .join(" / ");
}

function getStatusCopy(status: SmartWantCandidateResult["evaluation"]["status"]) {
  if (status === "match") {
    return {
      label: "Match",
      icon: CheckCircle2,
      className: "border-[#1DB954]/22 bg-[#1DB954]/10 text-[#C8F7D8]",
    };
  }

  if (status === "rejected") {
    return {
      label: "Rejected",
      icon: XCircle,
      className: "border-[#D34278]/24 bg-[#D34278]/10 text-[#FFD7E4]",
    };
  }

  return {
    label: "Unknown",
    icon: CircleHelp,
    className: "border-[#F08A4B]/24 bg-[#F08A4B]/10 text-[#FFE1C7]",
  };
}

function selectedRecordFromCandidate(
  smartWant: SmartWant,
  result: SmartWantCandidateResult,
): SelectedRecord {
  const candidate = result.candidate;

  return {
    source: "crate",
    id: `smart-want:${smartWant.id}:${candidate.id}`,
    collectionId: null,
    wishlistId: null,
    discogsReleaseId: candidate.id,
    discogsMasterId: candidate.masterId ?? smartWant.masterReleaseId,
    artist: candidate.artist ?? smartWant.artist,
    title: candidate.title,
    format: candidate.formats,
    year: candidate.year,
    label: candidate.labels[0] ?? null,
    catalogNumber: candidate.catalogNumbers[0] ?? null,
    barcode: null,
    imageUrl: candidate.imageUrl,
    mediaCondition: null,
    sleeveCondition: null,
    status: result.ownsExactRelease ? "owned" : null,
    tags: ["smart-want"],
    notes: null,
    room: null,
    unit: null,
    shelf: null,
    slot: null,
    priceHintLabel: null,
    discogsUri: candidate.uri ?? `https://www.discogs.com/release/${candidate.id}`,
    sourceContext: `Smart Want: ${smartWant.artist} - ${smartWant.title}`,
    savedAt: null,
    wishlistRecord: null,
  };
}

function SmartWantEditor({
  smartWant,
  selectedRecord,
  onCancel,
  onSaved,
}: {
  smartWant: SmartWant | null;
  selectedRecord: SelectedRecord | null;
  onCancel: () => void;
  onSaved: (smartWant: SmartWant) => void;
}) {
  const [draft, setDraft] = useState<SmartWantDraft>(
    smartWant ? draftFromSmartWant(smartWant) : draftFromSelectedRecord(selectedRecord),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canUseSelectedMaster = Boolean(selectedRecord?.discogsMasterId);

  function updateDraft<Key extends keyof SmartWantDraft>(
    key: Key,
    value: SmartWantDraft[Key],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
    setMessage(null);
  }

  function toggleExclusion(exclusion: SmartWantExclusion) {
    setDraft((current) => {
      const hasExclusion = current.excludedTags.includes(exclusion);

      return {
        ...current,
        excludedTags: hasExclusion
          ? current.excludedTags.filter((tag) => tag !== exclusion)
          : [...current.excludedTags, exclusion],
      };
    });
    setMessage(null);
  }

  function applySelectedRecord() {
    setDraft(draftFromSelectedRecord(selectedRecord));
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const input = draftToSmartWantInput(draft);

      if (!input) {
        throw new Error(
          "Master release id, artist, and album title are required.",
        );
      }

      const saved = await saveSmartWant(input, smartWant?.id);

      onSaved(saved);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Smart Want could not save.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const inputClasses =
    "h-10 rounded-lg border border-[#FFF4E8]/10 bg-[#101014] px-3 text-sm text-[#FFF4E8] outline-none transition placeholder:text-[#FFF4E8]/28 focus:border-[#FFF4E8]/24 focus:ring-2 focus:ring-[#FFF4E8]/8";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#FFF4E8]/10 bg-[#0f0f13] p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#FFF4E8]">
            {smartWant ? "Edit Smart Want" : "Create Smart Want"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#FFF4E8]/50">
            Define what counts as an acceptable version of one Discogs master.
            This does not replace exact-release wants.
          </p>
        </div>
        {!smartWant ? (
          <Button
            type="button"
            onClick={applySelectedRecord}
            disabled={!canUseSelectedMaster}
            variant="outline"
            className="rounded-full border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/76 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8] disabled:opacity-45"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Use selected record
          </Button>
        ) : null}
      </div>

      {!smartWant && selectedRecord && !canUseSelectedMaster ? (
        <p className="mt-3 rounded-lg border border-[#F08A4B]/20 bg-[#F08A4B]/8 px-3 py-2 text-xs leading-5 text-[#FFE1C7]">
          The selected record does not include a Discogs master id, so enter a
          master release id manually.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/58">
          Master release id
          <Input
            value={draft.masterReleaseId}
            onChange={(event) =>
              updateDraft("masterReleaseId", event.target.value)
            }
            inputMode="numeric"
            placeholder="Discogs master id"
            className={inputClasses}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/58">
          Artist
          <Input
            value={draft.artist}
            onChange={(event) => updateDraft("artist", event.target.value)}
            placeholder="Fleetwood Mac"
            className={inputClasses}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/58 md:col-span-2">
          Album / master title
          <Input
            value={draft.title}
            onChange={(event) => updateDraft("title", event.target.value)}
            placeholder="Rumours"
            className={inputClasses}
          />
        </label>
      </div>

      <fieldset className="mt-5 rounded-xl border border-[#FFF4E8]/8 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#FFF4E8]/44">
          I want this album
        </legend>
        <label className="mt-1 flex items-start gap-3 text-sm text-[#FFF4E8]/70">
          <input
            type="checkbox"
            checked={draft.includeVinyl}
            onChange={(event) =>
              updateDraft("includeVinyl", event.target.checked)
            }
            className="mt-1"
          />
          <span>
            Vinyl versions
            <span className="mt-1 block text-xs leading-5 text-[#FFF4E8]/42">
              Leave enabled for the default &quot;any vinyl version&quot; Smart Want.
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm text-[#FFF4E8]/70">
          <input
            type="checkbox"
            checked={draft.excludeOwned}
            onChange={(event) =>
              updateDraft("excludeOwned", event.target.checked)
            }
            className="mt-1"
          />
          <span>
            Exclude exact releases I already own
            <span className="mt-1 block text-xs leading-5 text-[#FFF4E8]/42">
              Owning another version from the same master does not exclude this
              album-level want.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="mt-4 rounded-xl border border-[#FFF4E8]/8 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#FFF4E8]/44">
          Optional preferences
        </legend>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/58">
            Countries
            <Input
              value={draft.countries}
              onChange={(event) => updateDraft("countries", event.target.value)}
              placeholder="UK, Germany"
              className={inputClasses}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/58">
            Year from
            <Input
              value={draft.yearFrom}
              onChange={(event) => updateDraft("yearFrom", event.target.value)}
              inputMode="numeric"
              placeholder="1970"
              className={inputClasses}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/58">
            Year to
            <Input
              value={draft.yearTo}
              onChange={(event) => updateDraft("yearTo", event.target.value)}
              inputMode="numeric"
              placeholder="1989"
              className={inputClasses}
            />
          </label>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-[#FFF4E8]/58">Exclusions</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {EXCLUSIONS.map((exclusion) => (
              <label
                key={exclusion}
                className="flex items-center gap-2 rounded-lg border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 px-3 py-2 text-xs text-[#FFF4E8]/62"
              >
                <input
                  type="checkbox"
                  checked={draft.excludedTags.includes(exclusion)}
                  onChange={() => toggleExclusion(exclusion)}
                />
                No {getSmartWantExclusionLabel(exclusion)}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="rounded-full border-[#FFF4E8]/12 bg-transparent text-[#FFF4E8]/68 hover:bg-[#FFF4E8]/8 hover:text-[#FFF4E8]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save Smart Want
        </Button>
      </div>

      {message ? (
        <p className="mt-3 text-xs text-[#D34278]">{message}</p>
      ) : null}
    </form>
  );
}

function CandidateList({
  smartWant,
  state,
  onReload,
  onSelectRecord,
}: {
  smartWant: SmartWant;
  state: CandidateState;
  onReload: () => void;
  onSelectRecord: (record: SelectedRecord) => void;
}) {
  if (state.status === "idle") {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-[#FFF4E8]/12 bg-[#FFF4E8]/4 p-4 text-sm leading-6 text-[#FFF4E8]/54">
        Load candidate versions to preview deterministic matches, rejections,
        and unknowns from Discogs master-version summaries.
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="mt-4 grid min-h-32 place-items-center rounded-xl border border-[#FFF4E8]/8 bg-[#FFF4E8]/4 text-sm text-[#FFF4E8]/54">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading candidate versions
        </span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-4 rounded-xl border border-[#D34278]/24 bg-[#D34278]/8 p-4 text-sm leading-6 text-[#FFD7E4]">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p>{state.error}</p>
            <Button
              type="button"
              onClick={onReload}
              variant="outline"
              className="mt-3 h-9 rounded-full border-[#D34278]/24 bg-[#D34278]/8 px-4 text-xs text-[#FFD7E4] hover:bg-[#D34278]/14"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const run = state.run;
  const sortedCandidates = [...run.candidates].sort((left, right) => {
    const statusRank = { match: 0, unknown: 1, rejected: 2 };

    return (
      statusRank[left.evaluation.status] -
        statusRank[right.evaluation.status] || left.candidate.id - right.candidate.id
    );
  });

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 rounded-xl border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#FFF4E8]">
            {run.preview.matchCount.toLocaleString()} matching versions
          </p>
          <p className="mt-1 text-xs leading-5 text-[#FFF4E8]/48">
            {run.preview.unknownCount.toLocaleString()} unknown ·{" "}
            {run.preview.rejectedCount.toLocaleString()} rejected ·{" "}
            {run.returnedVersions.toLocaleString()} of{" "}
            {run.totalVersions.toLocaleString()} versions checked
            {run.truncated ? " in this bounded preview" : ""}
          </p>
        </div>
        <Button
          type="button"
          onClick={onReload}
          variant="outline"
          className="rounded-full border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {sortedCandidates.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-[#FFF4E8]/12 bg-[#FFF4E8]/4 p-5 text-center text-sm leading-6 text-[#FFF4E8]/54">
          No candidate versions were returned for this master release.
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {sortedCandidates.slice(0, 20).map((result) => {
            const status = getStatusCopy(result.evaluation.status);
            const StatusIcon = status.icon;

            return (
              <article
                key={result.candidate.id}
                className="rounded-xl border border-[#FFF4E8]/8 bg-[#121216] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                          status.className,
                        )}
                      >
                        <StatusIcon className="size-3.5" aria-hidden="true" />
                        {status.label}
                      </span>
                      {result.ownsExactRelease ? (
                        <span className="rounded-full border border-[#F08A4B]/20 bg-[#F08A4B]/8 px-2.5 py-1 text-xs text-[#FFE1C7]">
                          Exact owned
                        </span>
                      ) : result.ownsAnotherVersionFromMaster ? (
                        <span className="rounded-full border border-[#FFF4E8]/10 bg-[#FFF4E8]/6 px-2.5 py-1 text-xs text-[#FFF4E8]/52">
                          Another pressing owned
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-[#FFF4E8]">
                      {result.candidate.title}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[#FFF4E8]/48">
                      {formatCandidateMeta(result) || "Metadata sparse"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        onSelectRecord(
                          selectedRecordFromCandidate(smartWant, result),
                        )
                      }
                      variant="outline"
                      className="h-9 rounded-full border-transparent bg-[#1b1b20] px-4 text-xs font-semibold text-[#FFF4E8]/68 hover:bg-[#24242a] hover:text-[#FFF4E8]"
                    >
                      <Disc3 className="size-3.5" aria-hidden="true" />
                      Inspect
                    </Button>
                    {result.candidate.uri ? (
                      <Button
                        asChild
                        variant="outline"
                        className="h-9 rounded-full border-transparent bg-[#1b1b20] px-4 text-xs font-semibold text-[#FFF4E8]/68 hover:bg-[#24242a] hover:text-[#FFF4E8]"
                      >
                        <a
                          href={result.candidate.uri}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                          <ExternalLink
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-1.5 text-xs leading-5 text-[#FFF4E8]/52">
                  {result.evaluation.reasons.length > 0 ? (
                    result.evaluation.reasons.slice(0, 5).map((reason) => (
                      <p key={`${result.candidate.id}:${reason.code}`}>
                        <span className="font-medium text-[#FFF4E8]/72">
                          {reason.status === "matched"
                            ? "Matched"
                            : reason.status === "rejected"
                              ? "Rejected"
                              : "Unknown"}
                          :
                        </span>{" "}
                        {reason.message}
                      </p>
                    ))
                  ) : (
                    <p>No extra restrictions beyond this album-level want.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SmartWantsWorkspace({
  query,
  selectedRecord,
  onSelectRecord,
}: {
  query: string;
  selectedRecord: SelectedRecord | null;
  onSelectRecord: (record: SelectedRecord | null) => void;
}) {
  const [smartWants, setSmartWants] = useState<SmartWant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorSmartWant, setEditorSmartWant] = useState<SmartWant | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [candidateStates, setCandidateStates] = useState<
    Record<string, CandidateState>
  >({});
  const filteredSmartWants = useMemo(() => {
    const nextQuery = query.trim().toLowerCase();

    if (!nextQuery) {
      return smartWants;
    }

    return smartWants.filter((smartWant) =>
      [
        smartWant.artist,
        smartWant.title,
        smartWant.masterReleaseId,
        getSmartWantRuleSummary(smartWant.rules),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(nextQuery),
    );
  }, [query, smartWants]);
  const selectedCanSeed = Boolean(selectedRecord?.discogsMasterId);

  function upsertSmartWant(savedSmartWant: SmartWant) {
    setSmartWants((currentSmartWants) => {
      const hasSmartWant = currentSmartWants.some(
        (smartWant) => smartWant.id === savedSmartWant.id,
      );

      return hasSmartWant
        ? currentSmartWants.map((smartWant) =>
            smartWant.id === savedSmartWant.id ? savedSmartWant : smartWant,
          )
        : [savedSmartWant, ...currentSmartWants];
    });
    setEditorSmartWant(null);
    setIsCreating(false);
  }

  async function handleDelete(smartWant: SmartWant) {
    const confirmed = window.confirm(
      `Delete Smart Want for ${smartWant.artist} - ${smartWant.title}?`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteError(null);

    try {
      await deleteSmartWant(smartWant.id);
      setSmartWants((currentSmartWants) =>
        currentSmartWants.filter((entry) => entry.id !== smartWant.id),
      );
      setCandidateStates((currentStates) => {
        const nextStates = { ...currentStates };

        delete nextStates[smartWant.id];

        return nextStates;
      });
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Smart Want could not delete.",
      );
    }
  }

  async function handleLoadCandidates(smartWantId: string) {
    setCandidateStates((currentStates) => ({
      ...currentStates,
      [smartWantId]: {
        status: "loading",
        run: currentStates[smartWantId]?.run ?? null,
        error: null,
      },
    }));

    try {
      const run = await loadCandidateRun(smartWantId);

      setCandidateStates((currentStates) => ({
        ...currentStates,
        [smartWantId]: {
          status: "loaded",
          run,
          error: null,
        },
      }));
    } catch (error) {
      setCandidateStates((currentStates) => ({
        ...currentStates,
        [smartWantId]: {
          status: "error",
          run: currentStates[smartWantId]?.run ?? null,
          error:
            error instanceof Error
              ? error.message
              : "Smart Want candidates could not load.",
        },
      }));
    }
  }

  useEffect(() => {
    let isActive = true;

    loadSmartWants()
      .then((records) => {
        if (isActive) {
          setSmartWants(records);
        }
      })
      .catch((error) => {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : "Smart Wants could not load.",
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
  }, []);

  if (isCreating || editorSmartWant) {
    return (
      <SmartWantEditor
        smartWant={editorSmartWant}
        selectedRecord={selectedRecord}
        onCancel={() => {
          setEditorSmartWant(null);
          setIsCreating(false);
        }}
        onSaved={upsertSmartWant}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#FFF4E8]/48">
              <Sparkles className="size-4" aria-hidden="true" />
              <p className="text-xs uppercase tracking-[0.22em]">
                Flexible want rules
              </p>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-[#FFF4E8]">
              Smart Wants
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#FFF4E8]/56">
              Want an album but not one exact pressing? Save a master-level want
              and define which versions count as acceptable.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsCreating(true)}
            className="rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Create Smart Want
          </Button>
        </div>
        {selectedRecord ? (
          <p className="mt-3 rounded-lg border border-[#FFF4E8]/8 bg-[#05030A]/42 px-3 py-2 text-xs leading-5 text-[#FFF4E8]/48">
            Selected inspector record: {selectedRecord.artist} -{" "}
            {selectedRecord.title}
            {selectedCanSeed
              ? ` · master #${selectedRecord.discogsMasterId}`
              : " · no master id available"}
          </p>
        ) : null}
      </div>

      {deleteError ? (
        <div className="rounded-xl border border-[#D34278]/24 bg-[#D34278]/8 p-4 text-sm leading-6 text-[#FFD7E4]">
          {deleteError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-[#D34278]/24 bg-[#D34278]/8 p-4 text-sm leading-6 text-[#FFD7E4]">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid min-h-[28rem] place-items-center text-sm text-[#FFF4E8]/54">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading Smart Wants
          </span>
        </div>
      ) : filteredSmartWants.length === 0 ? (
        <div className="grid min-h-[28rem] place-items-center rounded-2xl border border-dashed border-[#FFF4E8]/12 bg-[#FFF4E8]/4 p-8 text-center">
          <div>
            <Sparkles
              className="mx-auto size-8 text-[#FFF4E8]/28"
              aria-hidden="true"
            />
            <p className="mt-5 text-sm font-medium text-[#FFF4E8]/72">
              {smartWants.length > 0
                ? "No Smart Wants found"
                : "No Smart Wants yet"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/44">
              {smartWants.length > 0
                ? "Adjust search to find a flexible want rule."
                : "Create an album-level want for any acceptable vinyl version, then add rules like country, year range, exclusions, and owned-release filtering."}
            </p>
          </div>
        </div>
      ) : (
        filteredSmartWants.map((smartWant) => {
          const state = candidateStates[smartWant.id] ?? EMPTY_CANDIDATE_STATE;

          return (
            <article
              key={smartWant.id}
              className="rounded-2xl border border-[#FFF4E8]/10 bg-[#0f0f13] p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#FFF4E8]/10 bg-[#160A24]">
                    {smartWant.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={smartWant.imageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <Disc3
                        className="size-6 text-[#FFF4E8]/38"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/40">
                      Master #{smartWant.masterReleaseId}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-[#FFF4E8]">
                      {smartWant.title}
                    </h3>
                    <p className="mt-1 text-sm text-[#FFF4E8]/58">
                      {smartWant.artist}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-[#FFF4E8]/50">
                      {getSmartWantRuleSummary(smartWant.rules)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button
                    type="button"
                    onClick={() => handleLoadCandidates(smartWant.id)}
                    disabled={state.status === "loading"}
                    variant="outline"
                    className="rounded-full border-transparent bg-[#1b1b20] px-4 text-xs font-semibold text-[#FFF4E8]/68 hover:bg-[#24242a] hover:text-[#FFF4E8]"
                  >
                    {state.status === "loading" ? (
                      <Loader2
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                    )}
                    Versions
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setEditorSmartWant(smartWant)}
                    variant="outline"
                    className="rounded-full border-transparent bg-[#1b1b20] px-4 text-xs font-semibold text-[#FFF4E8]/68 hover:bg-[#24242a] hover:text-[#FFF4E8]"
                  >
                    <Edit3 className="size-3.5" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleDelete(smartWant)}
                    variant="outline"
                    className="rounded-full border-[#D34278]/20 bg-[#D34278]/8 px-4 text-xs font-semibold text-[#FFD7E4] hover:bg-[#D34278]/14"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </div>
              <CandidateList
                smartWant={smartWant}
                state={state}
                onReload={() => handleLoadCandidates(smartWant.id)}
                onSelectRecord={onSelectRecord}
              />
            </article>
          );
        })
      )}
    </div>
  );
}
