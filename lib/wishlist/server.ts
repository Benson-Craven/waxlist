import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import {
  copyCookieHeaders,
  fetchSpotifyJson,
  getSpotifyAuthorizedRequest,
} from "@/lib/spotify/api";
import { getSpotifyCookieNames } from "@/lib/spotify/oauth";
import {
  normalizeWishlistRecord,
  type WishlistRecord,
} from "@/lib/wishlist/record";

const WISHLIST_SESSION_COOKIE = "waxlist_wishlist_session";
const WISHLIST_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const WISHLIST_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

type WishlistOwner =
  | {
      type: "user";
      userId: string;
      sessionIdHash: null;
      cookieResponse?: NextResponse;
    }
  | {
      type: "session";
      userId: null;
      sessionIdHash: string;
      cookieResponse?: NextResponse;
    };

type SpotifyMeResponse = {
  id?: string;
  display_name?: string | null;
  images?: Array<{
    url?: string;
  }>;
};

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  return { db, schema };
}

function createStableHash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function getWishlistSessionId(request: NextRequest) {
  const cookieValue = request.cookies.get(WISHLIST_SESSION_COOKIE)?.value;

  if (cookieValue && /^[A-Za-z0-9_-]{16,128}$/.test(cookieValue)) {
    return {
      sessionId: cookieValue,
      cookieResponse: undefined,
    };
  }

  const sessionId = randomUUID();
  const cookieResponse = new NextResponse(null);

  cookieResponse.cookies.set(WISHLIST_SESSION_COOKIE, sessionId, {
    ...WISHLIST_COOKIE_OPTIONS,
    maxAge: WISHLIST_SESSION_MAX_AGE_SECONDS,
  });

  return {
    sessionId,
    cookieResponse,
  };
}

async function resolveSpotifyUser(request: NextRequest) {
  if (!request.cookies.has(getSpotifyCookieNames().session)) {
    return null;
  }

  const authorized = await getSpotifyAuthorizedRequest(request);

  if (!authorized.ok) {
    return null;
  }

  const profileResponse = await fetchSpotifyJson<SpotifyMeResponse>(
    "/me",
    authorized.session,
  );

  if (
    !profileResponse.ok ||
    !profileResponse.payload ||
    typeof profileResponse.payload !== "object" ||
    typeof (profileResponse.payload as SpotifyMeResponse).id !== "string"
  ) {
    return null;
  }

  const profile = profileResponse.payload as SpotifyMeResponse;
  const spotifyUserId = profile.id;

  if (!spotifyUserId) {
    return null;
  }

  const imageUrl = profile.images?.find((image) => image.url)?.url ?? null;
  const { db, schema } = await loadDatabase();
  const now = new Date();
  const [user] = await db
    .insert(schema.users)
    .values({
      spotifyUserId,
      displayName: profile.display_name ?? null,
      imageUrl,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.users.spotifyUserId,
      set: {
        displayName: profile.display_name ?? null,
        imageUrl,
        updatedAt: now,
      },
    })
    .returning({
      id: schema.users.id,
    });

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    cookieResponse: authorized.response,
  };
}

export async function resolveWishlistOwner(
  request: NextRequest,
): Promise<WishlistOwner> {
  const spotifyUser = await resolveSpotifyUser(request);

  if (spotifyUser) {
    return {
      type: "user",
      userId: spotifyUser.userId,
      sessionIdHash: null,
      cookieResponse: spotifyUser.cookieResponse,
    };
  }

  const fallbackSession = getWishlistSessionId(request);

  return {
    type: "session",
    userId: null,
    sessionIdHash: createStableHash(fallbackSession.sessionId),
    cookieResponse: fallbackSession.cookieResponse,
  };
}

function ownerFilter(
  owner: WishlistOwner,
  schema: Awaited<ReturnType<typeof loadDatabase>>["schema"],
) {
  return owner.type === "user"
    ? eq(schema.wishlistItems.userId, owner.userId)
    : eq(schema.wishlistItems.sessionIdHash, owner.sessionIdHash);
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
    userId: owner.type === "user" ? owner.userId : null,
    sessionIdHash: owner.type === "session" ? owner.sessionIdHash : null,
    recordKey: record.id,
    spotifyAlbum: record.spotifyAlbum,
    spotifyArtist: record.spotifyArtist,
    discogsTitle: record.discogsTitle,
    discogsArtist: record.discogsArtist,
    discogsUrl: record.discogsUri,
    recordPayload: record,
    createdAt: now,
  };

  if (owner.type === "user") {
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
  } else {
    await db
      .insert(schema.wishlistItems)
      .values(values)
      .onConflictDoUpdate({
        target: [
          schema.wishlistItems.sessionIdHash,
          schema.wishlistItems.recordKey,
        ],
        set: values,
      });
  }

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

  if (owner.type === "session") {
    await db
      .delete(schema.wishlistItems)
      .where(eq(schema.wishlistItems.sessionIdHash, owner.sessionIdHash));

    return {
      deletedUser: false,
      clearedWishlistSession: true,
    };
  }

  const importRows = await db
    .select({ id: schema.spotifyImports.id })
    .from(schema.spotifyImports)
    .where(eq(schema.spotifyImports.userId, owner.userId));
  const importIds = importRows.map((row) => row.id);

  if (importIds.length > 0) {
    await db
      .delete(schema.discogsMatches)
      .where(inArray(schema.discogsMatches.importId, importIds));
    await db
      .delete(schema.spotifyImports)
      .where(eq(schema.spotifyImports.userId, owner.userId));
  }

  await db.delete(schema.users).where(eq(schema.users.id, owner.userId));

  return {
    deletedUser: true,
    clearedWishlistSession: false,
  };
}

export function clearWishlistSessionCookie(response: NextResponse) {
  response.cookies.set(WISHLIST_SESSION_COOKIE, "", {
    ...WISHLIST_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

export function copyWishlistCookieHeaders(
  owner: WishlistOwner,
  response: NextResponse,
) {
  copyCookieHeaders(owner.cookieResponse, response);
}
