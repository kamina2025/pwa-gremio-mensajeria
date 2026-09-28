/**
 * PROTOCOLO MACONDO - SUBSISTEMA MAPA: TRAZADO ANIMADO SIN SOLAPAMIENTO DE TRAMOS
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-rutas.js
 * Arquitectura: Google Maps JavaScript API / Directions API / rAF Animation / Cyberpunk Dark Mode
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

// Cache local de polílineas y control de animación rAF
let coleccionPolilineasActivas = [];
let polylineVialNavegacion = null;

let polilineasCache = {
    tramoActivo: null,
    tramosFaltantes: [],
    tramosIntergrupales: []
};

let animacionEspiralId = null;
let offsetEspiralActual = 0;

// Instancias y estados globales de navegación interna
if (typeof window !== "undefined") {
    window.directionsServicePWA = window.directionsServicePWA || null;
    window.paradaObjetivoNavegacion = window.paradaObjetivoNavegacion || null;
    window.rutaNavegacionPuntosActiva = window.rutaNavegacionPuntosActiva || [];

    if (!window.__POLILINEAS_CLUSTERS__) {
        window.__POLILINEAS_CLUSTERS__ = [];
    }
}

/**
 * Detiene el bucle de animación rAF de la espiral neón.
 */
function detenerAnimacionEspiral() {
    if (animacionEspiralId) {
        cancelAnimationFrame(animacionEspiralId);
        animacionEspiralId = null;
    }
}

/**
 * Inicia la animación fluida estilo "Barber Pole" (Poste de Barbería) a lo largo de la Polyline.
 * @param {google.maps.Polyline} polylineActiva 
 */
function iniciarAnimacionEspiralRuta(polylineActiva) {
    detenerAnimacionEspiral();

    function pasoAnimacion() {
        if (!polylineActiva || !polylineActiva.getMap()) {
            detenerAnimacionEspiral();
            return;
        }

        // Avance suave a velocidad controlada (0.25% por cuadro)
        offsetEspiralActual = (offsetEspiralActual + 0.25) % 100;

        const iconConfig = polylineActiva.get("icons");
        if (iconConfig && iconConfig[0]) {
            iconConfig[0].offset = offsetEspiralActual + "%";
            polylineActiva.set("icons", iconConfig);
        }

        animacionEspiralId = requestAnimationFrame(pasoAnimacion);
    }

    animacionEspiralId = requestAnimationFrame(pasoAnimacion);
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
 * Extrae y valida un objeto google.maps.LatLng desde cualquier estructura de datos de parada.
 * @param {Object} punto 
 * @returns {google.maps.LatLng|null}
 */
function extraerLatLngValido(punto) {
    if (!punto) return null;
    if (typeof google !== "undefined" && google.maps && punto instanceof google.maps.LatLng) {
        return punto;
    }

    const rawLat = punto.lat ?? punto.latitud ?? (punto.coordenadas && punto.coordenadas.lat) ?? (punto.ubicacion && punto.ubicacion.lat) ?? (punto.centroide && punto.centroide.lat);
    const rawLng = punto.lng ?? punto.longitud ?? (punto.coordenadas && punto.coordenadas.lng) ?? (punto.ubicacion && punto.ubicacion.lng) ?? (punto.centroide && punto.centroide.lng);

    if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) return null;

    const lat = parseFloat(String(rawLat).replace(',', '.'));
    const lng = parseFloat(String(rawLng).replace(',', '.'));

    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && typeof google !== "undefined" && google.maps) {
        return new google.maps.LatLng(lat, lng);
    }

    return null;
}

/**
 * Limpia el trazado de polílineas, bucles de animación y trazados viales previos.
 */
