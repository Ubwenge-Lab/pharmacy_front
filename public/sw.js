// E-Vuze service worker — offline shell only.
//
// Deliberately minimal: it does NOT cache pages or API responses (the app is
// authenticated and data must stay fresh). It only makes sure that a page
// navigation that fails because the connection dropped shows a branded
// offline page instead of the browser's error screen.
//
// Bump CACHE_VERSION whenever offline.html or the precached assets change.

const CACHE_VERSION = 'evuze-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Page navigations: try the network, fall back to the offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL, { ignoreSearch: true }))
    );
    return;
  }

  // The offline page's own assets
  if (request.method === 'GET' && PRECACHE.includes(new URL(request.url).pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
