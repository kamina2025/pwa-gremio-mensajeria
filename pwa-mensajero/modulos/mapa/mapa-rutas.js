/**
 * PROTOCOLO MACONDO - SUBSISTEMA MAPA: SERVICIO DE TRAZADO Y MINIRUTAS POR CLÚSTER
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-rutas.js
 * Arquitectura: Google Maps JavaScript API / Local-First / Cyberpunk Dark Mode
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

// Exposición global para interoperabilidad PWA
if (!window.__POLILINEAS_CLUSTERS__) {
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
        const lat = parseFloat(punto.lat || punto.latitud || (punto.ubicacion && punto.ubicacion.lat) || (punto.centroide && punto.centroide.lat));
        const lng = parseFloat(punto.lng || punto.longitud || (punto.ubicacion && punto.ubicacion.lng) || (punto.centroide && punto.centroide.lng));
        
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

    // Limpiar colección local
    if (Array.isArray(coleccionPolilineasActivas)) {
        coleccionPolilineasActivas.forEach(poly => {
            if (poly && typeof poly.setMap === "function") poly.setMap(null);
        });
        coleccionPolilineasActivas = [];
    }

    // Limpiar colección global
    if (Array.isArray(window.__POLILINEAS_CLUSTERS__)) {
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
        || window.mapaVisorInstancia 
        || window.mapaMensajero 
        || window.mapaInstanciaGlobal 
        || (window.renderRutasMensajero && window.renderRutasMensajero.getMap());

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

    // 1. Filtrar y agrupar paradas por Zona
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
                const lat = parseFloat(p.lat || p.latitud || (p.coordenadas && p.coordenadas.lat) || (p.centroide && p.centroide.lat));
                const lng = parseFloat(p.lng || p.longitud || (p.coordenadas && p.coordenadas.lng) || (p.centroide && p.centroide.lng));
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
            window.__POLILINEAS_CLUSTERS__.push(polyMiniruta);

            console.log(` ⚡ [MINIRUTA_OK]: ${grupoId} (${pathPuntos.length} puntos) -> Color: %c${colorMiniruta}`, `color: ${colorMiniruta}; font-weight: bold;`);
            colorIndex++;
        }
    });

    console.groupEnd();
}

/**
 * Alias de compatibilidad global para el trazado exclusivo por zona.
 */
export async function trazarRutaPorZonaAislada(paradasZona, zonaFoco = null) {
    return trazarPolilineaRuta(paradasZona, zonaFoco);
}

// BINDINGS GLOBALES EN WINDOW
window.trazarPolilineaRuta = trazarPolilineaRuta;
window.trazarRutaPorZonaAislada = trazarRutaPorZonaAislada;
window.limpiarRutaTrazada = limpiarRutaTrazada;
window.limpiarPolilineasMapa = limpiarRutaTrazada;