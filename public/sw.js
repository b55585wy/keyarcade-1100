const CACHE_NAME = "keyarcade-1100-v1";
const PRECACHE_URLS = ["/", "/arcade", "/android", "/import", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for heavy offline MediaPipe WASM/model assets, network-first for app pages
  if (url.pathname.startsWith("/mediapipe/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            void caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return resp;
        });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((resp) => {
        if (resp.ok && request.mode === "navigate") {
          const copy = resp.clone();
          void caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        }
        return resp;
      })
      .catch(() => caches.match(request)),
  );
});
