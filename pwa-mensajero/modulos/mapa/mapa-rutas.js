/**
 * PROTOCOLO MACONDO - SUBSISTEMA MAPA: SERVICIO DE TRAZADO, MINIRUTAS Y NAVEGACIÓN GPS INTRAMURAL
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-rutas.js
 * Arquitectura: Google Maps JavaScript API / Directions API / Local-First / Cyberpunk Dark Mode
 */

import { PALETA_ZONAS } from "./zonificacion/mensajero-zonificacion.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "./zonificacion/estandar-zonas.js";

// Paleta Cyberpunk Neón para diferenciar visualmente cada miniruta / clúster
const PALETA_COLORES_CLUSTERS = [
    "#00E5FF", // Cyan Neón (GRUPO-01)
    "#00FF66", // Verde Neón (GRUPO-02)
    "#FFB300", // Amarillo/Ámbar Neón (GRUPO-03)
    "#FF3366", // Magenta/Rosa Neón (GRUPO-04)
    "#9D00FF", // Púrpura Neón (GRUPO-05)
    "#FF6600"  // Naranja Neón (GRUPO-06)
];

let coleccionPolilineasActivas = [];
let directionsRendererActivo = null;

// Instancias y estados globales de navegación interna
window.directionsRendererPWA = window.directionsRendererPWA || null;
window.directionsServicePWA = window.directionsServicePWA || null;
window.paradaObjetivoNavegacion = window.paradaObjetivoNavegacion || null;
window.rutaNavegacionPuntosActiva = window.rutaNavegacionPuntosActiva || [];

// Exposición global para interoperabilidad PWA
if (typeof window !== "undefined" && !window.__POLILINEAS_CLUSTERS__) {
    window.__POLILINEAS_CLUSTERS__ = [];
}

/**
 * Sanitiza una dirección en texto añadiéndole el contexto geográfico si no lo posee.
 * @param {string} direccion - Dirección cruda
 * @returns {string} Dirección sanitizada
 */
function sanitizarDireccionContexto(direccion) {
    if (!direccion || typeof direccion !== "string") return "Cali, Colombia";
    const dirLower = direccion.toLowerCase();
    if (dirLower.includes("cali") || dirLower.includes("jamundi") || dirLower.includes("yumbo") || dirLower.includes("palmira")) {
        return direccion;
    }
    return `${direccion}, Cali, Colombia`;
}

/**
 * Normaliza un ítem de pedido o punto a una ubicación reconocible por Google Maps SDK.
 * @param {Object|string} punto - Objeto con coordenadas/dirección o string
 * @returns {google.maps.LatLng|string} Ubicación normalizada
 */
function normalizarPuntoUbicacion(punto) {
    if (!punto) return "Cali, Colombia";
    if (typeof google !== "undefined" && google.maps && punto instanceof google.maps.LatLng) return punto;

    if (typeof punto === "object") {
        const rawLat = punto.lat ?? punto.latitud ?? (punto.ubicacion && punto.ubicacion.lat) ?? (punto.centroide && punto.centroide.lat);
        const rawLng = punto.lng ?? punto.longitud ?? (punto.ubicacion && punto.ubicacion.lng) ?? (punto.centroide && punto.centroide.lng);

        const lat = parseFloat(String(rawLat).replace(',', '.'));
        const lng = parseFloat(String(rawLng).replace(',', '.'));
        
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            return new google.maps.LatLng(lat, lng);
        }

        if (punto.direccion || punto.dir) {
            return sanitizarDireccionContexto(punto.direccion || punto.dir);
        }
    }

    if (typeof punto === "string") {
        return sanitizarDireccionContexto(punto);
    }

    return "Cali, Colombia";
}

/**
 * Limpia el trazado de polílineas y renderers previos en el visor del mapa.
 */
