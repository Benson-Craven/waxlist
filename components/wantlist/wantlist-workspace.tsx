"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Boxes,
  ChevronDown,
  DollarSign,
  Disc3,
  ExternalLink,
  Filter,
  Grid2X2,
  Heart,
  List,
  ListFilter,
  Loader2,
  MapPin,
  PackagePlus,
  Save,
  Search,
  SlidersHorizontal,
  Tag,
  TrendingDown,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  normalizeWishlistRecord,
  type WishlistBuyingControls,
  type WishlistRecord,
} from "@/lib/wishlist/record";
import { cn } from "@/lib/utils";

type WishlistPayload = {
  records?: unknown;
  error?: {
    message?: string;
  };
};

type WishlistSavePayload = {
  record?: unknown;
  error?: {
    message?: string;
  };
};

type WantlistTab = "all" | "priced" | "available" | "bundle";
type WantlistView = "list" | "grid";

const WANTLIST_TABS: Array<{
  id: WantlistTab;
  label: string;
}> = [
  { id: "all", label: "All Wanted" },
  { id: "priced", label: "Priced" },
  { id: "available", label: "Available" },
  { id: "bundle", label: "Bundle" },
];

async function readWishlistResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as WishlistPayload | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? "Wantlist records could not be loaded.",
    );
  }

  return payload;
}

async function saveWishlistRecordToApi(record: WishlistRecord) {
  const response = await fetch("/api/wishlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ record }),
  });
  const payload = (await response
    .json()
    .catch(() => null)) as WishlistSavePayload | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? "Wantlist controls could not be saved.",
    );
  }

  return normalizeWishlistRecord(payload?.record) ?? record;
}

function normalizeWishlistRecords(value: unknown) {
  return Array.isArray(value)
    ? value
        .map(normalizeWishlistRecord)
        .filter((record): record is WishlistRecord => Boolean(record))
    : [];
}

function isKnownPrice(record: WishlistRecord) {
  return record.priceLabel !== "Price unknown";
}

function isKnownAvailability(record: WishlistRecord) {
  return record.availabilityLabel !== "Availability unknown";
}

function parseListingCount(record: WishlistRecord) {
  const match = record.availabilityLabel.match(/\d+/);

  return match ? Number(match[0]) : null;
}

