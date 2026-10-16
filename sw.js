// Hasana service worker: offline app shell
// Bumped by Scripts/rehash_assets.py, which also renames the content-hashed
// css/js below. The three must always move together.
const VERSION = 'hasana-v26';
const CORE_CACHE = VERSION + '-core';
// Fonts and Written/ text are immutable content - the font files and the verse .txt
// files do not change when the app's CSS/JS does. Keeping their cache names
// version-scoped meant every deploy evicted ~2.2MB of fonts plus every cached
// surah, forcing a full re-download for returning and offline users. These two
// are deliberately NOT version-scoped; the activate handler below still prunes
// the old version-scoped ones (hasana-v6-fonts etc.) once.
const FONT_CACHE = 'hasana-fonts';
const WRITTEN_CACHE = 'hasana-written';

const CORE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/style.7a976259df.css',
    '/script.bd7960cde7.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CORE_CACHE)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Fonts we currently ship. FONT_CACHE is deliberately not version-scoped, so
// nothing else would ever evict a font we stopped using: dropping a cache NAME
// cannot remove entries from a cache we keep. Without this, every device that
// visited before the Scheherazade swap would hold ~2.2MB of unreachable .otf
// blobs forever. Keep this list in step with the @font-face rules in style.css;
// anything under /fonts/ not listed here is pruned (and simply re-fetched if it
// turns out to still be needed).
const CURRENT_FONTS = ['/fonts/ScheherazadeNew-Regular.woff2'];

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key.startsWith('hasana-') && key !== CORE_CACHE && key !== FONT_CACHE && key !== WRITTEN_CACHE)
                .map((key) => caches.delete(key))
        ))
        .then(() => caches.open(FONT_CACHE))
        .then((cache) => cache.keys().then((reqs) => Promise.all(
            reqs.filter((req) => !CURRENT_FONTS.includes(new URL(req.url).pathname))
                .map((req) => cache.delete(req))
        )))
        .catch(() => {}) // pruning is best-effort; never block activation on it
        .then(() => self.clients.claim())
    );
});

function networkFirst(request) {
    return fetch(request)
        .then((response) => {
            const copy = response.clone();
            caches.open(CORE_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')));
}

function cacheFirst(request, cacheName) {
    return caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
            if (response && response.ok) {
                const copy = response.clone();
                caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
        });
    });
}

function staleWhileRevalidate(request, cacheName, cap) {
    return caches.open(cacheName).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((response) => {
            if (response && response.ok) {
                const copy = response.clone();
                cache.put(request, copy).catch(() => {});
                // keep the runtime cache bounded (oldest ~120 entries)
                cache.keys().then((keys) => {
                    if (keys.length > cap) {
                        cache.delete(keys[0]).catch(() => {});
                    }
                }).catch(() => {});
            }
            return response;
        }).catch(() => cached);
        return cached || network;
    });
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // never cache cross-origin (mp3quran, cdnjs, fonts)

    const { pathname } = url;

    if (pathname === '/' || pathname === '/index.html' || pathname === '/quran_data.json') {
        event.respondWith(networkFirst(request));
        return;
    }

    if (pathname === '/manifest.json' || pathname.endsWith('.css') || pathname.endsWith('.js')) {
        event.respondWith(cacheFirst(request, CORE_CACHE));
        return;
    }

    if (pathname.startsWith('/fonts/')) {
        event.respondWith(cacheFirst(request, FONT_CACHE));
        return;
    }

    if (pathname.startsWith('/Written/')) {
        event.respondWith(staleWhileRevalidate(request, WRITTEN_CACHE, 120));
        return;
    }
});
