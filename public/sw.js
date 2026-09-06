const CACHE_NAME = "maak-shell-v9";
const APP_SHELL = [
  "/Maak/",
  "/Maak/index.html",
  "/Maak/manifest.webmanifest",
  "/Maak/404.html",
  "/Maak/icon-192.png",
  "/Maak/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached app shell (SPA routing).
  // This guarantees a freshly deployed index.html (and therefore the new
  // hashed CSS/JS bundle) is picked up on the very next online visit.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          }
          return caches.match("/Maak/index.html").then((cached) => cached || response);
        })
        .catch(() => caches.match("/Maak/index.html")),
    );
    return;
  }

  // The providers API is never cached — the app must hit the real backend.
  if (url.pathname.startsWith("/api/")) return;

  // Hashed build assets (/Maak/assets/index-XXXX.js|css, images) are immutable:
  // cache-first is safe because a new deploy always produces new file names.
  if (url.pathname.startsWith("/Maak/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Everything else under the app scope (manifest, icons, favicon, 404.html):
  // network-first so brand/manifest updates propagate without a cache bump,
  // with the cached copy as an offline fallback.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.pathname.startsWith("/Maak/")) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