export function limpiarRutaTrazada() {
    console.log("🧹 [MAPA_RUTAS]: Limpiando minirutas y polílineas previas en visor...");

    // Limpiar colección local de polílineas
    if (Array.isArray(coleccionPolilineasActivas)) {
        coleccionPolilineasActivas.forEach(poly => {
            if (poly && typeof poly.setMap === "function") poly.setMap(null);
        });
        coleccionPolilineasActivas = [];
    }

    // Limpiar colección global
    if (typeof window !== "undefined" && Array.isArray(window.__POLILINEAS_CLUSTERS__)) {
        window.__POLILINEAS_CLUSTERS__.forEach(poly => {
            if (poly && typeof poly.setMap === "function") poly.setMap(null);
        });
        window.__POLILINEAS_CLUSTERS__ = [];
    }

    // Limpiar renderers de direcciones activos
    if (directionsRendererActivo && typeof directionsRendererActivo.setMap === "function") {
        directionsRendererActivo.setMap(null);
        directionsRendererActivo = null;
    }

    if (typeof window !== "undefined") {
        if (window.__DIRECTIONS_RENDERER__ && typeof window.__DIRECTIONS_RENDERER__.setMap === "function") {
            window.__DIRECTIONS_RENDERER__.setMap(null);
        }

        if (window.renderRutasMensajero && typeof window.renderRutasMensajero.setDirections === "function") {
            try {
                window.renderRutasMensajero.setDirections({ routes: [] });
            } catch (e) {
                // Limpieza silenciosa
            }
        }
    }
}

/**
 * Traza las minirutas divididas en segmentos independientes según su clúster (grupoId).
 * Garantiza la separación cromática por miniruta y la secuencia entre paradas.
 * 
 * @param {Array<Object>} listaPedidos - Arreglo global o de zona de paradas
 * @param {string} [zonaFoco=null] - Zona específica para enfocar/aislar opcionalmente
 * @param {google.maps.Map} [mapaInstancia=null] - Instancia del mapa
 */
export async function trazarPolilineaRuta(listaPedidos, zonaFoco = null, mapaInstancia = null) {
    const mapaTarget = mapaInstancia 
        || (typeof window !== "undefined" && (
            window.mapaVisorInstancia 
            || window.mapaMensajero 
            || window.mapaInstanciaGlobal 
            || (window.renderRutasMensajero && window.renderRutasMensajero.getMap())
        ));

    if (!listaPedidos || !Array.isArray(listaPedidos) || listaPedidos.length < 1) {
        console.warn("⚠️ [MAPA_RUTAS]: Se requiere al menos una parada para procesar trazado.");
        limpiarRutaTrazada();
        return;
    }

    limpiarRutaTrazada();

    if (!mapaTarget || typeof google === "undefined" || !google.maps) {
        console.warn("⚠️ [MAPA_RUTAS]: Instancia de Google Maps no lista para dibujar minirutas.");
        return;
    }

    // 1. Filtrar paradas por Zona
    const targetCanonico = zonaFoco ? estandarizarZonaCanonica(zonaFoco) : null;
    const paradasFiltradas = targetCanonico
        ? listaPedidos.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico)
        : listaPedidos;

    if (paradasFiltradas.length < 2) {
        console.warn("ℹ️ [MAPA_RUTAS]: Se requieren al menos 2 paradas para dibujar minirutas.");
        return;
    }

    // 2. Sub-agrupar paradas por su `grupoId` (Miniruta / Clúster)
    const clustersMap = new Map();
    paradasFiltradas.forEach((parada, idx) => {
        // Fallback: si no posee grupoId asignado, agrupar en bloques de 4
        const grupoKey = parada.grupoId || `GRUPO-${String(Math.ceil((idx + 1) / 4)).padStart(2, "0")}`;
        if (!clustersMap.has(grupoKey)) {
            clustersMap.set(grupoKey, []);
        }
        clustersMap.get(grupoKey).push(parada);
    });

    console.group(`KM [MAPA_RUTAS]: Procesando ${clustersMap.size} minirutas por clúster ${targetCanonico ? `[Foco: ${targetCanonico}]` : ''}`);

    let colorIndex = 0;

    // 3. Dibujar una Polyline independiente con color único por cada miniruta / clúster
    clustersMap.forEach((paradasGrupo, grupoId) => {
        // Ordenar internamente las paradas del clúster por su secuencia
        paradasGrupo.sort((a, b) => {
            const seqA = parseInt(a.secuenciaZona || a.secuencia || a.orden || 0, 10);
            const seqB = parseInt(b.secuenciaZona || b.secuencia || b.orden || 0, 10);
            return seqA - seqB;
        });

        const pathPuntos = paradasGrupo
            .map(p => {
                const rawLat = p.lat ?? p.latitud ?? (p.coordenadas && p.coordenadas.lat) ?? (p.centroide && p.centroide.lat);
                const rawLng = p.lng ?? p.longitud ?? (p.coordenadas && p.coordenadas.lng) ?? (p.centroide && p.centroide.lng);

                const lat = parseFloat(String(rawLat).replace(',', '.'));
                const lng = parseFloat(String(rawLng).replace(',', '.'));

                return (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) ? new google.maps.LatLng(lat, lng) : null;
            })
            .filter(Boolean);

        if (pathPuntos.length >= 2) {
            const colorMiniruta = PALETA_COLORES_CLUSTERS[colorIndex % PALETA_COLORES_CLUSTERS.length];

            const polyMiniruta = new google.maps.Polyline({
                path: pathPuntos,
                geodesic: true,
                strokeColor: colorMiniruta,
                strokeOpacity: 0.9,
                strokeWeight: 5,
                map: mapaTarget
            });

            coleccionPolilineasActivas.push(polyMiniruta);
            if (typeof window !== "undefined" && Array.isArray(window.__POLILINEAS_CLUSTERS__)) {
                window.__POLILINEAS_CLUSTERS__.push(polyMiniruta);
            }

            console.log(` ⚡ [MINIRUTA_OK]: ${grupoId} (${pathPuntos.length} puntos) -> Color: %c${colorMiniruta}`, `color: ${colorMiniruta}; font-weight: bold;`);
            colorIndex++;
        }
    });

    console.groupEnd();
}

