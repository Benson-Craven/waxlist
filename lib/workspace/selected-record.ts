import type { CollectionRecord } from "@/lib/collection/record";
import {
  createUnknownPriceBreakdown,
  type WishlistRecord,
} from "@/lib/wishlist/record";

export const SELECTED_RECORD_CHANGED_EVENT = "waxlist:selected-record-changed";

export type SelectedRecordSource = "collection" | "wishlist" | "crate";

export type SelectedRecordStatus = "owned" | "wanted" | null;

export type SelectedRecord = {
  source: SelectedRecordSource;
  id: string;
  collectionId: string | null;
  wishlistId: string | null;
  discogsReleaseId: number;
  discogsMasterId: number | null;
  artist: string;
  title: string;
  format: string[];
  year: number | null;
  label: string | null;
  catalogNumber: string | null;
  barcode: string | null;
  imageUrl: string | null;
  mediaCondition: string | null;
  sleeveCondition: string | null;
  status: SelectedRecordStatus;
  tags: string[];
  notes: string | null;
  room: string | null;
  unit: string | null;
  shelf: string | null;
  slot: string | null;
  priceHintLabel: string | null;
  discogsUri: string | null;
  sourceContext: string | null;
  savedAt: string | null;
  wishlistRecord: WishlistRecord | null;
};

export type SelectedRecordPatch = Partial<
  Pick<
    SelectedRecord,
    "status" | "tags" | "notes" | "room" | "unit" | "shelf" | "slot"
  >
>;

export type CrateSelectedRecordInput = {
  id: string;
  discogsReleaseId: number;
  discogsMasterId?: number | null;
  artist: string;
  title: string;
  format?: string[];
  year?: number | null;
  label?: string | null;
  catalogNumber?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  mediaCondition?: string | null;
  sleeveCondition?: string | null;
  priceHintLabel?: string | null;
  discogsUri?: string | null;
  sourceContext?: string | null;
  wishlistRecord?: WishlistRecord | null;
};

export function selectedRecordFromCollection(
  record: CollectionRecord,
): SelectedRecord {
  return {
    source: "collection",
    id: `collection:${record.id}`,
    collectionId: record.id,
    wishlistId: null,
    discogsReleaseId: record.discogsReleaseId,
    discogsMasterId: record.discogsMasterId,
    artist: record.artist,
    title: record.title,
    format: record.format,
    year: record.year,
    label: record.label,
    catalogNumber: record.catalogNumber,
    barcode: record.barcode,
    imageUrl: record.imageUrl,
    mediaCondition: record.mediaCondition,
    sleeveCondition: record.sleeveCondition,
    status: record.status,
    tags: record.tags,
    notes: record.notes,
    room: record.room,
    unit: record.unit,
    shelf: record.shelf,
    slot: record.slot,
    priceHintLabel: record.priceHintLabel,
    discogsUri: `https://www.discogs.com/release/${record.discogsReleaseId}`,
    sourceContext: record.syncedAt ? `Synced ${record.syncedAt}` : null,
    savedAt: null,
    wishlistRecord: null,
  };
}

export function selectedRecordFromWishlist(
  record: WishlistRecord,
): SelectedRecord {
  return {
    source: "wishlist",
    id: `wishlist:${record.id}`,
    collectionId: null,
    wishlistId: record.id,
    discogsReleaseId: record.discogsReleaseId,
    discogsMasterId: null,
    artist: record.discogsArtist,
    title: record.discogsTitle,
    format: record.format,
    year: record.year,
    label: null,
    catalogNumber: null,
    barcode: null,
    imageUrl: record.thumb,
    mediaCondition: null,
    sleeveCondition: null,
    status: "wanted",
    tags: record.buyingControls.tags,
    notes: record.buyingControls.ignoredListingNote,
    room: null,
    unit: null,
    shelf: null,
    slot: null,
    priceHintLabel: record.priceLabel,
    discogsUri: record.discogsUri,
    sourceContext: `${record.spotifyArtist} - ${record.spotifyAlbum}`,
    savedAt: record.savedAt,
    wishlistRecord: record,
  };
}

export function selectedRecordFromCrate(
  record: CrateSelectedRecordInput,
): SelectedRecord {
  return {
    source: "crate",
    id: `crate:${record.id}`,
    collectionId: null,
    wishlistId: record.wishlistRecord?.id ?? null,
    discogsReleaseId: record.discogsReleaseId,
    discogsMasterId: record.discogsMasterId ?? null,
    artist: record.artist,
    title: record.title,
    format: record.format ?? [],
    year: record.year ?? null,
    label: record.label ?? null,
    catalogNumber: record.catalogNumber ?? null,
    barcode: record.barcode ?? null,
    imageUrl: record.imageUrl ?? null,
    mediaCondition: record.mediaCondition ?? null,
    sleeveCondition: record.sleeveCondition ?? null,
    status: record.wishlistRecord ? "wanted" : null,
    tags: record.wishlistRecord?.buyingControls.tags ?? [],
    notes: record.wishlistRecord?.buyingControls.ignoredListingNote ?? null,
    room: null,
    unit: null,
    shelf: null,
    slot: null,
    priceHintLabel: record.priceHintLabel ?? null,
    discogsUri: record.discogsUri ?? null,
    sourceContext: record.sourceContext ?? null,
    savedAt: record.wishlistRecord?.savedAt ?? null,
    wishlistRecord: record.wishlistRecord ?? null,
  };
}

export function applySelectedRecordPatch(
  record: SelectedRecord,
  patch: SelectedRecordPatch,
): SelectedRecord {
  return {
    ...record,
    ...patch,
    tags: patch.tags ?? record.tags,
  };
}

export function createWishlistRecordFromSelected(
  record: SelectedRecord,
): WishlistRecord {
  return {
    id: record.wishlistId ?? `discogs:${record.discogsReleaseId}`,
    savedAt: record.savedAt ?? new Date().toISOString(),
    spotifyAlbum: record.sourceContext ?? record.title,
    spotifyArtist: record.artist,
    spotifyAlbumId: null,
    spotifyAlbumUrl: null,
    discogsReleaseId: record.discogsReleaseId,
    discogsTitle: record.title,
    discogsArtist: record.artist,
    discogsUri:
      record.discogsUri ?? `https://www.discogs.com/release/${record.discogsReleaseId}`,
    thumb: record.imageUrl,
    format: record.format,
    year: record.year,
    country: null,
    recommendationScore: 0,
    confidence: 0,
    availabilityLabel: "Availability unknown",
    priceLabel: record.priceHintLabel ?? "Price unknown",
    sourceTrackCount: 0,
    priceBreakdown:
      record.wishlistRecord?.priceBreakdown ??
      createUnknownPriceBreakdown("not_checked"),
    buyingControls: {
      priority: null,
      tags: record.tags,
      maxItemPrice: null,
      maxShipping: null,
      conditionPreference: null,
      sellerFilter: null,
      regionFilter: null,
      ignoredListingState: "none",
      ignoredListingNote: record.notes,
      updatedAt: new Date().toISOString(),
    },
  };
}
