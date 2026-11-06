"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { VinylGrid } from "@/components/collection/vinyl-grid";
import type { CollectionRecord } from "@/lib/collection/record";
import { cn } from "@/lib/utils";

// Enough covers to make the grid feel like a crate without turning the page
// into an endless scroll. The full set is one press away.
const VINYL_GRID_PREVIEW_COUNT = 12;

/**
 * The browse result set. The parent keys this component on the tab, search,
 * filter, and sort state, so a new result set always opens collapsed.
 */
export function VinylGridSection({
  records,
  selectedRecordId,
  onSelectRecord,
  onGroupRecord,
  onReset,
}: {
  records: CollectionRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (record: CollectionRecord) => void;
  onGroupRecord: (record: CollectionRecord) => void;
  onReset: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPreviewable = records.length > VINYL_GRID_PREVIEW_COUNT;
  const visibleRecords =
    isPreviewable && !isExpanded
      ? records.slice(0, VINYL_GRID_PREVIEW_COUNT)
      : records;
  const hiddenRecordCount = records.length - visibleRecords.length;

  return (
    <section
      id="vinyl-grid"
      className="mt-10 scroll-mt-6"
      aria-labelledby="vinyl-grid-heading"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2
            id="vinyl-grid-heading"
            className="font-serif text-3xl italic leading-none tracking-[-0.02em] text-[#FFF4E8] sm:text-4xl"
          >
            All vinyls
          </h2>
          <span className="text-[11px] tabular-nums text-[#FFF4E8]/34">
            {records.length.toLocaleString()}{" "}
            {records.length === 1 ? "record" : "records"}
          </span>
        </div>

        {isPreviewable ? (
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-controls="vinyl-grid-records"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E8]/8 px-4 py-1.5 text-[11px] font-medium text-[#FFF4E8]/70 transition hover:bg-[#FFF4E8]/14 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40"
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-300",
                isExpanded && "rotate-180",
              )}
              aria-hidden="true"
            />
            {isExpanded
              ? "Show less"
              : `Show all ${records.length.toLocaleString()} vinyls`}
          </button>
        ) : null}
      </header>

      {records.length === 0 ? (
        <div className="mt-8 grid min-h-[16rem] place-items-center text-center">
          <div>
            <p className="text-sm text-[#FFF4E8]/56">
              No records match this view.
            </p>
            <button
              type="button"
              onClick={onReset}
              className="mt-3 rounded-full bg-[#FFF4E8]/8 px-4 py-1.5 text-xs text-[#FFF4E8]/70 transition hover:bg-[#FFF4E8]/14 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40"
            >
              Reset filters
            </button>
          </div>
        </div>
      ) : (
        <div id="vinyl-grid-records" className="mt-7">
          <VinylGrid
            records={visibleRecords}
            selectedRecordId={selectedRecordId}
            onSelectRecord={onSelectRecord}
            onGroupRecord={onGroupRecord}
            revealFrom={
              isExpanded ? VINYL_GRID_PREVIEW_COUNT : undefined
            }
          />

          {isPreviewable ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
                aria-controls="vinyl-grid-records"
                className="inline-flex items-center gap-2 rounded-full bg-[#FFF4E8]/9 px-5 py-2 text-xs font-medium text-[#FFF4E8]/76 transition hover:bg-[#FFF4E8]/15 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-300",
                    isExpanded && "rotate-180",
                  )}
                  aria-hidden="true"
                />
                {isExpanded
                  ? "Show less"
                  : `Show ${hiddenRecordCount.toLocaleString()} more`}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
