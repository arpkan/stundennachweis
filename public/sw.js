const CACHE_NAME = 'stundennachweis-v4';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});

function shouldCache(url) {
  const u = new URL(url);
  // Never cache HTML shell or manifest — always fetch fresh
  if (u.pathname === '/' || u.pathname.endsWith('.html') || u.pathname === '/manifest.json') return false;
  // Never cache unhashed static assets — they can change without a filename change
  if (/\.(png|ico|svg|webp)$/.test(u.pathname)) return false;
  // Only cache versioned JS/CSS/WASM assets (content hashes in filenames)
  return true;
}

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return;
  event.waitUntil(
    self.registration.showNotification(event.data.title, event.data.options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (!shouldCache(request.url)) {
    // Network-first for HTML: always get the latest shell
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Stale-while-revalidate for hashed assets
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
