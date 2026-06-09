// RKT Motors CRM — Service Worker v1.2 (Network-first = always latest)
var CACHE = 'rkt-crm-v3';
var ASSETS = [
  '/rkt-crm/',
  '/rkt-crm/index.html',
  '/rkt-crm/manifest.json',
  '/rkt-crm/icons/icon-192.png',
  '/rkt-crm/icons/icon-512.png',
  '/rkt-crm/icons/rkt-logo-original.png'
];

// Install — cache app shell
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

// Activate — clean old caches immediately
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

// Fetch — Network first for HTML (always latest), cache first for assets
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // GAS API — always network, never cache
  if (url.indexOf('script.google.com') !== -1) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Leaflet CDN — cache first (rarely changes)
  if (url.indexOf('unpkg.com') !== -1 || url.indexOf('openstreetmap.org') !== -1) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
          return response;
        });
      })
    );
    return;
  }

  // App HTML — Network first so updates show immediately
  // Falls back to cache if offline
  e.respondWith(
    fetch(e.request).then(function(response) {
      if (response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
      }
      return response;
    }).catch(function() {
      // Offline — serve from cache
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match('/rkt-crm/index.html');
      });
    })
  );
});
