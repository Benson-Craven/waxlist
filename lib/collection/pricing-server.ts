import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import { getApiCacheEnv, getDiscogsEnv } from "@/lib/config";
import {
  getRecordPriceSummary,
  normalizePriceCurrency,
  summarizeCollectionPricing,
  type CollectionPriceSnapshot,
  type CollectionPricingSummary,
  type CollectionPriceSource,
  type RecordPriceSummary,
  type SummarizeCollectionPricingOptions,
} from "@/lib/collection/pricing";
import type { CollectionRecord } from "@/lib/collection/record";
import { DiscogsApiError, getDiscogsMarketplaceStats } from "@/lib/discogs/client";

const DAY_MS = 86_400_000;
const DEFAULT_REFRESH_LIMIT = 8;
const DEFAULT_REFRESH_MIN_AGE_HOURS = 12;
const MAX_REFRESH_LIMIT = 24;

type PriceSnapshotInput = {
  collectionItemId: string;
  discogsReleaseId: number;
  amountCents: number;
  currency: string;
  source: CollectionPriceSource;
  observedAt: Date;
};

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  return { db, schema };
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);

    return Number.isFinite(date.getTime()) ? date : null;
  }

  return null;
}

function normalizeSource(value: unknown): CollectionPriceSource | null {
  return value === "manual" || value === "discogs_marketplace" ? value : null;
}

type PricingOwner = {
  userId: string;
};

function snapshotFromRow(
  row: Record<string, unknown>,
): CollectionPriceSnapshot | null {
  const id = typeof row.id === "string" ? row.id : null;
  const collectionItemIdValue = row.collection_item_id ?? row.collectionItemId;
  const collectionItemId =
    typeof collectionItemIdValue === "string" ? collectionItemIdValue : null;
  const discogsReleaseId = Number(
    row.discogs_release_id ?? row.discogsReleaseId,
  );
  const amountCents = Number(row.amount_cents ?? row.amountCents);
  const currency = normalizePriceCurrency(row.currency);
  const source = normalizeSource(row.source);
  const observedAt = readDate(row.observed_at ?? row.observedAt);

  if (
    !id ||
    !collectionItemId ||
    !Number.isInteger(discogsReleaseId) ||
    !Number.isInteger(amountCents) ||
    amountCents <= 0 ||
    !currency ||
    !source ||
    !observedAt
  ) {
    return null;
  }

  return {
    id,
    collectionItemId,
    discogsReleaseId,
    amountCents,
    currency,
    source,
    observedAt: observedAt.toISOString(),
  };
}

/**
 * The newest two observations for every selected record. Two is enough to show
 * a current value and its move without loading a full history.
 */
export async function loadRecordPriceSummaries(
  owner: PricingOwner,
  collectionItemIds: string[],
): Promise<Map<string, RecordPriceSummary>> {
  if (collectionItemIds.length === 0) {
    return new Map();
  }

  const { db, schema } = await loadDatabase();
  const recordIds = new Set(collectionItemIds);
  let result;

  try {
    result = await db.execute(sql`
    select
      id,
      collection_item_id,
      discogs_release_id,
      amount_cents,
      currency,
      source,
      observed_at
    from (
      select
        snapshots.*,
        row_number() over (
          partition by snapshots.collection_item_id
          order by snapshots.observed_at desc, snapshots.created_at desc
        ) as snapshot_rank
      from ${schema.collectionPriceSnapshots} snapshots
      where snapshots.user_id = ${owner.userId}
    ) ranked
      where ranked.snapshot_rank <= 2
      order by ranked.collection_item_id asc, ranked.snapshot_rank asc
    `);
  } catch {
    // Pricing is an optional layer. A missing table (before migration) or a
    // transient query failure must not take the collection workspace down.
    return new Map();
  }

  const grouped = new Map<string, CollectionPriceSnapshot[]>();

  for (const rawRow of result as unknown as Array<Record<string, unknown>>) {
    const snapshot = snapshotFromRow(rawRow);

    if (!snapshot || !recordIds.has(snapshot.collectionItemId)) {
      continue;
    }

    const current = grouped.get(snapshot.collectionItemId) ?? [];
    current.push(snapshot);
    grouped.set(snapshot.collectionItemId, current);
  }

  const summaries = new Map<string, RecordPriceSummary>();

  for (const [collectionItemId, snapshots] of grouped) {
    const summary = getRecordPriceSummary(snapshots);

    if (summary) {
      summaries.set(collectionItemId, summary);
    }
  }

  return summaries;
}

