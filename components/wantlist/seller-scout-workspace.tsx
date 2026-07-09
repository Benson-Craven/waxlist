"use client";

import { useState } from "react";
import { ExternalLink, Loader2, PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SellerScoutRun } from "@/lib/wishlist/seller-scout";

type SellerScoutPayload = {
  sellerScoutRun?: SellerScoutRun & {
    stoppedForRateLimit?: boolean;
    requestDelayMs?: number;
    rateLimit?: unknown;
  };
  error?: {
    message?: string;
  };
};

async function readSellerScoutResponse(response: Response) {
  const payload = (await response
    .json()
    .catch(() => null)) as SellerScoutPayload | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? "Seller Scout could not be loaded.",
    );
  }

  return payload;
}

function formatCheckedAt(checkedAt: string | null) {
  if (!checkedAt) {
    return "Checked time unknown";
  }

  const date = new Date(checkedAt);

  if (Number.isNaN(date.getTime())) {
    return "Checked time unknown";
  }

  return `Checked ${date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function formatFreshness(freshForSeconds: number | null) {
  if (freshForSeconds === null) {
    return "Freshness unknown";
  }

  if (freshForSeconds < 60) {
    return `Fresh for ${freshForSeconds}s`;
  }

  return `Fresh for ${Math.round(freshForSeconds / 60)}m`;
}

function formatFailureRetry(retryAfterSeconds: number | null | undefined) {
  if (typeof retryAfterSeconds !== "number") {
    return null;
  }

  return retryAfterSeconds > 0
    ? `Retry after about ${retryAfterSeconds.toLocaleString()}s.`
    : "Retry when Discogs allows another request.";
}

export function SellerScoutWorkspace({ hasRecords }: { hasRecords: boolean }) {
  const [run, setRun] = useState<SellerScoutPayload["sellerScoutRun"] | null>(
    null,
  );
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function runSellerScout() {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/wishlist/seller-scout", {
        method: "POST",
        cache: "no-store",
      });
      const payload = await readSellerScoutResponse(response);

      setRun(payload?.sellerScoutRun ?? null);
      setStatus("idle");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Seller Scout could not be loaded.",
      );
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-[#FFF4E8]/10 bg-[#111116] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#FFF4E8]">
            Seller Bundle Scout
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#FFF4E8]/54">
            Find Discogs sellers who appear to carry multiple exact wants.
            WAXLIST shows listing evidence only; final shipping, handling, tax,
            and checkout totals stay in Discogs.
          </p>
        </div>
        <Button
          type="button"
          onClick={runSellerScout}
          disabled={!hasRecords || status === "loading"}
          className="rounded-full bg-[#FFF4E8] px-5 text-[#08030f] hover:bg-[#f6dfc9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <PackagePlus className="size-4" aria-hidden="true" />
          )}
          {run ? "Refresh scout" : "Run Seller Scout"}
        </Button>
      </div>

      {!hasRecords ? (
        <div className="mt-5 rounded-xl border border-[#FFF4E8]/8 bg-[#0b0b0f] p-4 text-sm text-[#FFF4E8]/58">
          Save exact wanted records before scouting seller bundles.
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-xl border border-[#D34278]/24 bg-[#D34278]/8 p-4 text-sm leading-6 text-[#FFF4E8]/78">
          {error}
        </div>
      ) : null}

      {run ? (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2 text-xs text-[#FFF4E8]/58">
            <span className="rounded-full bg-[#1b1b20] px-3 py-1.5">
              {run.opportunities.length} multi-want sellers
            </span>
            <span className="rounded-full bg-[#1b1b20] px-3 py-1.5">
              {run.wantsScanned}/{run.totalWants} wants scanned
            </span>
            <span className="rounded-full bg-[#1b1b20] px-3 py-1.5">
              {run.maxListingsPerWant} listings per want max
            </span>
            <span className="rounded-full bg-[#1b1b20] px-3 py-1.5">
              {formatCheckedAt(run.checkedAt)}
            </span>
            {run.truncated ? (
              <span className="rounded-full bg-[#351f15] px-3 py-1.5 text-[#F08A4B]">
                Capped run
              </span>
            ) : null}
            {run.failures.length > 0 ? (
              <span className="rounded-full bg-[#351a24] px-3 py-1.5 text-[#D34278]">
                {run.failures.length} lookup issue
                {run.failures.length === 1 ? "" : "s"}
              </span>
            ) : null}
            {run.stoppedForRateLimit ? (
              <span className="rounded-full bg-[#351a24] px-3 py-1.5 text-[#D34278]">
                Stopped for Discogs rate limit
              </span>
            ) : null}
          </div>

          {run.failures.length > 0 ? (
            <div className="mt-4 rounded-xl border border-[#D34278]/18 bg-[#D34278]/8 p-4 text-xs leading-5 text-[#FFF4E8]/68">
              {run.failures.slice(0, 4).map((failure) => (
                <p key={`${failure.releaseId}:${failure.wantedRecordId}`}>
                  Release {failure.releaseId}: {failure.message}{" "}
                  {formatFailureRetry(failure.retryAfterSeconds)}
                </p>
              ))}
            </div>
          ) : null}

          {run.opportunities.length > 0 ? (
            <div className="mt-5 grid gap-4">
              {run.opportunities.map((opportunity) => (
                <article
                  key={opportunity.sellerUsername}
                  className="rounded-xl border border-[#FFF4E8]/8 bg-[#0b0b0f] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#FFF4E8]">
                        {opportunity.sellerUsername}
                      </p>
                      <p className="mt-1 text-xs text-[#FFF4E8]/48">
                        {opportunity.coverageCount} wants covered ·{" "}
                        {opportunity.itemSubtotal.label} ·{" "}
                        {opportunity.shippingSummary.label}
                      </p>
                      <p className="mt-1 text-xs text-[#FFF4E8]/38">
                        {formatCheckedAt(opportunity.checkedAt)} ·{" "}
                        {formatFreshness(opportunity.freshForSeconds)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#FFF4E8]/46">
                        {opportunity.shipsFrom.length > 0 ? (
                          <span>
                            Ships from {opportunity.shipsFrom.join(", ")}
                          </span>
                        ) : null}
                        {opportunity.sellerRating ? (
                          <span>
                            Rating {opportunity.sellerRating}
                            {opportunity.sellerTotalRatings
                              ? ` from ${opportunity.sellerTotalRatings} ratings`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {opportunity.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full bg-[#1b1b20] px-2.5 py-1 text-[11px] text-[#FFF4E8]/50"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {opportunity.sellerInventoryUri ? (
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-full border-transparent bg-[#1b1b20] text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
                        >
                          <a
                            href={opportunity.sellerInventoryUri}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Seller inventory
                            <ExternalLink
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {opportunity.listings.map((listing) => (
                      <div
                        key={listing.listingId}
                        className="grid gap-2 rounded-lg bg-[#15151a] p-3 text-xs text-[#FFF4E8]/58 md:grid-cols-[minmax(0,1fr)_8rem_10rem_6rem]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#FFF4E8]/82">
                            {listing.wantedTitle}
                          </p>
                          <p className="mt-1 truncate text-[#FFF4E8]/42">
                            {listing.mediaCondition ?? "Condition unknown"}
                            {listing.sleeveCondition
                              ? ` / Sleeve ${listing.sleeveCondition}`
                              : ""}
                          </p>
                          {listing.controlWarnings.length > 0 ? (
                            <p className="mt-1 truncate text-[#F08A4B]/72">
                              {listing.controlWarnings.join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <span>{listing.itemPriceLabel}</span>
                        <span>{listing.shipping.label}</span>
                        {listing.listingUri ? (
                          <a
                            href={listing.listingUri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[#FFF4E8]/78 hover:text-[#FFF4E8]"
                          >
                            Listing
                            <ExternalLink
                              className="size-3"
                              aria-hidden="true"
                            />
                          </a>
                        ) : (
                          <span>No link</span>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-[#FFF4E8]/8 bg-[#0b0b0f] p-4 text-sm leading-6 text-[#FFF4E8]/58">
              No seller currently covers multiple exact wants in the scanned
              listings.
              {run.singleSellerMatches.length > 0
                ? ` ${run.singleSellerMatches.length} sellers matched one want.`
                : ""}
            </div>
          )}

          <div className="mt-5 grid gap-2 text-xs leading-5 text-[#FFF4E8]/42">
            {run.caveats.map((caveat) => (
              <p key={caveat}>{caveat}</p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
