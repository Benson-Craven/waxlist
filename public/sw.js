/* WAXLIST offline shell.
 *
 * Goals:
 * - The app shell and the last visited page still load with no connection.
 * - Static assets keep their cached copy so the shell is usable offline.
 * - API responses are never cached; collection data already lives in the
 *   browser cache owned by the Digging and Shelf workspaces.
 *
 * Signed-in pages are cached as HTML. The sign-out route sends
 * `Clear-Site-Data` so the next account on the same browser cannot open the
 * previous account's cached shell while offline.
 */

const VERSION = "v1";
const MODE =
  new URL(self.location.href).searchParams.get("mode") === "dev"
    ? "dev"
    : "prod";

const SHELL_CACHE = `waxlist-shell-${VERSION}`;
const PAGE_CACHE = `waxlist-pages-${VERSION}`;
const ASSET_CACHE = `waxlist-assets-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, PAGE_CACHE, ASSET_CACHE];

const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/waxlist-192.png",
  "/icons/waxlist-512.png",
];
const MAX_CACHED_PAGES = 24;
const NAVIGATION_TIMEOUT_MS = 6000;

const ASSET_PATTERN =
  /\.(?:css|js|mjs|json|webmanifest|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|otf)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);

      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            // One missing optional asset must not block the whole shell.
          }
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("waxlist-") && !CURRENT_CACHES.includes(name),
          )
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "CLEAR_CACHES") {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();

        await Promise.all(
          names
            .filter((name) => name.startsWith("waxlist-"))
            .map((name) => caches.delete(name)),
        );
      })(),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // Private data stays out of the shell cache.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      MODE === "dev"
        ? networkFirstAsset(request)
        : cacheFirstAsset(request),
    );
  }
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    ASSET_PATTERN.test(url.pathname)
  );
}

async function handleNavigation(request) {
  const url = new URL(request.url);

  try {
    const response = await withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS);

    if (
      response &&
      response.ok &&
      !response.redirected &&
      !url.pathname.startsWith("/auth/") &&
      request.headers.get("RSC") !== "1"
    ) {
      const cache = await caches.open(PAGE_CACHE);

      await cache.put(request, response.clone());
      await trimCache(PAGE_CACHE, MAX_CACHED_PAGES);
    }

    return response;
  } catch {
    const exact = await caches.match(request);

    if (exact) {
      return exact;
    }

    const shell = await caches.match("/app");

    if (shell) {
      return shell;
    }

    const offline = await caches.match(OFFLINE_URL);

    if (offline) {
      return offline;
    }

    return new Response("WAXLIST is offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  return fetchAndCacheAsset(request);
}

async function networkFirstAsset(request) {
  try {
    return await fetchAndCacheAsset(request);
  } catch {
    const cached = await caches.match(request);

    return cached || Response.error();
  }
}

async function fetchAndCacheAsset(request) {
  const response = await fetch(request);

  if (response && response.ok && response.type === "basic") {
    const cache = await caches.open(ASSET_CACHE);

    await cache.put(request, response.clone());
  }

  return response;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length <= maxEntries) {
    return;
  }

  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
  );
}

function withTimeout(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Navigation timed out."));
    }, milliseconds);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
