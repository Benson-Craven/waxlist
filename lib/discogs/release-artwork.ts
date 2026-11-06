import "server-only";

import { getApiCacheEnv, getDiscogsEnv } from "@/lib/config";
import { getDiscogsReleaseDetail } from "@/lib/discogs/client";

const ARTWORK_LOOKUP_TIMEOUT_MS = 2500;

/**
 * Loads the album cover for a release that is being added to the collection.
 *
 * Cover art is a nice-to-have, not a precondition: a missing Discogs
 * configuration, provider outage, or rate limit must never stop an owned or
 * wanted write, so this resolves to `null` instead of throwing. The lookup is
 * also bounded so a slow provider cannot hold up the add action.
 */
export async function loadDiscogsReleaseArtwork(
  releaseId: number,
): Promise<string | null> {
  if (!Number.isInteger(releaseId) || releaseId <= 0) {
    return null;
  }

  const discogs = getDiscogsEnv();

  if (!discogs.ok) {
    return null;
  }

  const cache = getApiCacheEnv();

  try {
    const release = await getDiscogsReleaseDetail({
      releaseId,
      token: discogs.token,
      userAgent: discogs.userAgent,
      cacheTtlMs: cache.ok ? cache.ttlMs : 0,
      signal: AbortSignal.timeout(ARTWORK_LOOKUP_TIMEOUT_MS),
    });

    return release.imageUrl ?? null;
  } catch {
    return null;
  }
}