export function limpiarRutaTrazada() {
    detenerAnimacionEspiral();

    console.log("🧹 [MAPA_RUTAS]: Limpiando minirutas, animaciones espirales y polílineas previas...");

    // 1. Limpiar caché de trazados dinámicos
    if (polilineasCache.tramoActivo) {
        if (typeof polilineasCache.tramoActivo.setMap === "function") polilineasCache.tramoActivo.setMap(null);
        polilineasCache.tramoActivo = null;
    }

    if (polylineVialNavegacion) {
        if (typeof polylineVialNavegacion.setMap === "function") polylineVialNavegacion.setMap(null);
        polylineVialNavegacion = null;
    }

    polilineasCache.tramosFaltantes.forEach(p => {
        if (p && typeof p.setMap === "function") p.setMap(null);
    });
    polilineasCache.tramosFaltantes = [];

    polilineasCache.tramosIntergrupales.forEach(p => {
        if (p && typeof p.setMap === "function") p.setMap(null);
    });
    polilineasCache.tramosIntergrupales = [];

    // 2. Limpiar colección local por clúster
    if (Array.isArray(coleccionPolilineasActivas)) {
        coleccionPolilineasActivas.forEach(poly => {
            if (poly && typeof poly.setMap === "function") poly.setMap(null);
        });
        coleccionPolilineasActivas = [];
    }

    // 3. Limpiar colección global
    if (typeof window !== "undefined" && Array.isArray(window.__POLILINEAS_CLUSTERS__)) {
        window.__POLILINEAS_CLUSTERS__.forEach(poly => {
            if (poly && typeof poly.setMap === "function") poly.setMap(null);
        });
        window.__POLILINEAS_CLUSTERS__ = [];
    }

    if (typeof window !== "undefined" && window.directionsRendererPWA) {
        window.directionsRendererPWA.setMap(null);
    }
}

/**
 * Renderiza dinámicamente los trazados diferenciados por estado y grupos:
 * - Tramo activo: Cyan (#00e5ff) con franjas en espiral "Barber Pole" animadas.
 * - Tramos faltantes: Amarillo (#ffb300) con franjas estáticas (excluyendo el tramo activo actual).
 * - Tramos inter-grupales: Morado (#d2a8ff) conector entre bloques.
 * 
 * @param {google.maps.Map} mapaInstancia 
 * @param {{lat: number, lng: number}|null} posUbicacionMensajero 
 * @param {Array<Array<Object>>} listaGruposParadas 
 * @param {Object|null} paradaSeleccionada 
 */
export function dibujarTrazadosSecuenciales(mapaInstancia, posUbicacionMensajero, listaGruposParadas = [], paradaSeleccionada = null) {
    if (!mapaInstancia || typeof google === "undefined" || !google.maps) return;

    limpiarRutaTrazada();

    console.group("🌀 [MAPA_RUTAS]: Dibujando trazados dinámicos efecto Barber Pole...");

    const esParadaFinalizada = paradaSeleccionada && (paradaSeleccionada.completada || paradaSeleccionada.entregado || paradaSeleccionada.estado === "completado");
    const tieneNavegacionVialActiva = Array.isArray(window.rutaNavegacionPuntosActiva) && window.rutaNavegacionPuntosActiva.length > 0;

    // 1. DIBUJAR TRAMO ACTIVO DIRECTO SOLO SI NO HAY RUTA VIAL POR CALLES EN CURSO
    if (posUbicacionMensajero && paradaSeleccionada && !esParadaFinalizada && !tieneNavegacionVialActiva) {
        const destLatLng = extraerLatLngValido(paradaSeleccionada);

        if (destLatLng) {
            const rutaActivaCoords = [
                new google.maps.LatLng(posUbicacionMensajero.lat, posUbicacionMensajero.lng),
                destLatLng
            ];

            const simboloBarberPoleAnimado = {
                path: "M -3,-6 L 3,6",
                strokeColor: "#00e5ff",
                strokeOpacity: 1,
                strokeWeight: 4,
                scale: 1.5
            };

            polilineasCache.tramoActivo = new google.maps.Polyline({
                path: rutaActivaCoords,
                geodesic: true,
                strokeColor: "#00e5ff",
                strokeOpacity: 0.3,
                strokeWeight: 7,
                icons: [{
                    icon: simboloBarberPoleAnimado,
                    offset: "0%",
                    repeat: "12px"
                }],
                zIndex: 99999,
                map: mapaInstancia
            });

            iniciarAnimacionEspiralRuta(polilineasCache.tramoActivo);
            console.log(`⚡ [TRAMO_ACTIVO_OK]: Azul Cyan (#00e5ff) estilo Barber Pole animado -> Parada: ${paradaSeleccionada.id || paradaSeleccionada.ssc}`);
        }
    } else if (tieneNavegacionVialActiva) {
        console.log(`⚡ [TRAMO_ACTIVO_OK]: Ruta navegable activa por calles reales en Azul Cyan (#00e5ff). Omitiendo traza geodésica secundaria.`);
    }

    // 2. DIBUJAR TRAMOS FALTANTES EN AMARILLO (#ffb300) SIN SOLAPAR CON EL TRAMO ACTIVO
    const simboloBarberPoleEstatico = {
        path: "M -3,-6 L 3,6",
        strokeColor: "#ffb300",
        strokeOpacity: 1,
        strokeWeight: 3,
        scale: 1.3
    };

    const targetParadaActivaId = paradaSeleccionada ? (paradaSeleccionada.id || paradaSeleccionada.ssc) : null;

    for (let gIdx = 0; gIdx < listaGruposParadas.length; gIdx++) {
        const grupoActual = listaGruposParadas[gIdx] || [];
        const paradasFaltantes = grupoActual.filter(p => p && !p.completada && !p.entregado && p.estado !== "completado");

        for (let i = 0; i < paradasFaltantes.length - 1; i++) {
            const pA = paradasFaltantes[i];
            const pB = paradasFaltantes[i + 1];

            const idA = pA ? (pA.id || pA.ssc) : null;
            const idB = pB ? (pB.id || pB.ssc) : null;

            // Omitir trazado amarillo si coincide con el origen-destino del tramo activo en navegación GPS
            if (tieneNavegacionVialActiva && targetParadaActivaId && (idA === targetParadaActivaId || idB === targetParadaActivaId)) {
                continue;
            }

            const latLngA = extraerLatLngValido(pA);
            const latLngB = extraerLatLngValido(pB);

            if (latLngA && latLngB) {
                const polyFaltante = new google.maps.Polyline({
                    path: [latLngA, latLngB],
                    geodesic: true,
                    strokeColor: "#ffb300",
                    strokeOpacity: 0.25,
                    strokeWeight: 5,
                    icons: [{
                        icon: simboloBarberPoleEstatico,
                        offset: "0",
                        repeat: "12px"
                    }],
                    map: mapaInstancia
                });
                polilineasCache.tramosFaltantes.push(polyFaltante);
            }
        }

        if (gIdx < listaGruposParadas.length - 1) {
            const grupoSiguiente = listaGruposParadas[gIdx + 1] || [];
            const ultimaParadaGrupoActual = paradasFaltantes[paradasFaltantes.length - 1] || grupoActual[grupoActual.length - 1];
            const primeraParadaGrupoSig = grupoSiguiente.find(p => p && !p.completada && !p.entregado && p.estado !== "completado") || grupoSiguiente[0];

            if (ultimaParadaGrupoActual && primeraParadaGrupoSig) {
                const latLngA = extraerLatLngValido(ultimaParadaGrupoActual);
                const latLngB = extraerLatLngValido(primeraParadaGrupoSig);

                if (latLngA && latLngB) {
                    const polyInter = new google.maps.Polyline({
                        path: [latLngA, latLngB],
                        geodesic: true,
                        strokeColor: "#d2a8ff",
                        strokeOpacity: 0.85,
                        strokeWeight: 4,
                        map: mapaInstancia
                    });
                    polilineasCache.tramosIntergrupales.push(polyInter);
                }
            }
        }
    }

    console.groupEnd();
}

