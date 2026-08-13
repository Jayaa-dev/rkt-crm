// RKT Motors CRM — Service Worker v1.5
var CACHE   = 'rkt-crm-v6';
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

// ── Notification click → open app to Daily tab ──────────────
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var action = e.action;
  if (action === 'dismiss') return;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var c = clientList[i];
          if (c.url.indexOf('/rkt-crm/') !== -1 && 'focus' in c) {
            c.focus();
            c.postMessage({ type: 'OPEN_DAILY' });
            return;
          }
        }
        return self.clients.openWindow('/rkt-crm/?tab=daily');
      })
  );
});

// ── Push event (server-push / future VAPID use) ──────────────
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'RKT CRM Reminder', {
      body:   data.body  || 'Time to log your field entries!',
      icon:   '/rkt-crm/icons/icon-192.png',
      badge:  '/rkt-crm/icons/icon-192.png',
      tag:    'rkt-crm-push',
      requireInteraction: false,
      actions: [
        { action: 'open',    title: '📋 Open CRM' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: data
    })
  );
});

// ── Message from page → trigger notification immediately ─────
self.addEventListener('message', function(e) {
  if (!e.data) return;
  if (e.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(e.data.title || 'RKT CRM', {
      body:   e.data.body  || '',
      icon:   '/rkt-crm/icons/icon-192.png',
      badge:  '/rkt-crm/icons/icon-192.png',
      tag:    e.data.tag   || 'rkt-crm-reminder',
      requireInteraction: false,
      actions: [
        { action: 'open',    title: '📋 Open CRM' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
  }
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
