/**
 * PROTOCOLO MACONDO - SUBSISTEMA MAPA: SERVICIO DE TRAZADO Y RUTAS
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-rutas.js
 */

let polilineaRutaActiva = null;
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
 * Convierte un ítem de pedido a un punto reconocible por Google Maps (google.maps.LatLng o String).
 * 
 * @param {Object|string} punto - Objeto con lat/lng o string de dirección
 * @returns {google.maps.LatLng|string} Punto formateado
 */
function normalizarPuntoUbicacion(punto) {
    if (!punto) return "Cali, Colombia";

    // Si ya es un objeto LatLng
    if (punto instanceof google.maps.LatLng) return punto;

    // Si contiene coordenadas numéricas lat y lng
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
 * Limpia el trazado actual de rutas en el mapa (Polilínea o DirectionsRenderer).
 */
export function limpiarRutaTrazada() {
    if (polilineaRutaActiva) {
        polilineaRutaActiva.setMap(null);
        polilineaRutaActiva = null;
    }
    if (directionsRendererActivo) {
        directionsRendererActivo.setMap(null);
        directionsRendererActivo = null;
    }
    if (window.renderRutasMensajero && typeof window.renderRutasMensajero.setDirections === "function") {
        try {
            window.renderRutasMensajero.setDirections({ routes: [] });
        } catch (e) {
            // Silencioso en caso de desacople
        }
    }
}

/**
 * Traza la polilínea óptima en el mapa utilizando la API moderna de Routes (computeRoutes)
 * con fallback transparente a DirectionsService.
 * 
 * @param {Array<Object>} listaPedidos - Arreglo de pedidos o paradas
 * @param {google.maps.Map} [mapaInstancia] - Instancia opcional del mapa de Google
 */
export async function trazarPolilineaRuta(listaPedidos, mapaInstancia = null) {
    const mapaTarget = mapaInstancia || window.mapaVisorInstancia || (window.renderRutasMensajero && window.renderRutasMensajero.getMap());

    if (!listaPedidos || !Array.isArray(listaPedidos) || listaPedidos.length < 1) {
        console.warn("⚠️ [MAPA_RUTAS]: Se requiere al menos un punto para trazar la ruta.");
        limpiarRutaTrazada();
        return;
    }

    // Limpiar capas anteriores
    limpiarRutaTrazada();

    const puntosNormalizados = listaPedidos.map(p => normalizarPuntoUbicacion(p));
    
    // Si solo hay un punto, centramos y no calculamos ruta
    if (puntosNormalizados.length === 1) {
        console.log("📍 [MAPA_RUTAS]: Solo existe 1 parada. Sin necesidad de calcular polilínea inter-puntos.");
        return;
    }

    const origen = puntosNormalizados[0];
    const destino = puntosNormalizados[puntosNormalizados.length - 1];
    const intermediarios = puntosNormalizados.length > 2 ? puntosNormalizados.slice(1, -1) : [];

    // --- OPCIÓN 1: API MODERNA (google.maps.routes.Route.computeRoutes) ---
    if (google.maps.routes && google.maps.routes.Route && typeof google.maps.routes.Route.computeRoutes === "function" && mapaTarget) {
        try {
            console.log("🧭 [MAPA_RUTAS]: Intentando trazado mediante google.maps.routes.Route.computeRoutes...");

            const formatearLatLng = (p) => {
                if (p instanceof google.maps.LatLng) {
                    return { latLng: { latitude: p.lat(), longitude: p.lng() } };
                }
                return { address: p };
            };

            const request = {
                origin: { location: formatearLatLng(origen) },
                destination: { location: formatearLatLng(destino) },
                travelMode: "TWO_WHEELER", // Modo ideal para mensajería y domicilios
                intermediates: intermediarios.map(i => ({ location: formatearLatLng(i) }))
            };

            const response = await google.maps.routes.Route.computeRoutes(request);

            if (response && response.routes && response.routes[0] && response.routes[0].polyline) {
                const encodedPolyline = response.routes[0].polyline.encodedPolyline;
                
                if (google.maps.geometry && google.maps.geometry.encoding) {
                    const pathDecodificado = google.maps.geometry.encoding.decodePath(encodedPolyline);
                    
                    polilineaRutaActiva = new google.maps.Polyline({
                        path: pathDecodificado,
                        geodesic: true,
                        strokeColor: "#00E5FF",
                        strokeOpacity: 0.85,
                        strokeWeight: 5,
                        map: mapaTarget
                    });

                    console.log("✅ [MAPA_RUTAS_OK]: Polilínea trazada exitosamente con computeRoutes.");
                    return;
                }
            }
        } catch (err) {
            console.warn("⚠️ [MAPA_RUTAS_FALLBACK]: No se pudo usar computeRoutes, conmutando a DirectionsService:", err.message);
        }
    }

    // --- OPCIÓN 2: FALLBACK LEGACY (DirectionsService) ---
    if (!google.maps.DirectionsService) {
        console.error("❌ [MAPA_RUTAS_ERROR]: google.maps.DirectionsService no se encuentra cargado.");
        return;
    }

    try {
        console.log("🧭 [MAPA_RUTAS]: Ejecutando trazado con DirectionsService...");
        const servicioDirecciones = new google.maps.DirectionsService();

        const waypointsFormatted = intermediarios.map(loc => ({
            location: loc,
            stopover: true
        }));

        const requestLegacy = {
            origin: origen,
            destination: destino,
            waypoints: waypointsFormatted,
            optimizeWaypoints: false,
            travelMode: google.maps.TravelMode.DRIVING
        };

        servicioDirecciones.route(requestLegacy, (response, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                if (window.renderRutasMensajero) {
                    window.renderRutasMensajero.setDirections(response);
                } else if (mapaTarget) {
                    directionsRendererActivo = new google.maps.DirectionsRenderer({
                        map: mapaTarget,
                        suppressMarkers: true,
                        polylineOptions: {
                            strokeColor: "#00E5FF",
                            strokeOpacity: 0.85,
                            strokeWeight: 5
                        }
                    });
                    directionsRendererActivo.setDirections(response);
                }
                console.log("✅ [MAPA_RUTAS_OK]: Ruta trazada correctamente con DirectionsService.");
            } else {
                console.warn("⚠️ [MAPA_RUTAS_WARN]: DirectionsService devolvió estado no OK:", status);
            }
        });
    } catch (e) {
        console.error("❌ [ENRUTAMIENTO_MENSAJERO_ERROR]: Fallo crítico al trazar la polilínea:", e);
    }
}