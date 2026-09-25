/**
 * PROTOCOLO MACONDO - SUBSISTEMA MAPA: SERVICIO DE TRAZADO Y RUTAS AISLADAS POR ZONA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-rutas.js
 * Arquitectura: Google Maps JavaScript API / Local-First / Cyberpunk Dark Mode
 */

import { PALETA_ZONAS } from "./zonificacion/mensajero-zonificacion.js";

let coleccionPolilineasActivas = [];
let directionsRendererActivo = null;

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
 * Limpia el trazado de polilineas y renderers previos en el visor del mapa.
 */
export function limpiarRutaTrazada() {
    console.log("🧹 [MAPA_RUTAS]: Limpiando polilíneas y trazos previos en visor...");

    // Limpiar polilíneas manuales
    if (Array.isArray(coleccionPolilineasActivas)) {
        coleccionPolilineasActivas.forEach(poly => {
            if (poly && typeof poly.setMap === "function") poly.setMap(null);
        });
        coleccionPolilineasActivas = [];
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
 * Traza de forma segmentada las rutas aisladas por zona y grupo en el mapa.
 * Garantiza la separación visual entre zonas e interconecta las secuencias optimizadas.
 * 
 * @param {Array<Object>} listaPedidos - Arreglo global de paradas
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

    // Si la API de Google Maps DirectionsRenderer está dibujando activamente por carreteras, se respeta
    if (window.__DIRECTIONS_RENDERER__ && window.__DIRECTIONS_RENDERER__.getMap()) {
        console.log("ℹ️ [MAPA_RUTAS]: Trazado vial por DirectionsRenderer activo. Preservando render de carretera.");
        return;
    }

    limpiarRutaTrazada();

    if (!mapaTarget || typeof google === "undefined" || !google.maps) {
        console.warn("⚠️ [MAPA_RUTAS]: Instancia de Google Maps no lista para dibujar polilínea.");
        return;
    }

    // 1. Agrupar paradas por zona geográfica
    const gruposPorZona = {};

    listaPedidos.forEach(p => {
        if (!p) return;
        const zKey = (p.zonaKey || p.zona || p.nombreZona || "GENERAL")
            .toUpperCase()
            .replace(/^ZONA[_\s]+/i, "")
            .replace(/_/g, "-");

        if (zonaFoco) {
            const zFocoLimpio = zonaFoco.toUpperCase().replace(/^ZONA[_\s]+/i, "").replace(/_/g, "-");
            if (zKey !== zFocoLimpio) return;
        }

        if (!gruposPorZona[zKey]) {
            gruposPorZona[zKey] = [];
        }
        gruposPorZona[zKey].push(p);
    });

    console.group(`KM [MAPA_RUTAS]: Procesando trayectos independientes ${zonaFoco ? `[Foco: ${zonaFoco}]` : ''}`);

    // 2. Dibujar polilíneas autónomas para cada grupo/zona
    for (const [keyZona, paradasDeEstaZona] of Object.entries(gruposPorZona)) {
        if (paradasDeEstaZona.length < 2) {
            console.log(`ℹ️ [MAPA_RUTAS]: La Zona [${keyZona}] contiene ${paradasDeEstaZona.length} parada(s). No requiere polílinea inter-puntos.`);
            continue;
        }

        // Ordenar paradas estrictamente por su atributo de secuencia numérico
        paradasDeEstaZona.sort((a, b) => {
            const seqA = parseInt(a.secuenciaZona || a.secuencia || a.orden || 0, 10);
            const seqB = parseInt(b.secuenciaZona || b.secuencia || b.orden || 0, 10);
            return seqA - seqB;
        });

        const infoMeta = (PALETA_ZONAS && PALETA_ZONAS[keyZona]) || (PALETA_ZONAS && PALETA_ZONAS["GENERAL"]) || { color: "#00E5FF" };
        const colorPolilinea = infoMeta.color || "#00E5FF";

        const pathPuntos = paradasDeEstaZona
            .map(p => {
                const lat = parseFloat(p.lat || p.latitud || (p.coordenadas && p.coordenadas.lat) || (p.centroide && p.centroide.lat));
                const lng = parseFloat(p.lng || p.longitud || (p.coordenadas && p.coordenadas.lng) || (p.centroide && p.centroide.lng));
                return (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) ? new google.maps.LatLng(lat, lng) : null;
            })
            .filter(Boolean);

        if (pathPuntos.length >= 2) {
            const polyDirecta = new google.maps.Polyline({
                path: pathPuntos,
                geodesic: true,
                strokeColor: colorPolilinea,
                strokeOpacity: 0.85,
                strokeWeight: 4,
                map: mapaTarget
            });

            coleccionPolilineasActivas.push(polyDirecta);
            console.log(`✅ [MAPA_RUTAS_OK]: Trayecto directo trazado para Zona [${keyZona}] (${pathPuntos.length} puntos).`);
        }
    }

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