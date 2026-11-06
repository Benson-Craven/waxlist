"use client";

import { Heart, HeartOff, Loader2, Minus, Plus, Star } from "lucide-react";

import { LabelBadge } from "@/components/ui/label-badge";
import { formatShelfCode, isOnShelf } from "@/lib/collection/location";
import { formatPriceCents } from "@/lib/collection/pricing";
import type { CollectionRecord } from "@/lib/collection/record";
import { cn } from "@/lib/utils";

const SLEEVE_FALLBACKS = [
  "linear-gradient(150deg,#33203f,#0b0712)",
  "linear-gradient(150deg,#1c3a33,#070d0c)",
  "linear-gradient(150deg,#41202a,#0d0709)",
  "linear-gradient(150deg,#202a4a,#070911)",
];

export function CollectionRecordCover({
  record,
  index,
  compact = false,
}: {
  record: CollectionRecord;
  index: number;
  /** Smaller sleeve type for tight surfaces such as a group's stack. */
  compact?: boolean;
}) {
  return (
    <span className="relative block aspect-square overflow-hidden rounded-[10px] bg-[#120d18] shadow-[0_18px_34px_-24px_rgba(0,0,0,0.95)] transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_24px_40px_-24px_rgba(0,0,0,0.95)]">
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center p-3"
        style={{
          background: SLEEVE_FALLBACKS[index % SLEEVE_FALLBACKS.length],
        }}
      >
        <span
          aria-hidden="true"
          className="absolute size-[56%] rounded-full border border-[#FFF4E8]/10"
        />
        <span
          className={cn(
            "relative line-clamp-4 text-center font-serif italic leading-[1.05] text-[#FFF4E8]/68",
            compact
              ? "text-[0.58rem] leading-[1.15]"
              : "text-[clamp(0.65rem,1.6vw,0.95rem)]",
          )}
        >
          {record.title}
        </span>
      </span>
      {record.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={record.imageUrl}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : null}
    </span>
  );
}

/**
 * The cover action revealed on hover or keyboard focus. It is a plus where the
 * cover can be filed into a group and a minus inside a group, where the same
 * spot takes the record back out. Touch devices always show it.
 */
const COVER_ACTION_CLASS_NAME =
  "absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-[#FFF4E8] text-[#08030F] shadow-[0_6px_16px_rgba(0,0,0,0.45)] transition duration-150 hover:bg-[#f6dfc9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/60 disabled:cursor-wait pointer-events-none translate-y-0.5 opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:translate-y-0 focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100";

/**
 * The wantlist's own cover control. Unlike the group plus, it is always
 * visible: taking a record off the wantlist must be findable without knowing
 * to hover a sleeve. It sits opposite the plus as a dark chip and turns cream
 * on hover, so it reads as the removal half of the pair.
 */
const WANTLIST_ACTION_CLASS_NAME =
  "absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-[#08030F]/82 text-[#FFF4E8]/86 ring-1 ring-[#FFF4E8]/28 shadow-[0_6px_16px_rgba(0,0,0,0.45)] backdrop-blur-sm transition duration-150 hover:bg-[#FFF4E8] hover:text-[#08030F] hover:ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/70 disabled:cursor-wait disabled:opacity-70";

/**
 * The one cover card used by the Collection grid, its shelving groups, and the
 * Wantlist. Showing group state here keeps the group action, selection ring,
 * and shelf code identical everywhere a record is browsed.
 */
