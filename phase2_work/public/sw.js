const CACHE_NAME = 'klar-stale-while-revalidate-v2';

const SWR_URLS = [
  '/rechtstexte/datenschutz',
  '/rechtstexte/agb',
  '/manifest.json'
];

const SWR_REGEXES = [
  /\\.(png|jpg|jpeg|svg|webp)$/i,
  /firebasestorage\\.googleapis\\.com/
];

// Pure decision function, kept independent from Service Worker globals so it
// can be exercised by scripts/sw-durchreiche.mjs.
function sollAbfangen(method, requestUrl, origin, mode) {
  if (method !== 'GET' || mode === 'navigate') return false;
  try {
    const url = new URL(requestUrl);
    const eigene = new URL(origin);
    if (url.origin !== eigene.origin) return false;
    return true;
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  const isSwrRoute = SWR_URLS.includes(url.pathname) || SWR_REGEXES.some(regex => regex.test(event.request.url));

  const darfAbfangen = sollAbfangen(
    event.request.method,
    event.request.url,
    self.location.origin,
    event.request.mode
  );

  if (darfAbfangen && isSwrRoute) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(err => {
            console.warn('[SW] Fetch failed for', event.request.url, err);
          });

          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
