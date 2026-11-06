"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { RecordStack } from "@/components/collection/record-stack";
import { VinylGrid } from "@/components/collection/vinyl-grid";
import { Collapse } from "@/components/ui/collapse";
import type { CollectionRecord } from "@/lib/collection/record";
import type { ShelfGroupBucket } from "@/lib/collection/shelf";
import { cn } from "@/lib/utils";

type GroupDialogOpen = (options?: {
  group?: string;
  recordIds?: string[];
}) => void;

/**
 * The physical shelf: one tile per group, each showing its records as a stack
 * of sleeves. Tiles sit in a responsive grid and open in place, so the page
 * stays a crate overview until a group is worth looking through.
 *
 * Inside a group every cover carries a minus that takes it back out. The
 * `Unsorted` tile is not a group, so its covers keep the plus instead.
 */
export function ShelvingGrid({
  groups,
  selectedRecordId,
  onSelectRecord,
  onOpenGroupDialog,
  onRemoveRecordFromGroup,
  removingRecordId,
}: {
  groups: ShelfGroupBucket[];
  selectedRecordId: string | null;
  onSelectRecord: (record: CollectionRecord) => void;
  onOpenGroupDialog: GroupDialogOpen;
  onRemoveRecordFromGroup?: (record: CollectionRecord) => void;
  removingRecordId?: string | null;
}) {
  const [openGroupIds, setOpenGroupIds] = useState<string[]>([]);

  function toggleGroup(groupId: string) {
    setOpenGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => {
        const slug = group.id.replace(/[^a-z0-9]+/gi, "-");
        const titleId = `shelving-${slug}`;
        const panelId = `shelving-${slug}-records`;
        const isOpen = openGroupIds.includes(group.id);

        return (
          <section
            key={group.id}
            aria-labelledby={titleId}
            className={cn(
              "group/tile rounded-[22px] bg-[#FFF4E8]/[0.06] p-4 transition-colors duration-300 hover:bg-[#FFF4E8]/[0.1] focus-within:bg-[#FFF4E8]/[0.1]",
              isOpen &&
                "col-span-full bg-[#FFF4E8]/[0.08] p-5 hover:bg-[#FFF4E8]/[0.08] sm:p-6",
            )}
          >
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex w-full items-start gap-4 rounded-[16px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40"
            >
              <RecordStack
                records={group.records}
                className="mr-2 w-[4.75rem] shrink-0 sm:w-[5.25rem]"
              />

              <span className="min-w-0 flex-1 pt-0.5">
                <span
                  id={titleId}
                  className={cn(
                    "block truncate font-serif text-2xl italic leading-none tracking-[-0.015em]",
                    group.isUnsorted ? "text-[#FFD4B5]" : "text-[#FFF4E8]",
                  )}
                >
                  {group.label}
                </span>
                <span className="mt-2 block text-[11px] tabular-nums text-[#FFF4E8]/40">
                  {group.recordCount.toLocaleString()}{" "}
                  {group.recordCount === 1 ? "record" : "records"}
                </span>
                <span className="mt-3 block text-[10px] uppercase tracking-[0.16em] text-[#FFF4E8]/46 transition group-hover/tile:text-[#FFF4E8]/72">
                  {isOpen ? "Fold group" : "Open group"}
                </span>
              </span>

              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#FFF4E8]/7 text-[#FFF4E8]/62 transition group-hover/tile:bg-[#FFF4E8]/12 group-hover/tile:text-[#FFF4E8]">
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform duration-300",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </span>
            </button>

            <Collapse open={isOpen} id={panelId}>
              <div className="pt-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#FFF4E8]/32">
                      {group.isUnsorted
                        ? "Not filed in a group yet"
                        : `${group.recordCount.toLocaleString()} ${
                            group.recordCount === 1 ? "vinyl" : "vinyls"
                          } in this group`}
                    </p>
                    {group.isUnsorted ? null : (
                      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#FFF4E8]/26">
                        Minus removes a vinyl from this group
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      group.isUnsorted
                        ? onOpenGroupDialog({
                            recordIds: group.records.map((record) => record.id),
                          })
                        : onOpenGroupDialog({ group: group.label })
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E8]/8 px-3.5 py-1.5 text-[11px] font-medium text-[#FFF4E8]/70 transition hover:bg-[#FFF4E8]/14 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {group.isUnsorted ? "Group these" : "Add records"}
                  </button>
                </div>

                <VinylGrid
                  records={group.records}
                  selectedRecordId={selectedRecordId}
                  onSelectRecord={onSelectRecord}
                  onGroupRecord={
                    group.isUnsorted
                      ? (record) =>
                          onOpenGroupDialog({ recordIds: [record.id] })
                      : undefined
                  }
                  onRemoveRecordFromGroup={
                    group.isUnsorted ? undefined : onRemoveRecordFromGroup
                  }
                  removingRecordId={removingRecordId}
                />
              </div>
            </Collapse>
          </section>
        );
      })}
    </div>
  );
}
