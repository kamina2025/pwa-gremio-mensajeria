/**
 * PROTOCOLO MACONDO - SUBSISTEMA MAPA: SERVICIO DE TRAZADO Y RUTAS AISLADAS POR ZONA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-rutas.js
 * Arquitectura: Google Maps JavaScript API (Estándar v2026)
 */

import { PALETA_ZONAS } from "./zonificacion/mensajero-zonificacion.js";

let coleccionPolilineasActivas = [];
let directionsRendererActivo = null;

/**
 * Sanitiza una dirección en texto añadiéndole el contexto geográfico de Cali si no lo tiene.
 * 
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
 * Normaliza un ítem de pedido o punto a una ubicación reconocible por Google Maps.
 * 
 * @param {Object|string} punto - Objeto con coordenadas/dirección o string
 * @returns {google.maps.LatLng|string} Ubicación normalizada
 */
function normalizarPuntoUbicacion(punto) {
    if (!punto) return "Cali, Colombia";
    if (typeof google !== "undefined" && google.maps && punto instanceof google.maps.LatLng) return punto;

    if (typeof punto === "object") {
        const lat = parseFloat(punto.lat || punto.latitude || (punto.ubicacion && punto.ubicacion.lat));
        const lng = parseFloat(punto.lng || punto.longitude || (punto.ubicacion && punto.ubicacion.lng));
        
        if (!isNaN(lat) && !isNaN(lng)) {
            return new google.maps.LatLng(lat, lng);
        }

        if (punto.direccion) {
            return sanitizarDireccionContexto(punto.direccion);
        }
    }

    if (typeof punto === "string") {
        return sanitizarDireccionContexto(punto);
    }

    return "Cali, Colombia";
}

/**
 * Limpia el trazado de polilíneas y renderers previos en el visor del mapa.
 */
