"use client";

import { useState, type FormEvent } from "react";
import {
  Disc3,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  PanelRight,
  Save,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PressingDetectivePanel } from "@/components/app-shell/pressing-detective-panel";
import {
  COLLECTION_LOCATION_FIELDS,
  formatCollectionLocation,
} from "@/lib/collection/location";
import type { CollectionRecord } from "@/lib/collection/record";
import {
  SELECTED_RECORD_CHANGED_EVENT,
  applySelectedRecordPatch,
  createWishlistRecordFromSelected,
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

export function SelectedRecordInspector({
  record,
  onRecordChange,
}: {
  record: SelectedRecord | null;
  onRecordChange: (record: SelectedRecord | null) => void;
}) {
  if (!record) {
    return (
      <aside
        className="flex min-h-[24rem] flex-col rounded-2xl border border-[#FFF4E8]/12 bg-[#08030f]/72 p-4 shadow-2xl shadow-black/20 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"
        aria-labelledby="record-inspector-heading"
      >
        <div className="flex items-center gap-2 text-[#FFF4E8]/48">
          <PanelRight className="size-4" aria-hidden="true" />
          <p className="text-xs uppercase tracking-[0.24em]">Inspector</p>
        </div>
        <div className="mt-8 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#FFF4E8]/12 bg-[#FFF4E8]/4 px-5 text-center">
          <Disc3 className="size-9 text-[#FFF4E8]/38" aria-hidden="true" />
          <h2
            id="record-inspector-heading"
            className="mt-4 text-base font-semibold text-[#FFF4E8]"
          >
            No record selected
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-[#FFF4E8]/58">
            Select a record from Collection, Wantlist, Digging, Shelf, or
            Insights to edit status, location, tags, notes, and Discogs context.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <SelectedRecordInspectorForm
      key={record.id}
      record={record}
      onRecordChange={onRecordChange}
    />
  );
}

function SelectedRecordInspectorForm({
  record,
  onRecordChange,
}: {
  record: SelectedRecord;
  onRecordChange: (record: SelectedRecord | null) => void;
}) {
  const [status, setStatus] = useState<NonNullable<SelectedRecord["status"]>>(
    record.status ?? "wanted",
  );
  const [tags, setTags] = useState(record.tags.join(", "));
  const [notes, setNotes] = useState(record.notes ?? "");
  const [room, setRoom] = useState(record.room ?? "");
  const [unit, setUnit] = useState(record.unit ?? "");
  const [shelf, setShelf] = useState(record.shelf ?? "");
  const [slot, setSlot] = useState(record.slot ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isWishlistSaving, setIsWishlistSaving] = useState(false);
  const [isSmartWantSaving, setIsSmartWantSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locationValues = { room, unit, shelf, slot };
  const locationSetters = { room: setRoom, unit: setUnit, shelf: setShelf, slot: setSlot };
  const parsedTags = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const canEditLocation = Boolean(record.collectionId);
  const canRemoveWantlist = Boolean(record.wishlistId);
  const canCreateSmartWant = Boolean(record.discogsMasterId);
  const currentLocation = formatCollectionLocation(record);
  const priceBreakdownDisplay = record.wishlistRecord
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
      tags: parsedTags,
      notes,
      room,
      unit,
      shelf,
      slot,
    };

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
            status: updatedRecord.status,
            tags: updatedRecord.tags,
            notes: updatedRecord.notes,
            room: updatedRecord.room,
            unit: updatedRecord.unit,
            shelf: updatedRecord.shelf,
            slot: updatedRecord.slot,
            priceHintLabel: updatedRecord.priceHintLabel,
          };
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
            imageUrl: record.imageUrl,
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
    <aside
      className="flex min-h-[24rem] flex-col rounded-2xl border border-[#FFF4E8]/12 bg-[#08030f]/72 p-4 shadow-2xl shadow-black/20 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
      aria-labelledby="record-inspector-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[#FFF4E8]/48">
          <PanelRight className="size-4" aria-hidden="true" />
          <p className="text-xs uppercase tracking-[0.24em]">Inspector</p>
        </div>
        <span className="rounded-full border border-[#FFF4E8]/10 bg-[#FFF4E8]/6 px-2.5 py-1 text-xs text-[#FFF4E8]/56">
          {getSourceLabel(record)}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-1 flex-col">
        <div className="flex gap-3">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#FFF4E8]/10 bg-[#160A24]">
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
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
              Discogs #{record.discogsReleaseId}
            </p>
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
          <p className="flex items-center gap-2">
            <MapPin className="size-3.5" aria-hidden="true" />
            {currentLocation || "No shelf location"}
          </p>
          {record.priceHintLabel ? (
            <p className="flex items-center gap-2">
              <Tag className="size-3.5" aria-hidden="true" />
              {record.priceHintLabel}
            </p>
          ) : null}
          {record.mediaCondition || record.sleeveCondition ? (
            <p className="flex items-center gap-2">
              <Tag className="size-3.5" aria-hidden="true" />
              Media: {record.mediaCondition ?? "unset"} / Sleeve:{" "}
              {record.sleeveCondition ?? "unset"}
            </p>
          ) : null}
        </div>

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
                Estimated delivered cost
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
                      Legacy price hint
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
                <dt className="text-[#FFF4E8]/48">Estimated delivered cost</dt>
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
          <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
            Status
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

          <div className="grid grid-cols-2 gap-2">
            {COLLECTION_LOCATION_FIELDS.map(({ key, label, placeholder }) => (
              <label
                key={key}
                className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62"
              >
                {label}
                <Input
                  value={locationValues[key]}
                  onChange={(event) => locationSetters[key](event.target.value)}
                  placeholder={placeholder}
                  disabled={!canEditLocation}
                  className="h-10 rounded-lg border-[#FFF4E8]/14 bg-[#FFF4E8]/8 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12 disabled:opacity-45"
                />
              </label>
            ))}
          </div>

          <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
            Tags
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="jazz, first press, shop-check"
              className="h-10 rounded-lg border-[#FFF4E8]/14 bg-[#FFF4E8]/8 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/62">
            Notes
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
            Save record
          </Button>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
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
            {canRemoveWantlist ? (
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
            ) : (
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
            )}
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
          </div>
        </div>

        {record.sourceContext ? (
          <p className="mt-4 rounded-lg border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 px-3 py-2 text-xs leading-5 text-[#FFF4E8]/50">
            Source: {record.sourceContext}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 text-xs text-[#FFF4E8]/58">{message}</p>
        ) : null}
      </form>
      <PressingDetectivePanel record={record} onRecordChange={onRecordChange} />
    </aside>
  );
}
