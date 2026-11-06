import "server-only";

import {
  findCollectionRecordByRelease,
  insertCollectionRecord,
  updateCollectionRecord,
  type CollectionOwner,
} from "@/lib/collection/server";
import type { CollectionRecord } from "@/lib/collection/record";
import { getApiCacheEnv, getDiscogsEnv } from "@/lib/config";
import {
  DiscogsCatalogueError,
  getDiscogsCatalogueRelease,
} from "@/lib/discogs/catalogue-client";
import { loadDiscogsReleaseArtwork } from "@/lib/discogs/release-artwork";

export type AddCollectionStatus = "owned" | "wanted";

export type AddCollectionRecordInput = {
  discogsReleaseId: number;
  status: AddCollectionStatus;
  favourite?: boolean;
};

export class AddCollectionRecordError extends Error {
  constructor(
    public readonly code:
      | "collection_add_configuration_error"
      | "collection_add_release_required"
      | "collection_add_release_unavailable",
    message: string,
    public readonly status: number,
    public readonly missing: string[] = [],
  ) {
    super(message);
    this.name = "AddCollectionRecordError";
  }
}

/**
 * Adds a catalogue release to the owner's collection. The release detail is
 * resolved server-side from the public Discogs catalogue so the client cannot
 * invent metadata. Artwork is optional and never blocks the write.
 */
export async function addCollectionRecord(
  owner: CollectionOwner,
  input: AddCollectionRecordInput,
): Promise<{ record: CollectionRecord; existed: boolean }> {
  if (!Number.isInteger(input.discogsReleaseId) || input.discogsReleaseId <= 0) {
    throw new AddCollectionRecordError(
      "collection_add_release_required",
      "Choose a Discogs release before adding it.",
      400,
    );
  }

  const existing = await findCollectionRecordByRelease(
    owner,
    input.discogsReleaseId,
  );

  if (existing) {
    // A WAXLIST row has one owned/wanted state. Adding an owned release that is
    // already wanted promotes it to owned; adding a duplicate want never
    // demotes a record the owner already has on the shelf.
    if (existing.status === "wanted" && input.status === "owned") {
      const updated = await updateCollectionRecord(owner, existing.id, {
        status: "owned",
        ...(typeof input.favourite === "boolean"
          ? { favourite: input.favourite }
          : {}),
      });

      if (updated) {
        return { record: updated, existed: true };
      }
    }

    return { record: existing, existed: true };
  }

  const discogs = getDiscogsEnv();

  if (!discogs.ok) {
    throw new AddCollectionRecordError(
      "collection_add_configuration_error",
      discogs.message,
      500,
      discogs.missing,
    );
  }

  const cache = getApiCacheEnv();
  let release;

  try {
    const result = await getDiscogsCatalogueRelease({
      releaseId: input.discogsReleaseId,
      token: discogs.token,
      userAgent: discogs.userAgent,
      cacheTtlMs: cache.ok ? cache.ttlMs : 0,
    });

    release = result.candidate;
  } catch (error) {
    if (error instanceof DiscogsCatalogueError) {
      throw new AddCollectionRecordError(
        "collection_add_release_unavailable",
        error.status === 429
          ? "Discogs is rate limiting adds. Try again shortly."
          : "That release could not be loaded from Discogs.",
        error.status === 429 ? 429 : 502,
      );
    }

    throw new AddCollectionRecordError(
      "collection_add_release_unavailable",
      "That release could not be loaded from Discogs.",
      502,
    );
  }

  const artist = release.artist?.trim() || release.title;
  const artistPrefix = `${artist} - `;
  const title = release.title.startsWith(artistPrefix)
    ? release.title.slice(artistPrefix.length).trim() || release.title
    : release.title;
  const artwork = await loadDiscogsReleaseArtwork(input.discogsReleaseId);

  const record = await insertCollectionRecord(owner, {
    discogsReleaseId: input.discogsReleaseId,
    discogsMasterId: release.masterId,
    discogsInstanceId: null,
    discogsFolderId: null,
    artist,
    title,
    format: release.formats,
    year: release.year,
    label: release.labels[0] ?? null,
    catalogNumber: release.catalogNumbers[0] ?? null,
    barcode: release.barcodes[0] ?? null,
    imageUrl: artwork,
    mediaCondition: null,
    sleeveCondition: null,
    rating: null,
    favourite: input.favourite === true,
    status: input.status,
    tags: [],
    notes: null,
    group: null,
    unit: null,
    shelf: null,
    slot: null,
    priceHintCents: null,
    priceHintCurrency: null,
    priceHintLabel: null,
  });

  return { record, existed: false };
}
