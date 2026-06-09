// RKT Motors CRM — Service Worker v1.3
var CACHE   = 'rkt-crm-v4';
var ASSETS  = [
  '/rkt-crm/',
  '/rkt-crm/index.html',
  '/rkt-crm/manifest.json',
  '/rkt-crm/icons/icon-192.png',
  '/rkt-crm/icons/icon-512.png',
  '/rkt-crm/icons/rkt-logo-original.png'
];

// Install — pre-cache app shell
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
  );
  self.skipWaiting(); // activate immediately without waiting
});

// Activate — delete old caches, then tell ALL open tabs to reload
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k)   { return caches.delete(k); })
      );
    }).then(function() {
      // Notify all open clients (tabs) that a new version is ready
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'SW_UPDATED', cache: CACHE });
        });
      });
    })
  );
  return self.clients.claim();
});

// Fetch — Network first (always latest), fallback to cache when offline
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // GAS API — always network, never cache
  if (url.indexOf('script.google.com') !== -1) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Leaflet / OpenStreetMap tiles — cache first (static assets)
  if (url.indexOf('unpkg.com') !== -1 || url.indexOf('openstreetmap.org') !== -1) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(response) {
          if (response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else — Network first, cache fallback for offline
  e.respondWith(
    fetch(e.request).then(function(response) {
      if (response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
      }
      return response;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match('/rkt-crm/index.html');
      });
    })
  );
});
