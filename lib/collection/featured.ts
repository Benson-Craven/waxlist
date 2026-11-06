import type { CollectionRecord } from "@/lib/collection/record";
import { rankTopRatedCollectionRecords } from "@/lib/collection/rating";

export const FEATURED_COLLECTION_LIMIT = 5;
/**
 * The starred cap is five; the two recorded-value extremes ride on top so
 * adding them never pushes a starred record off the stage.
 */
export const FEATURED_COLLECTION_MAX = 7;

export type FeaturedCollectionReason =
  | "starred"
  | "most-expensive"
  | "least-expensive";

export type FeaturedCollectionEntry = {
  record: CollectionRecord;
  reasons: FeaturedCollectionReason[];
};

type PriceExtremes = {
  mostExpensive: CollectionRecord | null;
  leastExpensive: CollectionRecord | null;
};

function updatedAtTime(record: CollectionRecord) {
  const parsed = Date.parse(record.updatedAt);

  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Recorded values only compare inside one currency. This mirrors the Dashboard
 * value panel: the currency with the most priced records wins, with an
 * alphabetical tie-break so the choice is stable.
 */
function dominantPricedCurrency(records: CollectionRecord[]): string | null {
  const counts = new Map<string, number>();

  for (const record of records) {
    const currency = record.pricing?.currency;

    if (currency) {
      counts.set(currency, (counts.get(currency) ?? 0) + 1);
    }
  }

  return (
    [...counts.entries()].sort(
      ([leftCurrency, leftCount], [rightCurrency, rightCount]) =>
        rightCount - leftCount || leftCurrency.localeCompare(rightCurrency),
    )[0]?.[0] ?? null
  );
}

function compareMostExpensive(
  left: CollectionRecord,
  right: CollectionRecord,
) {
  return (
    (right.pricing?.currentCents ?? 0) - (left.pricing?.currentCents ?? 0) ||
    updatedAtTime(right) - updatedAtTime(left) ||
    left.id.localeCompare(right.id)
  );
}

function compareLeastExpensive(
  left: CollectionRecord,
  right: CollectionRecord,
) {
  return (
    (left.pricing?.currentCents ?? 0) - (right.pricing?.currentCents ?? 0) ||
    updatedAtTime(right) - updatedAtTime(left) ||
    left.id.localeCompare(right.id)
  );
}

/**
 * The most and least expensive records that carry a recorded value in the
 * shelf's dominant currency. Wanted records stay eligible because a saved
 * marketplace observation is still a real value, and the local shelf may hold
 * priced wants before it holds a priced owned record.
 */
function selectPriceExtremes(records: CollectionRecord[]): PriceExtremes {
  const currency = dominantPricedCurrency(records);

  if (!currency) {
    return { mostExpensive: null, leastExpensive: null };
  }

  const priced = records.filter(
    (record) => record.pricing?.currency === currency,
  );

  if (priced.length === 0) {
    return { mostExpensive: null, leastExpensive: null };
  }

  return {
    mostExpensive: [...priced].sort(compareMostExpensive)[0] ?? null,
    leastExpensive: [...priced].sort(compareLeastExpensive)[0] ?? null,
  };
}

/**
 * The Collection carousel is a featured shelf, not a sampler of the whole
 * collection. Starring a record is the one manual switch; the most and least
 * expensive recorded values are added automatically so the stage also reflects
 * what the shelf is worth. The five highest-rated starred records are preserved,
 * and the price picks sit alongside them, so the stage grows to seven at most.
 */
export function selectFeaturedCollectionRecords(
  records: CollectionRecord[],
  limit = FEATURED_COLLECTION_MAX,
): FeaturedCollectionEntry[] {
  const safeLimit = Math.max(0, Math.floor(limit));

  if (safeLimit === 0) {
    return [];
  }

  const favourites = rankTopRatedCollectionRecords(
    records.filter((record) => record.favourite),
    Math.min(FEATURED_COLLECTION_LIMIT, safeLimit),
  );
  const { mostExpensive, leastExpensive } = selectPriceExtremes(records);
  const extremes = [mostExpensive, leastExpensive].filter(
    (record): record is CollectionRecord => Boolean(record),
  );
  const uniqueExtremes = extremes.filter(
    (record, index) =>
      extremes.findIndex((candidate) => candidate.id === record.id) === index,
  );
  const missingExtremes = uniqueExtremes.filter(
    (record) => !favourites.some((favourite) => favourite.id === record.id),
  );
  const keptFavourites = favourites.slice(
    0,
    Math.max(0, safeLimit - missingExtremes.length),
  );
  const selected = [...keptFavourites, ...missingExtremes].slice(0, safeLimit);
  const mostExpensiveId = mostExpensive?.id ?? null;
  const leastExpensiveId = leastExpensive?.id ?? null;

  return selected.map((record) => {
    const reasons: FeaturedCollectionReason[] = [];

    if (record.favourite) {
      reasons.push("starred");
    }

    if (record.id === mostExpensiveId) {
      reasons.push("most-expensive");
    }

    if (record.id === leastExpensiveId) {
      reasons.push("least-expensive");
    }

    return { record, reasons };
  });
}
