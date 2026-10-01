/**
 * PROTOCOLO MACONDO - SERVICE WORKER LOCAL-FIRST
 * Ubicación: pwa-mensajero/sw.js
 * Arquitectura: Cache API / Net-First con Fallback Offline Desacoplado
 */

const CACHE_NAME = "pwa-mensajero-v2.3.1";

const ASSETS_TO_CACHE = [
    "./",
    "./index2.html",
    "./manifest.json",
    "./app.js",
    "./script2.js",
    "./style/style2.css",
    "./style/layout.css",
    "./style/sidebar.css",
    "./style/formularios.css",
    "./style/barra-inferior.css",
    "./componentes/siderbar.html",
    "./componentes/barra-inferior/inicio-barra-infe.html",
    "./componentes/barra-inferior/mapa-barra-infe.html",
    "./vistas/ruta/ruta-activa.html",
    "./vistas/ruta/crear.html",
    "./vistas/ruta/mapa-activa.html",
    "./vistas/monedero/saldo.html",
    "./vistas/monedero/historial.html",
    "./vistas/perfil/conductor.html",
    "./vistas/notificaciones/planillas.html",
    "./vistas/notificaciones/reportes.html"
];

// Instalar Service Worker e inyectar caché estática core
self.addEventListener("install", (event) => {
    console.log(`⚙️ [SW]: Instalando Service Worker e inyectando caché ${CACHE_NAME}...`);
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            const peticiones = ASSETS_TO_CACHE.map(async (url) => {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        await cache.put(url, response);
                    }
                } catch (err) {
                    console.warn(`⚠️ [SW_CACHE]: Error al precachear recurso ${url}:`, err);
                }
            });
            return Promise.all(peticiones);
        })
    );
});

// Activar Service Worker y purgar cachés obsoletas de versiones anteriores
self.addEventListener("activate", (event) => {
    console.log(`🧹 [SW]: Activando Service Worker ${CACHE_NAME} y purgando cachés obsoletas...`);
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log(`🗑️ [SW]: Eliminando caché obsoleta -> ${key}`);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia de interceptación Network First con respaldo local en Caché
// Ruta: pwa-mensajero/sw.js
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Estrategia Bypass para llamadas explícitas a Google APIs
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
        console.log(`🌐 [SW_BYPASS]: Petición API enviada directamente a la red real -> [${event.request.method} ${url.pathname}]`);
        event.respondWith(
            fetch(event.request).catch((err) => {
                console.warn(`⚠️ [SW_BYPASS_OFFLINE]: Sin conexión para API externa: ${url.pathname}`);
                // Retornar respuesta nula/vacía defensiva para evitar TypeError
                return new Response(JSON.stringify({ error: 'offline', status: 'ERR_INTERNET_DISCONNECTED' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Manejo general de recursos estáticos e imágenes (Favicon, Fonts, etc.)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).catch((err) => {
                console.warn(`⚠️ [SW_FETCH_OFFLINE]: Error al recuperar recurso de la red: ${event.request.url}`);
                // Evita 'Failed to convert value to Response' devolviendo un estado HTTP 503 o recurso vacío
                return new Response('', { status: 503, statusText: 'Service Unavailable (Offline)' });
            });
        })
    );
});