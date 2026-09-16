const CACHE_NAME = 'pwa-mensajero-v1';

// Rutas relativas al directorio /pwa-mensajero/
const PRECACHE_ASSETS = [
    './',
    './index2.html',
    './manifest.json',
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
    // Ignorar peticiones que no sean GET (como APIs POST/PUT)
    if (event.request.method !== 'GET') return;

    // Ignorar peticiones a esquemas no soportados (extensiones, chrome-extension, etc.)
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Promesa de red en segundo plano para revalidar el cache
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    console.log('[SW] Petición fallida en red, usando respaldo offline');
                });

            // Si está en cache devuélvelo de inmediato, de lo contrario espera a la red
            return cachedResponse || fetchPromise;
        })
    );
});