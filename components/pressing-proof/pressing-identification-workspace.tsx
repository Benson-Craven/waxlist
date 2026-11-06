"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Disc3,
  ExternalLink,
  Loader2,
  PauseCircle,
  RotateCcw,
  Save,
  Search,
  ShieldQuestion,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelBadge } from "@/components/ui/label-badge";
import { usePressingBarcodeScanner } from "@/components/pressing-proof/use-pressing-barcode-scanner";
import type { PressingEvidence } from "@/lib/pressing-detective/matching";
import type {
  PressingResolution,
  PressingResolutionCandidate,
} from "@/lib/pressing-proof/resolution";
import { cn } from "@/lib/utils";

type SearchMode = "query" | "barcode" | "catalogNumber" | "discogsId";
type InputSource =
  | "camera_barcode"
  | "manual_barcode"
  | "manual_search"
  | "manual_discogs_id";

type PressingSeed = {
  id: number;
  masterId: number | null;
  title: string;
  year: number | null;
  formats: string[];
  country: string | null;
  labels: string[];
  catalogNumbers: string[];
  barcodes: string[];
  uri: string;
};

type SearchPayload = {
  search?: {
    candidates: PressingSeed[];
    totalItems: number;
    checkedAt: string;
    attribution: {
      label: string;
      url: string;
    };
  };
  error?: {
    message?: string;
  };
};

type CollectionOverlay = {
  releaseId: number;
  owned: boolean;
  wanted: boolean;
  duplicateCount: number;
};

