/**
 * PROTOCOLO MACONDO - SERVICE WORKER LOCAL-FIRST
 * Ubicación: pwa-mensajero/sw.js
 */

const CACHE_NAME = "pwa-mensajero-v2";

// Lista de activos esenciales ajustados a la nueva estructura
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
    "./vistas/perfil/conductor.html",
    "./vistas/notificaciones/planillas.html"
];

// Instalación del SW con tolerancia a recursos faltantes
self.addEventListener("install", (event) => {
    console.log(" ⚙️ [SW]: Instalando Service Worker e inyectando caché...");
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Se cachea de forma individual para evitar la caída masiva por un 404
            const peticiones = ASSETS_TO_CACHE.map(async (url) => {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        await cache.put(url, response);
                    } else {
                        console.warn(` ⚠️ [SW_CACHE]: No se pudo cachear ${url} (HTTP ${response.status})`);
                    }
                } catch (err) {
                    console.warn(` ⚠️ [SW_CACHE]: Error de red al intentar precachar ${url}:`, err);
                }
            });
            return Promise.all(peticiones);
        })
    );
});

// Activación y limpieza de cachés antiguas
self.addEventListener("activate", (event) => {
    console.log(" 🧹 [SW]: Activando Service Worker y depurando cachés antiguas...");
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log(` 🗑️ [SW]: Eliminando caché obsoleta -> ${key}`);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia de respuesta (Network First con Fallback a Cache)
self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (event.request.headers.get("accept")?.includes("text/html")) {
                        return caches.match("./index2.html");
                    }
                });
            })
    );
});