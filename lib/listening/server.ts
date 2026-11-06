import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type { CollectionOwner } from "@/lib/collection/server";
import type {
  ListeningSourceProvider,
  ListeningSourceSnapshot,
  ListeningSourceType,
} from "@/lib/listening/types";

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  return { db, schema };
}

export async function loadLatestListeningSnapshot(
  owner: CollectionOwner,
  provider: ListeningSourceProvider,
  sourceType: ListeningSourceType,
): Promise<ListeningSourceSnapshot | null> {
  const { db, schema } = await loadDatabase();
  const [row] = await db
    .select({
      summary: schema.listeningSourceSnapshots.summary,
    })
    .from(schema.listeningSourceSnapshots)
    .where(
      and(
        eq(schema.listeningSourceSnapshots.userId, owner.userId),
        eq(schema.listeningSourceSnapshots.provider, provider),
        eq(schema.listeningSourceSnapshots.sourceType, sourceType),
      ),
    )
    .orderBy(desc(schema.listeningSourceSnapshots.updatedAt))
    .limit(1);

  const summary = row?.summary;

  if (
    !summary ||
    !("provider" in summary) ||
    summary.provider !== provider ||
    !("sourceType" in summary) ||
    summary.sourceType !== sourceType ||
    !Array.isArray(summary.candidates)
  ) {
    return null;
  }

  return summary;
}

export async function replaceListeningSnapshot(
  owner: CollectionOwner,
  snapshot: ListeningSourceSnapshot,
) {
  const { db, schema } = await loadDatabase();
  const now = new Date();

  return db.transaction(async (transaction) => {
    await transaction.execute(sql`
      select pg_advisory_xact_lock(
        hashtext(${`${owner.userId}:${snapshot.provider}:${snapshot.sourceType}`})
      )
    `);

    await transaction
      .delete(schema.listeningSourceSnapshots)
      .where(
        and(
          eq(schema.listeningSourceSnapshots.userId, owner.userId),
          eq(schema.listeningSourceSnapshots.provider, snapshot.provider),
          eq(
            schema.listeningSourceSnapshots.sourceType,
            snapshot.sourceType,
          ),
        ),
      );

    const [inserted] = await transaction
      .insert(schema.listeningSourceSnapshots)
      .values({
        userId: owner.userId,
        provider: snapshot.provider,
        sourceType: snapshot.sourceType,
        sourceId: snapshot.sourceAccountId,
        snapshotId: snapshot.importedAt,
        windowDays: snapshot.windowDays,
        summary: snapshot,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: schema.listeningSourceSnapshots.id,
      });

    if (!inserted) {
      throw new Error("Listening snapshot could not be persisted.");
    }

    return snapshot;
  });
}

export async function setNativeCollectionState(input: {
  owner: CollectionOwner;
  status: "owned" | "wanted";
  releaseId: number;
  masterId: number | null;
  artist: string;
  title: string;
  format: string[];
  year: number | null;
  imageUrl?: string | null;
}) {
  const { db, schema } = await loadDatabase();
  const [existing] = await db
    .select({
      id: schema.collectionItems.id,
      imageUrl: schema.collectionItems.imageUrl,
    })
    .from(schema.collectionItems)
    .where(
      and(
        eq(schema.collectionItems.userId, input.owner.userId),
        eq(schema.collectionItems.discogsReleaseId, input.releaseId),
      ),
    )
    .limit(1);
  const now = new Date();
  const artwork =
    input.imageUrl && input.imageUrl.trim() ? input.imageUrl.trim() : null;

  if (existing) {
    await db
      .update(schema.collectionItems)
      .set({
        status: input.status,
        ...(input.masterId !== null
          ? { discogsMasterId: input.masterId }
          : {}),
        // Fill in cover art for records added before artwork was captured,
        // but never replace art the record already has.
        ...(artwork && !existing.imageUrl ? { imageUrl: artwork } : {}),
        updatedAt: now,
      })
      .where(eq(schema.collectionItems.id, existing.id));
  } else {
    await db.insert(schema.collectionItems).values({
      userId: input.owner.userId,
      discogsReleaseId: input.releaseId,
      discogsMasterId: input.masterId,
      discogsInstanceId: null,
      discogsFolderId: null,
      artist: input.artist,
      title: input.title,
      format: input.format,
      year: input.year,
      label: null,
      catalogNumber: null,
      barcode: null,
      imageUrl: artwork,
      mediaCondition: null,
      sleeveCondition: null,
      status: input.status,
      tags: ["listening-gap"],
      notes: null,
      group: null,
      unit: null,
      shelf: null,
      slot: null,
      priceHintCents: null,
      priceHintCurrency: null,
      priceHintLabel: null,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return input.status;
}
