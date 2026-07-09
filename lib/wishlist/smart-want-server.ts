import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { CollectionOwner } from "@/lib/collection/server";
import {
  normalizeSmartWant,
  normalizeSmartWantInput,
  type SmartWant,
  type SmartWantInput,
} from "@/lib/wishlist/smart-want";

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  return { db, schema };
}

function serializeSmartWant(row: {
  id: string;
  masterReleaseId: number;
  sourceReleaseId: number | null;
  artist: string;
  title: string;
  imageUrl: string | null;
  sourceUri: string | null;
  rules: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SmartWant | null {
  return normalizeSmartWant({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function ownerFilter(
  owner: CollectionOwner,
  schema: Awaited<ReturnType<typeof loadDatabase>>["schema"],
) {
  return eq(schema.smartWants.userId, owner.userId);
}

export async function listSmartWants(owner: CollectionOwner) {
  const { db, schema } = await loadDatabase();
  const rows = await db
    .select()
    .from(schema.smartWants)
    .where(ownerFilter(owner, schema))
    .orderBy(desc(schema.smartWants.updatedAt));

  return rows
    .map(serializeSmartWant)
    .filter((want): want is SmartWant => Boolean(want));
}

export async function getSmartWant(owner: CollectionOwner, smartWantId: string) {
  const { db, schema } = await loadDatabase();
  const [row] = await db
    .select()
    .from(schema.smartWants)
    .where(
      and(
        ownerFilter(owner, schema),
        eq(schema.smartWants.id, smartWantId),
      ),
    )
    .limit(1);

  return row ? serializeSmartWant(row) : null;
}

export async function createSmartWant(
  owner: CollectionOwner,
  input: SmartWantInput,
) {
  const { db, schema } = await loadDatabase();
  const now = new Date();
  const normalized = normalizeSmartWantInput(input);

  if (!normalized) {
    return null;
  }

  const [row] = await db
    .insert(schema.smartWants)
    .values({
      userId: owner.userId,
      masterReleaseId: normalized.masterReleaseId,
      sourceReleaseId: normalized.sourceReleaseId,
      artist: normalized.artist,
      title: normalized.title,
      imageUrl: normalized.imageUrl,
      sourceUri: normalized.sourceUri,
      rules: normalized.rules,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row ? serializeSmartWant(row) : null;
}

export async function updateSmartWant(
  owner: CollectionOwner,
  smartWantId: string,
  input: SmartWantInput,
) {
  const { db, schema } = await loadDatabase();
  const normalized = normalizeSmartWantInput(input);

  if (!normalized) {
    return null;
  }

  const [row] = await db
    .update(schema.smartWants)
    .set({
      masterReleaseId: normalized.masterReleaseId,
      sourceReleaseId: normalized.sourceReleaseId,
      artist: normalized.artist,
      title: normalized.title,
      imageUrl: normalized.imageUrl,
      sourceUri: normalized.sourceUri,
      rules: normalized.rules,
      updatedAt: new Date(),
    })
    .where(
      and(
        ownerFilter(owner, schema),
        eq(schema.smartWants.id, smartWantId),
      ),
    )
    .returning();

  return row ? serializeSmartWant(row) : null;
}

export async function deleteSmartWant(
  owner: CollectionOwner,
  smartWantId: string,
) {
  const { db, schema } = await loadDatabase();

  await db
    .delete(schema.smartWants)
    .where(
      and(
        ownerFilter(owner, schema),
        eq(schema.smartWants.id, smartWantId),
      ),
    );
}
