"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Tag,
} from "lucide-react";

import { CollectionValueChart } from "@/components/dashboard/collection-value-chart";
import { PriceMovementBoard } from "@/components/dashboard/price-movement-board";
import { Button } from "@/components/ui/button";
import {
  formatPriceCents,
  formatPriceDate,
  type CollectionPricingSummary,
} from "@/lib/collection/pricing";

type RefreshPayload = {
  updated?: number;
  checked?: number;
  unavailable?: number;
  failed?: number;
  skipped?: number;
  rateLimited?: boolean;
  retryAfterSeconds?: number | null;
  error?: {
    message?: string;
  };
};

function movementLabel(summary: CollectionPricingSummary) {
  if (summary.changeCents === null) {
    return "Waiting for a second check";
  }

  if (summary.changeCents === 0) {
    return "No change since the previous check";
  }

  const direction = summary.changeCents < 0 ? "Down" : "Up";
  const amount = formatPriceCents(Math.abs(summary.changeCents), summary.currency);
  const percent =
    summary.changePercent === null
      ? null
      : `${Math.abs(summary.changePercent).toFixed(1)}%`;

  return [direction, amount, percent ? `(${percent})` : null, "since the previous check"]
    .filter(Boolean)
    .join(" ");
}

function MovementIcon({ summary }: { summary: CollectionPricingSummary }) {
  if (summary.changeCents === null || summary.changeCents === 0) {
    return <Tag className="size-3.5 text-[#FFF4E8]/46" aria-hidden="true" />;
  }

  return summary.changeCents < 0 ? (
    <ArrowDownRight
      className="size-3.5 text-[#FFF4E8]/72"
      aria-hidden="true"
    />
  ) : (
    <ArrowUpRight className="size-3.5 text-[#FFF4E8]/72" aria-hidden="true" />
  );
}

export function CollectionValuePanel({
  pricing,
  canRefreshPrices,
  recordCount,
}: {
  pricing: CollectionPricingSummary | null;
  canRefreshPrices: boolean;
  /** Every vinyl the overview can value, owned and wanted. */
  recordCount: number;
}) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshPrices() {
    setIsRefreshing(true);
    setNotice(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/collection/prices/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => null)) as
        | RefreshPayload
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Record values could not be refreshed.",
        );
      }

      const updated = payload?.updated ?? 0;
      const unavailable = payload?.unavailable ?? 0;
      const failed = payload?.failed ?? 0;
      const checked = payload?.checked ?? 0;

      if (payload?.rateLimited) {
        setNotice(
          `Discogs paused the check after ${updated} ${
            updated === 1 ? "value" : "values"
          }. Try again in about ${payload.retryAfterSeconds ?? 60} seconds.`,
        );
      } else if (checked === 0) {
        setNotice("Every priced record was checked recently. Values are current.");
      } else {
        setNotice(
          `Checked ${checked} ${checked === 1 ? "record" : "records"}: ${updated} updated${
            unavailable > 0 ? `, ${unavailable} without a marketplace price` : ""
          }${failed > 0 ? `, ${failed} unavailable` : ""}.`,
        );
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Record values could not be refreshed.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const checkedLabel = formatPriceDate(pricing?.lastObservedAt ?? null);
  const movement = pricing ? movementLabel(pricing) : null;

  return (
    <section
      aria-labelledby="collection-value-heading"
      className="mt-12"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[#FFF4E8]/45">
            Price overview
          </p>
          <h2
            id="collection-value-heading"
            className="mt-2 font-serif text-[clamp(1.8rem,3.2vw,2.6rem)] italic leading-none tracking-[-0.015em] text-[#FFF4E8]"
          >
            {pricing
              ? formatPriceCents(pricing.totalCents, pricing.currency)
              : "Not valued yet"}
          </h2>
          {pricing ? (
            <div className="mt-3 text-xs leading-5 text-[#FFF4E8]/52">
              <span className="inline-flex items-center gap-1.5 align-middle">
                <MovementIcon summary={pricing} />
                <span>{movement}</span>
              </span>
              <span aria-hidden="true" className="mx-2 text-[#FFF4E8]/22">
                ·
              </span>
              <span className="tabular-nums">
                {pricing.pricedCount.toLocaleString()} of{" "}
                {(
                  pricing.pricedCount + pricing.unpricedCount
                ).toLocaleString()}{" "}
                vinyls priced
                {pricing.ownedPricedCount > 0 ||
                pricing.wantedPricedCount > 0 ? (
                  <span className="text-[#FFF4E8]/38">
                    {" · "}
                    {[
                      pricing.ownedPricedCount > 0
                        ? `${pricing.ownedPricedCount.toLocaleString()} owned`
                        : null,
                      pricing.wantedPricedCount > 0
                        ? `${pricing.wantedPricedCount.toLocaleString()} wanted`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </span>
              {checkedLabel ? (
                <>
                  <span aria-hidden="true" className="mx-2 text-[#FFF4E8]/22">
                    ·
                  </span>
                  <span className="whitespace-nowrap">
                    Last checked {checkedLabel}
                  </span>
                </>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#FFF4E8]/52">
              Prices appear here for every vinyl you value, owned or wanted.
              Open a vinyl in Collection and fetch its Discogs price, or save a
              value by hand. Every check adds a blip to the graph.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canRefreshPrices && recordCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={refreshPrices}
              disabled={isRefreshing}
              className="rounded-full border-[#FFF4E8]/14 bg-[#FFF4E8]/7 text-[#FFF4E8]/78 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
            >
              {isRefreshing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {isRefreshing ? "Checking prices" : "Refresh prices"}
            </Button>
          ) : null}
          <Button
            asChild
            variant="outline"
            className="rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8]"
          >
            <Link href="/app?view=collection">
              {pricing ? "Open collection" : "Value a vinyl"}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="mt-4 text-xs leading-5 text-[#FFF4E8]/58"
        >
          {notice}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 text-xs leading-5 text-[#F08A4B]"
        >
          {errorMessage}
        </p>
      ) : null}

      {pricing ? (
        <>
          <div className="mt-6 h-px bg-[#FFF4E8]/10" aria-hidden="true" />
          <PriceMovementBoard summary={pricing} />

          {pricing.otherCurrencyCount > 0 ? (
            <p className="mt-4 text-[11px] leading-5 text-[#FFF4E8]/38">
              {pricing.otherCurrencyCount.toLocaleString()}{" "}
              {pricing.otherCurrencyCount === 1 ? "vinyl is" : "vinyls are"}{" "}
              priced in another currency and left out of this{" "}
              {pricing.currency} overview.
            </p>
          ) : null}

          {pricing.series.length > 1 ? (
            <div className="mt-10">
              <div className="h-px bg-[#FFF4E8]/10" aria-hidden="true" />
              <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <h3 className="text-[0.65rem] uppercase tracking-[0.18em] text-[#FFF4E8]/45">
                    Tracked total · last {pricing.periodDays} days
                  </h3>
                  <CollectionValueChart summary={pricing} />
                </div>
                <p className="max-w-sm self-end text-xs leading-5 text-[#FFF4E8]/42">
                  The line carries the last known value forward between checks,
                  so a quiet week is a flat line, not a gap.
                </p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
