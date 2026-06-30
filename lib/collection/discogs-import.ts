import "server-only";

import { and, desc, eq } from "drizzle-orm";

import {
  normalizeCollectionItem,
  serializeCollectionItem,
  type CollectionRecord,
} from "@/lib/collection/record";
import type { CollectionOwner } from "@/lib/collection/server";
import { getDiscogsEnv } from "@/lib/config";
import { db } from "@/lib/db/client";
import { collectionItems, discogsImportRuns } from "@/lib/db/schema";
import {
  DiscogsApiError,
  getDiscogsCollectionPage,
  getDiscogsIdentity,
  type DiscogsCollectionRelease,
  type DiscogsRateLimit,
} from "@/lib/discogs/client";

export type DiscogsImportRunStatus =
  | "running"
  | "rate_limited"
  | "completed"
  | "failed";

export type DiscogsImportFailure = {
  page: number;
  releaseId: number | null;
  instanceId: number | null;
  message: string;
};

export type DiscogsImportProgress = {
  id: string;
  status: DiscogsImportRunStatus;
  discogsUsername: string | null;
  nextPage: number;
  perPage: number;
  totalPages: number | null;
  totalItems: number | null;
  importedCount: number;
  failedCount: number;
  failures: DiscogsImportFailure[];
  rateLimit: DiscogsRateLimit | null;
  retryAfterSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
};

type ImportRunRow = typeof discogsImportRuns.$inferSelect;

const DISCOGS_COLLECTION_FOLDER_ID = 0;
const DISCOGS_COLLECTION_PER_PAGE = 100;
const DISCOGS_IMPORT_PAGES_PER_REQUEST = 2;
const EMPTY_RATE_LIMIT: DiscogsRateLimit = {
  limit: null,
  used: null,
  remaining: null,
};

function delay(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : null;
}