/**
 * Traza las minirutas divididas en segmentos independientes según su clúster (grupoId).
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

    const targetCanonico = zonaFoco ? estandarizarZonaCanonica(zonaFoco) : null;
    const paradasFiltradas = targetCanonico
        ? listaPedidos.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico)
        : listaPedidos;

    if (paradasFiltradas.length < 2) {
        console.warn("ℹ️ [MAPA_RUTAS]: Se requieren al menos 2 paradas para dibujar minirutas.");
        return;
    }

    const clustersMap = new Map();
    paradasFiltradas.forEach((parada, idx) => {
        const grupoKey = parada.grupoId || `GRUPO-${String(Math.ceil((idx + 1) / 4)).padStart(2, "0")}`;
        if (!clustersMap.has(grupoKey)) {
            clustersMap.set(grupoKey, []);
        }
        clustersMap.get(grupoKey).push(parada);
    });

    console.group(`KM [MAPA_RUTAS]: Procesando ${clustersMap.size} minirutas por clúster ${targetCanonico ? `[Foco: ${targetCanonico}]` : ''}`);

    let colorIndex = 0;

    clustersMap.forEach((paradasGrupo, grupoId) => {
        paradasGrupo.sort((a, b) => {
            const seqA = parseInt(a.secuenciaZona || a.secuencia || a.orden || 0, 10);
            const seqB = parseInt(b.secuenciaZona || b.secuencia || b.orden || 0, 10);
            return seqA - seqB;
        });

        const pathPuntos = paradasGrupo
            .map(p => extraerLatLngValido(p))
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
 * Traza la ruta navegable por calles reales con animación suave estilo "Barber Pole".
 * Dibuja EXCLUSIVAMENTE en Azul Cyan (#00e5ff) sin solapamientos.
 * 
 * @param {Object} [paradaDestino] - Parada seleccionada como objetivo
 * @param {boolean} [centrarVista=true] - Mantiene o centra la cámara del usuario
 */
