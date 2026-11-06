"use client";

import { useState, type FormEvent } from "react";
import {
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  Disc3,
  ExternalLink,
  Heart,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PressingDetectivePanel } from "@/components/app-shell/pressing-detective-panel";
import { ShelfLocationSummary } from "@/components/shelf/shelf-location";
import { StarRating } from "@/components/ui/star-rating";
import {
  DeleteRecordButton,
  FavouriteButton,
} from "@/components/records/record-actions";
import { requestAddCollectionRecord } from "@/lib/collection/actions";
import {
  formatPriceCents,
  formatPriceDate,
  formatPriceInput,
  parsePriceToCents,
  SUPPORTED_PRICE_CURRENCIES,
  type RecordPriceSummary,
} from "@/lib/collection/pricing";
import type { CollectionRecord } from "@/lib/collection/record";
import {
  SELECTED_RECORD_CHANGED_EVENT,
  applySelectedRecordPatch,
  createWishlistRecordFromSelected,
  selectedRecordFromCollection,
  type SelectedRecord,
  type SelectedRecordPatch,
} from "@/lib/workspace/selected-record";
import {
  getPriceBreakdownDisplay,
  normalizeWishlistRecord,
  type PriceBreakdownDisplayLine,
  type WishlistRecord,
} from "@/lib/wishlist/record";
import { getDefaultSmartWantRules } from "@/lib/wishlist/smart-want";
import { cn } from "@/lib/utils";

type CollectionPayload = {
  record?: unknown;
  error?: {
    message?: string;
  };
};

type WishlistPayload = {
  record?: unknown;
  error?: {
    message?: string;
  };
};

type SmartWantPayload = {
  smartWant?: unknown;
  error?: {
    message?: string;
  };
};

function isCollectionRecord(value: unknown): value is CollectionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<CollectionRecord>;

  return (
    typeof record.id === "string" &&
    typeof record.artist === "string" &&
    typeof record.title === "string" &&
    typeof record.discogsReleaseId === "number" &&
    (record.status === "owned" || record.status === "wanted")
  );
}

async function readCollectionResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as CollectionPayload | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Record could not be saved.");
  }

  return payload;
}

async function readWishlistResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as WishlistPayload | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Wantlist could not be updated.");
  }

  return payload;
}

function formatRecordMeta(record: SelectedRecord) {
  return [
    record.year,
    record.format.length ? record.format.slice(0, 2).join(", ") : null,
    record.label,
  ]
    .filter(Boolean)
    .join(" / ");
}

function emitSelectedRecordChange(record: SelectedRecord | null) {
  window.dispatchEvent(
    new CustomEvent(SELECTED_RECORD_CHANGED_EVENT, {
      detail: record,
    }),
  );
}

function getSourceLabel(record: SelectedRecord) {
  if (record.source === "collection") {
    return "Collection";
  }

  if (record.source === "wishlist") {
    return "Wantlist";
  }

  return "Crate match";
}

function getPriceEvidenceMeta(line: PriceBreakdownDisplayLine) {
  return line.metaLabel;
}

function isRecordPriceSummary(value: unknown): value is RecordPriceSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const summary = value as Partial<RecordPriceSummary>;

  return (
    typeof summary.currentCents === "number" &&
    Number.isInteger(summary.currentCents) &&
    summary.currentCents > 0 &&
    typeof summary.currency === "string" &&
    typeof summary.observedAt === "string"
  );
}

function valueMovementLabel(pricing: RecordPriceSummary) {
  if (pricing.changeCents === null) {
    return "First value recorded";
  }

  if (pricing.changeCents === 0) {
    return "Unchanged since the previous check";
  }

  const amount = formatPriceCents(
    Math.abs(pricing.changeCents),
    pricing.currency,
  );
  const percent =
    pricing.changePercent === null
      ? null
      : `${Math.abs(pricing.changePercent).toFixed(1)}%`;

  return `${pricing.changeCents < 0 ? "Down" : "Up"} ${amount}${
    percent ? ` (${percent})` : ""
  }`;
}

