"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Disc3, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CollectionGapState,
  ListeningAlbumCandidate,
  ListeningSourceSnapshot,
} from "@/lib/listening/types";

type CatalogueMatch = {
  searchUnit: { id: string };
  state: CollectionGapState;
  bestMatch: {
    id: number;
    masterId: number | null;
    title: string;
    year: number | null;
    format: string[];
    country: string | null;
    discogsUrl: string;
    confidence: number;
    confidenceLabel: string;
    reasons: string[];
    markToken: string | null;
  } | null;
};

type ApiError = {
  error?: { message?: string };
};

const STATE_LABELS: Record<CollectionGapState, string> = {
  owned: "Owned",
  wanted: "Wanted",
  missing: "Missing",
  review: "Needs review",
  unmatched: "Unmatched",
};

async function readJson<T>(response: Response): Promise<T & ApiError> {
  try {
    return (await response.json()) as T & ApiError;
  } catch {
    return {} as T & ApiError;
  }
}

export function ListenBrainzCrateWorkspace() {
  const [username, setUsername] = useState("");
  const [windowDays, setWindowDays] = useState<30 | 90 | 365>(90);
  const [snapshot, setSnapshot] = useState<ListeningSourceSnapshot | null>(null);
  const [candidates, setCandidates] = useState<ListeningAlbumCandidate[]>([]);
  const [matches, setMatches] = useState<CatalogueMatch[]>([]);
  const [busy, setBusy] = useState<"loading" | "importing" | "matching" | null>(
    "loading",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/listening/listenbrainz/import")
      .then(async (response) => {
        const payload = await readJson<{ snapshot?: ListeningSourceSnapshot | null }>(
          response,
        );
        if (!active) return;
        if (response.ok && payload.snapshot) {
          setSnapshot(payload.snapshot);
          setCandidates(payload.snapshot.candidates);
          setUsername(payload.snapshot.sourceAccountId);
          if (payload.snapshot.windowDays) {
            setWindowDays(payload.snapshot.windowDays);
          }
        }
      })
      .finally(() => {
        if (active) setBusy(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const candidateById = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate])),
    [candidates],
  );

  async function importListens() {
    setBusy("importing");
    setMessage(null);
    setMatches([]);

    try {
      const response = await fetch("/api/listening/listenbrainz/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, windowDays }),
      });
      const payload = await readJson<{ snapshot?: ListeningSourceSnapshot }>(
        response,
      );

      if (!response.ok || !payload.snapshot) {
        throw new Error(
          payload.error?.message ?? "ListenBrainz import could not be completed.",
        );
      }

      setSnapshot(payload.snapshot);
      setCandidates(payload.snapshot.candidates);
      setMessage(
        `Reviewed ${payload.snapshot.evidenceReviewed.toLocaleString()} listens and found ${payload.snapshot.candidates.length.toLocaleString()} albums.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ListenBrainz import failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  function editCandidate(
    candidateId: string,
    field: "artist" | "album",
    value: string,
  ) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === candidateId
          ? {
              ...candidate,
              [field]: value,
              metadataQuality:
                (field === "artist" ? value : candidate.artist).trim() &&
                (field === "album" ? value : candidate.album).trim()
                  ? "complete"
                  : "review",
              reviewReason: null,
            }
          : candidate,
      ),
    );
  }

  async function matchCatalogue() {
    const matchable = candidates.filter(
      (candidate) =>
        candidate.artist.trim() &&
        candidate.album.trim() &&
        candidate.metadataQuality === "complete",
    );

    if (matchable.length === 0) {
      setMessage("Review at least one album before matching the catalogue.");
      return;
    }

    setBusy("matching");
    setMessage(null);

    try {
      const response = await fetch("/api/discogs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: matchable,
        }),
      });
      const payload = await readJson<{
        matchRun?: { results?: CatalogueMatch[]; failures?: unknown[] };
      }>(response);

      if (!response.ok || !payload.matchRun) {
        throw new Error(
          payload.error?.message ?? "Discogs catalogue matching failed.",
        );
      }

      setMatches(payload.matchRun.results ?? []);
      setMessage(
        `Matched ${(payload.matchRun.results ?? []).length.toLocaleString()} albums. Weak matches stayed in review.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Catalogue matching failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function markState(match: CatalogueMatch, status: "owned" | "wanted") {
    const candidate = candidateById.get(match.searchUnit.id);

    if (!candidate || !match.bestMatch?.markToken) return;

    const response = await fetch("/api/listening/gaps/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        markToken: match.bestMatch.markToken,
      }),
    });
    const payload = await readJson<Record<string, never>>(response);

    if (!response.ok) {
      setMessage(
        payload.error?.message ?? "Collection state could not be updated.",
      );
      return;
    }

    setMatches((current) =>
      current.map((item) =>
        item.searchUnit.id === match.searchUnit.id
          ? { ...item, state: status }
          : item,
      ),
    );
  }

  return (
    <section className="min-w-0 space-y-5" aria-label="ListenBrainz crate">
      <div className="rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/68 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-[#FFF4E8]/45">
          ListenBrainz source
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-[#FFF4E8]">
          Turn listening into gaps
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#FFF4E8]/58">
          WAXLIST reads up to 500 recent listens, groups them by album, and
          checks each solid match against what you own and want.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
          <label className="grid gap-2 text-xs text-[#FFF4E8]/58">
            ListenBrainz username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-11 rounded-xl border border-[#FFF4E8]/14 bg-[#05030A] px-3 text-sm text-[#FFF4E8] outline-none focus:border-[#FFF4E8]/36"
              autoComplete="username"
            />
          </label>
          <label className="grid gap-2 text-xs text-[#FFF4E8]/58">
            Listening window
            <select
              value={windowDays}
              onChange={(event) =>
                setWindowDays(Number(event.target.value) as 30 | 90 | 365)
              }
              className="h-11 rounded-xl border border-[#FFF4E8]/14 bg-[#05030A] px-3 text-sm text-[#FFF4E8]"
            >
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>365 days</option>
            </select>
          </label>
          <Button
            onClick={importListens}
            disabled={busy !== null || !username.trim()}
            className="self-end rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
          >
            {busy === "importing" ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Import listens
          </Button>
        </div>

        {message ? (
          <p className="mt-4 text-sm leading-6 text-[#FFF4E8]/68" role="status">
            {message}
          </p>
        ) : null}
      </div>

      {busy === "loading" ? (
        <div className="grid min-h-48 place-items-center rounded-2xl border border-[#FFF4E8]/10">
          <LoaderCircle className="size-6 animate-spin text-[#FFF4E8]/60" />
        </div>
      ) : candidates.length > 0 ? (
        <div className="rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#FFF4E8]">
                Review album evidence
              </h2>
              <p className="mt-1 text-sm text-[#FFF4E8]/54">
                {snapshot?.evidenceReviewed.toLocaleString() ?? 0} listens ·{" "}
                {candidates.length.toLocaleString()} deduplicated albums
              </p>
            </div>
            <Button
              onClick={matchCatalogue}
              disabled={busy !== null}
              className="rounded-full bg-[#D34278] text-white hover:bg-[#b93568]"
            >
              {busy === "matching" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Disc3 className="size-4" />
              )}
              Match catalogue
            </Button>
          </div>

          <div className="mt-5 grid gap-3">
            {candidates.map((candidate) => (
              <article
                key={candidate.id}
                className="rounded-xl border border-[#FFF4E8]/9 bg-[#FFF4E8]/4 p-4"
              >
                {candidate.metadataQuality === "review" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      aria-label="Artist"
                      value={candidate.artist}
                      placeholder="Artist"
                      onChange={(event) =>
                        editCandidate(candidate.id, "artist", event.target.value)
                      }
                      className="h-10 rounded-lg border border-[#F08A4B]/30 bg-[#05030A] px-3 text-sm"
                    />
                    <input
                      aria-label="Album"
                      value={candidate.album}
                      placeholder="Album"
                      onChange={(event) =>
                        editCandidate(candidate.id, "album", event.target.value)
                      }
                      className="h-10 rounded-lg border border-[#F08A4B]/30 bg-[#05030A] px-3 text-sm"
                    />
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-[#FFF4E8]">
                        {candidate.album}
                      </h3>
                      <p className="mt-1 text-sm text-[#FFF4E8]/56">
                        {candidate.artist}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#FFF4E8]/12 px-3 py-1 text-xs text-[#FFF4E8]/62">
                      {candidate.evidenceCount}{" "}
                      {candidate.evidenceCount === 1 ? "listen" : "listens"}
                    </span>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="grid gap-3">
          {matches.map((match) => {
            const candidate = candidateById.get(match.searchUnit.id);

            return (
              <article
                key={match.searchUnit.id}
                className="rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/58 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
                      {STATE_LABELS[match.state]}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[#FFF4E8]">
                      {candidate?.album ?? match.bestMatch?.title}
                    </h3>
                    <p className="mt-1 text-sm text-[#FFF4E8]/56">
                      {candidate?.artist}
                    </p>
                    {match.bestMatch ? (
                      <p className="mt-2 text-xs text-[#FFF4E8]/44">
                        {match.bestMatch.confidence}% catalogue confidence ·{" "}
                        {match.bestMatch.title}
                      </p>
                    ) : null}
                  </div>
                  {match.bestMatch ? (
                    <div className="flex flex-wrap gap-2">
                      {match.bestMatch.markToken ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markState(match, "owned")}
                            className="rounded-full border-[#FFF4E8]/16 bg-transparent"
                          >
                            {match.state === "owned" ? (
                              <Check className="size-4" />
                            ) : null}
                            Mark owned
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markState(match, "wanted")}
                            className="rounded-full border-[#FFF4E8]/16 bg-transparent"
                          >
                            {match.state === "wanted" ? (
                              <Check className="size-4" />
                            ) : null}
                            Mark wanted
                          </Button>
                        </>
                      ) : null}
                      <Button asChild size="sm" className="rounded-full">
                        <a
                          href={match.bestMatch.discogsUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Discogs
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
          <p className="text-xs text-[#FFF4E8]/40">Data provided by Discogs.</p>
        </div>
      ) : null}
    </section>
  );
}
