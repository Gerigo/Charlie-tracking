/**
 * Charlie service worker — minimal app-shell cache.
 * Strategy:
 *  - Navigations (HTML): network-first with cache fallback so the user never
 *    sees a blank page when offline.
 *  - Static JS/CSS/fonts/icons: stale-while-revalidate.
 *  - Firestore/Auth/Storage requests: bypass the SW entirely (always live).
 *
 * ⚠️ BUMP CACHE_VERSION on every meaningful deploy. The activate handler
 * deletes any cache whose name doesn't match the current version, so a
 * version bump forces all installed clients (including the iOS home-screen
 * PWA) to discard their old shell on next visit and pick up the new bundle.
 * Without this, stale-while-revalidate keeps serving last-known JS until
 * the user reloads twice — frustrating after a deploy.
 */
const CACHE_VERSION = 'charlie-v11-tabbar-opaque';
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|gif|ico)$/i.test(url.pathname);
}

function isFirebaseRequest(url) {
  return (
    url.hostname.endsWith('firestore.googleapis.com') ||
    url.hostname.endsWith('firebaseapp.com') ||
    url.hostname.endsWith('googleapis.com') ||
    url.hostname.endsWith('firebasestorage.app') ||
    url.hostname.endsWith('firebaseio.com')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Don't cache anything from Firebase services — always live.
  if (isFirebaseRequest(url)) return;

  // HTML navigations: network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match(request))),
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetched;
      }),
    );
  }
});
