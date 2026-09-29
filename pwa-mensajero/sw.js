/**
 * PROTOCOLO MACONDO - SERVICE WORKER LOCAL-FIRST
 * Ubicación: pwa-mensajero/sw.js
 */

const CACHE_NAME = "pwa-mensajero-v2.3.0";

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

self.addEventListener("install", (event) => {
    console.log("⚙️ [SW]: Instalando Service Worker e inyectando caché v2.3.0...");
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
                    console.warn(`⚠️ [SW_CACHE]: Error al precachear ${url}:`, err);
                }
            });
            return Promise.all(peticiones);
        })
    );
});

self.addEventListener("activate", (event) => {
    console.log("🧹 [SW]: Activando Service Worker v2.3.0 y purgando cachés obsoletas...");
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

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // BYPASS EXPLICITO DE RED PARA EL ENDPOINT API REST LOCAL O REMOTO
    if (url.pathname.endsWith("api.php") || url.searchParams.has("action") || url.pathname.includes("/api/")) {
        console.log(`🌐 [SW_BYPASS_V2.3]: Petición API enviada directamente a la red real -> [${event.request.method} ${url.pathname}]`);
        return; 
    }

    if (event.request.method !== "GET") return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.headers.get("accept")?.includes("text/html")) {
                        return caches.match("./index2.html");
                    }
                });
            })
    );
});