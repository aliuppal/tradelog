// ============================================================
// TradeLog service worker
// - App files: network-first, so every Vercel deploy shows up
//   immediately; the cached copy is only used offline.
// - CDN libraries/fonts: stale-while-revalidate.
// - Supabase (auth + data): never cached, always live.
// Bump CACHE when the shell list changes.
// ============================================================

const CACHE = 'tradelog-v1';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/main.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/config.js',
  '/js/db.js',
  '/js/modal.js',
  '/js/router.js',
  '/js/utils.js',
  '/js/pages/calendar.js',
  '/js/pages/dashboard.js',
  '/js/pages/funded.js',
  '/js/pages/journal.js',
  '/js/pages/live.js',
  '/js/pages/stats.js',
  '/js/pages/trades.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.hostname.endsWith('supabase.co')) return;

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('/index.html');
    throw new Error('Offline and not cached: ' + request.url);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
