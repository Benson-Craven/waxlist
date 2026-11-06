import type { CollectionRecord } from "@/lib/collection/record";

export const COLLECTION_RATING_MIN = 1;
export const COLLECTION_RATING_MAX = 5;

/**
 * Ratings are native WAXLIST data, stored as whole stars from 1 to 5.
 * Anything else (including the 0 Discogs uses for "unrated") becomes null.
 */
export function normalizeCollectionRating(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const rounded = Math.round(parsed);

  return rounded >= COLLECTION_RATING_MIN && rounded <= COLLECTION_RATING_MAX
    ? rounded
    : null;
}

export function formatCollectionRating(value: number | null | undefined): string {
  return typeof value === "number" && value > 0 ? `${value} / 5` : "Unrated";
}

/**
 * Highest ratings first. Ties break on the most recently updated record, and
 * unrated records trail the rated ones so a new shelf can still show a full
 * five-record carousel while the collector rates it.
 */
export function rankTopRatedCollectionRecords(
  records: CollectionRecord[],
  limit = 5,
): CollectionRecord[] {
  const safeLimit = Math.max(0, Math.floor(limit));

  return [...records]
    .sort((left, right) => {
      const ratingDifference = (right.rating ?? 0) - (left.rating ?? 0);

      if (ratingDifference !== 0) {
        return ratingDifference;
      }

      const leftUpdated = Date.parse(left.updatedAt);
      const rightUpdated = Date.parse(right.updatedAt);

      if (Number.isFinite(leftUpdated) && Number.isFinite(rightUpdated)) {
        return rightUpdated - leftUpdated;
      }

      return 0;
    })
    .slice(0, safeLimit);
}
