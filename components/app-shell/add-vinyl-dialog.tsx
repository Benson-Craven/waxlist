"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Check, Disc3, Heart, Loader2, Plus, Search, X } from "lucide-react";

import {
  requestAddCollectionRecord,
  requestCatalogueSearch,
  type CatalogueSearchCandidate,
} from "@/lib/collection/actions";
import type { CollectionRecord } from "@/lib/collection/record";

function candidateMeta(candidate: CatalogueSearchCandidate) {
  return [
    candidate.year ? String(candidate.year) : null,
    candidate.formats.slice(0, 2).join(", ") || null,
    candidate.label,
    candidate.catalogNumber,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function AddVinylDialog({
  onAdded,
}: {
  onAdded?: (record: CollectionRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogueSearchCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    let isActive = true;

    const timeout = setTimeout(() => {
      requestCatalogueSearch(trimmed)
        .then((candidates) => {
          if (!isActive) return;
          setResults(candidates);
        })
        .catch((error) => {
          if (!isActive) return;
          setResults([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : "Discogs search could not run.",
          );
        })
        .finally(() => {
          if (isActive) setIsSearching(false);
        });
    }, 320);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [open, query]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setQuery("");
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);

    if (value.trim().length < 2) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
  }

  function clearQuery() {
    handleQueryChange("");
    inputRef.current?.focus();
  }

  async function addCandidate(
    candidate: CatalogueSearchCandidate,
    status: "owned" | "wanted",
  ) {
    const key = `${candidate.id}:${status}`;
    setAddingKey(key);

    try {
      const result = await requestAddCollectionRecord({
        discogsReleaseId: candidate.id,
        status,
      });

      onAdded?.(result.record);

      if (result.existed && result.record.status !== status) {
        setSearchError(`Already saved as ${result.record.status}.`);
        return;
      }

      handleOpenChange(false);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "That record could not be added.",
      );
    } finally {
      setAddingKey(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#FFF4E8] px-4 text-sm font-semibold text-[#08030f] transition hover:bg-[#f6dfc9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030A]"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Add vinyl</span>
          <span className="sr-only sm:hidden">Add vinyl</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#05030A]/78 backdrop-blur-sm" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[86svh] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-[#0c0713] shadow-[0_40px_120px_-40px_rgba(0,0,0,.95)] outline-none">
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-[#FFF4E8]">
                Add a vinyl
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[#FFF4E8]/52">
                Search Discogs, then save it as owned or wanted.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-[#FFF4E8]/52 transition hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/42"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="search"
                autoFocus
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="Artist or album"
                aria-label="Search Discogs for an album"
                className="h-11 w-full rounded-full bg-[#FFF4E8]/7 pl-10 pr-16 text-sm text-[#FFF4E8] outline-none placeholder:text-[#FFF4E8]/34 [&::-webkit-search-cancel-button]:appearance-none focus:bg-[#FFF4E8]/10 focus:ring-1 focus:ring-[#FFF4E8]/22"
              />
              <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {isSearching ? (
                  <Loader2
                    className="size-4 animate-spin text-[#FFF4E8]/42"
                    aria-hidden="true"
                  />
                ) : null}
                {query ? (
                  <button
                    type="button"
                    onClick={clearQuery}
                    aria-label="Clear search"
                    title="Clear search"
                    className="grid size-7 cursor-pointer place-items-center rounded-full text-[#FFF4E8]/45 transition hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/50"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </span>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {searchError ? (
              <p
                role="alert"
                className="mx-2 mt-2 rounded-xl bg-[#D34278]/10 px-3 py-2 text-sm text-[#FFD7E4]"
              >
                {searchError}
              </p>
            ) : null}

            {query.trim().length < 2 ? (
              <div className="grid min-h-40 place-items-center px-4 text-center">
                <p className="max-w-xs text-sm leading-6 text-[#FFF4E8]/40">
                  Type at least two characters to search the catalogue.
                </p>
              </div>
            ) : results.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {results.map((candidate) => {
                  const meta = candidateMeta(candidate);

                  return (
                    <li
                      key={candidate.id}
                      className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[#FFF4E8]/5"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#160A24] text-[#FFF4E8]/38">
                        <Disc3 className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#FFF4E8]">
                          {candidate.title}
                        </span>
                        {meta ? (
                          <span className="mt-0.5 block truncate text-xs text-[#FFF4E8]/42">
                            {meta}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => addCandidate(candidate, "owned")}
                          disabled={Boolean(addingKey)}
                          aria-label={`Save ${candidate.title} as owned`}
                          title="Save as owned"
                          className="grid size-8 cursor-pointer place-items-center rounded-full bg-[#FFF4E8] text-[#08030f] transition hover:bg-[#f6dfc9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0713] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {addingKey === `${candidate.id}:owned` ? (
                            <Loader2
                              className="size-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Check
                              className="size-4"
                              strokeWidth={2.5}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => addCandidate(candidate, "wanted")}
                          disabled={Boolean(addingKey)}
                          aria-label={`Save ${candidate.title} as wanted`}
                          title="Save as wanted"
                          className="grid size-8 cursor-pointer place-items-center rounded-full bg-[#FFF4E8]/8 text-[#FFF4E8]/68 transition hover:bg-[#FFF4E8]/14 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {addingKey === `${candidate.id}:wanted` ? (
                            <Loader2
                              className="size-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Heart className="size-4" aria-hidden="true" />
                          )}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : isSearching ? (
              <div className="grid min-h-40 place-items-center px-4 text-center">
                <p className="text-sm text-[#FFF4E8]/42">Searching Discogs…</p>
              </div>
            ) : (
              <div className="grid min-h-40 place-items-center px-4 text-center">
                <p className="max-w-xs text-sm leading-6 text-[#FFF4E8]/40">
                  No releases matched. Try the artist and album together.
                </p>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