function buildSearchText(record: WishlistRecord) {
  return [
    record.discogsTitle,
    record.discogsArtist,
    record.spotifyAlbum,
    record.spotifyArtist,
    record.country,
    record.year,
    record.priceLabel,
    record.availabilityLabel,
    record.buyingControls.priority,
    record.buyingControls.conditionPreference,
    record.buyingControls.sellerFilter,
    record.buyingControls.regionFilter,
    record.buyingControls.ignoredListingNote,
    ...record.format,
    ...record.buyingControls.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatPriorityLabel(priority: WishlistBuyingControls["priority"]) {
  if (priority === "grail") {
    return "Grail";
  }

  return priority ? priority[0].toUpperCase() + priority.slice(1) : "Set priority";
}

function formatIgnoredStateLabel(
  state: WishlistBuyingControls["ignoredListingState"],
) {
  if (state === "ignored") {
    return "Ignored";
  }

  if (state === "watch_relist") {
    return "Watch relists";
  }

  return "No ignored listing";
}

function getBundleCount(
  record: WishlistRecord,
  recordsByArtist: Map<string, WishlistRecord[]>,
) {
  return recordsByArtist.get(record.discogsArtist.toLowerCase())?.length ?? 0;
}

function getConfidenceLabel(record: WishlistRecord) {
  if (record.confidence >= 90) {
    return "High";
  }

  if (record.confidence >= 75) {
    return "Strong";
  }

  if (record.confidence >= 50) {
    return "Check";
  }

  return "Low";
}

function WantlistRecordArtwork({ record }: { record: WishlistRecord }) {
  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-[#24242a]">
      {record.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={record.thumb}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid size-full place-items-center text-[#FFF4E8]/34">
          <Disc3 className="size-6" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function BuyingSignals({
  record,
  bundleCount,
}: {
  record: WishlistRecord;
  bundleCount: number;
}) {
  const listingCount = parseListingCount(record);

  return (
    <div className="grid gap-2 text-xs text-[#FFF4E8]/56 sm:grid-cols-2 lg:grid-cols-4">
      <span className="flex items-center gap-2 rounded-full bg-[#1b1b20] px-3 py-2">
        <TrendingDown className="size-3.5 text-[#FFF4E8]/42" aria-hidden="true" />
        Price drop pending
      </span>
      <span className="flex items-center gap-2 rounded-full bg-[#1b1b20] px-3 py-2">
        <Boxes className="size-3.5 text-[#FFF4E8]/42" aria-hidden="true" />
        {listingCount ? `${listingCount} listed` : record.availabilityLabel}
      </span>
      <span className="flex items-center gap-2 rounded-full bg-[#1b1b20] px-3 py-2">
        <BadgeCheck className="size-3.5 text-[#FFF4E8]/42" aria-hidden="true" />
        Seller not checked
      </span>
      <span className="flex items-center gap-2 rounded-full bg-[#1b1b20] px-3 py-2">
        <PackagePlus className="size-3.5 text-[#FFF4E8]/42" aria-hidden="true" />
        {bundleCount > 1 ? `${bundleCount} by artist` : "No bundle yet"}
      </span>
    </div>
  );
}

function BuyingControlSummary({ record }: { record: WishlistRecord }) {
  const controls = record.buyingControls;
  const tags = controls.tags.slice(0, 3);

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#FFF4E8]/56">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#211b24] px-3 py-1.5">
        <SlidersHorizontal className="size-3.5 text-[#F08A4B]/72" aria-hidden="true" />
        {formatPriorityLabel(controls.priority)}
      </span>
      {controls.maxItemPrice ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#211b24] px-3 py-1.5">
          <DollarSign className="size-3.5 text-[#F08A4B]/72" aria-hidden="true" />
          Item &lt;= {controls.maxItemPrice}
        </span>
      ) : null}
      {controls.maxShipping ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#211b24] px-3 py-1.5">
          <Truck className="size-3.5 text-[#F08A4B]/72" aria-hidden="true" />
          Ship &lt;= {controls.maxShipping}
        </span>
      ) : null}
      {controls.regionFilter ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#211b24] px-3 py-1.5">
          <MapPin className="size-3.5 text-[#F08A4B]/72" aria-hidden="true" />
          {controls.regionFilter}
        </span>
      ) : null}
      {controls.ignoredListingState !== "none" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#351a24] px-3 py-1.5 text-[#FFF4E8]/68">
          <Ban className="size-3.5 text-[#D34278]/82" aria-hidden="true" />
          {formatIgnoredStateLabel(controls.ignoredListingState)}
        </span>
      ) : null}
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#211b24] px-3 py-1.5"
        >
          <Tag className="size-3.5 text-[#F08A4B]/72" aria-hidden="true" />
          {tag}
        </span>
      ))}
    </div>
  );
}

function BuyingControlField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-[#FFF4E8]/54">
      <span>{label}</span>
      {children}
    </label>
  );
}