/**
 * Traza y actualiza dinámicamente la ruta de navegación navegable por calles en tiempo real
 * desde la posición GPS actual del mensajero hasta la parada objetivo.
 * Extrae y guarda en memoria el array de coordenadas viales reales (overview_path) para el simulador.
 * 
 * @param {Object} [paradaDestino] - Parada seleccionada como objetivo (Opcional si ya existe en memoria global)
 * @param {boolean} [centrarVista=true] - Si es false, no altera la cámara/zoom del usuario durante el movimiento
 */
export async function trazarRutaNavegacionInternaGPS(paradaDestino = null, centrarVista = true) {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) {
        console.error("❌ [NAVEGACION_PWA]: Instancia del mapa no disponible.");
        return;
    }

    if (paradaDestino) {
        window.paradaObjetivoNavegacion = paradaDestino;
    }

    const objetivo = window.paradaObjetivoNavegacion;
    if (!objetivo) {
        console.warn("⚠️ [NAVEGACION_PWA]: No hay una parada objetivo activa asignada.");
        return;
    }

    // 1. Obtener coordenadas de origen (GPS Mensajero)
    let origenCoords = window.posicionActualMensajero;
    if (!origenCoords || !origenCoords.lat || !origenCoords.lng) {
        console.warn("⚠️ [NAVEGACION_PWA]: Posición GPS actual no detectada. Intentando capturar ubicación...");
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    window.posicionActualMensajero = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    trazarRutaNavegacionInternaGPS(objetivo, centrarVista);
                },
                (err) => console.error("❌ [NAVEGACION_PWA]: Error obteniendo GPS actual:", err),
                { enableHighAccuracy: true, timeout: 8000 }
            );
            return;
        }
    }

    // 2. Obtener coordenadas de destino
    const destCoords = typeof window.obtenerCoordenadasValidasParada === "function"
        ? window.obtenerCoordenadasValidasParada(objetivo)
        : null;

    if (!destCoords) {
        console.error("❌ [NAVEGACION_PWA]: La parada seleccionada no tiene coordenadas válidas.");
        return;
    }

    console.log(`🧭 [NAVEGACION_PWA]: Trazando viaje interno -> Origen: [${origenCoords.lat.toFixed(5)}, ${origenCoords.lng.toFixed(5)}] -> Destino: [${destCoords.lat.toFixed(5)}, ${destCoords.lng.toFixed(5)}]`);

    // 3. Inicializar o actualizar servicios de Google Maps Directions
    if (!window.directionsServicePWA) {
        window.directionsServicePWA = new google.maps.DirectionsService();
    }

    if (!window.directionsRendererPWA) {
        window.directionsRendererPWA = new google.maps.DirectionsRenderer({
            map: mapa,
            suppressMarkers: true, // Preserva los pines tácticos neón
            preserveViewport: !centrarVista, // Mantiene el zoom fijado por el usuario en movimiento
            polylineOptions: {
                strokeColor: "#FF007F", // Rosa Magenta Cyberpunk
                strokeOpacity: 0.95,
                strokeWeight: 7,
                zIndex: 99999
            }
        });
    } else {
        window.directionsRendererPWA.setMap(mapa);
        window.directionsRendererPWA.setOptions({ preserveViewport: !centrarVista });
    }

    const request = {
        origin: new google.maps.LatLng(origenCoords.lat, origenCoords.lng),
        destination: new google.maps.LatLng(destCoords.lat, destCoords.lng),
        travelMode: google.maps.TravelMode.DRIVING
    };

    window.directionsServicePWA.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            window.directionsRendererPWA.setDirections(result);

            // EXTRAER PUNTOS VIALES REALES PARA LA SIMULACIÓN PASO A PASO POR CALLES
            if (result.routes && result.routes[0] && result.routes[0].overview_path) {
                window.rutaNavegacionPuntosActiva = result.routes[0].overview_path.map(pt => ({
                    lat: pt.lat(),
                    lng: pt.lng()
                }));
                console.log(`🛣️ [NAVEGACION_PWA]: Extraídos ${window.rutaNavegacionPuntosActiva.length} vértices viales de la ruta real.`);
            }

            console.log("✅ [NAVEGACION_PWA]: Ruta de viaje por calles actualizada exitosamente en el lienzo PWA.");
            mostrarBotonLimpiarRutaNavegacion();
        } else {
            console.error("❌ [NAVEGACION_PWA]: Fallo al calcular la ruta de viaje por calles:", status);
        }
    });
}