export async function listCollectionPriceSnapshots(
  owner: PricingOwner,
  since: Date,
): Promise<CollectionPriceSnapshot[]> {
  const { db, schema } = await loadDatabase();
  let rows;

  try {
    rows = await db
      .select()
      .from(schema.collectionPriceSnapshots)
      .where(
        and(
          eq(schema.collectionPriceSnapshots.userId, owner.userId),
          gte(schema.collectionPriceSnapshots.observedAt, since),
        ),
      )
      .orderBy(schema.collectionPriceSnapshots.observedAt);
  } catch {
    return [];
  }

  return rows
    .map((row) =>
      snapshotFromRow({
        id: row.id,
        collectionItemId: row.collectionItemId,
        discogsReleaseId: row.discogsReleaseId,
        amountCents: row.amountCents,
        currency: row.currency,
        source: row.source,
        observedAt: row.observedAt,
      }),
    )
    .filter((snapshot): snapshot is CollectionPriceSnapshot => Boolean(snapshot));
}

export async function recordCollectionPriceSnapshot(
  owner: PricingOwner,
  input: PriceSnapshotInput,
): Promise<CollectionPriceSnapshot | null> {
  const currency = normalizePriceCurrency(input.currency);

  if (!currency || input.amountCents <= 0) {
    return null;
  }

  const { db, schema } = await loadDatabase();
  const [row] = await db
    .insert(schema.collectionPriceSnapshots)
    .values({
      userId: owner.userId,
      collectionItemId: input.collectionItemId,
      discogsReleaseId: input.discogsReleaseId,
      amountCents: input.amountCents,
      currency,
      source: input.source,
      observedAt: input.observedAt,
    })
    .returning();

  return row
    ? snapshotFromRow({
        id: row.id,
        collectionItemId: row.collectionItemId,
        discogsReleaseId: row.discogsReleaseId,
        amountCents: row.amountCents,
        currency: row.currency,
        source: row.source,
        observedAt: row.observedAt,
      })
    : null;
}

export type DiscogsRecordPriceResult =
  | {
      ok: true;
      pricing: RecordPriceSummary;
      numForSale: number | null;
      amountCents: number;
      currency: string;
    }
  | {
      ok: false;
      code:
        | "discogs_configuration_error"
        | "discogs_no_price"
        | "discogs_rate_limited"
        | "discogs_not_found"
        | "discogs_failed";
      message: string;
      status: number;
      retryAfterSeconds: number | null;
    };

/**
 * Fetch one release's lowest marketplace price and record it immediately. This
 * is the per-record companion to the bounded Dashboard refresh, so a wanted or
 * newly added record can be priced without waiting for a bulk run.
 */