type ResolutionPayload = {
  investigation?: {
    authenticated: boolean;
    previewId: string | null;
  };
  masterId?: number;
  seedReleaseId?: number | null;
  resolution?: PressingResolution;
  collectionOverlay?: CollectionOverlay[];
  checkedAt?: string;
  attribution?: {
    label: string;
    url: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type SavedInvestigation = {
  id: string;
  masterReleaseId: number | null;
  seedReleaseId: number | null;
  inputSource: InputSource;
  userEvidence: PressingEvidence;
  remainingCandidateIds: number[];
  status: "active" | "resolved" | "dismissed";
  resolutionKind: "exact" | "shortlist" | "unknown";
  resolvedReleaseId: number | null;
  updatedAt: string;
};

const SEARCH_MODES: Array<{
  id: SearchMode;
  label: string;
  placeholder: string;
}> = [
  {
    id: "query",
    label: "Artist or title",
    placeholder: "Artist and album title",
  },
  {
    id: "barcode",
    label: "Barcode",
    placeholder: "Type the barcode digits",
  },
  {
    id: "catalogNumber",
    label: "Catalogue no.",
    placeholder: "Label or spine catalogue number",
  },
  {
    id: "discogsId",
    label: "Discogs ID",
    placeholder: "Release ID or Discogs release URL",
  },
];

function inputSourceFor(mode: SearchMode): InputSource {
  if (mode === "barcode") return "manual_barcode";
  if (mode === "discogsId") return "manual_discogs_id";
  return "manual_search";
}

function discogsIdFrom(value: string) {
  const releaseMatch = value.match(/\/release\/(\d+)/i);
  return releaseMatch?.[1] ?? value.trim();
}

function seedMeta(seed: PressingSeed) {
  return [
    seed.country,
    seed.year,
    seed.formats.slice(0, 2).join(", "),
    seed.labels[0],
    seed.catalogNumbers[0],
  ]
    .filter(Boolean)
    .join(" / ");
}

function evidenceKeyForQuestion(field: string): keyof PressingEvidence {
  if (
    field === "pressingPlant" ||
    field === "masteringCredits" ||
    field === "identifiers"
  ) {
    return "identifierText";
  }

  return field as keyof PressingEvidence;
}

function resolutionCopy(resolution: PressingResolution) {
  if (resolution.kind === "exact") {
    return {
      eyebrow: "Exact",
      title: "One version fits the evidence.",
      body: "WAXLIST checked the whole family. One candidate matches everything you entered.",
      tone: "border-[#FFF4E8]/16 bg-[#FFF4E8]/8",
      icon: CheckCircle2,
    };
  }

  if (resolution.kind === "shortlist") {
    return {
      eyebrow: "Shortlist",
      title: `${resolution.remainingCandidates.length.toLocaleString()} viable versions remain.`,
      body: "The evidence narrows it down, but not to one pressing yet.",
      tone: "border-[#FFF4E8]/10 bg-[#FFF4E8]/5",
      icon: ShieldQuestion,
    };
  }

  return {
    eyebrow: "Unknown",
    title: "Not enough to prove this pressing.",
    body:
      resolution.reason === "comparison_incomplete"
        ? "Some version details are missing from the catalogue."
        : resolution.reason === "evidence_conflict"
          ? "Your evidence conflicts with every version here."
          : "The evidence can't narrow this family any further.",
    tone: "border-[#FFF4E8]/10 bg-transparent",
    icon: AlertTriangle,
  };
}

function EvidenceList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "warn" | "muted";
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p
        className={cn(
          "text-[0.68rem] font-semibold uppercase tracking-[0.18em]",
          tone === "good" && "text-[#FFF4E8]/72",
          tone === "warn" && "text-[#FFF4E8]/86",
          tone === "muted" && "text-[#FFF4E8]/40",
        )}
      >
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-[#FFF4E8]/62">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function CandidateCard({
  candidate,
  overlay,
}: {
  candidate: PressingResolutionCandidate;
  overlay?: CollectionOverlay;
}) {
  return (
    <article className="rounded-xl border border-[#FFF4E8]/10 bg-[#05030A]/65 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#FFF4E8]">
            {candidate.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#FFF4E8]/48">
            {[candidate.country, candidate.year, candidate.formats.join(", ")]
              .filter(Boolean)
              .join(" / ") || "Version details not listed"}
          </p>
        </div>
        <a
          href={candidate.uri ?? `https://www.discogs.com/release/${candidate.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#FFF4E8]/62 hover:text-[#FFF4E8]"
        >
          Discogs #{candidate.id}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>

      {overlay ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {overlay.owned ? (
            <LabelBadge size="md">
              Owned{overlay.duplicateCount > 1 ? ` ×${overlay.duplicateCount}` : ""}
            </LabelBadge>
          ) : null}
          {overlay.wanted ? (
            <LabelBadge size="md" tone="quiet">
              Wanted
            </LabelBadge>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <EvidenceList
          title="Matched"
          items={candidate.matchedEvidence}
          tone="good"
        />
        <EvidenceList
          title="Conflicting"
          items={candidate.conflictingEvidence}
          tone="warn"
        />
        <EvidenceList
          title="Unavailable"
          items={candidate.unavailableEvidence}
          tone="muted"
        />
      </div>
    </article>
  );
}

export function PressingIdentificationWorkspace({
  authenticated = false,
  compact = false,
}: {
  authenticated?: boolean;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<SearchMode>("query");
  const [query, setQuery] = useState("");
  const [inputSource, setInputSource] =
    useState<InputSource>("manual_search");
  const [seeds, setSeeds] = useState<PressingSeed[]>([]);
  const [selectedSeed, setSelectedSeed] = useState<PressingSeed | null>(null);
  const [evidence, setEvidence] = useState<PressingEvidence>({});
  const [resolutionPayload, setResolutionPayload] =
    useState<ResolutionPayload | null>(null);
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [investigations, setInvestigations] = useState<SavedInvestigation[]>(
    [],
  );
  const [activeInvestigationId, setActiveInvestigationId] = useState<
    string | null
  >(null);
  const {
    isOpen: isCameraOpen,
    message: cameraMessage,
    start: startCamera,
    stop: stopCamera,
    videoRef,
  } = usePressingBarcodeScanner((barcode) => {
    setMode("barcode");
    setQuery(barcode);
    setInputSource("camera_barcode");
  });

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  async function loadInvestigations() {
    if (!authenticated) return;

    const response = await fetch("/api/pressing-investigations", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { investigations?: SavedInvestigation[] }
      | null;

    if (response.ok) {
      setInvestigations(
        (payload?.investigations ?? []).filter(
          ({ status }) => status === "active",
        ),
      );
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    let active = true;

    fetch("/api/pressing-investigations", {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload: { investigations?: SavedInvestigation[] }) => {
        if (!active) return;
        setInvestigations(
          (payload.investigations ?? []).filter(
            ({ status }) => status === "active",
          ),
        );
      })
      .catch(() => {
        // The identification workflow remains usable if resume data is unavailable.
      });

    return () => {
      active = false;
    };
  }, [authenticated]);

  function searchBody(searchMode: SearchMode, value: string) {
    if (searchMode === "discogsId") {
      return { discogsId: discogsIdFrom(value) };
    }

    return {
      [searchMode]: value.trim(),
    };
  }

  function initialEvidence(searchMode: SearchMode, value: string) {
    if (searchMode === "barcode") {
      return { barcode: value.trim() };
    }
    if (searchMode === "catalogNumber") {
      return { catalogNumber: value.trim() };
    }
    return {};
  }

  async function runSearch(
    searchMode: SearchMode,
    value: string,
    source: InputSource,
  ) {
    if (!isOnline) {
      setMessage(
        "Connect to search the live Discogs catalogue.",
      );
      return;
    }

    setIsSearching(true);
    setMessage(null);
    setSeeds([]);
    setSelectedSeed(null);
    setResolutionPayload(null);
    setActiveInvestigationId(null);
    setInputSource(source);
    setEvidence(initialEvidence(searchMode, value));

    try {
      const response = await fetch("/api/discogs/pressings/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...searchBody(searchMode, value),
          inputSource: source,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | SearchPayload
        | null;

      if (!response.ok || !payload?.search) {
        throw new Error(
          payload?.error?.message ?? "Pressing search could not be completed.",
        );
      }

      setSeeds(payload.search.candidates);
      setMessage(
        payload.search.candidates.length > 0
          ? "Pick the family that matches the record in your hand."
          : "No families matched that search.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Pressing search could not be completed.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setMessage("Enter a search value first.");
      return;
    }
    await runSearch(mode, value, inputSource);
  }

  async function resolveSeed(
    seed: PressingSeed,
    nextEvidence: PressingEvidence,
  ) {
    if (!isOnline) {
      setMessage(
        "Connect to compare version details.",
      );
      return;
    }

    setIsResolving(true);
    setMessage(null);
    setSelectedSeed(seed);
    setQuestionAnswer("");

    try {
      const response = await fetch("/api/discogs/pressings/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          masterId: seed.masterId,
          seedReleaseId: seed.id,
          evidence: nextEvidence,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | ResolutionPayload
        | null;

      if (!response.ok || !payload?.resolution) {
        throw new Error(
          payload?.error?.message ??
            "The pressing evidence could not be checked.",
        );
      }

      setResolutionPayload(payload);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The pressing evidence could not be checked.",
      );
    } finally {
      setIsResolving(false);
    }
  }

  async function answerQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = resolutionPayload?.resolution?.nextQuestion;
    if (!question || !selectedSeed || !questionAnswer.trim()) return;
    const evidenceKey = evidenceKeyForQuestion(question.field);
    const answer =
      evidenceKey === "year"
        ? Number.parseInt(questionAnswer, 10)
        : questionAnswer.trim();
    const nextEvidence = {
      ...evidence,
      [evidenceKey]:
        evidenceKey === "year" && !Number.isInteger(answer) ? null : answer,
    };

    setEvidence(nextEvidence);
    await resolveSeed(selectedSeed, nextEvidence);
  }

  async function saveInvestigation() {
    if (!selectedSeed || !resolutionPayload?.resolution) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/pressing-investigations", {
        method: activeInvestigationId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          activeInvestigationId
            ? {
                id: activeInvestigationId,
                action: "resolve",
                evidence,
              }
            : {
                masterId: resolutionPayload.masterId ?? selectedSeed.masterId,
                seedReleaseId: selectedSeed.id,
                inputSource,
                evidence,
              },
        ),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            investigation?: { id?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Investigation could not be saved.",
        );
      }
      if (!activeInvestigationId && payload?.investigation?.id) {
        setActiveInvestigationId(payload.investigation.id);
      }
      setMessage(
        activeInvestigationId
          ? "Investigation updated with fresh evidence."
          : "Investigation saved with fresh evidence.",
      );
      await loadInvestigations();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Investigation could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function resumeInvestigation(investigation: SavedInvestigation) {
    const seed: PressingSeed = {
      id:
        investigation.seedReleaseId ??
        investigation.remainingCandidateIds[0] ??
        0,
      masterId: investigation.masterReleaseId,
      title: investigation.masterReleaseId
        ? `Saved investigation ${investigation.masterReleaseId}`
        : `Saved release investigation ${investigation.seedReleaseId}`,
      year: null,
      formats: [],
      country: null,
      labels: [],
      catalogNumbers: [],
      barcodes: [],
      uri: investigation.seedReleaseId
        ? `https://www.discogs.com/release/${investigation.seedReleaseId}`
        : investigation.masterReleaseId
          ? `https://www.discogs.com/master/${investigation.masterReleaseId}`
          : "https://www.discogs.com",
    };

    setEvidence(investigation.userEvidence);
    setInputSource(investigation.inputSource);
    setActiveInvestigationId(investigation.id);
    await resolveSeed(seed, investigation.userEvidence);
  }

  async function dismissInvestigation(id: string) {
    const response = await fetch("/api/pressing-investigations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: "dismiss" }),
    });

    if (response.ok) {
      setInvestigations((current) =>
        current.filter((investigation) => investigation.id !== id),
      );
    }
  }

  const resolution = resolutionPayload?.resolution ?? null;
  const resultCopy = resolution ? resolutionCopy(resolution) : null;
  const ResultIcon = resultCopy?.icon ?? Disc3;

  return (
    <section
      className={cn(
        "rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/78 shadow-2xl shadow-black/20",
        compact ? "p-4 sm:p-5" : "p-5 sm:p-7",
      )}
      aria-label="Pressing identification"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#FFF4E8]/42">
            Pressing proof beta
          </p>
          <h2
            className={cn(
              "mt-2 font-serif italic text-[#FFF4E8]",
              compact ? "text-3xl" : "text-4xl sm:text-5xl",
            )}
          >
            Prove the pressing—do not guess.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#FFF4E8]/58">
            Start with an easy clue. WAXLIST only asks for details that narrow
            the family.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#FFF4E8]/10 bg-[#FFF4E8]/6 px-3 py-2 text-xs text-[#FFF4E8]/54">
          <Disc3 className="size-4" aria-hidden="true" />
          Catalogue only
        </span>
      </div>

      {!isOnline ? (
        <div
          className="mt-5 rounded-xl border border-[#F08A4B]/24 bg-[#F08A4B]/9 p-4 text-sm leading-6 text-[#FFE1C7]"
          role="status"
        >
          Saved evidence is still readable. Live Discogs searches need a
          connection.
        </div>
      ) : null}

      {authenticated && investigations.length > 0 ? (
        <div className="mt-6 rounded-xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/5 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[#FFF4E8]/42">
            Resume investigations
          </p>
          <div className="mt-3 grid gap-2">
            {investigations.slice(0, 3).map((investigation) => (
              <div
                key={investigation.id}
                className="flex flex-col gap-3 rounded-lg border border-[#FFF4E8]/8 bg-[#05030A]/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-[#FFF4E8]">
                    {investigation.masterReleaseId
                      ? `Master #${investigation.masterReleaseId}`
                      : `Release #${investigation.seedReleaseId}`}
                  </p>
                  <p className="mt-1 text-xs text-[#FFF4E8]/45">
                    {investigation.resolutionKind} /{" "}
                    {investigation.remainingCandidateIds.length} candidates
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void resumeInvestigation(investigation)}
                    className="rounded-full border-[#FFF4E8]/14 bg-transparent"
                  >
                    Resume
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => void dismissInvestigation(investigation.id)}
                    className="size-8 rounded-full border-[#FFF4E8]/10 bg-transparent text-[#FFF4E8]/45"
                    aria-label="Dismiss investigation"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 border-t border-[#FFF4E8]/8 pt-6">
        <div className="flex flex-wrap gap-2">
          {SEARCH_MODES.map((searchMode) => (
            <button
              key={searchMode.id}
              type="button"
              onClick={() => {
                setMode(searchMode.id);
                setInputSource(inputSourceFor(searchMode.id));
              }}
              className={cn(
                "rounded-full border px-3 py-2 text-xs font-medium transition",
                mode === searchMode.id
                  ? "border-[#FFF4E8]/24 bg-[#FFF4E8]/12 text-[#FFF4E8]"
                  : "border-[#FFF4E8]/10 bg-transparent text-[#FFF4E8]/48 hover:text-[#FFF4E8]/76",
              )}
            >
              {searchMode.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSearch}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/38"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (mode === "barcode") {
                  setInputSource("manual_barcode");
                }
              }}
              inputMode={mode === "barcode" || mode === "discogsId" ? "numeric" : "search"}
              placeholder={
                SEARCH_MODES.find(({ id }) => id === mode)?.placeholder
              }
              aria-label={
                SEARCH_MODES.find(({ id }) => id === mode)?.label ??
                "Pressing search"
              }
              className="h-12 border-[#FFF4E8]/12 bg-[#05030A] pl-11 text-[#FFF4E8] placeholder:text-[#FFF4E8]/30"
            />
          </div>
          <Button
            type="submit"
            disabled={isSearching || !isOnline}
            className="h-12 rounded-full bg-[#FFF4E8] px-6 text-[#05030A] hover:bg-[#f6dfc9]"
          >
            {isSearching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            Find release family
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={isCameraOpen ? stopCamera : () => void startCamera()}
            disabled={!isOnline}
            className="h-12 rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]"
          >
            {isCameraOpen ? (
              <PauseCircle className="size-4" aria-hidden="true" />
            ) : (
              <Camera className="size-4" aria-hidden="true" />
            )}
            {isCameraOpen ? "Stop camera" : "Scan barcode"}
          </Button>
        </form>

        {isCameraOpen ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[#FFF4E8]/12 bg-black">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              muted
              playsInline
              aria-label="Barcode camera preview"
            />
          </div>
        ) : null}
        {cameraMessage ? (
          <p className="mt-3 text-sm leading-6 text-[#FFF4E8]/58">
            {cameraMessage}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-[#FFF4E8]/38">
          A barcode finds a candidate family. It never proves one exact
          pressing by itself.
        </p>
      </div>

      {message ? (
        <div
          className="mt-5 rounded-xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/6 p-4 text-sm leading-6 text-[#FFF4E8]/66"
          role="status"
        >
          {message}
        </div>
      ) : null}

      {seeds.length > 0 && !resolution ? (
        <div className="mt-6 grid gap-3">
          {seeds.slice(0, 8).map((seed) => (
            <button
              key={seed.id}
              type="button"
              onClick={() => void resolveSeed(seed, evidence)}
              disabled={isResolving}
              className="rounded-xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/5 p-4 text-left transition hover:border-[#FFF4E8]/20 hover:bg-[#FFF4E8]/8"
            >
              <span className="block text-sm font-semibold text-[#FFF4E8]">
                {seed.title}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[#FFF4E8]/46">
                {seedMeta(seed) || `Discogs release #${seed.id}`}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {isResolving ? (
        <div className="mt-8 grid min-h-36 place-items-center rounded-xl border border-dashed border-[#FFF4E8]/10 text-sm text-[#FFF4E8]/50">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Comparing current version metadata
          </span>
        </div>
      ) : null}

      {resolution && resultCopy ? (
        <div className="mt-7">
          <div className={cn("rounded-xl border p-5", resultCopy.tone)}>
            <div className="flex items-start gap-3">
              <ResultIcon
                className="mt-0.5 size-5 shrink-0 text-[#FFF4E8]"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#FFF4E8]/48">
                  {resultCopy.eyebrow}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[#FFF4E8]">
                  {resultCopy.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#FFF4E8]/62">
                  {resultCopy.body}
                </p>
              </div>
            </div>
          </div>

          {resolution.nextQuestion ? (
            <form
              onSubmit={answerQuestion}
              className="mt-5 rounded-xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/5 p-5"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-[#FFF4E8]/56">
                Next useful check
              </p>
              <label
                htmlFor="pressing-next-answer"
                className="mt-2 block text-lg font-semibold text-[#FFF4E8]"
              >
                {resolution.nextQuestion.title}
              </label>
              <p className="mt-1 text-sm leading-6 text-[#FFF4E8]/56">
                {resolution.nextQuestion.description}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Input
                  id="pressing-next-answer"
                  value={questionAnswer}
                  onChange={(event) => setQuestionAnswer(event.target.value)}
                  placeholder="Enter what is printed on your copy"
                  className="h-11 border-[#FFF4E8]/14 bg-[#05030A] text-[#FFF4E8]"
                />
                <Button
                  type="submit"
                  disabled={!questionAnswer.trim() || isResolving}
                  className="h-11 rounded-full bg-[#FFF4E8] px-5 text-[#05030A]"
                >
                  Check evidence
                </Button>
              </div>
            </form>
          ) : null}

          <div className="mt-5 grid gap-3">
            {resolution.remainingCandidates.slice(0, 8).map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                overlay={resolutionPayload?.collectionOverlay?.find(
                  ({ releaseId }) => releaseId === candidate.id,
                )}
              />
            ))}
          </div>

          {resolution.rejectedCandidates.length > 0 ? (
            <details className="mt-5 rounded-xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/4 p-4">
              <summary className="cursor-pointer text-sm font-medium text-[#FFF4E8]/68">
                Conflicting candidates (
                {resolution.rejectedCandidates.length.toLocaleString()})
              </summary>
              <div className="mt-4 grid gap-3">
                {resolution.rejectedCandidates
                  .slice(0, 4)
                  .map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      overlay={resolutionPayload?.collectionOverlay?.find(
                        ({ releaseId }) => releaseId === candidate.id,
                      )}
                    />
                  ))}
              </div>
            </details>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {resolutionPayload?.investigation?.authenticated ||
            authenticated ? (
              <Button
                type="button"
                onClick={() => void saveInvestigation()}
                disabled={isSaving}
                className="rounded-full bg-[#1DB954] text-[#041008] hover:bg-[#22d162]"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                Save investigation
              </Button>
            ) : (
              <Button
                asChild
                className="rounded-full bg-[#1DB954] text-[#041008] hover:bg-[#22d162]"
              >
                <Link href="/auth/sign-in?next=%2Fidentify">
                  Sign in to save or resume
                </Link>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResolutionPayload(null);
                setSelectedSeed(null);
                setActiveInvestigationId(null);
                setSeeds([]);
                setEvidence({});
                setMessage(null);
              }}
              className="rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]/62"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Start again
            </Button>
          </div>

          {resolutionPayload?.attribution ? (
            <p className="mt-5 text-xs leading-5 text-[#FFF4E8]/36">
              <a
                href={resolutionPayload.attribution.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-[#FFF4E8]/62"
              >
                {resolutionPayload.attribution.label}
              </a>
              {resolutionPayload.checkedAt
                ? ` · Checked ${new Date(
                    resolutionPayload.checkedAt,
                  ).toLocaleString()}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
