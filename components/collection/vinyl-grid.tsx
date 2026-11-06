"use client";

import { CollectionRecordCard } from "@/components/collection/record-card";
import type { CollectionRecord } from "@/lib/collection/record";

/**
 * The flat browse grid. Unlike the shelving groups below it, this list shows
 * every record that matches the current tab, search, filter, and sort.
 *
 * `onGroupRecord` puts a record into a group. `onRemoveRecordFromGroup` is the
 * inverse and belongs to a cover rendered inside a group, where the same
 * hover control takes the record back out.
 */
export function VinylGrid({
  records,
  selectedRecordId,
  onSelectRecord,
  onGroupRecord,
  onRemoveRecordFromGroup,
  removingRecordId,
  onRemoveRecordFromWantlist,
  removingWantlistRecordId,
  revealFrom,
}: {
  records: CollectionRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (record: CollectionRecord) => void;
  onGroupRecord?: (record: CollectionRecord) => void;
  onRemoveRecordFromGroup?: (record: CollectionRecord) => void;
  removingRecordId?: string | null;
  /** The wantlist is the only surface that offers taking a want off the list. */
  onRemoveRecordFromWantlist?: (record: CollectionRecord) => void;
  removingWantlistRecordId?: string | null;
  /** Cards from this index on rise in, for a "show all" expansion. */
  revealFrom?: number;
}) {
  return (
    <ul className="grid gap-x-4 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))] sm:gap-x-5 sm:[grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]">
      {records.map((record, index) => (
        <CollectionRecordCard
          key={record.id}
          record={record}
          index={index}
          revealDelayMs={
            revealFrom !== undefined && index >= revealFrom
              ? Math.min(index - revealFrom, 8) * 30
              : undefined
          }
          isSelected={selectedRecordId === record.id}
          onSelect={() => onSelectRecord(record)}
          onGroup={
            onGroupRecord ? () => onGroupRecord(record) : undefined
          }
          onRemoveFromGroup={
            onRemoveRecordFromGroup
              ? () => onRemoveRecordFromGroup(record)
              : undefined
          }
          isRemovingFromGroup={removingRecordId === record.id}
          onRemoveFromWantlist={
            onRemoveRecordFromWantlist
              ? () => onRemoveRecordFromWantlist(record)
              : undefined
          }
          isRemovingFromWantlist={removingWantlistRecordId === record.id}
        />
      ))}
    </ul>
  );
}
