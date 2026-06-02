// MealFlow Service Worker
const CACHE = 'mealflow-v1';

// Files to cache for offline use
const SHELL = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=DM+Sans:wght@300;400;500&display=swap',
  'https://accounts.google.com/gsi/client'
];

// Install — cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache what we can, ignore failures for external resources
      return Promise.allSettled(SHELL.map(url => cache.add(url).catch(() => {})));
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Google APIs / Anthropic: network only (must be live)
// - App shell (index.html, fonts): cache first, fallback to network
// - Everything else: network first, fallback to cache
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network for API calls
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('accounts.google.com')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache first for app shell
  if (url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
          return res;
        });
        // Return cached immediately, update in background
        return cached || networkFetch;
      })
    );
    return;
  }

  // Network first for everything else
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
