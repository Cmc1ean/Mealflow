// MealFlow Service Worker
// Bump CACHE on every deploy so the browser detects a new worker and the app
// can show the "update available" prompt.
const CACHE = 'mealflow-v5';

// Files to cache for offline fallback
const SHELL = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://accounts.google.com/gsi/client'
];

// Install — pre-cache the shell. Do NOT skipWaiting automatically:
// we wait until the user accepts the update prompt.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(SHELL.map(url => cache.add(url).catch(() => {})))
    )
  );
});

// The page asks the waiting worker to activate when the user taps "Reload".
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate — clean old caches and take control.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Google / Anthropic APIs: network only (must be live)
// - Everything else (incl. index.html): network-first, fall back to cache offline
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('accounts.google.com') ||
    url.hostname.includes('ocado.com')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first for everything else, caching fresh copies as we go.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && (e.request.method === 'GET')) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