export async function trazarRutaNavegacionInternaGPS(paradaDestino = null, centrarVista = true) {
    const mapa = window.mapaMensajero || window.mapaInstancia || window.mapaInstanciaGlobal;
    if (!mapa || typeof google === "undefined" || !google.maps) {
        console.error("❌ [NAVEGACION_PWA]: Instancia del mapa no disponible.");
        return;
    }

    if (paradaDestino) window.paradaObjetivoNavegacion = paradaDestino;

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
    const destLatLng = extraerLatLngValido(objetivo);
    if (!destLatLng) {
        console.error("❌ [NAVEGACION_PWA]: La parada seleccionada no tiene coordenadas válidas.");
        return;
    }

    console.log(`🧭 [NAVEGACION_PWA]: Trazando viaje interno por calles en Azul Cyan (#00e5ff) -> Origen: [${origenCoords.lat.toFixed(5)}, ${origenCoords.lng.toFixed(5)}] -> Destino: [${destLatLng.lat().toFixed(5)}, ${destLatLng.lng().toFixed(5)}]`);

    // 3. Consultar servicio de rutas de Google Maps
    if (!window.directionsServicePWA) {
        window.directionsServicePWA = new google.maps.DirectionsService();
    }

    const request = {
        origin: new google.maps.LatLng(origenCoords.lat, origenCoords.lng),
        destination: destLatLng,
        travelMode: google.maps.TravelMode.DRIVING
    };

    window.directionsServicePWA.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK || status === "OK") {
            if (result.routes && result.routes[0] && result.routes[0].overview_path) {
                const pathVial = result.routes[0].overview_path;

                window.rutaNavegacionPuntosActiva = pathVial.map(pt => ({ lat: pt.lat(), lng: pt.lng() }));

                // Limpiar traza previa
                if (polylineVialNavegacion) {
                    polylineVialNavegacion.setMap(null);
                }

                // Símbolo SVG efecto Barber Pole (poste de barbería)
                const simboloBarberPoleAnimado = {
                    path: "M -3,-6 L 3,6",
                    strokeColor: "#00e5ff",
                    strokeOpacity: 1,
                    strokeWeight: 4,
                    scale: 1.5
                };

                // Crear Polyline propia animable en Cyan Neón por calles reales
                polylineVialNavegacion = new google.maps.Polyline({
                    path: pathVial,
                    geodesic: true,
                    strokeColor: "#00e5ff",
                    strokeOpacity: 0.3,
                    strokeWeight: 7,
                    icons: [{
                        icon: simboloBarberPoleAnimado,
                        offset: "0%",
                        repeat: "12px"
                    }],
                    zIndex: 99999,
                    map: mapa
                });

                // Activar animación suave estilo Barber Pole
                iniciarAnimacionEspiralRuta(polylineVialNavegacion);

                if (centrarVista) {
                    const bounds = new google.maps.LatLngBounds();
                    pathVial.forEach(pt => bounds.extend(pt));
                    mapa.fitBounds(bounds);
                }

                console.log(`🌀 [NAVEGACION_PWA]: Traza vial en Cyan (#00e5ff) con animación Barber Pole desplegada (${pathVial.length} puntos).`);
                mostrarBotonLimpiarRutaNavegacion();
            }
        } else {
            console.error("❌ [NAVEGACION_PWA]: Fallo al calcular la ruta de viaje por calles:", status);
        }
    });
}

/**
 * Limpia la línea de navegación activa del mapa PWA y cancela la animación.
 */
export function limpiarRutaNavegacionGPS() {
    detenerAnimacionEspiral();
    window.paradaObjetivoNavegacion = null;
    window.rutaNavegacionPuntosActiva = [];

    if (polylineVialNavegacion) {
        polylineVialNavegacion.setMap(null);
        polylineVialNavegacion = null;
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
    window.dibujarTrazadosSecuenciales = dibujarTrazadosSecuenciales;
    window.limpiarPolilineasRuta = limpiarRutaTrazada;
    window.trazarPolilineaRuta = trazarPolilineaRuta;
    window.trazarRutaPorZonaAislada = trazarRutaPorZonaAislada;
    window.trazarRutaNavegacionInternaGPS = trazarRutaNavegacionInternaGPS;
    window.limpiarRutaNavegacionGPS = limpiarRutaNavegacionGPS;
    window.limpiarRutaTrazada = limpiarRutaTrazada;
    window.limpiarPolilineasMapa = limpiarRutaTrazada;
}