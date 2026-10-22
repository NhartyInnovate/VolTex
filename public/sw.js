// VolTex Service Worker (PWA-2)
// Provides secure static asset caching and a safe offline fallback page.
// Strictly avoids caching private user data, authenticated routes, referrals, or API responses.

const CACHE_VERSION = 'voltex-v1';
const OFFLINE_URL = '/offline.html';

// Explicitly allowlisted static public assets
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/voltex-logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            // Delete old versions of voltex caches only
            if (key.startsWith('voltex-') && key !== CACHE_VERSION) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Strict Bypass: Never intercept or cache Supabase auth/data requests or external domains
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Strict Bypass: Never cache API routes (/api/*)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 4. Strict Bypass: Never cache private or dynamic routes
  // (/dashboard, /admin, /auth, etc.)
  const isPrivateRoute =
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/auth');

  // 5. Navigation requests (HTML documents)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        // If offline and the network fails, serve the branded static offline page
        const cache = await caches.open(CACHE_VERSION);
        const offlineResponse = await cache.match(OFFLINE_URL);
        return offlineResponse || Response.error();
      })
    );
    return;
  }

  // If it's a private subresource or data request, do not cache
  if (isPrivateRoute) {
    return;
  }

  // 6. Static asset caching (allowlisted static icons, logo, manifest, offline page)
  const isAllowlistedAsset = PRECACHE_ASSETS.includes(url.pathname);

  if (isAllowlistedAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            // Validate response before caching
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type !== 'basic'
            ) {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
            // Return empty/error if static asset fetch fails while offline
            return Response.error();
          });
      })
    );
  }
});
