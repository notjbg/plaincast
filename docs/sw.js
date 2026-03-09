const CACHE_VERSION = 'plaincast-v1';
const SHELL_CACHE = CACHE_VERSION + '-shell';
const API_CACHE = CACHE_VERSION + '-api';
const MAX_API_ENTRIES = 30;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: cache app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k.startsWith('plaincast-') && k !== SHELL_CACHE && k !== API_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, stale-while-revalidate for shell
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API calls (our translate endpoint + NWS API)
  if (url.pathname.startsWith('/api/') || url.hostname === 'api.weather.gov') {
    e.respondWith(networkFirst(e.request, API_CACHE));
    return;
  }

  // App shell / static assets
  if (e.request.mode === 'navigate' || SHELL_ASSETS.some(a => url.pathname === a)) {
    e.respondWith(staleWhileRevalidate(e.request, SHELL_CACHE));
    return;
  }
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      trimCache(cacheName, MAX_API_ENTRIES);
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return a minimal offline JSON for API calls
    if (request.url.includes('/api/')) {
      return new Response(JSON.stringify({ error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    await cache.delete(keys[0]);
    trimCache(cacheName, max);
  }
}
