// Service worker: makes the app installable and lets the analysis work offline
// (the engine runs in the browser). Hand-written, no dependencies.
//
// - /_next/static/*  cache-first (file names carry a content hash);
// - /engine/*, /openings.json, icons  stale-while-revalidate;
// - pages (navigations and RSC requests)  network-first, falling back to the cache;
// - /api/*, other origins, non-GET  never touched.
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const KEEP = [STATIC, ASSETS, PAGES];
const MAX_STATIC_ENTRIES = 300;

self.addEventListener("install", (event) => {
  // Precache the shell so the home page opens offline after the first visit.
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll(["/"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trim(STATIC, MAX_STATIC_ENTRIES);
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit ?? (await refresh) ?? Response.error();
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(request, res.clone());
    return res;
  } catch {
    const hit =
      (await cache.match(request)) ??
      // Offline navigation to a page we never cached: fall back to the home page shell.
      (request.mode === "navigate" ? await cache.match("/") : undefined);
    return hit ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (
    url.pathname.startsWith("/engine/") ||
    url.pathname === "/openings.json" ||
    /^\/(icon|apple-touch-icon)/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (request.mode === "navigate" || request.headers.get("RSC") === "1") {
    event.respondWith(networkFirst(request));
  }
});
