"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Disc3,
  ExternalLink,
  Link2,
  LoaderCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LabelBadge } from "@/components/ui/label-badge";
import type {
  CollectionGapState,
  ListeningAlbumCandidate,
  ListeningSourceSnapshot,
} from "@/lib/listening/types";

type CatalogueMatch = {
  searchUnit: {
    id: string;
    source: {
      provider: "youtube";
      albumUrl: string | null;
    };
  };
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
  error?: {
    message?: string;
    issues?: Array<{ index?: number; message?: string }>;
  };
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

function youtubeEvidence(candidate: ListeningAlbumCandidate) {
  return candidate.sourceEvidence.find(
    (evidence) => evidence.type === "youtube_link",
  );
}

export function YouTubeLinkCrateWorkspace() {
  const [rawLinks, setRawLinks] = useState("");
  const [snapshot, setSnapshot] = useState<ListeningSourceSnapshot | null>(null);
  const [candidates, setCandidates] = useState<ListeningAlbumCandidate[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<CatalogueMatch[]>([]);
  const [busy, setBusy] = useState<"loading" | "reviewing" | "matching" | null>(
    "loading",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/listening/youtube/links")
      .then(async (response) => {
        const payload = await readJson<{
          snapshot?: ListeningSourceSnapshot | null;
        }>(response);

        if (!active || !response.ok || !payload.snapshot) return;
        setSnapshot(payload.snapshot);
        setCandidates(payload.snapshot.candidates);
        setConfirmedIds(
          new Set(
            payload.snapshot.candidates
              .filter((candidate) => candidate.metadataQuality === "complete")
              .map((candidate) => candidate.id),
          ),
        );
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

  async function saveEntries(
    entries: Array<{
      url: string;
      artist?: string;
      album?: string;
      note?: string;
      metadataConfirmed?: boolean;
    }>,
  ) {
    const response = await fetch("/api/listening/youtube/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    const payload = await readJson<{ snapshot?: ListeningSourceSnapshot }>(
      response,
    );

    if (!response.ok || !payload.snapshot) {
      throw new Error(
        payload.error?.message ?? "YouTube links could not be reviewed.",
      );
    }

    return payload.snapshot;
  }

  async function reviewLinks() {
    const links = rawLinks
      .split(/\r?\n/)
      .map((link) => link.trim())
      .filter(Boolean);

    if (links.length === 0) {
      setMessage("Add at least one individual YouTube video link.");
      return;
    }

    setBusy("reviewing");
    setMessage(null);
    setMatches([]);

    try {
      const nextSnapshot = await saveEntries(
        links.map((url) => ({ url, metadataConfirmed: false })),
      );
      setSnapshot(nextSnapshot);
      setCandidates(nextSnapshot.candidates);
      setConfirmedIds(new Set());
      setMessage(
        `${nextSnapshot.candidates.length.toLocaleString()} unique YouTube ${nextSnapshot.candidates.length === 1 ? "link is" : "links are"} ready for artist and album confirmation.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "YouTube link review failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  function editCandidate(
    candidateId: string,
    field: "artist" | "album" | "note",
    value: string,
  ) {
    setCandidates((current) =>
      current.map((candidate) => {
        if (candidate.id !== candidateId) return candidate;

        if (field === "note") {
          return {
            ...candidate,
            sourceEvidence: candidate.sourceEvidence.map((evidence) =>
              evidence.type === "youtube_link"
                ? { ...evidence, note: value }
                : evidence,
            ),
          };
        }

        return {
          ...candidate,
          [field]: value,
          metadataQuality: "review",
          reviewReason:
            "Confirm the artist and album before catalogue matching.",
        };
      }),
    );

    if (field !== "note") {
      setConfirmedIds((current) => {
        const next = new Set(current);
        next.delete(candidateId);
        return next;
      });
    }
  }

  function setCandidateConfirmed(candidateId: string, confirmed: boolean) {
    setConfirmedIds((current) => {
      const next = new Set(current);
      if (confirmed) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  }

  async function matchCatalogue() {
    const needsReview = candidates.find(
      (candidate) =>
        !candidate.artist.trim() ||
        !candidate.album.trim() ||
        !confirmedIds.has(candidate.id),
    );

    if (needsReview) {
      setMessage(
        "Confirm the artist and album for every link first.",
      );
      return;
    }

    setBusy("matching");
    setMessage(null);

    try {
      const confirmedSnapshot = await saveEntries(
        candidates.map((candidate) => ({
          url: youtubeEvidence(candidate)?.url ?? "",
          artist: candidate.artist,
          album: candidate.album,
          note: youtubeEvidence(candidate)?.note ?? "",
          metadataConfirmed: true,
        })),
      );
      setSnapshot(confirmedSnapshot);
      setCandidates(confirmedSnapshot.candidates);

      const response = await fetch("/api/discogs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "youtube",
          sourceType: "video_links",
          candidates: confirmedSnapshot.candidates,
        }),
      });
      const payload = await readJson<{
        matchRun?: { results?: CatalogueMatch[] };
      }>(response);

      if (!response.ok || !payload.matchRun) {
        throw new Error(
          payload.error?.message ?? "Discogs catalogue matching failed.",
        );
      }

      const nextMatches = payload.matchRun.results ?? [];
      setMatches(nextMatches);
      setMessage(
        `Matched ${nextMatches.length.toLocaleString()} albums. Weak matches stayed labelled.`,
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
    if (!match.bestMatch?.markToken) return;

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
    <section className="min-w-0 space-y-5" aria-label="YouTube link crate">
      <div className="rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/68 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.24em] text-[#FFF4E8]/45">
            YouTube · Link beta
          </p>
          <LabelBadge size="lg" tone="quiet">
            Watch-history import · Coming soon
          </LabelBadge>
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-[#FFF4E8]">
          Add individual YouTube links
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#FFF4E8]/58">
          WAXLIST keeps the video ID without opening or scraping the link.
          It’s a note you added, not proof you watched it.
        </p>

        <label className="mt-5 grid gap-2 text-xs text-[#FFF4E8]/58">
          One youtube.com, youtu.be, or Shorts URL per line
          <textarea
            value={rawLinks}
            onChange={(event) => setRawLinks(event.target.value)}
            rows={4}
            placeholder="https://www.youtube.com/watch?v=..."
            className="rounded-xl border border-[#FFF4E8]/14 bg-[#05030A] px-3 py-3 text-sm leading-6 text-[#FFF4E8] outline-none focus:border-[#FFF4E8]/36"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            onClick={reviewLinks}
            disabled={busy !== null}
            className="rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
          >
            {busy === "reviewing" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Review links
          </Button>
          <p className="text-xs text-[#FFF4E8]/42">
            Playlist import is coming later.
          </p>
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
                Confirm album evidence
              </h2>
              <p className="mt-1 text-sm text-[#FFF4E8]/54">
                {snapshot?.evidenceReviewed ?? candidates.length} deduplicated{" "}
                {candidates.length === 1 ? "link" : "links"}
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
              Save and match
            </Button>
          </div>

          <div className="mt-5 grid gap-3">
            {candidates.map((candidate) => {
              const evidence = youtubeEvidence(candidate);

              return (
                <article
                  key={candidate.id}
                  className="rounded-xl border border-[#FFF4E8]/9 bg-[#FFF4E8]/4 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-xs text-[#FFF4E8]/54">
                      Artist
                      <input
                        value={candidate.artist}
                        onChange={(event) =>
                          editCandidate(
                            candidate.id,
                            "artist",
                            event.target.value,
                          )
                        }
                        className="h-10 rounded-lg border border-[#F08A4B]/30 bg-[#05030A] px-3 text-sm text-[#FFF4E8]"
                      />
                    </label>
                    <label className="grid gap-2 text-xs text-[#FFF4E8]/54">
                      Album
                      <input
                        value={candidate.album}
                        onChange={(event) =>
                          editCandidate(
                            candidate.id,
                            "album",
                            event.target.value,
                          )
                        }
                        className="h-10 rounded-lg border border-[#F08A4B]/30 bg-[#05030A] px-3 text-sm text-[#FFF4E8]"
                      />
                    </label>
                  </div>
                  <label className="mt-3 grid gap-2 text-xs text-[#FFF4E8]/54">
                    Note (optional)
                    <input
                      value={evidence?.note ?? ""}
                      onChange={(event) =>
                        editCandidate(candidate.id, "note", event.target.value)
                      }
                      className="h-10 rounded-lg border border-[#FFF4E8]/12 bg-[#05030A] px-3 text-sm text-[#FFF4E8]"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-[#FFF4E8]/68">
                      <input
                        type="checkbox"
                        checked={confirmedIds.has(candidate.id)}
                        onChange={(event) =>
                          setCandidateConfirmed(
                            candidate.id,
                            event.target.checked,
                          )
                        }
                        className="size-4 accent-[#D34278]"
                      />
                      Artist and album confirmed
                    </label>
                    {evidence?.url ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-full border-[#FFF4E8]/14 bg-transparent"
                      >
                        <a
                          href={evidence.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open YouTube
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="grid gap-3">
          {matches.map((match) => {
            const candidate = candidateById.get(match.searchUnit.id);
            const evidence = candidate ? youtubeEvidence(candidate) : null;

            return (
              <article
                key={match.searchUnit.id}
                className="rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/58 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
                      YouTube link · {STATE_LABELS[match.state]}
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
                  <div className="flex flex-wrap gap-2">
                    {match.bestMatch?.markToken ? (
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
                    {evidence?.url ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-full border-[#FFF4E8]/16 bg-transparent"
                      >
                        <a
                          href={evidence.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open YouTube
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    ) : null}
                    {match.bestMatch ? (
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
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          <p className="text-xs text-[#FFF4E8]/40">
            Data provided by Discogs.
          </p>
        </div>
      ) : null}
    </section>
  );
}
