// Service Worker — La Mia Cantina PWA
// IMPORTANTE: incrementare CACHE_VERSION ad ogni modifica per forzare l'aggiornamento
const CACHE_VERSION = 11;
const CACHE_NAME = 'cantina-v' + CACHE_VERSION;

// Risorse statiche da pre-cachare (NO cantina.json — viene sempre preso dalla rete)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: pre-cache risorse statiche, skip waiting per attivarsi subito
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: ELIMINA TUTTE le cache vecchie (sia statiche che dati)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME) // elimina TUTTO tranne la cache corrente
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // cantina.json → SEMPRE dalla rete, MAI dalla cache
  // Questo garantisce che i dati siano sempre aggiornati
  if (url.pathname.endsWith('cantina.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error('Network response not ok');
          return response;
        })
        .catch(err => {
          console.warn('Fetch cantina.json fallito, nessun fallback cache:', err);
          return new Response(JSON.stringify({ cantina: [] }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // index.html → Network-First (per ricevere subito aggiornamenti del codice)
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Tutto il resto (CSS, fonts, icons, etc.) → Cache-First con fallback rete
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          });
        })
    );
    return;
  }

  // Fallback per tutto il resto
  event.respondWith(fetch(event.request));
});
