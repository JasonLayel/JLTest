/* Service worker: caches the app shell so it works offline / as an installed PWA. */
const CACHE = "random-task-picker-v11";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "companion.js",
  "manifest.json",
  "icon.svg",
  "fonts/medievalsharp.woff2",
  "fonts/geist-pixel.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first so updates are picked up when online; cache fallback offline.
// cache: "no-cache" forces revalidation with the server so a deploy can't be
// masked by the browser's HTTP cache (which once served index.html and app.js
// from two different versions).
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