export function SelectedRecordInspector({
  record,
  onRecordChange,
  showRestrictedData = false,
  canFetchDiscogsPrice = false,
}: {
  record: SelectedRecord | null;
  onRecordChange: (record: SelectedRecord | null) => void;
  showRestrictedData?: boolean;
  canFetchDiscogsPrice?: boolean;
}) {
  if (!record) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[#FFF4E8]/12 bg-[#FFF4E8]/4 px-5 py-16 text-center">
          <Disc3 className="size-9 text-[#FFF4E8]/38" aria-hidden="true" />
          <h2
            id="record-inspector-heading"
            className="mt-4 text-base font-semibold text-[#FFF4E8]"
          >
            Select a record
          </h2>
        </div>
      </div>
    );
  }

  return (
    <SelectedRecordInspectorForm
      key={record.id}
      record={record}
      onRecordChange={onRecordChange}
      showRestrictedData={showRestrictedData}
      canFetchDiscogsPrice={canFetchDiscogsPrice}
    />
  );
}

function SelectedRecordInspectorForm({
  record,
  onRecordChange,
  showRestrictedData,
  canFetchDiscogsPrice,
}: {
  record: SelectedRecord;
  onRecordChange: (record: SelectedRecord | null) => void;
  showRestrictedData: boolean;
  canFetchDiscogsPrice: boolean;
}) {
  const [status, setStatus] = useState<NonNullable<SelectedRecord["status"]>>(
    record.status ?? "wanted",
  );
  const [rating, setRating] = useState<number | null>(record.rating ?? null);
  const [favourite, setFavourite] = useState(record.favourite);
  const [tags, setTags] = useState(record.tags.join(", "));
  const [notes, setNotes] = useState(record.notes ?? "");
  const [priceAmount, setPriceAmount] = useState(
    record.pricing ? formatPriceInput(record.pricing.currentCents) : "",
  );
  const [priceCurrency, setPriceCurrency] = useState(
    record.pricing?.currency ?? "GBP",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscogsPriceFetching, setIsDiscogsPriceFetching] = useState(false);
  const [isWishlistSaving, setIsWishlistSaving] = useState(false);
  const [isSmartWantSaving, setIsSmartWantSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const parsedTags = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const canRemoveWantlist = Boolean(record.wishlistId);
  const canCreateSmartWant = Boolean(record.discogsMasterId);
  const currentPricing = record.pricing ?? null;
  const priceBreakdownDisplay = showRestrictedData && record.wishlistRecord
    ? getPriceBreakdownDisplay(record.wishlistRecord.priceBreakdown, undefined, {
        legacyPriceLabel: record.wishlistRecord.priceLabel,
      })
    : null;

  async function saveCollectionRecord(patch: SelectedRecordPatch) {
    if (!record.collectionId) {
      return null;
    }

    const response = await fetch(`/api/collection/${record.collectionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    const payload = await readCollectionResponse(response);
    const updatedRecord = isCollectionRecord(payload?.record)
      ? payload.record
      : null;

    if (!updatedRecord) {
      throw new Error("Collection update returned an invalid record.");
    }

    return updatedRecord;
  }

  async function saveRecordPrice(amountCents: number, currency: string) {
    const response = await fetch(`/api/collection/${record.collectionId}/price`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amountCents, currency }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { pricing?: unknown; error?: { message?: string } }
      | null;

    if (!response.ok) {
      throw new Error(
        payload?.error?.message ?? "The record value could not be saved.",
      );
    }

    if (!isRecordPriceSummary(payload?.pricing)) {
      throw new Error("The saved value could not be read.");
    }

    return payload.pricing;
  }

  async function fetchDiscogsPrice() {
    if (!record.collectionId) {
      return;
    }

    setIsDiscogsPriceFetching(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/collection/${record.collectionId}/price/discogs`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { pricing?: unknown; error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Discogs price could not be fetched.",
        );
      }

      if (!isRecordPriceSummary(payload?.pricing)) {
        throw new Error("The Discogs price could not be read.");
      }

      const pricing = payload.pricing;
      const nextRecord: SelectedRecord = { ...record, pricing };

      setPriceAmount(formatPriceInput(pricing.currentCents));
      setPriceCurrency(pricing.currency);
      onRecordChange(nextRecord);
      emitSelectedRecordChange(nextRecord);
      setMessage("Discogs price saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Discogs price could not be fetched.",
      );
    } finally {
      setIsDiscogsPriceFetching(false);
    }
  }

  async function saveWishlistRecord(nextRecord: SelectedRecord) {
    const wishlistRecord: WishlistRecord = {
      ...createWishlistRecordFromSelected(nextRecord),
      ...(nextRecord.wishlistRecord ?? {}),
      buyingControls: {
        ...createWishlistRecordFromSelected(nextRecord).buyingControls,
        ...(nextRecord.wishlistRecord?.buyingControls ?? {}),
        tags: nextRecord.tags,
        ignoredListingNote: nextRecord.notes,
        updatedAt: new Date().toISOString(),
      },
    };
    const response = await fetch("/api/wishlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ record: wishlistRecord }),
    });
    const payload = await readWishlistResponse(response);
    const savedRecord = normalizeWishlistRecord(payload?.record) ?? wishlistRecord;

    return savedRecord;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const patch: SelectedRecordPatch = {
      status,
      rating,
      favourite,
      tags: parsedTags,
      notes,
    };
    const enteredPriceCents = priceAmount.trim()
      ? parsePriceToCents(priceAmount)
      : null;

    if (priceAmount.trim() && enteredPriceCents === null) {
      setMessage("Enter a value like 24.50.");
      setIsSaving(false);
      return;
    }

    const priceChanged = Boolean(
      record.collectionId &&
        enteredPriceCents !== null &&
        (enteredPriceCents !== record.pricing?.currentCents ||
          priceCurrency !== record.pricing?.currency),
    );

    try {
      let nextRecord = applySelectedRecordPatch(record, patch);

      if (record.collectionId) {
        const updatedRecord = await saveCollectionRecord(patch);

        if (updatedRecord) {
          nextRecord = {
            ...nextRecord,
            id: `collection:${updatedRecord.id}`,
            collectionId: updatedRecord.id,
            discogsReleaseId: updatedRecord.discogsReleaseId,
            discogsMasterId: updatedRecord.discogsMasterId,
            artist: updatedRecord.artist,
            title: updatedRecord.title,
            format: updatedRecord.format,
            year: updatedRecord.year,
            label: updatedRecord.label,
            catalogNumber: updatedRecord.catalogNumber,
            barcode: updatedRecord.barcode,
            imageUrl: updatedRecord.imageUrl,
            mediaCondition: updatedRecord.mediaCondition,
            sleeveCondition: updatedRecord.sleeveCondition,
            rating: updatedRecord.rating,
            favourite: updatedRecord.favourite,
            status: updatedRecord.status,
            tags: updatedRecord.tags,
            notes: updatedRecord.notes,
            group: updatedRecord.group,
            unit: updatedRecord.unit,
            shelf: updatedRecord.shelf,
            slot: updatedRecord.slot,
            priceHintLabel: updatedRecord.priceHintLabel,
            pricing: updatedRecord.pricing ?? nextRecord.pricing ?? null,
          };

          if (priceChanged && enteredPriceCents !== null) {
            const pricing = await saveRecordPrice(
              enteredPriceCents,
              priceCurrency,
            );

            nextRecord = { ...nextRecord, pricing };
          }
        }
      } else if (record.wishlistId || record.source === "wishlist") {
        const savedRecord = await saveWishlistRecord(nextRecord);
        nextRecord = {
          ...nextRecord,
          id: `wishlist:${savedRecord.id}`,
          wishlistId: savedRecord.id,
          status: "wanted",
          tags: savedRecord.buyingControls.tags,
          notes: savedRecord.buyingControls.ignoredListingNote,
          wishlistRecord: savedRecord,
        };
      }

      onRecordChange(nextRecord);
      emitSelectedRecordChange(nextRecord);
      setMessage("Record saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Record could not save.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddToCollection(nextStatus: "owned" | "wanted") {
    setIsSaving(true);
    setMessage(null);

    try {
      const result = await requestAddCollectionRecord({
        discogsReleaseId: record.discogsReleaseId,
        status: nextStatus,
        favourite,
      });
      const nextRecord = selectedRecordFromCollection(result.record);

      onRecordChange(nextRecord);
      emitSelectedRecordChange(nextRecord);
      setStatus(nextStatus);
      setMessage(nextStatus === "owned" ? "Saved as owned." : "Saved as wanted.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Record could not be added.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddWantlist() {
    setIsWishlistSaving(true);
    setMessage(null);

    try {
      const nextRecord = applySelectedRecordPatch(record, {
        status: "wanted",
        tags: parsedTags,
        notes,
      });
      const savedRecord = await saveWishlistRecord(nextRecord);

      onRecordChange({
        ...nextRecord,
        id:
          record.source === "collection"
            ? record.id
            : `wishlist:${savedRecord.id}`,
        wishlistId: savedRecord.id,
        status: "wanted",
        tags: savedRecord.buyingControls.tags,
        notes: savedRecord.buyingControls.ignoredListingNote,
        wishlistRecord: savedRecord,
        savedAt: savedRecord.savedAt,
      });
      emitSelectedRecordChange({
        ...nextRecord,
        id:
          record.source === "collection"
            ? record.id
            : `wishlist:${savedRecord.id}`,
        wishlistId: savedRecord.id,
        status: "wanted",
        tags: savedRecord.buyingControls.tags,
        notes: savedRecord.buyingControls.ignoredListingNote,
        wishlistRecord: savedRecord,
        savedAt: savedRecord.savedAt,
      });
      setStatus("wanted");
      setMessage("Added to wantlist.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Wantlist could not be updated.",
      );
    } finally {
      setIsWishlistSaving(false);
    }
  }

  async function handleRemoveWantlist() {
    if (!record.wishlistId) {
      return;
    }

    setIsWishlistSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/wishlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordId: record.wishlistId }),
      });

      await readWishlistResponse(response);
      const nextRecord = {
        ...record,
        wishlistId: null,
        wishlistRecord: null,
        savedAt: null,
        status: record.collectionId ? record.status : null,
      };

      onRecordChange(nextRecord);
      emitSelectedRecordChange(nextRecord);
      setMessage("Removed from wantlist.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Wantlist could not be updated.",
      );
    } finally {
      setIsWishlistSaving(false);
    }
  }

  async function handleAddSmartWant() {
    if (!record.discogsMasterId) {
      setMessage("This record does not include a Discogs master id.");
      return;
    }

    setIsSmartWantSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/wishlist/smart-wants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          smartWant: {
            masterReleaseId: record.discogsMasterId,
            sourceReleaseId: record.discogsReleaseId,
            artist: record.artist,
            title: record.title,
            imageUrl: showRestrictedData ? record.imageUrl : null,
            sourceUri:
              record.discogsUri ??
              `https://www.discogs.com/release/${record.discogsReleaseId}`,
            rules: getDefaultSmartWantRules(),
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | SmartWantPayload
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "Smart Want could not be created.",
        );
      }

      setMessage("Smart Want created. Open Wantlist to edit flexible rules.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Smart Want could not be created.",
      );
    } finally {
      setIsSmartWantSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <div className="flex gap-3">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#160A24]">
            {record.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={record.imageUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Disc3 className="size-7 text-[#FFF4E8]/42" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
                #{record.discogsReleaseId}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                {record.collectionId ? (
                  <FavouriteButton
                    record={{
                      id: record.collectionId,
                      title: record.title,
                      favourite,
                    }}
                    onChanged={(updated) => {
                      setFavourite(updated.favourite);
                      onRecordChange({
                        ...record,
                        favourite: updated.favourite,
                      });
                    }}
                  />
                ) : null}
                <span className="rounded-full bg-[#FFF4E8]/6 px-2.5 py-1 text-[11px] text-[#FFF4E8]/56">
                  {getSourceLabel(record)}
                </span>
              </div>
            </div>
            <h2
              id="record-inspector-heading"
              className="mt-2 text-lg font-semibold text-[#FFF4E8]"
            >
              {record.title}
            </h2>
            <p className="mt-1 text-sm text-[#FFF4E8]/62">{record.artist}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-xs text-[#FFF4E8]/52">
          {formatRecordMeta(record) ? (
            <p className="flex items-center gap-2">
              <Disc3 className="size-3.5" aria-hidden="true" />
              {formatRecordMeta(record)}
            </p>
          ) : null}
          {showRestrictedData && record.priceHintLabel ? (
            <p className="flex items-center gap-2">
              <Tag className="size-3.5" aria-hidden="true" />
              {record.priceHintLabel}
            </p>
          ) : null}
          {showRestrictedData &&
          (record.mediaCondition || record.sleeveCondition) ? (
            <p className="flex items-center gap-2">
              <Tag className="size-3.5" aria-hidden="true" />
              Media: {record.mediaCondition ?? "unset"} / Sleeve:{" "}
              {record.sleeveCondition ?? "unset"}
            </p>
          ) : null}
        </div>

        {record.collectionId ? (
          <section
            className="mt-5 rounded-xl bg-[#FFF4E8]/[0.055] p-3"
            aria-labelledby="record-value-heading"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3
                id="record-value-heading"
                className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FFF4E8]/72"
              >
                Value
              </h3>
              {currentPricing ? (
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#FFF4E8]/38">
                  {formatPriceDate(currentPricing.observedAt)}
                </span>
              ) : null}
            </div>

            {currentPricing ? (
              <div className="mt-2">
                <p className="font-serif text-2xl italic leading-none text-[#FFF4E8]">
                  {formatPriceCents(
                    currentPricing.currentCents,
                    currentPricing.currency,
                  )}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#FFF4E8]/32">
                  {currentPricing.source === "discogs_marketplace"
                    ? "Discogs lowest listing"
                    : "Saved value"}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#FFF4E8]/52">
                  {currentPricing.changeCents === null ? (
                    <Tag className="size-3" aria-hidden="true" />
                  ) : currentPricing.changeCents < 0 ? (
                    <ArrowDownRight className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  )}
                  {valueMovementLabel(currentPricing)}
                </p>
                {currentPricing.previousCents !== null ? (
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#FFF4E8]/32">
                    Previous{" "}
                    {formatPriceCents(
                      currentPricing.previousCents,
                      currentPricing.currency,
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-5 text-[#FFF4E8]/46">
                No value recorded yet. Save one to start the shelf graph.
              </p>
            )}

            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5.75rem] gap-2">
              <Input
                value={priceAmount}
                onChange={(event) => setPriceAmount(event.target.value)}
                inputMode="decimal"
                placeholder="24.50"
                aria-label={`Value of ${record.title}`}
                className="h-9 rounded-lg border-[#FFF4E8]/14 bg-[#FFF4E8]/8 text-sm tabular-nums text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
              />
              <select
                value={priceCurrency}
                onChange={(event) => setPriceCurrency(event.target.value)}
                aria-label="Value currency"
                className="h-9 rounded-lg border border-[#FFF4E8]/14 bg-[#120a1d] px-2 text-xs text-[#FFF4E8] outline-none focus:border-[#FFF4E8]/30"
              >
                {SUPPORTED_PRICE_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] leading-4 text-[#FFF4E8]/32">
                Saved with the record and plotted on the Dashboard.
              </p>
              {canFetchDiscogsPrice ? (
                <button
                  type="button"
                  onClick={fetchDiscogsPrice}
                  disabled={isDiscogsPriceFetching}
                  title="Fetch the lowest Discogs marketplace price"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E8]/8 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#FFF4E8]/64 transition hover:bg-[#FFF4E8]/14 hover:text-[#FFF4E8] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40"
                >
                  {isDiscogsPriceFetching ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="size-3" aria-hidden="true" />
                  )}
                  {isDiscogsPriceFetching ? "Fetching" : "Discogs price"}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {priceBreakdownDisplay ? (
          <section
            className="mt-5 rounded-xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/5 p-3"
            aria-labelledby="delivered-price-heading"
          >
            <div className="flex items-center gap-2 text-[#FFF4E8]">
              <Tag className="size-3.5 text-[#FFF4E8]/62" aria-hidden="true" />
              <h3
                id="delivered-price-heading"
                className="text-xs font-semibold uppercase tracking-[0.18em]"
              >
                Delivered cost
              </h3>
            </div>
            <dl className="mt-3 grid gap-3 text-xs">
              <div>
                <dt className="text-[#FFF4E8]/48">Item price</dt>
                <dd className="mt-1 text-sm font-medium text-[#FFF4E8]">
                  {priceBreakdownDisplay.itemPrice.label}
                </dd>
                <dd className="mt-1 text-[#FFF4E8]/45">
                  {getPriceEvidenceMeta(priceBreakdownDisplay.itemPrice)}
                </dd>
                {priceBreakdownDisplay.legacyPriceHint ? (
                  <dd className="mt-2 rounded-lg border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 px-2.5 py-2">
                    <span className="text-[#FFF4E8]/48">
                      Old price hint
                    </span>
                    <p className="mt-1 text-sm font-medium text-[#FFF4E8]">
                      {priceBreakdownDisplay.legacyPriceHint.label}
                    </p>
                    <p className="mt-1 leading-5 text-[#FFF4E8]/52">
                      {priceBreakdownDisplay.legacyPriceHint.explanation}
                    </p>
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-[#FFF4E8]/48">Shipping</dt>
                <dd className="mt-1 text-sm font-medium text-[#FFF4E8]">
                  {priceBreakdownDisplay.shipping.label}
                </dd>
                <dd className="mt-1 text-[#FFF4E8]/45">
                  {getPriceEvidenceMeta(priceBreakdownDisplay.shipping)}
                </dd>
              </div>
              <div>
                <dt className="text-[#FFF4E8]/48">Delivered</dt>
                <dd className="mt-1 text-sm font-medium text-[#FFF4E8]">
                  {priceBreakdownDisplay.estimatedDeliveredCost.label}
                </dd>
              </div>
            </dl>
            <ul className="mt-3 grid gap-1.5 text-xs leading-5 text-[#FFF4E8]/52">
              {priceBreakdownDisplay.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-5 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#FFF4E8]/40">
              Status
            </span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as NonNullable<SelectedRecord["status"]>)
              }
              disabled={!record.collectionId}
              className={cn(
                "h-10 rounded-lg border border-[#FFF4E8]/14 bg-[#120a1d] px-3 text-sm text-[#FFF4E8] outline-none focus:border-[#FFF4E8]/30",
                !record.collectionId && "opacity-60",
              )}
            >
              <option value="owned">Owned</option>
              <option value="wanted">Wanted</option>
            </select>
          </label>

          <fieldset className="grid gap-2" disabled={!record.collectionId}>
            <legend className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#FFF4E8]/40">
              Rating
            </legend>
            <div className="flex items-center justify-between gap-3">
              <StarRating
                value={rating}
                onChange={setRating}
                disabled={!record.collectionId}
                label={`Rate ${record.title}`}
                size="sm"
              />
              <span className="text-xs text-[#FFF4E8]/52">
                {rating ? `${rating} / 5` : "Unrated"}
              </span>
            </div>
          </fieldset>

          {record.collectionId ? (
            <section className="grid gap-2" aria-label="Shelf location">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#FFF4E8]/40">
                Shelf
              </h3>
              <ShelfLocationSummary location={record} variant="plate" />
              <p className="text-[11px] leading-5 text-[#FFF4E8]/38">
                Change the group from Collection with the + on the record.
              </p>
            </section>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#FFF4E8]/40">
              Tags
            </span>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="jazz, first press, shop-check"
              className="h-10 rounded-lg border-[#FFF4E8]/14 bg-[#FFF4E8]/8 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#FFF4E8]/40">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Condition, shop price, shelf detail, or buying note"
              className="resize-none rounded-lg border border-[#FFF4E8]/14 bg-[#FFF4E8]/8 px-3 py-2 text-sm text-[#FFF4E8] outline-none placeholder:text-[#FFF4E8]/36 focus:border-[#FFF4E8]/30"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            Save
          </Button>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {!record.collectionId ? (
              <>
                <Button
                  type="button"
                  onClick={() => handleAddToCollection("owned")}
                  disabled={isSaving}
                  className="rounded-full bg-[#1DB954]/12 text-[#C8F7D8] hover:bg-[#1DB954]/18"
                >
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Archive className="size-4" aria-hidden="true" />
                  )}
                  Save as owned
                </Button>
                <Button
                  type="button"
                  onClick={() => handleAddToCollection("wanted")}
                  disabled={isSaving}
                  variant="outline"
                  className="rounded-full border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/76 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
                >
                  <Heart className="size-4" aria-hidden="true" />
                  Save as wanted
                </Button>
              </>
            ) : null}
            {record.collectionId ? (
              <DeleteRecordButton
                recordId={record.collectionId}
                title={record.title}
                label="Delete record"
                onDeleted={() => onRecordChange(null)}
              />
            ) : null}
            {record.discogsUri ? (
              <Button
                asChild
                variant="outline"
                className="rounded-full border-[#FFF4E8]/12 bg-[#FFF4E8]/7 text-[#FFF4E8]/76 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
              >
                <a href={record.discogsUri} target="_blank" rel="noreferrer">
                  Open Discogs
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </Button>
            ) : null}
            {showRestrictedData && canRemoveWantlist ? (
              <Button
                type="button"
                onClick={handleRemoveWantlist}
                disabled={isWishlistSaving}
                variant="outline"
                className="rounded-full border-[#D34278]/24 bg-[#D34278]/8 text-[#FFD7E4] hover:bg-[#D34278]/14"
              >
                {isWishlistSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
                Remove wantlist
              </Button>
            ) : showRestrictedData ? (
              <Button
                type="button"
                onClick={handleAddWantlist}
                disabled={isWishlistSaving}
                variant="outline"
                className="rounded-full border-[#1DB954]/22 bg-[#1DB954]/10 text-[#C8F7D8] hover:bg-[#1DB954]/16"
              >
                {isWishlistSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Heart className="size-4" aria-hidden="true" />
                )}
                Add wantlist
              </Button>
            ) : null}
            {showRestrictedData ? (
              <Button
                type="button"
                onClick={handleAddSmartWant}
                disabled={isSmartWantSaving || !canCreateSmartWant}
                variant="outline"
                className="rounded-full border-[#F08A4B]/22 bg-[#F08A4B]/10 text-[#FFE1C7] hover:bg-[#F08A4B]/16 disabled:opacity-45"
              >
                {isSmartWantSaving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                Add Smart Want
              </Button>
            ) : null}
          </div>
        </div>

        {message ? (
          <p className="mt-3 text-xs text-[#FFF4E8]/58">{message}</p>
        ) : null}
      </form>
      {showRestrictedData ? (
        <PressingDetectivePanel
          record={record}
          onRecordChange={onRecordChange}
        />
      ) : null}
    </div>
  );
}
