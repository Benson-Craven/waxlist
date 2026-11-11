"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDot,
  ExternalLink,
  Minus,
} from "lucide-react";

import { discogsSellReleaseUrl } from "@/lib/discogs/links";
import {
  formatPriceCents,
  type CollectionPriceMovement,
  type CollectionPricingSummary,
} from "@/lib/collection/pricing";

const INITIAL_ROWS_PER_GROUP = 6;
const ROW_GRID_CLASS =
  "grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(92px,1.5fr)_minmax(68px,auto)] sm:gap-4";

type MovementScale = {
  min: number;
  max: number;
  percent: (amountCents: number) => number;
};

/**
 * One shared value scale for every row, so blips can be compared vertically.
 * The 5% inset keeps a rounded marker inside the plot column.
 */
function buildScale(movements: CollectionPriceMovement[]): MovementScale {
  if (movements.length === 0) {
    return { min: 0, max: 0, percent: () => 50 };
  }

  const amounts = movements.flatMap((movement) =>
    movement.previousCents === null
      ? [movement.currentCents]
      : [movement.previousCents, movement.currentCents],
  );
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const span = max - min;

  return {
    min,
    max,
    percent: (amountCents) =>
      span === 0 ? 50 : 5 + ((amountCents - min) / span) * 90,
  };
}

function movementDeltaLabel(movement: CollectionPriceMovement) {
  if (movement.previousCents === null) {
    return "First check";
  }

  if (movement.changeCents === null || movement.changeCents === 0) {
    return "No change";
  }

  const amount = formatPriceCents(
    Math.abs(movement.changeCents),
    movement.currency,
  );
  const percent =
    movement.changePercent === null
      ? null
      : `${Math.abs(movement.changePercent).toFixed(1)}%`;

  return percent ? `${amount} · ${percent}` : amount;
}

function MovementDeltaIcon({
  movement,
}: {
  movement: CollectionPriceMovement;
}) {
  if (movement.previousCents === null) {
    return <CircleDot className="size-3 text-[#FFF4E8]/38" aria-hidden="true" />;
  }

  if (movement.changeCents === null || movement.changeCents === 0) {
    return <Minus className="size-3 text-[#FFF4E8]/38" aria-hidden="true" />;
  }

  return movement.changeCents < 0 ? (
    <ArrowDownRight className="size-3 text-[#FFF4E8]/65" aria-hidden="true" />
  ) : (
    <ArrowUpRight className="size-3 text-[#FFF4E8]/65" aria-hidden="true" />
  );
}

function MovementRow({
  movement,
  scale,
}: {
  movement: CollectionPriceMovement;
  scale: MovementScale;
}) {
  const current = scale.percent(movement.currentCents);
  const previous =
    movement.previousCents === null
      ? null
      : scale.percent(movement.previousCents);
  const connectorLeft =
    previous === null ? 0 : Math.min(previous, current);
  const connectorWidth =
    previous === null ? 0 : Math.abs(current - previous);
  const price = formatPriceCents(movement.currentCents, movement.currency);

  return (
    <div className={`grid ${ROW_GRID_CLASS} py-2.5`}>
      <div className="order-1 min-w-0 sm:order-none">
        <Link
          href={`/app?view=collection&q=${encodeURIComponent(movement.title)}`}
          className="block truncate text-[13px] font-medium text-[#FFF4E8] transition hover:text-[#f6dfc9]"
        >
          {movement.title}
        </Link>
        <p className="mt-0.5 truncate text-[11px] text-[#FFF4E8]/42">
          {movement.artist}
          <span aria-hidden="true" className="text-[#FFF4E8]/22">
            {" · "}
          </span>
          {movement.status === "wanted" ? "Wanted" : "Owned"}
        </p>
      </div>

      <div className="relative order-3 col-span-2 h-7 sm:order-none sm:col-span-1">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-[5%] right-[5%]"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(255,244,232,0.055) 1px, transparent 1px)",
            backgroundSize: "25% 100%",
          }}
        />
        {previous !== null ? (
          <>
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-px bg-[#FFF4E8]/36"
              style={{
                left: `${connectorLeft}%`,
                width: `${connectorWidth}%`,
              }}
            />
            <span
              title={`Previous value ${formatPriceCents(
                movement.previousCents!,
                movement.currency,
              )}`}
              aria-hidden="true"
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#08030f] shadow-[0_0_0_1px_rgba(255,244,232,0.6)]"
              style={{ left: `${previous}%` }}
            />
          </>
        ) : null}
        <a
          href={discogsSellReleaseUrl(movement.discogsReleaseId)}
          target="_blank"
          rel="noreferrer"
          title={`Buy ${movement.title} on Discogs`}
          aria-label={`Buy ${movement.title} by ${movement.artist} on Discogs (${price})`}
          className="group/blip absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08030f]"
          style={{ left: `${current}%` }}
        >
          <span className="grid size-4 place-items-center rounded-full bg-[#FFF4E8] text-[#08030f] shadow-[0_0_0_3px_rgba(8,3,15,0.92)] transition duration-150 group-hover/blip:scale-125 group-hover/blip:bg-[#f6dfc9] group-focus-visible/blip:scale-125">
            <ExternalLink className="size-2" aria-hidden="true" />
          </span>
        </a>
      </div>

      <div className="order-2 text-right sm:order-none">
        <span className="block text-[13px] tabular-nums text-[#FFF4E8]">
          {price}
        </span>
        <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular-nums text-[#FFF4E8]/46">
          <MovementDeltaIcon movement={movement} />
          {movementDeltaLabel(movement)}
        </span>
      </div>
    </div>
  );
}