export function CollectionRecordCard({
  record,
  index,
  isSelected,
  onSelect,
  onGroup,
  onRemoveFromGroup,
  isRemovingFromGroup = false,
  onRemoveFromWantlist,
  isRemovingFromWantlist = false,
  groupLabel = "group",
  revealDelayMs,
}: {
  record: CollectionRecord;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onGroup?: () => void;
  onRemoveFromGroup?: () => void;
  isRemovingFromGroup?: boolean;
  /** Only the wantlist passes this; it takes the want off the list for good. */
  onRemoveFromWantlist?: () => void;
  isRemovingFromWantlist?: boolean;
  groupLabel?: string;
  /** Set for cards revealed by "show all", so they rise in with a stagger. */
  revealDelayMs?: number;
}) {
  const shelfCode = formatShelfCode(record);
  const shelfLabel = isOnShelf(record)
    ? shelfCode || "Group only"
    : "Unsorted";
  const currentGroup = record.group?.trim() ?? "";
  const actionLabel = onRemoveFromGroup
    ? currentGroup
      ? `Remove ${record.title} from ${currentGroup}`
      : `Remove ${record.title} from its ${groupLabel}`
    : `Add ${record.title} to a ${groupLabel}`;

  const isRevealing = typeof revealDelayMs === "number";

  return (
    <li
      className={cn("group relative min-w-0", isRevealing && "wax-reveal")}
      style={isRevealing ? { animationDelay: `${revealDelayMs}ms` } : undefined}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${record.artist} — ${record.title}`}
        className="block w-full text-left focus-visible:outline-none"
      >
        <span
          className={cn(
            "block rounded-[12px] transition focus-visible:outline-none",
            isSelected
              ? "shadow-[0_0_0_2px_#FFF4E8,0_26px_50px_-28px_rgba(0,0,0,0.95)]"
              : "group-focus-visible:shadow-[0_0_0_2px_#FFF4E8]",
          )}
        >
          <CollectionRecordCover record={record} index={index} />
        </span>
        <span className="mt-3 block truncate text-[13px] font-medium leading-tight text-[#FFF4E8]">
          {record.title}
        </span>
        <span className="mt-1 block truncate text-[11.5px] leading-tight text-[#FFF4E8]/45">
          {record.artist}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5">
          {record.status === "wanted" ? (
            <>
              <LabelBadge tone="quiet" size="xs" title="Wanted">
                <Heart className="size-3 fill-current" aria-hidden="true" />
                <span className="sr-only">Wanted</span>
              </LabelBadge>
              {record.group ? (
                <span className="min-w-0 truncate text-[9.5px] uppercase tracking-[0.16em] text-[#FFF4E8]/32">
                  {record.group}
                </span>
              ) : null}
            </>
          ) : (
            <span className="truncate text-[9.5px] uppercase tracking-[0.16em] text-[#FFF4E8]/32">
              {shelfLabel}
            </span>
          )}
          {record.favourite ? (
            <span
              className="inline-flex shrink-0 text-[#FFF4E8]/72"
              title="Favourite"
            >
              <Star className="size-3 fill-current" aria-hidden="true" />
            </span>
          ) : null}
          {record.pricing ? (
            <span
              className="ml-auto shrink-0 text-[10px] tabular-nums text-[#FFF4E8]/50"
              title={`Recorded ${formatPriceCents(
                record.pricing.currentCents,
                record.pricing.currency,
              )}`}
            >
              {formatPriceCents(
                record.pricing.currentCents,
                record.pricing.currency,
              )}
            </span>
          ) : null}
        </span>
      </button>

      {onRemoveFromGroup || onGroup ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (onRemoveFromGroup) {
              onRemoveFromGroup();
              return;
            }

            onGroup?.();
          }}
          aria-label={actionLabel}
          title={
            onRemoveFromGroup ? "Remove from group" : `Add to a ${groupLabel}`
          }
          disabled={isRemovingFromGroup}
          className={COVER_ACTION_CLASS_NAME}
        >
          {onRemoveFromGroup ? (
            isRemovingFromGroup ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Minus className="size-4" aria-hidden="true" />
            )
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
        </button>
      ) : null}

      {onRemoveFromWantlist ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemoveFromWantlist();
          }}
          aria-label={`Remove ${record.title} from the wantlist`}
          title="Remove from wantlist"
          disabled={isRemovingFromWantlist}
          className={WANTLIST_ACTION_CLASS_NAME}
        >
          {isRemovingFromWantlist ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <HeartOff className="size-4" aria-hidden="true" />
          )}
        </button>
      ) : null}
    </li>
  );
}