function BuyingControlsEditor({
  record,
  onSave,
}: {
  record: WishlistRecord;
  onSave: (record: WishlistRecord) => Promise<void>;
}) {
  const [draft, setDraft] = useState<WishlistBuyingControls>(
    record.buyingControls,
  );
  const [tagText, setTagText] = useState(record.buyingControls.tags.join(", "));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  function updateDraft<Key extends keyof WishlistBuyingControls>(
    key: Key,
    value: WishlistBuyingControls[Key],
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
    setStatus("idle");
  }

  async function saveControls() {
    const nextControls: WishlistBuyingControls = {
      ...draft,
      tags: [
        ...new Set(
          tagText
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
      updatedAt: new Date().toISOString(),
    };

    setStatus("saving");

    try {
      await onSave({
        ...record,
        buyingControls: nextControls,
      });
      setDraft(nextControls);
      setTagText(nextControls.tags.join(", "));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const inputClasses =
    "h-10 rounded-lg border border-[#FFF4E8]/10 bg-[#101014] px-3 text-sm text-[#FFF4E8] outline-none transition placeholder:text-[#FFF4E8]/28 focus:border-[#FFF4E8]/24 focus:ring-2 focus:ring-[#FFF4E8]/8";
  const selectClasses = cn(inputClasses, "appearance-none");

  return (
    <div className="mt-4 rounded-xl border border-[#FFF4E8]/8 bg-[#0f0f13] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#FFF4E8]">
            Buying controls
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#FFF4E8]/44">
            Seller and region filters apply when listing data is available from
            supported Discogs marketplace payloads.
          </p>
        </div>
        <Button
          type="button"
          onClick={saveControls}
          disabled={status === "saving"}
          className="h-9 rounded-full bg-[#FFF4E8] px-4 text-xs font-semibold text-[#08030f] hover:bg-[#f6dfc9]"
        >
          {status === "saving" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-3.5" aria-hidden="true" />
          )}
          Save
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BuyingControlField label="Priority">
          <select
            value={draft.priority ?? ""}
            onChange={(event) =>
              updateDraft(
                "priority",
                (event.target.value || null) as WishlistBuyingControls["priority"],
              )
            }
            className={selectClasses}
          >
            <option value="">Set priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="grail">Grail</option>
          </select>
        </BuyingControlField>

        <BuyingControlField label="Max item price">
          <Input
            value={draft.maxItemPrice ?? ""}
            onChange={(event) =>
              updateDraft("maxItemPrice", event.target.value)
            }
            placeholder="$40"
            className={inputClasses}
          />
        </BuyingControlField>

        <BuyingControlField label="Max shipping">
          <Input
            value={draft.maxShipping ?? ""}
            onChange={(event) =>
              updateDraft("maxShipping", event.target.value)
            }
            placeholder="$8"
            className={inputClasses}
          />
        </BuyingControlField>

        <BuyingControlField label="Condition preference">
          <select
            value={draft.conditionPreference ?? ""}
            onChange={(event) =>
              updateDraft("conditionPreference", event.target.value)
            }
            className={selectClasses}
          >
            <option value="">Any condition</option>
            <option value="Mint or Near Mint">Mint or Near Mint</option>
            <option value="VG+ or better">VG+ or better</option>
            <option value="VG or better">VG or better</option>
            <option value="Sleeve not critical">Sleeve not critical</option>
          </select>
        </BuyingControlField>

        <BuyingControlField label="Tags">
          <Input
            value={tagText}
            onChange={(event) => {
              setTagText(event.target.value);
              setStatus("idle");
            }}
            placeholder="jazz, gift, shop-check"
            className={inputClasses}
          />
        </BuyingControlField>

        <BuyingControlField label="Seller filter">
          <Input
            value={draft.sellerFilter ?? ""}
            onChange={(event) =>
              updateDraft("sellerFilter", event.target.value)
            }
            placeholder="trusted sellers, avoid seller"
            className={inputClasses}
          />
        </BuyingControlField>

        <BuyingControlField label="Region filter">
          <Input
            value={draft.regionFilter ?? ""}
            onChange={(event) =>
              updateDraft("regionFilter", event.target.value)
            }
            placeholder="US, UK, EU"
            className={inputClasses}
          />
        </BuyingControlField>

        <BuyingControlField label="Ignored/relist state">
          <select
            value={draft.ignoredListingState}
            onChange={(event) =>
              updateDraft(
                "ignoredListingState",
                event.target
                  .value as WishlistBuyingControls["ignoredListingState"],
              )
            }
            className={selectClasses}
          >
            <option value="none">No ignored listing</option>
            <option value="ignored">Ignored listing</option>
            <option value="watch_relist">Watch for relist</option>
          </select>
        </BuyingControlField>
      </div>

      <div className="mt-3">
        <BuyingControlField label="Ignored listing / relist note">
          <Input
            value={draft.ignoredListingNote ?? ""}
            onChange={(event) =>
              updateDraft("ignoredListingNote", event.target.value)
            }
            placeholder="Seller, listing id, reason, or relist pattern"
            className={inputClasses}
          />
        </BuyingControlField>
      </div>

      {status === "saved" ? (
        <p className="mt-3 text-xs text-[#1DB954]">Buying controls saved.</p>
      ) : null}
      {status === "error" ? (
        <p className="mt-3 text-xs text-[#D34278]">
          Buying controls could not be saved.
        </p>
      ) : null}
    </div>
  );
}

function WantlistList({
  records,
  recordsByArtist,
  onSaveRecord,
}: {
  records: WishlistRecord[];
  recordsByArtist: Map<string, WishlistRecord[]>;
  onSaveRecord: (record: WishlistRecord) => Promise<void>;
}) {
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-[#FFF4E8]/8 border-t border-[#FFF4E8]/10">
      {records.map((record) => {
        const bundleCount = getBundleCount(record, recordsByArtist);
        const isControlsOpen = openRecordId === record.id;

        return (
          <article
            key={record.id}
            className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_11rem]"
          >
            <div className="flex min-w-0 gap-4">
              <WantlistRecordArtwork record={record} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-[#FFF4E8]">
                      {record.discogsTitle}
                    </h2>
                    <p className="mt-1 truncate text-sm text-[#FFF4E8]/58">
                      {record.discogsArtist}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold text-[#FFF4E8]">
                      {record.priceLabel}
                    </p>
                    <p className="mt-1 text-xs text-[#FFF4E8]/46">
                      {record.availabilityLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem] uppercase tracking-[0.14em] text-[#FFF4E8]/42">
                  <span>{getConfidenceLabel(record)} confidence</span>
                  <span>{record.confidence}/100</span>
                  {record.year ? <span>{record.year}</span> : null}
                  {record.format.slice(0, 2).map((format) => (
                    <span key={format}>{format}</span>
                  ))}
                </div>

                <div className="mt-3">
                  <BuyingSignals record={record} bundleCount={bundleCount} />
                </div>
                <BuyingControlSummary record={record} />
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    aria-expanded={isControlsOpen}
                    aria-controls={`buying-controls-${record.id}`}
                    onClick={() =>
                      setOpenRecordId((currentRecordId) =>
                        currentRecordId === record.id ? null : record.id,
                      )
                    }
                    className="h-9 rounded-full border-transparent bg-[#1b1b20] px-4 text-xs font-semibold text-[#FFF4E8]/68 hover:bg-[#24242a] hover:text-[#FFF4E8]"
                  >
                    <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                    Buying controls
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform",
                        isControlsOpen && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </Button>
                </div>
                {isControlsOpen ? (
                  <div id={`buying-controls-${record.id}`}>
                    <BuyingControlsEditor
                      record={record}
                      onSave={onSaveRecord}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-start gap-2 lg:justify-end">
              {record.discogsUri ? (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-transparent bg-[#1b1b20] text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
                >
                  <a
                    href={record.discogsUri}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function WantlistGrid({
  records,
  recordsByArtist,
}: {
  records: WishlistRecord[];
  recordsByArtist: Map<string, WishlistRecord[]>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {records.map((record) => {
        const bundleCount = getBundleCount(record, recordsByArtist);

        return (
          <article
            key={record.id}
            className="overflow-hidden rounded-2xl border border-[#FFF4E8]/8 bg-[#141418]"
          >
            <div className="flex gap-4 p-4">
              <WantlistRecordArtwork record={record} />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[#FFF4E8]">
                  {record.discogsTitle}
                </h2>
                <p className="mt-1 truncate text-sm text-[#FFF4E8]/58">
                  {record.discogsArtist}
                </p>
                <p className="mt-3 text-sm font-semibold text-[#FFF4E8]">
                  {record.priceLabel}
                </p>
              </div>
            </div>
            <div className="border-t border-[#FFF4E8]/8 p-4">
              <div className="grid gap-2 text-xs text-[#FFF4E8]/54">
                <span>{record.availabilityLabel}</span>
                <span>
                  {getConfidenceLabel(record)} confidence · {record.confidence}/100
                </span>
                <span>
                  {bundleCount > 1
                    ? `${bundleCount} possible postage bundle`
                    : "No postage bundle yet"}
                </span>
                <span>Seller verification pending</span>
              </div>
              <BuyingControlSummary record={record} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EmptyWantlist({
  hasRecords,
  onReset,
}: {
  hasRecords: boolean;
  onReset: () => void;
}) {
  return (
    <div className="grid min-h-[34rem] place-items-center text-center">
      <div>
        <Heart className="mx-auto size-8 text-[#FFF4E8]/26" aria-hidden="true" />
        <p className="mt-5 text-sm font-medium text-[#FFF4E8]/68">
          {hasRecords ? "No wanted records found" : "No wanted vinyl saved yet"}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/42">
          {hasRecords
            ? "Adjust search or filters to find a saved record."
            : "Save records from the Crate workflow to populate buying signals here."}
        </p>
        {hasRecords ? (
          <Button
            type="button"
            onClick={onReset}
            className="mt-5 rounded-full bg-[#1b1b1f] px-5 text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
          >
            Reset filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function WantlistWorkspaceFrame() {
  const [records, setRecords] = useState<WishlistRecord[]>([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<WantlistTab>("all");
  const [view, setView] = useState<WantlistView>("list");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recordsByArtist = useMemo(() => {
    const nextRecords = new Map<string, WishlistRecord[]>();

    for (const record of records) {
      const key = record.discogsArtist.toLowerCase();
      const artistRecords = nextRecords.get(key) ?? [];

      artistRecords.push(record);
      nextRecords.set(key, artistRecords);
    }

    return nextRecords;
  }, [records]);
  const pricedCount = records.filter(isKnownPrice).length;
  const availableCount = records.filter(isKnownAvailability).length;
  const bundleCount = records.filter(
    (record) => getBundleCount(record, recordsByArtist) > 1,
  ).length;
  const filteredRecords = useMemo(() => {
    const nextQuery = query.trim().toLowerCase();

    return records.filter((record) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "priced" && isKnownPrice(record)) ||
        (activeTab === "available" && isKnownAvailability(record)) ||
        (activeTab === "bundle" &&
          getBundleCount(record, recordsByArtist) > 1);

      if (!matchesTab) {
        return false;
      }

      if (!nextQuery) {
        return true;
      }

      return buildSearchText(record).includes(nextQuery);
    });
  }, [activeTab, query, records, recordsByArtist]);
  const hasActiveFilters = activeTab !== "all" || query.trim().length > 0;

  function resetFilters() {
    setActiveTab("all");
    setQuery("");
  }

  async function saveRecord(record: WishlistRecord) {
    const savedRecord = await saveWishlistRecordToApi(record);

    setRecords((currentRecords) =>
      currentRecords.map((currentRecord) =>
        currentRecord.id === savedRecord.id ? savedRecord : currentRecord,
      ),
    );
  }

  useEffect(() => {
    let isActive = true;

    fetch("/api/wishlist", {
      cache: "no-store",
    })
      .then(readWishlistResponse)
      .then((payload) => {
        if (!isActive) {
          return;
        }

        setRecords(normalizeWishlistRecords(payload?.records));
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Wantlist records could not be loaded.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section aria-labelledby="wantlist-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1
          id="wantlist-heading"
          className="text-3xl font-semibold tracking-[-0.01em] text-[#FFF4E8]"
        >
          Wantlist
        </h1>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => setView("list")}
            variant="outline"
            className={cn(
              "rounded-full border-transparent px-4",
              view === "list"
                ? "bg-[#FFF4E8] text-[#08030f]"
                : "bg-[#1b1b20] text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]",
            )}
          >
            <List className="size-4" aria-hidden="true" />
            List
          </Button>
          <Button
            type="button"
            onClick={() => setView("grid")}
            variant="outline"
            className={cn(
              "rounded-full border-transparent px-4",
              view === "grid"
                ? "bg-[#FFF4E8] text-[#08030f]"
                : "bg-[#1b1b20] text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]",
            )}
          >
            <Grid2X2 className="size-4" aria-hidden="true" />
            Grid
          </Button>
        </div>
      </div>

      <div className="mt-5 flex gap-7 overflow-x-auto border-b border-[#FFF4E8]/10">
        {WANTLIST_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count =
            tab.id === "all"
              ? records.length
              : tab.id === "priced"
                ? pricedCount
                : tab.id === "available"
                  ? availableCount
                  : bundleCount;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative min-w-max pb-3 text-sm font-medium transition",
                isActive
                  ? "text-[#FFF4E8]"
                  : "text-[#FFF4E8]/50 hover:text-[#FFF4E8]/78",
              )}
            >
              {tab.label}
              <span className="ml-2 text-xs text-[#FFF4E8]/36">{count}</span>
              {isActive ? (
                <span className="absolute inset-x-0 bottom-0 h-px bg-[#FFF4E8]" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/48"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search wanted vinyl"
            className="h-11 rounded-full border-transparent bg-[#1b1b20] pl-11 pr-4 text-[#FFF4E8] placeholder:text-[#FFF4E8]/38 focus-visible:border-[#FFF4E8]/18 focus-visible:ring-[#FFF4E8]/8"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-transparent bg-[#1b1b20] px-4 text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
          >
            <Filter className="size-4" aria-hidden="true" />
            Filters ({hasActiveFilters ? 1 : 0})
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full border-transparent bg-[#1b1b20] px-4 text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]"
          >
            <ListFilter className="size-4" aria-hidden="true" />
            Best match
          </Button>
        </div>
      </div>

      <div className="mt-5">
        {error ? (
          <div className="rounded-xl border border-[#D34278]/24 bg-[#D34278]/8 p-4 text-sm leading-6 text-[#FFF4E8]/78">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid min-h-[34rem] place-items-center text-sm text-[#FFF4E8]/54">
            <div className="text-center">
              <Loader2
                className="mx-auto mb-3 size-5 animate-spin"
                aria-hidden="true"
              />
              Loading wantlist
            </div>
          </div>
        ) : filteredRecords.length > 0 ? (
          view === "list" ? (
            <WantlistList
              records={filteredRecords}
              recordsByArtist={recordsByArtist}
              onSaveRecord={saveRecord}
            />
          ) : (
            <WantlistGrid
              records={filteredRecords}
              recordsByArtist={recordsByArtist}
            />
          )
        ) : (
          <EmptyWantlist
            hasRecords={records.length > 0}
            onReset={resetFilters}
          />
        )}
      </div>
    </section>
  );
}