export async function fetchDiscogsPriceForRecord(
  owner: PricingOwner,
  record: CollectionRecord,
  options: { currency?: string } = {},
): Promise<DiscogsRecordPriceResult> {
  const discogs = getDiscogsEnv();

  if (!discogs.ok) {
    return {
      ok: false,
      code: "discogs_configuration_error",
      message: discogs.message,
      status: 500,
      retryAfterSeconds: null,
    };
  }

  const currency =
    normalizePriceCurrency(options.currency ?? record.pricing?.currency) ??
    "GBP";
  const cache = getApiCacheEnv();
  let stats;

  try {
    stats = await getDiscogsMarketplaceStats({
      releaseId: record.discogsReleaseId,
      token: discogs.token,
      userAgent: discogs.userAgent,
      cacheTtlMs: cache.ok ? cache.ttlMs : 0,
      currency,
    });
  } catch (error) {
    if (error instanceof DiscogsApiError) {
      return {
        ok: false,
        code:
          error.code === "discogs_rate_limited"
            ? "discogs_rate_limited"
            : error.code === "discogs_not_found"
              ? "discogs_not_found"
              : "discogs_failed",
        message:
          error.code === "discogs_not_found"
            ? "Discogs has no marketplace page for this release."
            : error.message,
        status: error.status === 429 ? 429 : 502,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }

    return {
      ok: false,
      code: "discogs_failed",
      message: "Discogs could not return a price for this release.",
      status: 502,
      retryAfterSeconds: null,
    };
  }

  const lowest = stats.lowestPrice;
  const lowestCurrency = normalizePriceCurrency(lowest?.currency);

  if (
    !lowest ||
    !lowestCurrency ||
    !Number.isFinite(lowest.value) ||
    lowest.value <= 0
  ) {
    return {
      ok: false,
      code: "discogs_no_price",
      message:
        "Discogs has no marketplace listing price for this release right now.",
      status: 404,
      retryAfterSeconds: null,
    };
  }

  const amountCents = Math.round(lowest.value * 100);
  const observedAt = readDate(stats.checkedAt) ?? new Date();
  const existingPricing = record.pricing;

  // A cached stats response can be returned twice in a row. Reuse the stored
  // observation instead of writing a duplicate point at the same timestamp.
  if (
    existingPricing &&
    existingPricing.currentCents === amountCents &&
    existingPricing.currency === lowestCurrency &&
    Math.abs(
      new Date(existingPricing.observedAt).getTime() - observedAt.getTime(),
    ) < 1000
  ) {
    return {
      ok: true,
      pricing: existingPricing,
      numForSale: stats.numForSale,
      amountCents,
      currency: lowestCurrency,
    };
  }

  const snapshot = await recordCollectionPriceSnapshot(owner, {
    collectionItemId: record.id,
    discogsReleaseId: record.discogsReleaseId,
    amountCents,
    currency: lowestCurrency,
    source: "discogs_marketplace",
    observedAt,
  });

  if (!snapshot) {
    return {
      ok: false,
      code: "discogs_failed",
      message: "The Discogs price could not be stored.",
      status: 500,
      retryAfterSeconds: null,
    };
  }

  const summaries = await loadRecordPriceSummaries(owner, [record.id]);
  const pricing = summaries.get(record.id) ?? null;

  if (!pricing) {
    return {
      ok: false,
      code: "discogs_failed",
      message: "The Discogs price was stored but could not be read back.",
      status: 500,
      retryAfterSeconds: null,
    };
  }

  return {
    ok: true,
    pricing,
    numForSale: stats.numForSale,
    amountCents,
    currency: lowestCurrency,
  };
}

export async function loadCollectionPricing(
  owner: PricingOwner,
  records: CollectionRecord[],
  options: SummarizeCollectionPricingOptions = {},
): Promise<CollectionPricingSummary | null> {
  if (records.length === 0) {
    return null;
  }

  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? 90;
  // The chart only needs its window, but a drop or move can be older than the
  // first plotted day. Keep a year plus the window so those comparisons stay
  // available without loading an unbounded history.
  const lookbackDays = Math.max(windowDays, 365) + 30;
  const since = new Date(now.getTime() - lookbackDays * DAY_MS);
  const snapshots = await listCollectionPriceSnapshots(owner, since);

  return summarizeCollectionPricing(records, snapshots, {
    ...options,
    now,
    windowDays,
  });
}

export type CollectionPriceRefreshResult = {
  checked: number;
  updated: number;
  unavailable: number;
  failed: number;
  skipped: number;
  rateLimited: boolean;
  retryAfterSeconds: number | null;
  pricing: CollectionPricingSummary | null;
};

/**
 * A bounded, on-demand marketplace check. It never runs on a schedule: one
 * click refreshes the stalest records, then stops so a large shelf cannot turn
 * a dashboard visit into a crawler.
 *
 * Owned and wanted records are both eligible because the Dashboard price
 * overview covers every valued vinyl, not just owned value.
 */
export async function refreshCollectionPrices(
  owner: PricingOwner,
  records: CollectionRecord[],
  options: { limit?: number; minAgeHours?: number; now?: Date } = {},
): Promise<CollectionPriceRefreshResult> {
  const now = options.now ?? new Date();
  const limit = Math.min(
    MAX_REFRESH_LIMIT,
    Math.max(1, Math.round(options.limit ?? DEFAULT_REFRESH_LIMIT)),
  );
  const minAgeMs =
    Math.max(0, options.minAgeHours ?? DEFAULT_REFRESH_MIN_AGE_HOURS) *
    60 *
    60 *
    1000;
  const tracked = records.filter((record) => record.discogsReleaseId > 0);
  const summaries = await loadRecordPriceSummaries(
    owner,
    tracked.map((record) => record.id),
  );
  const candidates = tracked
    .filter((record) => {
      const summary = summaries.get(record.id);

      if (!summary) {
        return true;
      }

      return now.getTime() - new Date(summary.observedAt).getTime() >= minAgeMs;
    })
    .sort((left, right) => {
      const leftTime = summaries.get(left.id)?.observedAt;
      const rightTime = summaries.get(right.id)?.observedAt;

      if (!leftTime && !rightTime) return left.updatedAt.localeCompare(right.updatedAt);
      if (!leftTime) return -1;
      if (!rightTime) return 1;
      return leftTime.localeCompare(rightTime);
    })
    .slice(0, limit);

  const result: CollectionPriceRefreshResult = {
    checked: candidates.length,
    updated: 0,
    unavailable: 0,
    failed: 0,
    skipped: tracked.length - candidates.length,
    rateLimited: false,
    retryAfterSeconds: null,
    pricing: null,
  };

  const discogs = getDiscogsEnv();

  if (!discogs.ok) {
    return {
      ...result,
      failed: candidates.length,
      pricing: null,
    };
  }

  const cache = getApiCacheEnv();
  const cacheTtlMs = cache.ok ? cache.ttlMs : 0;

  for (const record of candidates) {
    try {
      const stats = await getDiscogsMarketplaceStats({
        releaseId: record.discogsReleaseId,
        token: discogs.token,
        userAgent: discogs.userAgent,
        cacheTtlMs,
        currency: summaries.get(record.id)?.currency ?? "GBP",
      });
      const lowest = stats.lowestPrice;
      const currency = normalizePriceCurrency(lowest?.currency);

      if (!lowest || !currency || !Number.isFinite(lowest.value) || lowest.value <= 0) {
        result.unavailable += 1;
        continue;
      }

      const amountCents = Math.round(lowest.value * 100);
      const observedAt = readDate(stats.checkedAt) ?? now;
      const previous = summaries.get(record.id);

      if (
        previous &&
        previous.currentCents === amountCents &&
        previous.currency === currency &&
        Math.abs(
          new Date(previous.observedAt).getTime() - observedAt.getTime(),
        ) < 1000
      ) {
        result.skipped += 1;
        continue;
      }

      const snapshot = await recordCollectionPriceSnapshot(owner, {
        collectionItemId: record.id,
        discogsReleaseId: record.discogsReleaseId,
        amountCents,
        currency,
        source: "discogs_marketplace",
        observedAt,
      });

      if (snapshot) {
        result.updated += 1;
      } else {
        result.failed += 1;
      }
    } catch (error) {
      if (error instanceof DiscogsApiError) {
        result.rateLimited = error.code === "discogs_rate_limited";
        result.retryAfterSeconds = error.retryAfterSeconds;
        result.failed += 1;

        if (result.rateLimited) {
          break;
        }

        continue;
      }

      result.failed += 1;
    }
  }

  result.pricing = await loadCollectionPricing(owner, records, { now });

  return result;
}
