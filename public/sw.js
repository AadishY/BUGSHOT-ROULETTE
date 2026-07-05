const CACHE_NAME = 'bugshot-roulette-v6';
const ASSETS_TO_CACHE = [
    '/',
    '/manifest.json'
];

// Install event - Installs immediately with minimal critical cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                console.warn("[Service Worker] Install pre-caching failed:", err);
            });
        })
    );
    self.skipWaiting();
});

// Activate event - Claim clients and clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log("[Service Worker] Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - Dynamic caching with Cache First for assets, Network First for others
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Skip Chrome extensions and local dev socket/HMR connections
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return;
    }
    if (url.pathname.includes('/socket.io') || url.pathname.includes('ws') || (url.hostname.includes('localhost') && url.port === '3001')) {
        return;
    }

    // Cache First for static media assets (images, audio, models, styles, scripts)
    const isAsset = url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|mp3|wav|ogg|glb|gltf|js|css|woff2|ico)$/) || 
                    url.host.includes('fonts.gstatic.com') || 
                    url.host.includes('fonts.googleapis.com');

    if (isAsset) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((response) => {
                    // Cache the successful GET asset requests
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                }).catch(() => {
                    return new Response("Asset offline", { status: 408, headers: { "Content-Type": "text/plain" } });
                });
            })
        );
        return;
    }

    // Network First for HTML and APIs
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Return index fallback if HTML request fails offline
                    const acceptHeader = event.request.headers.get('accept') || '';
                    if (acceptHeader.includes('text/html')) {
                        return caches.match('/');
                    }
                    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
                });
            })
    );
});
