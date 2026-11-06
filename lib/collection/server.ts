import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { getServerCapabilities } from "@/lib/capabilities/server";
import {
  CLEARED_COLLECTION_LOCATION,
  type BulkLocationMode,
} from "@/lib/collection/location-batch";
import {
  normalizeCollectionItem,
  sanitizeRestrictedCollectionData,
  sanitizeRestrictedCollectionDataForOwner,
  serializeCollectionItem,
  type CollectionItemInput,
  type CollectionItemPatch,
  type CollectionRecord,
} from "@/lib/collection/record";
import { loadRecordPriceSummaries } from "@/lib/collection/pricing-server";
import {
  listWishlistRecords,
  type WishlistOwner,
} from "@/lib/wishlist/server";

export type CollectionOwner = Extract<WishlistOwner, { type: "user" }>;

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  return { db, schema };
}

export async function resolveCollectionOwner(
  _request?: NextRequest,
): Promise<CollectionOwner | null> {
  void _request;
  const resolved = await resolveAuthenticatedOwner();

  return resolved.ok ? resolved.owner : null;
}

export async function resolveCollectionOwnerFromSpotifyProfile(input: {
  spotifyUserId: string;
  displayName?: string | null;
  imageUrl?: string | null;
}): Promise<CollectionOwner | null> {
  if (!input.spotifyUserId) {
    return null;
  }

  const { db, schema } = await loadDatabase();
  const now = new Date();
  const [user] = await db
    .insert(schema.users)
    .values({
      spotifyUserId: input.spotifyUserId,
      displayName: input.displayName ?? null,
      imageUrl: input.imageUrl ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.users.spotifyUserId,
      set: {
        displayName: input.displayName ?? null,
        imageUrl: input.imageUrl ?? null,
        updatedAt: now,
      },
    })
    .returning({
      id: schema.users.id,
    });

  return user
    ? {
        type: "user",
        userId: user.id,
        sessionIdHash: null,
      }
    : null;
}

function ownerFilter(
  owner: CollectionOwner,
  schema: Awaited<ReturnType<typeof loadDatabase>>["schema"],
) {
  return eq(schema.collectionItems.userId, owner.userId);
}

export function jsonWithCollectionOwnerCookies(
  owner: CollectionOwner,
  payload: Record<string, unknown>,
  status = 200,
) {
  const response = NextResponse.json(payload, { status });

  return response;
}

type ListCollectionRecordsOptions = {
  /**
   * Keeps stored album artwork for the authenticated owner's own shelf.
   * Every other Restricted Data field stays stripped.
   */
  keepArtwork?: boolean;
};

export async function listCollectionRecords(
  owner: CollectionOwner,
  options: ListCollectionRecordsOptions = {},
) {
  const { db, schema } = await loadDatabase();
  const rows = await db
    .select()
    .from(schema.collectionItems)
    .where(ownerFilter(owner, schema))
    .orderBy(desc(schema.collectionItems.updatedAt));

  const records = rows
    .map((row) => normalizeCollectionItem(row))
    .filter((record): record is NonNullable<typeof record> => Boolean(record))
    .map(serializeCollectionItem);
  const pricing = await loadRecordPriceSummaries(
    owner,
    records.map((record) => record.id),
  );
  const recordsWithPricing = records.map((record) => ({
    ...record,
    pricing: pricing.get(record.id) ?? null,
  }));

  if (getServerCapabilities().discogsRestrictedData) {
    return recordsWithPricing;
  }

  return recordsWithPricing.map((record) =>
    options.keepArtwork
      ? sanitizeRestrictedCollectionDataForOwner(record)
      : sanitizeRestrictedCollectionData(record),
  );
}

export async function seedCollectionFromWishlist(owner: CollectionOwner) {
  const { db, schema } = await loadDatabase();
  const wishlistRecords = await listWishlistRecords(owner);

  if (wishlistRecords.length === 0) {
    return {
      insertedCount: 0,
      records: await listCollectionRecords(owner, { keepArtwork: true }),
    };
  }

  const wishlistReleaseIds = wishlistRecords.map((record) => record.discogsReleaseId);
  const existingWantedRows = await db
    .select({
      releaseId: schema.collectionItems.discogsReleaseId,
    })
    .from(schema.collectionItems)
    .where(
      and(
        ownerFilter(owner, schema),
        eq(schema.collectionItems.status, "wanted"),
        inArray(schema.collectionItems.discogsReleaseId, wishlistReleaseIds),
      ),
    );
  const existingWantedReleaseIds = new Set(
    existingWantedRows.map((row) => row.releaseId),
  );
  const now = new Date();
  const values = wishlistRecords
    .filter((record) => !existingWantedReleaseIds.has(record.discogsReleaseId))
    .map((record) => ({
      userId: owner.userId,
      discogsReleaseId: record.discogsReleaseId,
      discogsMasterId: null,
      discogsInstanceId: null,
      discogsFolderId: null,
      artist: record.discogsArtist || record.sourceArtist,
      title: record.discogsTitle || record.sourceAlbum,
      format: record.format,
      year: record.year,
      label: null,
      catalogNumber: null,
      barcode: null,
      imageUrl: record.thumb,
      mediaCondition: null,
      sleeveCondition: null,
      status: "wanted" as const,
      tags: ["wishlist"],
      notes: null,
      group: null,
      unit: null,
      shelf: null,
      slot: null,
      priceHintCents: null,
      priceHintCurrency: null,
      priceHintLabel:
        record.priceLabel === "Price unknown" ? null : record.priceLabel,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    }));

  if (values.length > 0) {
    await db.insert(schema.collectionItems).values(values);
  }

  return {
    insertedCount: values.length,
    records: await listCollectionRecords(owner, { keepArtwork: true }),
  };
}

