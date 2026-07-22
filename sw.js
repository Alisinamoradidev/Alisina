const CACHE_NAME = 'primenest-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.min.css',
  '/app.min.js',
  '/config.js',
  '/images/logo.jpeg',
  '/images/icon-192.jpeg',
  '/images/icon-512.jpeg',
  '/site.webmanifest',
  '/404.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
