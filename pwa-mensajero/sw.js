const CACHE_NAME = 'pwa-mensajero-v1';

// Rutas relativas al directorio /pwa-mensajero/
const PRECACHE_ASSETS = [
    './',
    './index2.html',
    './style2.css',
    './app.js',
    './script2.js',
    './componentes/siderbar.html',
    './vistas/ruta/ruta-activa.html'
    
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    console.log('[SW] Modo offline activo en PWA Mensajero');
                });

                return cachedResponse || fetchPromise;
            })
        );
    }
});