export type CollectionLocationUpdate = {
  group: string | null;
  unit: string | null;
  shelf: string | null;
  slot: string | null;
};

export async function updateCollectionLocations(
  owner: CollectionOwner,
  recordIds: string[],
  location: CollectionLocationUpdate,
  mode: BulkLocationMode = "replace",
): Promise<{
  updated: number;
  records: Array<CollectionLocationUpdate & { id: string }>;
}> {
  const { db, schema } = await loadDatabase();
  // Group mode is the merged Collection page's grouping control: move a record
  // between groups without wiping the unit/shelf/slot already stored on it.
  // Ungroup mode is its inverse: the spot inside a group is meaningless once
  // the group is gone, so the whole location is cleared.
  const nextLocation =
    mode === "group"
      ? { group: location.group }
      : mode === "ungroup"
        ? { ...CLEARED_COLLECTION_LOCATION }
        : location;
  const rows = await db
    .update(schema.collectionItems)
    .set({
      ...nextLocation,
      updatedAt: new Date(),
    })
    .where(
      and(
        ownerFilter(owner, schema),
        inArray(schema.collectionItems.id, recordIds),
      ),
    )
    .returning({
      id: schema.collectionItems.id,
      group: schema.collectionItems.group,
      unit: schema.collectionItems.unit,
      shelf: schema.collectionItems.shelf,
      slot: schema.collectionItems.slot,
    });

  return {
    updated: rows.length,
    records: rows,
  };
}

export async function updateCollectionRecord(
  owner: CollectionOwner,
  recordId: string,
  patch: CollectionItemPatch,
): Promise<CollectionRecord | null> {
  const { db, schema } = await loadDatabase();
  const [row] = await db
    .update(schema.collectionItems)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(and(ownerFilter(owner, schema), eq(schema.collectionItems.id, recordId)))
    .returning();
  const record = normalizeCollectionItem(row);

  if (!record) {
    return null;
  }

  return serializeCollectionItem(record);
}

/**
 * Returns a saved row in the shape the owner's own shelf may render. The
 * artwork is the only Restricted Data field kept for the authenticated owner.
 */
export function collectionRecordForOwner(record: CollectionRecord) {
  return getServerCapabilities().discogsRestrictedData
    ? record
    : sanitizeRestrictedCollectionDataForOwner(record);
}

export async function getCollectionRecordById(
  owner: CollectionOwner,
  recordId: string,
): Promise<CollectionRecord | null> {
  const { db, schema } = await loadDatabase();
  const [row] = await db
    .select()
    .from(schema.collectionItems)
    .where(
      and(
        ownerFilter(owner, schema),
        eq(schema.collectionItems.id, recordId),
      ),
    )
    .limit(1);
  const record = normalizeCollectionItem(row);

  return record ? serializeCollectionItem(record) : null;
}

export async function findCollectionRecordByRelease(
  owner: CollectionOwner,
  releaseId: number,
): Promise<CollectionRecord | null> {
  const { db, schema } = await loadDatabase();
  const [row] = await db
    .select()
    .from(schema.collectionItems)
    .where(
      and(
        ownerFilter(owner, schema),
        eq(schema.collectionItems.discogsReleaseId, releaseId),
      ),
    )
    .orderBy(desc(schema.collectionItems.updatedAt))
    .limit(1);
  const record = normalizeCollectionItem(row);

  return record ? serializeCollectionItem(record) : null;
}

export async function insertCollectionRecord(
  owner: CollectionOwner,
  input: Omit<CollectionItemInput, "userId" | "syncedAt">,
): Promise<CollectionRecord> {
  const { db, schema } = await loadDatabase();
  const now = new Date();
  const [row] = await db
    .insert(schema.collectionItems)
    .values({
      ...input,
      userId: owner.userId,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const record = normalizeCollectionItem(row);

  if (!record) {
    throw new Error("The saved record could not be read back.");
  }

  return serializeCollectionItem(record);
}

export async function deleteCollectionRecord(
  owner: CollectionOwner,
  recordId: string,
): Promise<boolean> {
  const { db, schema } = await loadDatabase();
  const deleted = await db
    .delete(schema.collectionItems)
    .where(
      and(
        ownerFilter(owner, schema),
        eq(schema.collectionItems.id, recordId),
      ),
    )
    .returning({ id: schema.collectionItems.id });

  return deleted.length > 0;
}
