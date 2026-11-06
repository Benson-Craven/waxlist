const OFFLINE_CACHE_PREFIX = "waxlist-";

/**
 * Drops every offline shell cache on this browser. Sign-out must not leave a
 * cached copy of the previous account's workspace behind.
 */
export async function clearOfflineShellCaches() {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }

  try {
    const names = await caches.keys();

    await Promise.all(
      names
        .filter((name) => name.startsWith(OFFLINE_CACHE_PREFIX))
        .map((name) => caches.delete(name)),
    );
  } catch {
    // Cache storage can be blocked; the server also sends Clear-Site-Data.
  }

  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_CACHES" });
  } catch {
    // No controller yet means no cache to clear.
  }
}
