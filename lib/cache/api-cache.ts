import "server-only";

import { eq } from "drizzle-orm";

export interface ApiCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

async function loadCacheTable() {
  const [{ db }, { apiCache: apiCacheTable }] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  return { db, apiCacheTable };
}

class NeonApiCache implements ApiCache {
  async get<T>(key: string) {
    const { db, apiCacheTable } = await loadCacheTable();
    const [entry] = await db
      .select({
        value: apiCacheTable.value,
        expiresAt: apiCacheTable.expiresAt,
      })
      .from(apiCacheTable)
      .where(eq(apiCacheTable.key, key))
      .limit(1);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt.getTime() <= Date.now()) {
      await this.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number) {
    const { db, apiCacheTable } = await loadCacheTable();

    if (ttlMs <= 0) {
      await this.delete(key);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    await db
      .insert(apiCacheTable)
      .values({
        key,
        value,
        expiresAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: apiCacheTable.key,
        set: {
          value,
          expiresAt,
          updatedAt: now,
        },
      });
  }

  async delete(key: string) {
    const { db, apiCacheTable } = await loadCacheTable();

    await db.delete(apiCacheTable).where(eq(apiCacheTable.key, key));
  }

  async clear() {
    const { db, apiCacheTable } = await loadCacheTable();

    await db.delete(apiCacheTable);
  }
}

export const apiCache: ApiCache = new NeonApiCache();

export const apiCacheKeys = {
  spotifyPlaylist(playlistId: string, snapshotId: string) {
    return `spotify:playlist:${playlistId}:${snapshotId}`;
  },
  spotifyAlbum(albumId: string) {
    return `spotify:album:${albumId}`;
  },
  discogsSearch(normalizedArtist: string, normalizedAlbum: string) {
    return `discogs:search:${normalizedArtist}:${normalizedAlbum}`;
  },
  discogsMarketplace(releaseId: number) {
    return `discogs:marketplace:${releaseId}`;
  },
} as const;

export async function getOrSetApiCache<T>(
  key: string,
  ttlMs: number,
  loadValue: () => Promise<T>,
) {
  if (ttlMs <= 0) {
    return loadValue();
  }

  const cachedValue = await apiCache.get<T>(key);

  if (cachedValue !== null) {
    return cachedValue;
  }

  const value = await loadValue();

  await apiCache.set(key, value, ttlMs);

  return value;
}