/**
 * Limpia la línea de navegación activa del mapa PWA y borra la parada objetivo y el path vial de memoria.
 */
export function limpiarRutaNavegacionGPS() {
    window.paradaObjetivoNavegacion = null;
    window.rutaNavegacionPuntosActiva = [];
    if (window.directionsRendererPWA) {
        window.directionsRendererPWA.setMap(null);
        console.log("🧹 [NAVEGACION_PWA]: Ruta de viaje removida del lienzo del mapa.");
    }
    const btnLimpiar = document.getElementById("btn-limpiar-navegacion-pwa");
    if (btnLimpiar) btnLimpiar.remove();
}

/**
 * Muestra un botón flotante neón para cancelar el modo viaje en la PWA.
 */
function mostrarBotonLimpiarRutaNavegacion() {
    let btnExistente = document.getElementById("btn-limpiar-navegacion-pwa");
    if (btnExistente) return;

    const btnHTML = `
        <button id="btn-limpiar-navegacion-pwa" 
                onclick="window.limpiarRutaNavegacionGPS()" 
                style="position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%); z-index: 99999; background: #0d1117; border: 2px solid #ff3366; color: #ff3366; padding: 10px 18px; border-radius: 20px; font-family: 'Fira Code', monospace; font-size: 0.82rem; font-weight: bold; box-shadow: 0 0 15px rgba(255, 51, 102, 0.4); cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <span>❌ CANCELAR VIAJE GPS</span>
        </button>
    `;
    document.body.insertAdjacentHTML("beforeend", btnHTML);
}

/**
 * Alias de compatibilidad global para el trazado exclusivo por zona.
 */
export async function trazarRutaPorZonaAislada(paradasZona, zonaFoco = null) {
    return trazarPolilineaRuta(paradasZona, zonaFoco);
}

// BINDINGS GLOBALES EN WINDOW
if (typeof window !== "undefined") {
    window.trazarPolilineaRuta = trazarPolilineaRuta;
    window.trazarRutaPorZonaAislada = trazarRutaPorZonaAislada;
    window.trazarRutaNavegacionInternaGPS = trazarRutaNavegacionInternaGPS;
    window.limpiarRutaNavegacionGPS = limpiarRutaNavegacionGPS;
    window.limpiarRutaTrazada = limpiarRutaTrazada;
    window.limpiarPolilineasMapa = limpiarRutaTrazada;
}