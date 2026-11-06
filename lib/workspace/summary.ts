import "server-only";

import { getServerCapabilities } from "@/lib/capabilities/server";
import { buildCollectionHealth } from "@/lib/collection/health";
import {
  type CollectionPricingSummary,
} from "@/lib/collection/pricing";
import { loadCollectionPricing } from "@/lib/collection/pricing-server";
import {
  buildCollectionSynopsis,
  type CollectionSynopsis,
} from "@/lib/collection/synopsis";
import { getLatestDiscogsImportRun } from "@/lib/collection/discogs-import";
import { isMissingCollectionLocation } from "@/lib/collection/location";
import {
  listCollectionRecords,
  type CollectionOwner,
} from "@/lib/collection/server";
import { loadSpinLogStats } from "@/lib/spins/server";
import { listWishlistRecords } from "@/lib/wishlist/server";

export type WorkspaceSummary = {
  collectionCount: number;
  ownedCount: number;
  wantedCount: number;
  missingLocationCount: number;
  duplicateCount: number;
  duplicateRecordCount: number;
  latestImportRun: Awaited<ReturnType<typeof getLatestDiscogsImportRun>>;
  priorityWantlistCount: number;
  ratedCount: number;
  favouriteCount: number;
  synopsis: CollectionSynopsis | null;
  pricing: CollectionPricingSummary | null;
  spinTotal: number;
  spinCount7d: number;
  lastSpinAt: string | null;
};

export async function loadWorkspaceSummary(
  owner: CollectionOwner,
): Promise<WorkspaceSummary> {
  const capabilities = getServerCapabilities();
  const canReadRestrictedImports =
    capabilities.discogsRestrictedData &&
    capabilities.discogsCollectionSync;
  const canReadLegacyWishlist =
    capabilities.discogsRestrictedData && capabilities.sellerScout;
  const [records, wishlistRecords, latestImportRun, spinStats] =
    await Promise.all([
      // The authenticated owner's own shelves (Dashboard and Collection) render
      // the artwork already stored with their records; every other Restricted
      // Data field stays stripped.
      listCollectionRecords(owner, { keepArtwork: true }),
      canReadLegacyWishlist ? listWishlistRecords(owner) : Promise.resolve([]),
      canReadRestrictedImports
        ? getLatestDiscogsImportRun(owner)
        : Promise.resolve(null),
      loadSpinLogStats(owner),
    ]);
  const health = buildCollectionHealth(records);
  const pricing = await loadCollectionPricing(owner, records);

  return {
    collectionCount: health.totalRecords,
    ownedCount: health.ownedCount,
    wantedCount: health.wantedCount,
    missingLocationCount: records.filter(
      (record) =>
        record.status === "owned" && isMissingCollectionLocation(record),
    ).length,
    duplicateCount: health.duplicateGroups.length,
    duplicateRecordCount: health.duplicateGroups.reduce(
      (count, group) => count + group.records.length,
      0,
    ),
    latestImportRun,
    priorityWantlistCount: wishlistRecords.filter((record) =>
      record.buyingControls.priority === "high" ||
      record.buyingControls.priority === "grail",
    ).length,
    ratedCount: records.filter((record) => record.rating !== null).length,
    favouriteCount: records.filter((record) => record.favourite).length,
    synopsis: buildCollectionSynopsis(records),
    pricing,
    spinTotal: spinStats.totalSpins,
    spinCount7d: spinStats.spinsLast7Days,
    lastSpinAt: spinStats.lastSpinAt,
  };
}
