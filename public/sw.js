/* TRONX service worker — deliberately conservative.
 *
 * What it does:
 *   - Precaches the offline fallback page + app icons.
 *   - Cache-first for immutable build assets (/_next/static/*) and /icons/*.
 *   - On a failed page NAVIGATION (no network), shows /offline.html.
 *
 * What it NEVER does:
 *   - Cache or intercept /api/*, admin / super-admin / captain pages, or any non-GET request.
 *   - Cache HTML documents, RSC payloads, menu data, orders, or anything cross-origin
 *     (images/videos/CDN media go straight to the network / browser HTTP cache).
 * So live menus, orders and sessions are never served stale by the worker.
 */
const VERSION = "tronx-pwa-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tronx-pwa-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.headers.has("range")) return; // video/audio streaming

  if (request.mode === "navigate") {
    // Network only; fall back to the offline page when the network is unavailable.
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
      }),
    );
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      }),
    );
  }
  // Everything else: untouched (default browser behaviour).
});
