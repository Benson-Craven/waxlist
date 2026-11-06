"use client";

import { CollectionRecordCover } from "@/components/collection/record-card";
import type { CollectionRecord } from "@/lib/collection/record";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_COVERS = 4;

/**
 * A group's vinyls stacked like a crate: the first record sits on top and the
 * rest peek out behind it. The stack is the group tile's identity, so a closed
 * group still reads as a physical pile instead of another run of covers.
 */
export function RecordStack({
  records,
  className,
  maxVisible = MAX_VISIBLE_COVERS,
}: {
  records: CollectionRecord[];
  className?: string;
  maxVisible?: number;
}) {
  const visible = records.slice(0, maxVisible);

  return (
    <span
      aria-hidden="true"
      className={cn("relative block aspect-square", className)}
    >
      {visible.map((record, index) => {
        // The first record is the front sleeve; every later record sits one
        // layer further back so the pile reads top-down in shelf order.
        const depth = index;

        return (
          <span
            key={record.id}
            className="absolute inset-0 rounded-[10px] shadow-[0_0_0_1px_rgba(255,244,232,0.09)]"
            style={{
              zIndex: visible.length - depth,
              opacity: 1 - depth * 0.1,
              transform: `translate(${depth * 8}px, ${
                depth * -5
              }px) rotate(${depth * 1.3}deg) scale(${1 - depth * 0.045})`,
            }}
          >
            <CollectionRecordCover record={record} index={index} compact />
          </span>
        );
      })}
    </span>
  );
}
