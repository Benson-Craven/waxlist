import "server-only";

import { buildCollectionHealth } from "@/lib/collection/health";
import { getLatestDiscogsImportRun } from "@/lib/collection/discogs-import";
import { isMissingCollectionLocation } from "@/lib/collection/location";
import {
  listCollectionRecords,
  type CollectionOwner,
} from "@/lib/collection/server";
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
};

export async function loadWorkspaceSummary(
  owner: CollectionOwner,
): Promise<WorkspaceSummary> {
  const [records, wishlistRecords, latestImportRun] = await Promise.all([
    listCollectionRecords(owner),
    listWishlistRecords(owner),
    getLatestDiscogsImportRun(owner),
  ]);
  const health = buildCollectionHealth(records);

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
  };
}
