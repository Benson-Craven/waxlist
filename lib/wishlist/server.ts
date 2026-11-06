import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { WISHLIST_SESSION_COOKIE } from "@/lib/constants";
import {
  normalizeWishlistRecord,
  type WishlistRecord,
} from "@/lib/wishlist/record";

export type WishlistOwner = {
  type: "user";
  userId: string;
  authUserId?: string | null;
  sessionIdHash: null;
};

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  return { db, schema };
}

export async function resolveWishlistOwner(
  _request?: NextRequest,
): Promise<WishlistOwner | null> {
  void _request;
  const resolved = await resolveAuthenticatedOwner();

  return resolved.ok ? resolved.owner : null;
}

function ownerFilter(
  owner: WishlistOwner,
  schema: Awaited<ReturnType<typeof loadDatabase>>["schema"],
) {
  return eq(schema.wishlistItems.userId, owner.userId);
}

export async function listWishlistRecords(owner: WishlistOwner) {
  const { db, schema } = await loadDatabase();
  const rows = await db
    .select({
      payload: schema.wishlistItems.recordPayload,
    })
    .from(schema.wishlistItems)
    .where(ownerFilter(owner, schema))
    .orderBy(desc(schema.wishlistItems.createdAt));

  return rows
    .map((row) => normalizeWishlistRecord(row.payload))
    .filter((record): record is WishlistRecord => Boolean(record));
}

export async function saveWishlistRecord(
  owner: WishlistOwner,
  record: WishlistRecord,
) {
  const { db, schema } = await loadDatabase();
  const now = new Date();
  const values = {
    userId: owner.userId,
    sessionIdHash: null,
    recordKey: record.id,
    sourceProvider: record.sourceProvider,
    sourceAlbum: record.sourceAlbum,
    sourceArtist: record.sourceArtist,
    discogsTitle: record.discogsTitle,
    discogsArtist: record.discogsArtist,
    discogsUrl: record.discogsUri,
    recordPayload: record,
    createdAt: now,
  };

  await db
    .insert(schema.wishlistItems)
    .values(values)
    .onConflictDoUpdate({
      target: [
        schema.wishlistItems.userId,
        schema.wishlistItems.recordKey,
      ],
      set: values,
    });

  return record;
}

export async function removeWishlistRecord(
  owner: WishlistOwner,
  recordId: string,
) {
  const { db, schema } = await loadDatabase();

  await db
    .delete(schema.wishlistItems)
    .where(
      and(
        ownerFilter(owner, schema),
        eq(schema.wishlistItems.recordKey, recordId),
      ),
    );
}

export async function deleteOwnerData(owner: WishlistOwner) {
  const { db, schema } = await loadDatabase();

  const importRows = await db
    .select({ id: schema.listeningSourceSnapshots.id })
    .from(schema.listeningSourceSnapshots)
    .where(eq(schema.listeningSourceSnapshots.userId, owner.userId));
  const importIds = importRows.map((row) => row.id);

  if (importIds.length > 0) {
    await db
      .delete(schema.discogsMatches)
      .where(inArray(schema.discogsMatches.importId, importIds));
    await db
      .delete(schema.listeningSourceSnapshots)
      .where(eq(schema.listeningSourceSnapshots.userId, owner.userId));
  }

  await db.delete(schema.users).where(eq(schema.users.id, owner.userId));

  return {
    deletedUser: true,
    clearedWishlistSession: false,
  };
}

export function clearWishlistSessionCookie(response: NextResponse) {
  response.cookies.delete(WISHLIST_SESSION_COOKIE);
}

export function copyWishlistCookieHeaders(
  _owner: WishlistOwner,
  _response: NextResponse,
) {
  void _owner;
  void _response;
  return;
}
