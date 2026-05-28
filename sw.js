// sw.js — Service Worker dla Eliadory
// Strategia:
//   - precache na install: HTML, JS, vendor, statyczne assety, portrety
//   - przy nawigacji (HTML): network-first z fallbackiem do cache (świeże aktualizacje)
//   - dla wszystkiego innego (obrazy, audio, vendor): cache-first
//   - przy braku sieci aplikacja działa w pełni z cache
//
// Wersja cache — zmień przy każdej zmianie zawartości którą trzeba "pchnąć" do użytkownika.
const CACHE_VERSION = 'eliadora-v10-3';
const CACHE_NAME = `eliadora-${CACHE_VERSION}`;

// Pliki absolutnie krytyczne — bez nich aplikacja nie wystartuje offline.
// Resztę (portrety w p/, dodatkowe pergaminy) cache zbiera "po drodze".
const CORE_ASSETS = [
  './',
  './eliadora8.html',
  './eliadora.css',
  './eliadora.js',
  './eliadora-pure.js',
  './eliadora-storage.js',
  './eliadora.i18n.js',
  './eliadora-data.js',
  './manifest.webmanifest',
  './vendor/d3.min.js',
  './vendor/jspdf.umd.min.js',
  './assets/lucid-academy-icon.png',
  './assets/parchment-classic.png',
  './assets/The_Keeper_s_Ledger.mp3',
  './adult_f.png',
  './adult_m.png',
  './child_f.png',
  './child_m.png',
  './elder_f.png',
  './elder_m.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll jest "all-or-nothing" — jeśli jeden plik nie istnieje,
      // cały install się wywala. Robimy po jednym z catch, żeby brakujące
      // zasoby nie blokowały instalacji.
      return Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] precache failed for', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('eliadora-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Tylko GET — POST/PUT nie cachujemy
  if (req.method !== 'GET') return;

  // Pomijamy zewnętrzne URLe (CDN itp. — w Eliadorze nie powinno być, ale safety)
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Nawigacja (otwarcie strony) — network first, fallback do cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // klonuj do cache i zwróć
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./eliadora8.html')))
    );
    return;
  }

  // Wszystko inne (assety, vendor) — cache first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // cache tylko sensowne odpowiedzi
        if (res && res.status === 200 && res.type !== 'opaque') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // ostatnia deska ratunku — nic nie mamy
        return new Response('', { status: 504, statusText: 'Offline and not cached' });
      });
    })
  );
});

// Wiadomość od strony: "wyczyść cache" (przydatne przy debugowaniu)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
