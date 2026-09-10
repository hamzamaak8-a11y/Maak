const CACHE_NAME = "maak-shell-v15";
const APP_ROOT = new URL("./", self.location).href;
const INDEX_URL = new URL("./index.html", self.location).href;
const MANIFEST_URL = new URL("./manifest.webmanifest", self.location).href;
const NOT_FOUND_URL = new URL("./404.html", self.location).href;
const ICON_URL = new URL("./maak-icon.svg", self.location).href;
const ICON_512_URL = new URL("./icon-512.png", self.location).href;
const ASSETS_PREFIX = new URL("./assets/", self.location).pathname;
const APP_SHELL = [APP_ROOT, INDEX_URL, MANIFEST_URL, NOT_FOUND_URL, ICON_URL, ICON_512_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          }
          return caches.match(INDEX_URL).then((cached) => cached || response);
        })
        .catch(() => caches.match(INDEX_URL)),
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith(ASSETS_PREFIX)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.pathname.startsWith(new URL("./", self.location).pathname)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