function serializeImportRun(row: ImportRunRow): DiscogsImportProgress {
  return {
    id: row.id,
    status: row.status,
    discogsUsername: row.discogsUsername,
    nextPage: row.nextPage,
    perPage: row.perPage,
    totalPages: row.totalPages,
    totalItems: row.totalItems,
    importedCount: row.importedCount,
    failedCount: row.failedCount,
    failures: row.failures,
    rateLimit: row.rateLimit,
    retryAfterSeconds: row.retryAfterSeconds,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function importConfigError() {
  const env = getDiscogsEnv();

  if (env.ok) {
    return null;
  }

  return {
    code: "discogs_import_configuration_error",
    message: env.message,
    missing: env.missing,
  };
}

function asImportFailure(input: {
  page: number;
  releaseId?: number | null;
  instanceId?: number | null;
  message: string;
}): DiscogsImportFailure {
  return {
    page: input.page,
    releaseId: input.releaseId ?? null,
    instanceId: input.instanceId ?? null,
    message: input.message,
  };
}

function toCollectionInsert(input: {
  owner: CollectionOwner;
  release: DiscogsCollectionRelease;
  now: Date;
}) {
  return {
    userId: input.owner.userId,
    discogsReleaseId: input.release.releaseId,
    discogsMasterId: input.release.masterId,
    discogsInstanceId: input.release.instanceId,
    discogsFolderId: input.release.folderId,
    artist: input.release.artist,
    title: input.release.title,
    format: input.release.format,
    year: input.release.year,
    label: input.release.label,
    catalogNumber: input.release.catalogNumber,
    barcode: input.release.barcode,
    imageUrl: input.release.imageUrl,
    status: "owned" as const,
    tags: ["discogs-import"],
    notes: null,
    room: null,
    unit: null,
    shelf: null,
    slot: null,
    priceHintCents: null,
    priceHintCurrency: null,
    priceHintLabel: null,
    syncedAt: input.now,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function getDiscogsImportConfigurationError() {
  return importConfigError();
}

export async function getLatestDiscogsImportRun(owner: CollectionOwner) {
  const [row] = await db
    .select()
    .from(discogsImportRuns)
    .where(eq(discogsImportRuns.userId, owner.userId))
    .orderBy(desc(discogsImportRuns.updatedAt))
    .limit(1);

  return row ? serializeImportRun(row) : null;
}

async function getImportRun(owner: CollectionOwner, runId?: string) {
  if (runId) {
    const [row] = await db
      .select()
      .from(discogsImportRuns)
      .where(
        and(
          eq(discogsImportRuns.userId, owner.userId),
          eq(discogsImportRuns.id, runId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  const [existingRun] = await db
    .select()
    .from(discogsImportRuns)
    .where(
      and(
        eq(discogsImportRuns.userId, owner.userId),
        eq(discogsImportRuns.source, "collection"),
      ),
    )
    .orderBy(desc(discogsImportRuns.updatedAt))
    .limit(1);

  if (
    existingRun &&
    (existingRun.status === "running" || existingRun.status === "rate_limited")
  ) {
    return existingRun;
  }

  const now = new Date();
  const [row] = await db
    .insert(discogsImportRuns)
    .values({
      userId: owner.userId,
      source: "collection",
      status: "running",
      discogsUsername: null,
      discogsFolderId: DISCOGS_COLLECTION_FOLDER_ID,
      nextPage: 1,
      perPage: DISCOGS_COLLECTION_PER_PAGE,
      totalPages: null,
      totalItems: null,
      importedCount: 0,
      failedCount: 0,
      failures: [],
      rateLimit: EMPTY_RATE_LIMIT,
      retryAfterSeconds: null,
      startedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

async function upsertCollectionRelease(input: {
  owner: CollectionOwner;
  release: DiscogsCollectionRelease;
  now: Date;
}) {
  const value = toCollectionInsert(input);
  const [row] = await db
    .insert(collectionItems)
    .values(value)
    .onConflictDoUpdate({
      target: [collectionItems.userId, collectionItems.discogsInstanceId],
      set: {
        discogsReleaseId: value.discogsReleaseId,
        discogsMasterId: value.discogsMasterId,
        discogsFolderId: value.discogsFolderId,
        artist: value.artist,
        title: value.title,
        format: value.format,
        year: value.year,
        label: value.label,
        catalogNumber: value.catalogNumber,
        barcode: value.barcode,
        imageUrl: value.imageUrl,
        status: "owned",
        syncedAt: value.syncedAt,
        updatedAt: value.updatedAt,
      },
    })
    .returning();
  const record = normalizeCollectionItem(row);

  return record ? serializeCollectionItem(record) : null;
}

async function listUpdatedRecords(owner: CollectionOwner) {
  const rows = await db
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.userId, owner.userId))
    .orderBy(desc(collectionItems.updatedAt));

  return rows
    .map((row) => normalizeCollectionItem(row))
    .filter((record): record is NonNullable<typeof record> => Boolean(record))
    .map(serializeCollectionItem);
}

async function updateRun(
  runId: string,
  values: Partial<typeof discogsImportRuns.$inferInsert>,
) {
  const [row] = await db
    .update(discogsImportRuns)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(discogsImportRuns.id, runId))
    .returning();

  return row;
}

export async function runDiscogsCollectionImport(input: {
  owner: CollectionOwner;
  runId?: string;
}): Promise<{
  progress: DiscogsImportProgress;
  records: CollectionRecord[];
}> {
  const env = getDiscogsEnv();

  if (!env.ok) {
    throw new Error(env.message);
  }

  const initialRun = await getImportRun(input.owner, input.runId);

  if (!initialRun) {
    throw new Error("Discogs import run could not be found.");
  }

  if (initialRun.status === "completed" || initialRun.status === "failed") {
    return {
      progress: serializeImportRun(initialRun),
      records: await listUpdatedRecords(input.owner),
    };
  }

  let run = initialRun;
  let username = run.discogsUsername;
  let importedCount = run.importedCount;
  let failedCount = run.failedCount;
  let failures = run.failures;
  let latestRateLimit = run.rateLimit;
  const now = new Date();

  if (!username) {
    const identity = await getDiscogsIdentity({
      token: env.token,
      userAgent: env.userAgent,
    });
    username = identity.username;
    latestRateLimit = identity.rateLimit;
    run = await updateRun(run.id, {
      status: "running",
      discogsUsername: username,
      rateLimit: latestRateLimit,
      retryAfterSeconds: null,
    });
  } else if (run.status === "rate_limited") {
    run = await updateRun(run.id, {
      status: "running",
      retryAfterSeconds: null,
    });
  }

  let nextPage = run.nextPage;
  let totalPages = run.totalPages;
  let totalItems = run.totalItems;
  let pagesProcessed = 0;

  try {
    while (
      pagesProcessed < DISCOGS_IMPORT_PAGES_PER_REQUEST &&
      (!totalPages || nextPage <= totalPages)
    ) {
      const page = await getDiscogsCollectionPage({
        username,
        folderId: run.discogsFolderId,
        page: nextPage,
        perPage: run.perPage,
        token: env.token,
        userAgent: env.userAgent,
      });

      latestRateLimit = page.rateLimit;
      totalPages = page.totalPages;
      totalItems = page.totalItems;

      for (const release of page.releases) {
        try {
          await upsertCollectionRelease({
            owner: input.owner,
            release,
            now,
          });
          importedCount += 1;
        } catch (error) {
          failedCount += 1;
          failures = [
            ...failures,
            asImportFailure({
              page: nextPage,
              releaseId: release.releaseId,
              instanceId: release.instanceId,
              message:
                error instanceof Error
                  ? error.message
                  : "Collection record could not be stored.",
            }),
          ].slice(-25);
        }
      }

      nextPage += 1;
      pagesProcessed += 1;

      if (
        pagesProcessed < DISCOGS_IMPORT_PAGES_PER_REQUEST &&
        (!totalPages || nextPage <= totalPages)
      ) {
        await delay(env.requestDelayMs);
      }
    }
  } catch (error) {
    if (error instanceof DiscogsApiError && error.code === "discogs_rate_limited") {
      const row = await updateRun(run.id, {
        status: "rate_limited",
        nextPage,
        totalPages,
        totalItems,
        importedCount,
        failedCount,
        failures,
        rateLimit: error.rateLimit,
        retryAfterSeconds: error.retryAfterSeconds,
      });

      return {
        progress: serializeImportRun(row),
        records: await listUpdatedRecords(input.owner),
      };
    }

    const nextFailures = [
      ...failures,
      asImportFailure({
        page: nextPage,
        message:
          error instanceof Error
            ? error.message
            : "Discogs import could not continue.",
      }),
    ].slice(-25);
    const row = await updateRun(run.id, {
      status: "failed",
      nextPage,
      totalPages,
      totalItems,
      importedCount,
      failedCount: failedCount + 1,
      failures: nextFailures,
      rateLimit:
        error instanceof DiscogsApiError ? error.rateLimit : latestRateLimit,
      retryAfterSeconds:
        error instanceof DiscogsApiError ? error.retryAfterSeconds : null,
      completedAt: new Date(),
    });

    return {
      progress: serializeImportRun(row),
      records: await listUpdatedRecords(input.owner),
    };
  }

  const isComplete = Boolean(totalPages && nextPage > totalPages);
  const row = await updateRun(run.id, {
    status: isComplete ? "completed" : "running",
    nextPage,
    totalPages,
    totalItems,
    importedCount,
    failedCount,
    failures,
    rateLimit: latestRateLimit,
    retryAfterSeconds: null,
    completedAt: isComplete ? new Date() : null,
  });

  return {
    progress: serializeImportRun(row),
    records: await listUpdatedRecords(input.owner),
  };
}
