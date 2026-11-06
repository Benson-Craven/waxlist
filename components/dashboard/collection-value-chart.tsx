"use client";

import { useId } from "react";

import {
  formatPriceCents,
  formatPriceDate,
  type CollectionPricingSummary,
} from "@/lib/collection/pricing";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 210;
const PADDING_X = 8;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 8;

type ChartPoint = {
  x: number;
  y: number;
  amountCents: number;
  date: string;
};

function buildChartPoints(series: CollectionPricingSummary["series"]) {
  if (series.length === 0) {
    return { points: [] as ChartPoint[], min: 0, max: 0 };
  }

  const amounts = series.map((point) => point.amountCents);
  const rawMin = Math.min(...amounts);
  const rawMax = Math.max(...amounts);
  const spread = rawMax - rawMin;
  const padding = spread === 0 ? Math.max(rawMax * 0.04, 100) : spread * 0.12;
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const plotWidth = CHART_WIDTH - PADDING_X * 2;
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const points = series.map((point, index) => {
    const x =
      series.length === 1
        ? CHART_WIDTH / 2
        : PADDING_X + (index / (series.length - 1)) * plotWidth;
    const ratio = max === min ? 0.5 : (point.amountCents - min) / (max - min);

    return {
      x,
      y: PADDING_TOP + (1 - ratio) * plotHeight,
      amountCents: point.amountCents,
      date: point.date,
    };
  });

  return { points, min: rawMin, max: rawMax };
}

function buildLinePath(points: ChartPoint[]) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
}

export function CollectionValueChart({
  summary,
}: {
  summary: CollectionPricingSummary;
}) {
  const gradientId = `wax-value-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { points, min, max } = buildChartPoints(summary.series);
  const firstPoint = points[0] ?? null;
  const lastPoint = points.at(-1) ?? null;
  const linePath = buildLinePath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L${lastPoint!.x} ${CHART_HEIGHT - PADDING_BOTTOM} L${firstPoint!.x} ${
          CHART_HEIGHT - PADDING_BOTTOM
        } Z`
      : "";
  const firstDate = formatPriceDate(summary.series[0]?.date ?? null);
  const lastDate = formatPriceDate(
    summary.series.at(-1)?.date ?? summary.lastObservedAt,
  );

  if (points.length < 2) {
    return (
      <div className="mt-6 flex min-h-[9rem] flex-col justify-end py-5">
        <span
          className="block h-px w-full bg-[repeating-linear-gradient(90deg,rgba(255,244,232,0.22)_0_6px,transparent_6px_12px)]"
          aria-hidden="true"
        />
        <p className="mt-4 text-xs leading-5 text-[#FFF4E8]/46">
          One value recorded. Update it from the record inspector to draw the
          tracked total&rsquo;s trend.
        </p>
      </div>
    );
  }

  return (
    <figure className="mt-6">
      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.16em] text-[#FFF4E8]/38">
        <span>{formatPriceCents(Math.round(min / 100) * 100, summary.currency)}</span>
        <span>{formatPriceCents(Math.round(max / 100) * 100, summary.currency)}</span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="mt-2 h-auto w-full overflow-visible"
        role="img"
        aria-label={`Tracked total trend from ${formatPriceCents(
          firstPoint!.amountCents,
          summary.currency,
        )} on ${firstDate ?? "the first check"} to ${formatPriceCents(
          lastPoint!.amountCents,
          summary.currency,
        )} on ${lastDate ?? "the latest check"}.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF4E8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FFF4E8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={PADDING_X}
            x2={CHART_WIDTH - PADDING_X}
            y1={PADDING_TOP + ratio * (CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM)}
            y2={PADDING_TOP + ratio * (CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM)}
            stroke="rgba(255,244,232,0.08)"
            strokeWidth="1"
          />
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="#FFF4E8"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {lastPoint ? (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3.4"
            fill="#FFF4E8"
            stroke="#08030f"
            strokeWidth="2"
          />
        ) : null}
      </svg>
      <figcaption className="mt-1 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.16em] text-[#FFF4E8]/38">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </figcaption>
    </figure>
  );
}
