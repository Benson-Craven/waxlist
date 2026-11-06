"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Star, Trash2 } from "lucide-react";

import {
  requestDeleteCollectionRecord,
  requestPatchCollectionRecord,
} from "@/lib/collection/actions";
import type { CollectionRecord } from "@/lib/collection/record";
import {
  SELECTED_RECORD_CHANGED_EVENT,
  selectedRecordFromCollection,
} from "@/lib/workspace/selected-record";
import { cn } from "@/lib/utils";

function emitSelectedRecord(record: CollectionRecord) {
  window.dispatchEvent(
    new CustomEvent(SELECTED_RECORD_CHANGED_EVENT, {
      detail: selectedRecordFromCollection(record),
    }),
  );
}

const actionButtonClass =
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#FFF4E8]/56 transition hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/50 disabled:cursor-not-allowed disabled:opacity-45";

export function FavouriteButton({
  record,
  onChanged,
  className,
}: {
  record: Pick<CollectionRecord, "id" | "title" | "favourite">;
  onChanged?: (record: CollectionRecord) => void;
  className?: string;
}) {
  const [optimisticFavourite, setOptimisticFavourite] = useState<
    boolean | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const favourite = optimisticFavourite ?? record.favourite;

  async function toggle() {
    if (isSaving) return;

    setIsSaving(true);
    const next = !favourite;

    try {
      const updated = await requestPatchCollectionRecord(record.id, {
        favourite: next,
      });

      setOptimisticFavourite(updated.favourite);
      emitSelectedRecord(updated);
      onChanged?.(updated);
    } catch {
      // Keep the previous state; the row simply does not change.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={favourite}
      aria-label={
        favourite
          ? `Remove ${record.title} from favourites`
          : `Favourite ${record.title}`
      }
      title={favourite ? "Remove from favourites" : "Favourite"}
      className={cn(
        actionButtonClass,
        favourite && "text-[#FFF4E8] hover:text-[#f6dfc9]",
        className,
      )}
    >
      {isSaving ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Star
          className={cn("size-4", favourite && "fill-current")}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export function DeleteRecordButton({
  recordId,
  title,
  onDeleted,
  label,
  className,
}: {
  recordId: string;
  title: string;
  onDeleted?: (id: string) => void;
  label?: string;
  className?: string;
}) {
  const [isArmed, setIsArmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleClick() {
    if (isSaving) return;

    if (!isArmed) {
      setIsArmed(true);
      timerRef.current = setTimeout(() => setIsArmed(false), 4000);
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setIsSaving(true);

    try {
      await requestDeleteCollectionRecord(recordId);
      onDeleted?.(recordId);
    } catch {
      setIsArmed(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        isArmed ? `Confirm delete ${title}` : `Delete ${title} from collection`
      }
      title={isArmed ? "Click again to delete" : "Delete record"}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full text-[#FFF4E8]/56 transition hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/50 disabled:cursor-not-allowed disabled:opacity-45",
        label ? "h-9 w-full gap-2 px-4 text-xs font-medium" : "size-8",
        isArmed && "bg-[#D34278]/14 text-[#FFD7E4] hover:bg-[#D34278]/20",
        className,
      )}
    >
      {isSaving ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <>
          <Trash2 className="size-4" aria-hidden="true" />
          {label ? (
            <span>{isArmed ? "Click again to delete" : label}</span>
          ) : null}
        </>
      )}
    </button>
  );
}

export function RecordQuickActions({
  record,
  onChanged,
  onDeleted,
  className,
}: {
  record: CollectionRecord;
  onChanged?: (record: CollectionRecord) => void;
  onDeleted?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <FavouriteButton record={record} onChanged={onChanged} />
      <DeleteRecordButton
        recordId={record.id}
        title={record.title}
        onDeleted={onDeleted}
      />
    </div>
  );
}

export function RecordStatusToggle({
  record,
  onChanged,
  className,
}: {
  record: Pick<CollectionRecord, "id" | "title" | "status">;
  onChanged?: (record: CollectionRecord) => void;
  className?: string;
}) {
  const [optimisticStatus, setOptimisticStatus] = useState<
    "owned" | "wanted" | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const status = optimisticStatus ?? record.status;

  async function change(nextStatus: "owned" | "wanted") {
    if (isSaving || nextStatus === status) return;

    setIsSaving(true);

    try {
      const updated = await requestPatchCollectionRecord(record.id, {
        status: nextStatus,
      });

      setOptimisticStatus(updated.status);
      emitSelectedRecord(updated);
      onChanged?.(updated);
    } catch {
      // The current state stays visible if the save fails.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-[#FFF4E8]/7 p-0.5",
        className,
      )}
      role="group"
      aria-label={`Status for ${record.title}`}
    >
      {(["owned", "wanted"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => change(option)}
          disabled={isSaving}
          aria-pressed={status === option}
          className={cn(
            "min-w-max cursor-pointer rounded-full px-3 py-1 text-xs font-medium capitalize transition disabled:cursor-not-allowed disabled:opacity-50",
            status === option
              ? "bg-[#FFF4E8] text-[#08030f]"
              : "text-[#FFF4E8]/56 hover:text-[#FFF4E8]",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
