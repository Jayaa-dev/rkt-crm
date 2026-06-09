// RKT Motors CRM — Service Worker v1.1
var CACHE = 'rkt-crm-v2';
var ASSETS = [
  '/rkt-crm/',
  '/rkt-crm/index.html',
  '/rkt-crm/manifest.json',
  '/rkt-crm/icons/icon-192.png',
  '/rkt-crm/icons/icon-512.png'
];

// Install — cache app shell
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k)   { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — serve from cache, fall back to network
self.addEventListener('fetch', function(e) {
  // Don't cache GAS API calls — always go to network
  if (e.request.url.indexOf('script.google.com') !== -1) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(response) {
        if (response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return response;
      });
    }).catch(function() {
      return caches.match('/rkt-crm/index.html');
    })
  );
});
