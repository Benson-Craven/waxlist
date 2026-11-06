import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

export function createLegacyClaimState(input: {
  nonce: string;
  authUserId: string;
  secret: string;
}) {
  const subject = Buffer.from(input.authUserId, "utf8").toString("base64url");
  const signedValue = `${input.nonce}.${subject}`;
  const signature = createHmac("sha256", input.secret)
    .update(signedValue)
    .digest("base64url");

  return `v1.${signedValue}.${signature}`;
}

export function verifyLegacyClaimState(input: {
  cookieValue: string | undefined;
  nonce: string | null;
  authUserId: string;
  secret: string;
}) {
  const parts = input.cookieValue?.split(".");

  if (!parts || parts.length !== 4 || parts[0] !== "v1" || !input.nonce) {
    return false;
  }

  const [, nonce, subject, signature] = parts;
  if (!nonce || !subject || !signature || nonce !== input.nonce) {
    return false;
  }

  const expectedSubject = Buffer.from(input.authUserId, "utf8").toString(
    "base64url",
  );
  if (subject !== expectedSubject) {
    return false;
  }

  const expected = createHmac("sha256", input.secret)
    .update(`${nonce}.${subject}`)
    .digest();
  let actual: Buffer;

  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type LegacyClaimDecision =
  | "bind_legacy"
  | "already_claimed"
  | "no_matching_legacy"
  | "claimed_by_another_account"
  | "current_account_linked_elsewhere";

export function decideLegacyClaim(input: {
  currentUserId: string;
  currentSpotifyUserId: string | null;
  legacyUserId: string | null;
  legacyAuthUserId: string | null;
  authUserId: string;
}): LegacyClaimDecision {
  if (
    input.currentSpotifyUserId &&
    input.legacyUserId !== input.currentUserId
  ) {
    return "current_account_linked_elsewhere";
  }

  if (!input.legacyUserId) {
    return "no_matching_legacy";
  }

  if (input.legacyUserId === input.currentUserId) {
    return "already_claimed";
  }

  if (input.legacyAuthUserId === input.authUserId) {
    return "already_claimed";
  }

  if (input.legacyAuthUserId) {
    return "claimed_by_another_account";
  }

  return "bind_legacy";
}

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);
  return { db, schema };
}

export async function claimLegacySpotifyData(input: {
  currentUserId: string;
  authUserId: string;
  spotifyUserId: string;
  displayName: string | null;
  imageUrl: string | null;
  connection?: {
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string | null;
    scope: string | null;
    expiresAt: Date;
  };
}) {
  const { db, schema } = await loadDatabase();

  return db.transaction(async (transaction) => {
    const [current] = await transaction
      .select({
        id: schema.users.id,
        spotifyUserId: schema.users.spotifyUserId,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, input.currentUserId),
          eq(schema.users.authUserId, input.authUserId),
        ),
      )
      .limit(1);
    const [legacy] = await transaction
      .select({
        id: schema.users.id,
        authUserId: schema.users.authUserId,
      })
      .from(schema.users)
      .where(eq(schema.users.spotifyUserId, input.spotifyUserId))
      .limit(1)
      .for("update");

    if (!current) {
      throw new Error("Signed-in WAXLIST account was not found.");
    }

    const decision = decideLegacyClaim({
      currentUserId: current.id,
      currentSpotifyUserId: current.spotifyUserId,
      legacyUserId: legacy?.id ?? null,
      legacyAuthUserId: legacy?.authUserId ?? null,
      authUserId: input.authUserId,
    });

    if (
      decision === "claimed_by_another_account" ||
      decision === "current_account_linked_elsewhere" ||
      (decision === "no_matching_legacy" && !input.connection)
    ) {
      return { ok: false as const, code: decision };
    }

    let targetUserId: string;
    let status:
      | "linked_current"
      | "already_claimed"
      | "bind_legacy";

    if (decision === "bind_legacy") {
      const dependentCounts = await transaction.execute(sql`
        select (
          (select count(*) from wishlist_items where user_id = ${current.id}) +
          (select count(*) from collection_items where user_id = ${current.id}) +
          (select count(*) from listening_source_snapshots where user_id = ${current.id}) +
          (select count(*) from smart_wants where user_id = ${current.id}) +
          (select count(*) from discogs_import_runs where user_id = ${current.id})
        )::int as count
      `);
      const count = Number(
        (dependentCounts as unknown as Array<{ count?: number | string }>)[0]
          ?.count ?? 0,
      );

      if (count > 0) {
        return {
          ok: false as const,
          code: "current_account_has_data" as const,
        };
      }

      await transaction
        .delete(schema.users)
        .where(eq(schema.users.id, current.id));
      await transaction
        .update(schema.users)
        .set({
          authUserId: input.authUserId,
          displayName: input.displayName,
          imageUrl: input.imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, legacy!.id));
      await transaction
        .delete(schema.spotifyAccounts)
        .where(eq(schema.spotifyAccounts.userId, legacy!.id));
      targetUserId = legacy!.id;
      status = decision;
    } else if (decision === "already_claimed") {
      targetUserId = legacy?.id ?? current.id;
      status = decision;
    } else if (decision === "no_matching_legacy" && input.connection) {
      await transaction
        .update(schema.users)
        .set({
          spotifyUserId: input.spotifyUserId,
          displayName: input.displayName,
          imageUrl: input.imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, current.id));
      targetUserId = current.id;
      status = "linked_current";
    } else {
      throw new Error(`Unhandled legacy claim decision: ${decision}`);
    }

    if (input.connection) {
      await transaction
        .insert(schema.spotifyAccounts)
        .values({
          userId: targetUserId,
          spotifyUserId: input.spotifyUserId,
          accessTokenEncrypted: input.connection.accessTokenEncrypted,
          refreshTokenEncrypted: input.connection.refreshTokenEncrypted,
          scope: input.connection.scope,
          expiresAt: input.connection.expiresAt,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.spotifyAccounts.userId,
          set: {
            spotifyUserId: input.spotifyUserId,
            accessTokenEncrypted: input.connection.accessTokenEncrypted,
            refreshTokenEncrypted: input.connection.refreshTokenEncrypted,
            scope: input.connection.scope,
            expiresAt: input.connection.expiresAt,
            updatedAt: new Date(),
          },
        });
    }

    return { ok: true as const, status, userId: targetUserId };
  });
}
