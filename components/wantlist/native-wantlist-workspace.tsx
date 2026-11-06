"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Disc3, Heart, Loader2, Star } from "lucide-react";

import { AddVinylDialog } from "@/components/app-shell/add-vinyl-dialog";
import { Button } from "@/components/ui/button";
import { LabelBadge } from "@/components/ui/label-badge";
import { RecordQuickActions } from "@/components/records/record-actions";
import { COLLECTION_CHANGED_EVENT } from "@/lib/collection/actions";
import type { CollectionRecord } from "@/lib/collection/record";
import {
  DEFAULT_SHORTLIST_TAB,
  SHORTLIST_TABS,
  shortlistTabCount,
  shortlistTabMatches,
  type ShortlistTab,
} from "@/lib/wantlist/shortlist";
import {
  selectedRecordFromCollection,
  type SelectedRecord,
} from "@/lib/workspace/selected-record";
import { cn } from "@/lib/utils";

const SHORTLIST_TAB_ICONS = {
  wanted: Heart,
  favourites: Star,
} as const;

/**
 * The Wantlist is the shortlist: one surface with two lenses over the same
 * collection rows, so a starred record keeps its owned/wanted status without a
 * second list to maintain.
 */
export function NativeWantlistWorkspace({
  initialTab = DEFAULT_SHORTLIST_TAB,
  onSelectRecord,
}: {
  initialTab?: ShortlistTab;
  onSelectRecord?: (record: SelectedRecord | null) => void;
}) {
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<ShortlistTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/collection", { cache: "no-store" });
      const payload = (await response.json()) as {
        records?: CollectionRecord[];
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Wantlist could not be loaded.",
        );
      }

      setRecords(Array.isArray(payload.records) ? payload.records : []);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wantlist failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferring the first read keeps loading out of the synchronous effect body
    // while still showing data as soon as the view mounts.
    const timer = setTimeout(() => {
      void load();
    }, 0);

    function handleCollectionChange() {
      void load();
    }

    window.addEventListener(COLLECTION_CHANGED_EVENT, handleCollectionChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener(
        COLLECTION_CHANGED_EVENT,
        handleCollectionChange,
      );
    };
  }, [load]);

  const tabCounts = useMemo<Record<ShortlistTab, number>>(
    () => ({
      wanted: shortlistTabCount(records, "wanted"),
      favourites: shortlistTabCount(records, "favourites"),
    }),
    [records],
  );
  const visibleRecords = useMemo(
    () => records.filter((record) => shortlistTabMatches(record, activeTab)),
    [activeTab, records],
  );

  const handleRecordChanged = useCallback((updated: CollectionRecord) => {
    setRecords((current) =>
      current.map((record) => (record.id === updated.id ? updated : record)),
    );
  }, []);

  const handleRecordDeleted = useCallback((id: string) => {
    setRecords((current) => current.filter((record) => record.id !== id));
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center text-[#FFF4E8]/55">
        <Loader2 className="size-5 animate-spin" aria-label="Loading wantlist" />
      </div>
    );
  }

  if (error && records.length === 0) {
    return (
      <p className="rounded-xl bg-[#D34278]/8 p-4 text-sm text-[#FFD7E4]">
        {error}
      </p>
    );
  }

  return (
    <section aria-label="Wantlist">
      <div
        role="group"
        aria-label="Shortlist"
        className="mb-4 flex flex-wrap gap-x-7 gap-y-1"
      >
        {SHORTLIST_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = SHORTLIST_TAB_ICONS[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative min-w-max cursor-pointer pb-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/50 focus-visible:ring-offset-4 focus-visible:ring-offset-[#05030A]",
                isActive
                  ? "text-[#FFF4E8]"
                  : "text-[#FFF4E8]/50 hover:text-[#FFF4E8]/78",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <TabIcon className="size-3.5" aria-hidden="true" />
                {tab.label}
              </span>
              <span className="ml-2 text-xs tabular-nums text-[#FFF4E8]/36">
                {tabCounts[tab.id]}
              </span>
              {isActive ? (
                <span className="absolute inset-x-0 bottom-0 h-px bg-[#FFF4E8]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {visibleRecords.length > 0 ? (
        <ul className="grid gap-1">
          {visibleRecords.map((record) => (
            <li
              key={record.id}
              className="flex items-center gap-3 rounded-xl bg-[#FFF4E8]/4 px-3 py-2.5"
            >
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#160A24]">
                {record.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={record.imageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                  />
                ) : (
                  <Disc3 className="size-4 text-[#FFF4E8]/38" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[#FFF4E8]">
                  {record.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-[#FFF4E8]/46">
                  {record.artist}
                </span>
              </span>
              {activeTab === "favourites" ? (
                <LabelBadge
                  tone="quiet"
                  size="xs"
                  className="hidden sm:inline-flex"
                >
                  {record.status === "wanted" ? "Wanted" : "Owned"}
                </LabelBadge>
              ) : null}
              <RecordQuickActions
                record={record}
                onChanged={handleRecordChanged}
                onDeleted={handleRecordDeleted}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelectRecord?.(selectedRecordFromCollection(record))}
                className="shrink-0 rounded-full px-3 text-xs text-[#FFF4E8]/58 hover:bg-[#FFF4E8]/8 hover:text-[#FFF4E8]"
              >
                Open
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-2xl bg-[#FFF4E8]/4 px-6 text-center">
          <div>
            {activeTab === "favourites" ? (
              <Star
                className="mx-auto size-8 text-[#FFF4E8]/28"
                aria-hidden="true"
              />
            ) : (
              <Disc3
                className="mx-auto size-8 text-[#FFF4E8]/28"
                aria-hidden="true"
              />
            )}
            <p className="mt-4 text-sm font-medium text-[#FFF4E8]/72">
              {activeTab === "favourites"
                ? "No favourites yet"
                : "Nothing on the wantlist"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[#FFF4E8]/42">
              {activeTab === "favourites"
                ? "Tap the star on any record to keep it here."
                : "Search Discogs and choose Want to start the list."}
            </p>
            <div className="mt-5 flex justify-center">
              {activeTab === "favourites" ? (
                <Button
                  asChild
                  className="rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
                >
                  <Link href="/app?view=collection">Open collection</Link>
                </Button>
              ) : (
                <AddVinylDialog />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
