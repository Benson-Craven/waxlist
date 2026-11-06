"use client";

import { Heart } from "lucide-react";

import { VinylGrid } from "@/components/collection/vinyl-grid";
import type { CollectionRecord } from "@/lib/collection/record";

/**
 * The wantlist is deliberately not part of the shelving surface: wanted
 * records are not on the shelf yet, and filing one into a group never removes
 * it from this list. The heart-off on each cover is the one action that does
 * take a record off the list.
 */
export function WantlistShelf({
  records,
  selectedRecordId,
  onSelectRecord,
  onGroupRecord,
  onRemoveRecord,
  removingRecordId,
}: {
  records: CollectionRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (record: CollectionRecord) => void;
  onGroupRecord: (record: CollectionRecord) => void;
  onRemoveRecord: (record: CollectionRecord) => void;
  removingRecordId: string | null;
}) {
  return (
    <section
      id="wantlist"
      aria-labelledby="wantlist-heading"
      className="mt-6 scroll-mt-6 rounded-[26px] bg-[#170F2A]/55 p-5 shadow-[inset_0_1px_0_rgba(255,244,232,0.06)] sm:p-7"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h2
              id="wantlist-heading"
              className="font-serif text-3xl italic leading-none tracking-[-0.02em] text-[#FFF4E8] sm:text-4xl"
            >
              Wantlist
            </h2>
            <span className="text-[11px] tabular-nums text-[#FFF4E8]/38">
              {records.length.toLocaleString()}{" "}
              {records.length === 1 ? "record" : "records"}
            </span>
          </div>
          <p className="mt-2 max-w-md text-[11px] leading-5 text-[#FFF4E8]/40">
            Wanted records stay here until you save them as owned. A group files
            the want without taking it off this list; the heart-off takes it off
            the list.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E8]/6 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[#FFF4E8]/50">
          <Heart className="size-3" aria-hidden="true" />
          Not on the shelf
        </span>
      </header>

      <div className="mt-6">
        <VinylGrid
          records={records}
          selectedRecordId={selectedRecordId}
          onSelectRecord={onSelectRecord}
          onGroupRecord={onGroupRecord}
          onRemoveRecordFromWantlist={onRemoveRecord}
          removingWantlistRecordId={removingRecordId}
        />
      </div>
    </section>
  );
}
