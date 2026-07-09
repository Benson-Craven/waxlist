import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import {
  normalizeCollectionItem,
  serializeCollectionItem,
  type CollectionItemPatch,
  type CollectionRecord,
} from "@/lib/collection/record";
import { copyCookieHeaders } from "@/lib/spotify/api";
import {
  listWishlistRecords,
  resolveWishlistOwner,
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
  request: NextRequest,
): Promise<CollectionOwner | null> {
  const owner = await resolveWishlistOwner(request);

  if (owner.type !== "user") {
    return null;
  }

  return owner;
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

  copyCookieHeaders(owner.cookieResponse, response);

  return response;
}

export async function listCollectionRecords(owner: CollectionOwner) {
  const { db, schema } = await loadDatabase();
  const rows = await db
    .select()
    .from(schema.collectionItems)
    .where(ownerFilter(owner, schema))
    .orderBy(desc(schema.collectionItems.updatedAt));

  return rows
    .map((row) => normalizeCollectionItem(row))
    .filter((record): record is NonNullable<typeof record> => Boolean(record))
    .map(serializeCollectionItem);
}

export async function seedCollectionFromWishlist(owner: CollectionOwner) {
  const { db, schema } = await loadDatabase();
  const wishlistRecords = await listWishlistRecords(owner);

  if (wishlistRecords.length === 0) {
    return {
      insertedCount: 0,
      records: await listCollectionRecords(owner),
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
      artist: record.discogsArtist || record.spotifyArtist,
      title: record.discogsTitle || record.spotifyAlbum,
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
      room: null,
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
    records: await listCollectionRecords(owner),
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

  return record ? serializeCollectionItem(record) : null;
}