function MovementGroup({
  label,
  emptyLabel,
  entries,
  scale,
}: {
  label: string;
  emptyLabel: string;
  entries: CollectionPriceMovement[];
  scale: MovementScale;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? entries
    : entries.slice(0, INITIAL_ROWS_PER_GROUP);

  return (
    <section className="mt-7 first:mt-0" aria-label={label}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[0.65rem] uppercase tracking-[0.18em] text-[#FFF4E8]/45">
          {label}
        </h3>
        <span className="text-[11px] tabular-nums text-[#FFF4E8]/38">
          {entries.length}
        </span>
      </div>
      <span className="mt-3 block h-px bg-[#FFF4E8]/10" aria-hidden="true" />

      {entries.length === 0 ? (
        <p className="mt-3 text-[11px] leading-5 text-[#FFF4E8]/38">
          {emptyLabel}
        </p>
      ) : (
        <ul>
          {visible.map((movement, index) => (
            <li key={movement.collectionItemId} className="list-none">
              {index > 0 ? (
                <span
                  className="block h-px bg-[#FFF4E8]/[0.06]"
                  aria-hidden="true"
                />
              ) : null}
              <MovementRow movement={movement} scale={scale} />
            </li>
          ))}
        </ul>
      )}

      {entries.length > INITIAL_ROWS_PER_GROUP ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-[11px] text-[#FFF4E8]/55 underline decoration-[#FFF4E8]/20 underline-offset-4 transition hover:text-[#FFF4E8] hover:decoration-[#FFF4E8]/45"
        >
          {expanded ? "Show less" : `Show all ${entries.length}`}
        </button>
      ) : null}
    </section>
  );
}

/**
 * The Dashboard price overview's graph: every valued vinyl is one row with a
 * hollow blip at its previous value and a cream blip at its current value. The
 * cream blip is a link to that release's Discogs marketplace page, so a price
 * drop can turn into a purchase in one press.
 */
export function PriceMovementBoard({
  summary,
}: {
  summary: CollectionPricingSummary;
}) {
  const { movements, currency } = summary;
  const all = [...movements.drops, ...movements.same, ...movements.increases];
  const scale = buildScale(all);

  return (
    <figure className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-[#FFF4E8]/38 sm:hidden">
        <span>Vinyl</span>
        <span className="tabular-nums">
          {formatPriceCents(scale.min, currency)} –{" "}
          {formatPriceCents(scale.max, currency)}
        </span>
      </div>
      <div
        className={`hidden ${ROW_GRID_CLASS} pb-2 text-[10px] uppercase tracking-[0.16em] text-[#FFF4E8]/38 sm:grid`}
      >
        <span>Vinyl</span>
        <span className="relative h-3">
          <span className="absolute left-[5%] top-0 -translate-x-1/2 tabular-nums">
            {formatPriceCents(scale.min, currency)}
          </span>
          <span className="absolute left-[95%] top-0 -translate-x-1/2 tabular-nums">
            {formatPriceCents(scale.max, currency)}
          </span>
        </span>
        <span className="text-right">Now</span>
      </div>

      <MovementGroup
        label="Price drops"
        emptyLabel="No drops yet. A vinyl lands here when a new check records a lower value."
        entries={movements.drops}
        scale={scale}
      />
      <MovementGroup
        label="Same price"
        emptyLabel="No held prices yet."
        entries={movements.same}
        scale={scale}
      />
      <MovementGroup
        label="Price increases"
        emptyLabel="No increases yet."
        entries={movements.increases}
        scale={scale}
      />

      <figcaption className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#FFF4E8]/38">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-[#08030f] shadow-[0_0_0_1px_rgba(255,244,232,0.6)]"
          />
          Previous check
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-[#FFF4E8]"
          />
          Latest value — opens Discogs to buy
        </span>
      </figcaption>
    </figure>
  );
}