export function limpiarRutaTrazada() {
    if (Array.isArray(coleccionPolilineasActivas)) {
        coleccionPolilineasActivas.forEach(poly => {
            if (poly) poly.setMap(null);
        });
        coleccionPolilineasActivas = [];
    }

    if (directionsRendererActivo) {
        directionsRendererActivo.setMap(null);
        directionsRendererActivo = null;
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
 * Traza de forma segmentada las rutas aisladas por zona en el mapa.
 * Garantiza que las paradas de la Zona A no se conecten físicamente con la Zona B.
 * 
 * @param {Array<Object>} listaPedidos - Arreglo global de paradas
 * @param {string} [zonaFoco=null] - Zona específica para enfocar/aislar opcionalmente
 * @param {google.maps.Map} [mapaInstancia=null] - Instancia del mapa
 */
export async function trazarPolilineaRuta(listaPedidos, zonaFoco = null, mapaInstancia = null) {
    const mapaTarget = mapaInstancia || window.mapaVisorInstancia || window.mapaMensajero || (window.renderRutasMensajero && window.renderRutasMensajero.getMap());

    if (!listaPedidos || !Array.isArray(listaPedidos) || listaPedidos.length < 1) {
        console.warn("⚠️ [MAPA_RUTAS]: Se requiere al menos una parada para procesar trazado.");
        limpiarRutaTrazada();
        return;
    }

    limpiarRutaTrazada();

    // 1. Agrupar paradas en contenedores aislados según su zona geográfica
    const gruposPorZona = {};

    listaPedidos.forEach(p => {
        if (!p) return;
        const zKey = (p.zonaKey || p.zona || p.nombreZona || "GENERAL")
            .toUpperCase()
            .replace(/^ZONA[_\s]+/i, "")
            .replace(/_/g, "-");

        // Si existe un foco de zona específico y el punto no corresponde, se omite
        if (zonaFoco) {
            const zFocoLimpio = zonaFoco.toUpperCase().replace(/^ZONA[_\s]+/i, "").replace(/_/g, "-");
            if (zKey !== zFocoLimpio) return;
        }

        if (!gruposPorZona[zKey]) {
            gruposPorZona[zKey] = [];
        }
        gruposPorZona[zKey].push(p);
    });

    console.group(`🛣️ [MAPA_RUTAS]: Procesando trayectos independientes por zona ${zonaFoco ? `[Foco: ${zonaFoco}]` : ''}`);

    // 2. Dibujar polilíneas autónomas para cada grupo/zona sin trazar líneas cruzadas
    for (const [keyZona, paradasDeEstaZona] of Object.entries(gruposPorZona)) {
        if (paradasDeEstaZona.length < 2) {
            console.log(`ℹ️ [MAPA_RUTAS]: La Zona [${keyZona}] contiene ${paradasDeEstaZona.length} parada(s). No requiere polílinea inter-puntos.`);
            continue;
        }

        const infoMeta = PALETA_ZONAS[keyZona] || PALETA_ZONAS["GENERAL"] || { color: "#00E5FF" };
        const colorPolilinea = infoMeta.color;

        const puntosNormalizados = paradasDeEstaZona.map(p => normalizarPuntoUbicacion(p));
        const origen = puntosNormalizados[0];
        const destino = puntosNormalizados[puntosNormalizados.length - 1];
        const intermediarios = puntosNormalizados.length > 2 ? puntosNormalizados.slice(1, -1) : [];

        // Tentativa mediante computeRoutes (API moderna)
        let trazadoExitoso = false;
        if (typeof google !== "undefined" && google.maps && google.maps.routes && google.maps.routes.Route && typeof google.maps.routes.Route.computeRoutes === "function" && mapaTarget) {
            try {
                const formatearUbicacion = (p) => {
                    if (p instanceof google.maps.LatLng) {
                        return { latLng: { latitude: p.lat(), longitude: p.lng() } };
                    }
                    return { address: p };
                };

                const request = {
                    origin: { location: formatearUbicacion(origen) },
                    destination: { location: formatearUbicacion(destino) },
                    travelMode: "TWO_WHEELER",
                    intermediates: intermediarios.map(i => ({ location: formatearUbicacion(i) }))
                };

                const response = await google.maps.routes.Route.computeRoutes(request);

                if (response && response.routes && response.routes[0] && response.routes[0].polyline) {
                    const encodedPolyline = response.routes[0].polyline.encodedPolyline;
                    if (google.maps.geometry && google.maps.geometry.encoding) {
                        const pathDecodificado = google.maps.geometry.encoding.decodePath(encodedPolyline);
                        
                        const nuevaPolyline = new google.maps.Polyline({
                            path: pathDecodificado,
                            geodesic: true,
                            strokeColor: colorPolilinea,
                            strokeOpacity: 0.9,
                            strokeWeight: 5,
                            map: mapaTarget
                        });

                        coleccionPolilineasActivas.push(nuevaPolyline);
                        trazadoExitoso = true;
                        console.log(`✅ [MAPA_RUTAS_OK]: Trayecto aislado para Zona [${keyZona}] dibujado en color ${colorPolilinea}.`);
                    }
                }
            } catch (err) {
                console.warn(`⚠️ [MAPA_RUTAS_FALLBACK]: computeRoutes no completado para zona ${keyZona}, usando fallback:`, err.message);
            }
        }

        // Fallback secundario directo por coordenadas locales para garantizar separación visual
        if (!trazadoExitoso && mapaTarget) {
            const pathPuntos = paradasDeEstaZona
                .map(p => {
                    const lat = parseFloat(p.lat);
                    const lng = parseFloat(p.lng);
                    return (!isNaN(lat) && !isNaN(lng)) ? new google.maps.LatLng(lat, lng) : null;
                })
                .filter(p => p !== null);

            if (pathPuntos.length >= 2) {
                const polyDirecta = new google.maps.Polyline({
                    path: pathPuntos,
                    geodesic: true,
                    strokeColor: colorPolilinea,
                    strokeOpacity: 0.85,
                    strokeWeight: 5,
                    map: mapaTarget
                });

                coleccionPolilineasActivas.push(polyDirecta);
                console.log(`✅ [MAPA_RUTAS_OK]: Trayecto directo trazado para Zona [${keyZona}] (${pathPuntos.length} puntos).`);
            }
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

// Global Bindings
window.trazarPolilineaRuta = trazarPolilineaRuta;
window.trazarRutaPorZonaAislada = trazarRutaPorZonaAislada;
window.limpiarRutaTrazada = limpiarRutaTrazada;