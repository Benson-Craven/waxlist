import "server-only";

import { and, desc, eq } from "drizzle-orm";

import {
  buildSpinStats,
  serializeSpinLogEntry,
  type SpinLogEntry,
  type SpinLogInput,
  type SpinLogStats,
} from "@/lib/spins/record";

type SpinLogOwner = {
  userId: string;
};

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  return { db, schema };
}

export async function listSpinLogEntries(
  owner: SpinLogOwner,
): Promise<SpinLogEntry[]> {
  const { db, schema } = await loadDatabase();
  const rows = await db
    .select()
    .from(schema.spinLogEntries)
    .where(eq(schema.spinLogEntries.userId, owner.userId))
    .orderBy(
      desc(schema.spinLogEntries.spunAt),
      desc(schema.spinLogEntries.createdAt),
    );

  return rows.map(serializeSpinLogEntry);
}

/**
 * Lightweight all-time stats for the workspace summary. The dashboard should
 * not pay for every note and side just to show this week's spin count.
 */
export async function loadSpinLogStats(
  owner: SpinLogOwner,
  now: Date = new Date(),
): Promise<SpinLogStats> {
  const { db, schema } = await loadDatabase();
  const rows = await db
    .select({
      spunAt: schema.spinLogEntries.spunAt,
      collectionItemId: schema.spinLogEntries.collectionItemId,
    })
    .from(schema.spinLogEntries)
    .where(eq(schema.spinLogEntries.userId, owner.userId));

  return buildSpinStats(rows, now);
}

export type CreateSpinLogResult =
  | { ok: true; entry: SpinLogEntry }
  | {
      ok: false;
      code: "spin_record_not_found" | "spin_record_not_owned";
      message: string;
    };

export async function createSpinLogEntry(
  owner: SpinLogOwner,
  input: SpinLogInput,
): Promise<CreateSpinLogResult> {
  const { db, schema } = await loadDatabase();
  const [record] = await db
    .select({
      id: schema.collectionItems.id,
      status: schema.collectionItems.status,
    })
    .from(schema.collectionItems)
    .where(
      and(
        eq(schema.collectionItems.id, input.collectionItemId),
        eq(schema.collectionItems.userId, owner.userId),
      ),
    )
    .limit(1);

  if (!record) {
    return {
      ok: false,
      code: "spin_record_not_found",
      message: "That collection record was not found.",
    };
  }

  if (record.status !== "owned") {
    return {
      ok: false,
      code: "spin_record_not_owned",
      message: "Only records you own can be spun.",
    };
  }

  const now = new Date();
  const [row] = await db
    .insert(schema.spinLogEntries)
    .values({
      userId: owner.userId,
      collectionItemId: record.id,
      spunAt: input.spunAt,
      side: input.side,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!row) {
    throw new Error("Spin log entry could not be created.");
  }

  return { ok: true, entry: serializeSpinLogEntry(row) };
}

export async function deleteSpinLogEntry(
  owner: SpinLogOwner,
  id: string,
): Promise<boolean> {
  const { db, schema } = await loadDatabase();
  const [row] = await db
    .delete(schema.spinLogEntries)
    .where(
      and(
        eq(schema.spinLogEntries.id, id),
        eq(schema.spinLogEntries.userId, owner.userId),
      ),
    )
    .returning({ id: schema.spinLogEntries.id });

  return Boolean(row);
}
