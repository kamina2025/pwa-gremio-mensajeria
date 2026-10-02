/**
 * PROTOCOLO MACONDO - SUBSISTEMA MAPA: SERVICIO DE TRAZADO, MINIRUTAS Y NAVEGACIÓN GPS INTRAMURAL
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-rutas.js
 * Arquitectura: Google Maps JavaScript API / OSRM Routing Client / Local-First / $0.00 COP
 */

import { PALETA_ZONAS } from "./zonificacion/mensajero-zonificacion.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "./zonificacion/estandar-zonas.js";

// Paleta Cyberpunk Neón para diferenciar visualmente cada clúster / grupo
const PALETA_COLORES_CLUSTERS = [
    "#00E5FF", // Cyan Neón (GRUPO-01)
    "#00FF66", // Verde Neón (GRUPO-02)
    "#FFB300", // Amarillo/Ámbar Neón (GRUPO-03)
    "#FF3366", // Magenta/Rosa Neón (GRUPO-04)
    "#9D00FF", // Púrpura Neón (GRUPO-05)
    "#FF6600"  // Naranja Neón (GRUPO-06)
];

const COLOR_CONECTOR_INTERGRUPAL = "#d2a8ff"; // Morado para enlaces entre clústeres

// Cache local de polilíneas y estados
let coleccionPolilineasActivas = [];
let polylineVialNavegacion = null;
let animacionPasoId = null;
let offsetBarberPoleActual = 0;

let polilineasCache = {
    tramoActivo: null,
    tramosFaltantes: [],
    tramosIntergrupales: []
};

// Watchdog: Observador de Estado para Restauración Automática
let ultimaMapaInstancia = null;
let ultimaListaGruposCache = null;
let ultimoHashPendientes = "";
let navegadorActivoPrevio = false;

// Instancias y estados globales de navegación interna
if (typeof window !== "undefined") {
    window.directionsRendererPWA = window.directionsRendererPWA || null;
    window.directionsServicePWA = window.directionsServicePWA || null;
    window.paradaObjetivoNavegacion = window.paradaObjetivoNavegacion || null;
    window.rutaNavegacionPuntosActiva = window.rutaNavegacionPuntosActiva || [];

    if (!window.__POLILINEAS_CLUSTERS__) {
        window.__POLILINEAS_CLUSTERS__ = [];
    }
}

/**
 * Predicado global para evaluar estáticamente si una parada requiere enrutamiento visible.
 * @param {Object} p
 * @returns {boolean}
 */
const esParadaPendiente = (p) => {
    if (!p) return false;
    if (p.completada === true || p.completada === "true" || p.completada === 1 || p.completada === "1") return false;
    
    const estadoActual = String(p.estado || "").toLowerCase().trim();
    const estadosCerrados = ["completado", "entregado", "fallido", "novedad"];
    
    return !estadosCerrados.includes(estadoActual);
};

/**
 * Genera una huella digital determinista incorporando posición y secuencia para detectar mutaciones o reordenamientos.
 * @returns {string}
 */
function generarHashPendientesActual() {
    if (!ultimaListaGruposCache) return "";
    const pendientes = [];
    ultimaListaGruposCache.forEach(grupo => {
        pendientes.push(...(grupo || []).filter(esParadaPendiente));
    });
    return pendientes.map((p, index) => {
        const idStr = String(p.id || p.scc || p.ssc || p.direccion || "").trim();
        const seq = p.consecutivoZona || p.secuenciaZona || p.orden || index;
        return `${idStr}_${seq}_${p.estado || 'pending'}`;
    }).join("|");
}

/**
 * Detiene la animación activa del patrón de barras del tramo navegable Cyan.
 */
function detenerAnimacionBarberPole() {
    if (animacionPasoId) {
        cancelAnimationFrame(animacionPasoId);
        animacionPasoId = null;
    }
}

/**
 * Inicia el bucle de animación dinámico continuo para desplazar las barras de barbería.
 * @param {Object} polyline 
 */
function iniciarAnimacionBarberPole(polyline) {
    detenerAnimacionBarberPole();

    function pasoAnimacion() {
        if (!polyline || typeof polyline.getMap !== "function" || !polyline.getMap()) return;
        offsetBarberPoleActual = (offsetBarberPoleActual + 0.3) % 100;

        const icons = polyline.get("icons");
        if (icons && icons[0]) {
            icons[0].offset = `${offsetBarberPoleActual}%`;
            polyline.set("icons", icons);
        }
        animacionPasoId = requestAnimationFrame(pasoAnimacion);
    }
    animacionPasoId = requestAnimationFrame(pasoAnimacion);
}

/**
 * Extrae y valida un objeto google.maps.LatLng desde cualquier estructura de datos de parada.
 * @param {Object} punto 
 * @returns {google.maps.LatLng|null}
 */
function extraerLatLngValido(punto) {
    if (!punto) return null;
    if (typeof google !== "undefined" && google.maps && punto instanceof google.maps.LatLng) return punto;

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
 * Decodifica una cadena de polilínea en formato comprimido OSRM.
 * @param {string} str 
 * @param {number} precision 
 * @returns {Array<google.maps.LatLng>}
 */
function decodificarPolylineOSRM(str, precision = 5) {
    let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null;
    const factor = Math.pow(10, precision);

    while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;

        shift = 0; result = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += deltaLng;

        if (typeof google !== "undefined" && google.maps) {
            coordinates.push(new google.maps.LatLng(lat / factor, lng / factor));
        }
    }
    return coordinates;
}

/**
 * Retorna la ruta por vías reales llamando al API público OSRM ($0.00 COP) sin tocar GCP.
 * @param {google.maps.LatLng} origen 
 * @param {google.maps.LatLng} destino 
 * @returns {Promise<Array<google.maps.LatLng>>}
 */
async function obtenerPuntosRutaCalle(origen, destino) {
    if (!origen || !destino) return [];

    const latA = origen.lat();
    const lngA = origen.lng();
    const latB = destino.lat();
    const lngB = destino.lng();

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lngA},${latA};${lngB},${latB}?overview=full&geometries=polyline`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP Error OSRM: ${resp.status}`);

        const data = await resp.json();
        if (data.routes && data.routes.length > 0 && data.routes[0].geometry) {
            const puntosViales = decodificarPolylineOSRM(data.routes[0].geometry);
            if (puntosViales.length > 0) return puntosViales;
        }
    } catch (err) {
        console.warn("⚠️ [MAPA_RUTAS_OSRM]: Error consultando OSRM. Recurriendo a fallback vectorial directo local:", err);
    }

    // Fallback Local-First si falla la red o el servicio OSRM
    return [origen, destino];
}

/**
 * Limpia únicamente la ruta Cyan de navegación GPS y resetea las variables de objetivo.
 */
export function limpiarRutaNavegacionGPS() {
    detenerAnimacionBarberPole();
    window.paradaObjetivoNavegacion = null;
    window.rutaNavegacionPuntosActiva = [];

    if (polylineVialNavegacion) {
        if (typeof polylineVialNavegacion.setMap === "function") polylineVialNavegacion.setMap(null);
        polylineVialNavegacion = null;
    }

    const btnLimpiar = document.getElementById("btn-limpiar-navegacion-pwa");
    if (btnLimpiar) btnLimpiar.remove();
}

/**
 * Limpia EXCLUSIVAMENTE los tramos estáticos del mapa. No destruye la navegación GPS Cyan.
 */
export function limpiarRutaTrazada() {
    if (polilineasCache.tramoActivo) {
        if (typeof polilineasCache.tramoActivo.setMap === "function") polilineasCache.tramoActivo.setMap(null);
        polilineasCache.tramoActivo = null;
    }

    polilineasCache.tramosFaltantes.forEach(p => {
        if (p && typeof p.setMap === "function") p.setMap(null);
    });
    polilineasCache.tramosFaltantes = [];

    polilineasCache.tramosIntergrupales.forEach(p => {
        if (p && typeof p.setMap === "function") p.setMap(null);
    });
    polilineasCache.tramosIntergrupales = [];

    if (Array.isArray(coleccionPolilineasActivas)) {
        coleccionPolilineasActivas.forEach(poly => {
            if (poly && typeof poly.setMap === "function") poly.setMap(null);
        });
        coleccionPolilineasActivas = [];
    }

    if (typeof window !== "undefined" && Array.isArray(window.__POLILINEAS_CLUSTERS__)) {
        window.__POLILINEAS_CLUSTERS__.forEach(poly => {
            if (poly && typeof poly.setMap === "function") poly.setMap(null);
        });
        window.__POLILINEAS_CLUSTERS__ = [];
    }
}

/**
 * Renderiza dinámicamente los trazados conectando linealmente los nodos pendientes y el ancla.
 * Modo Local-First / Vectorial Neón instantáneo.
 * 
 * @param {Object} mapaInstancia 
 * @param {Object|null} posUbicacionMensajero 
 * @param {Array<Array<Object>>} listaGruposParadas 
 * @param {Object|null} paradaSeleccionada 
 */
export async function dibujarTrazadosSecuenciales(mapaInstancia, posUbicacionMensajero, listaGruposParadas = [], paradaSeleccionada = null) {
    if (!mapaInstancia || typeof google === "undefined" || !google.maps) return;

    limpiarRutaTrazada();

    // Proteger Caché para el Watchdog
    if (listaGruposParadas && listaGruposParadas.length > 0) {
        ultimaMapaInstancia = mapaInstancia;
        ultimaListaGruposCache = listaGruposParadas;
        ultimoHashPendientes = generarHashPendientesActual();
    } else {
        return; 
    }

    console.group("🌀 [MAPA_RUTAS]: Trazando rutas viales contiguas (Local-First Vectorial $0.00 COP)...");

    const nodosPendientesLineales = [];

    // 1. Extraer todas las paradas pendientes en orden
    for (let gIdx = 0; gIdx < listaGruposParadas.length; gIdx++) {
        const paradasPendientesEnGrupo = (listaGruposParadas[gIdx] || []).filter(esParadaPendiente);
        paradasPendientesEnGrupo.forEach(parada => {
            nodosPendientesLineales.push({ parada: parada, grupoIndex: gIdx });
        });
    }

    // 2. Anclar el inicio de la ruta a la posición actual
    if (nodosPendientesLineales.length > 0) {
        let anclaOrigen = null;
        let indexGrupoAncla = nodosPendientesLineales[0].grupoIndex;

        if (posUbicacionMensajero && posUbicacionMensajero.lat && posUbicacionMensajero.lng) {
            anclaOrigen = new google.maps.LatLng(posUbicacionMensajero.lat, posUbicacionMensajero.lng);
        } else {
            let ultimaCompletada = null;
            for (let gIdx = listaGruposParadas.length - 1; gIdx >= 0; gIdx--) {
                const grupo = listaGruposParadas[gIdx] || [];
                for (let i = grupo.length - 1; i >= 0; i--) {
                    if (!esParadaPendiente(grupo[i])) {
                        ultimaCompletada = grupo[i];
                        break;
                    }
                }
                if (ultimaCompletada) break;
            }
            if (ultimaCompletada) {
                anclaOrigen = extraerLatLngValido(ultimaCompletada);
            }
        }

        if (anclaOrigen) {
            const latLngPrimerNodo = extraerLatLngValido(nodosPendientesLineales[0].parada);
            if (latLngPrimerNodo) {
                const diffLat = Math.abs(anclaOrigen.lat() - latLngPrimerNodo.lat());
                const diffLng = Math.abs(anclaOrigen.lng() - latLngPrimerNodo.lng());
                
                if (diffLat > 0.0001 || diffLng > 0.0001) {
                    nodosPendientesLineales.unshift({
                        parada: anclaOrigen,
                        grupoIndex: indexGrupoAncla
                    });
                }
            }
        }
    }

    // 3. Dibujar vectores entre nodos sucesivos
    let trazadosDesplegados = 0;
    for (let i = 0; i < nodosPendientesLineales.length - 1; i++) {
        const nodoOrigen = nodosPendientesLineales[i];
        const nodoDestino = nodosPendientesLineales[i + 1];

        const latLngA = extraerLatLngValido(nodoOrigen.parada);
        const latLngB = extraerLatLngValido(nodoDestino.parada);

        if (latLngA && latLngB) {
            const esMismoGrupo = nodoOrigen.grupoIndex === nodoDestino.grupoIndex;
            const colorTramo = esMismoGrupo ? "#ffb300" : COLOR_CONECTOR_INTERGRUPAL;
            const opacidadTramo = esMismoGrupo ? 0.35 : 0.45;

            const simboloBarberPoleEstatico = {
                path: "M -3,-6 L 3,6",
                strokeColor: colorTramo,
                strokeOpacity: 0.8,
                strokeWeight: 3,
                scale: 1.4
            };

            const pathCalle = [latLngA, latLngB];
            const polyTramo = new google.maps.Polyline({
                path: pathCalle,
                geodesic: true,
                strokeColor: colorTramo,
                strokeOpacity: opacidadTramo,
                strokeWeight: 5,
                icons: [{
                    icon: simboloBarberPoleEstatico,
                    offset: "0",
                    repeat: "12px"
                }],
                zIndex: esMismoGrupo ? 900 : 950,
                map: mapaInstancia
            });
            
            if (esMismoGrupo) {
                polilineasCache.tramosFaltantes.push(polyTramo);
            } else {
                polilineasCache.tramosIntergrupales.push(polyTramo);
            }
            trazadosDesplegados++;
        }
    }

    console.log(`✅ [MAPA_RUTAS]: ${trazadosDesplegados} segmentos atenuados desplegados exitosamente.`);
    console.groupEnd();
}

/**
 * Traza las minirutas por clúster sobre el visor del mapa.
 * @param {Array<Object>} listaPedidos 
 * @param {string|null} [zonaFoco=null] 
 * @param {Object|null} [mapaInstancia=null] 
 */
export async function trazarPolilineaRuta(listaPedidos, zonaFoco = null, mapaInstancia = null) {
    const mapaTarget = mapaInstancia || (typeof window !== "undefined" && (window.mapaVisorInstancia || window.mapaMensajero || window.mapaInstanciaGlobal || (window.renderRutasMensajero && window.renderRutasMensajero.getMap())));

    if (!listaPedidos || !Array.isArray(listaPedidos) || listaPedidos.length < 1) {
        limpiarRutaTrazada();
        return;
    }
    if (!mapaTarget || typeof google === "undefined" || !google.maps) return;

    const targetCanonico = zonaFoco ? estandarizarZonaCanonica(zonaFoco) : null;
    const paradasFiltradas = targetCanonico ? listaPedidos.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico) : listaPedidos;

    if (paradasFiltradas.length < 2) return;

    const clustersMap = new Map();
    paradasFiltradas.forEach((parada, idx) => {
        const grupoKey = parada.grupoId || `GRUPO-${String(Math.ceil((idx + 1) / 4)).padStart(2, "0")}`;
        if (!clustersMap.has(grupoKey)) clustersMap.set(grupoKey, []);
        clustersMap.get(grupoKey).push(parada);
    });

    const listaGruposOrdenados = Array.from(clustersMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([_, paradas]) => {
            return paradas.sort((a, b) => {
                const seqA = parseInt(a.secuenciaZona || a.secuencia || a.orden || 0, 10);
                const seqB = parseInt(b.secuenciaZona || b.secuencia || b.orden || 0, 10);
                return seqA - seqB;
            });
        });

    const posMensajero = window.posicionActualMensajero || null;
    const paradaTarget = window.paradaObjetivoNavegacion || paradasFiltradas.find(esParadaPendiente) || paradasFiltradas[0];

    await dibujarTrazadosSecuenciales(mapaTarget, posMensajero, listaGruposOrdenados, paradaTarget);
}

/**
 * Traza la ruta navegable por calles reales en Azul Cyan (#00e5ff) aislando temporalmente las estáticas.
 * @param {Object|null} [paradaDestino=null] 
 * @param {boolean} [centrarVista=true] 
 */
export async function trazarRutaNavegacionInternaGPS(paradaDestino = null, centrarVista = true) {
    const mapa = window.mapaMensajero || window.mapaInstancia || window.mapaInstanciaGlobal;
    if (!mapa || typeof google === "undefined" || !google.maps) return;

    limpiarRutaTrazada(); // Se ocultan intencionalmente los conectores estáticos para priorizar la navegación.

    if (paradaDestino) window.paradaObjetivoNavegacion = paradaDestino;
    const objetivo = window.paradaObjetivoNavegacion;
    if (!objetivo) return;

    let origenCoords = window.posicionActualMensajero;
    if (!origenCoords || !origenCoords.lat || !origenCoords.lng) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    window.posicionActualMensajero = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    trazarRutaNavegacionInternaGPS(objetivo, centrarVista);
                },
                (err) => {}, { enableHighAccuracy: true, timeout: 8000 }
            );
            return;
        }
    }

    const destLatLng = extraerLatLngValido(objetivo);
    if (!destLatLng) return;

    const origenLatLng = new google.maps.LatLng(origenCoords.lat, origenCoords.lng);
    
    // Obtener trazado por calles reales ($0.00 COP)
    const pathVial = await obtenerPuntosRutaCalle(origenLatLng, destLatLng);

    if (pathVial && pathVial.length > 0) {
        window.rutaNavegacionPuntosActiva = pathVial.map(pt => ({ lat: pt.lat(), lng: pt.lng() }));

        if (polylineVialNavegacion) polylineVialNavegacion.setMap(null);

        const simboloBarberPoleAnimado = {
            path: "M -3,-6 L 3,6",
            strokeColor: "#00e5ff",
            strokeOpacity: 1,
            strokeWeight: 4,
            scale: 1.5
        };

        polylineVialNavegacion = new google.maps.Polyline({
            path: pathVial,
            geodesic: true,
            strokeColor: "#00e5ff",
            strokeOpacity: 0.9,
            strokeWeight: 7,
            icons: [{ icon: simboloBarberPoleAnimado, offset: "0%", repeat: "12px" }],
            zIndex: 99999,
            map: mapa
        });

        iniciarAnimacionBarberPole(polylineVialNavegacion);

        if (centrarVista) {
            const bounds = new google.maps.LatLngBounds();
            pathVial.forEach(pt => bounds.extend(pt));
            mapa.fitBounds(bounds);
        }
    }
}

/**
 * WATCHDOG PRINCIPAL: Bucle silencioso que evalúa llegadas y cambios de estado/secuencia de marcadores
 * para auto-restaurar la red de polílineas.
 */
if (typeof window !== "undefined") {
    setInterval(() => {
        if (!ultimaMapaInstancia || !ultimaListaGruposCache) return;

        const estaNavegando = !!window.paradaObjetivoNavegacion || !!polylineVialNavegacion;
        const hashActual = generarHashPendientesActual();

        // Escenario A: El GPS ha llegado/limpiado, restauramos toda la grilla de tramos.
        if (navegadorActivoPrevio && !estaNavegando) {
            console.log("♻️ [MAPA_RUTAS]: Navegación finalizada. Restaurando red atenuada...");
            ultimoHashPendientes = hashActual;
            dibujarTrazadosSecuenciales(ultimaMapaInstancia, window.posicionActualMensajero || null, ultimaListaGruposCache);
        } 
        // Escenario B: Modal o Reordenamiento modificó el estado o secuencia, la red atenuada se re-conecta automáticamente.
        else if (!estaNavegando && hashActual !== ultimoHashPendientes) {
            console.log("♻️ [MAPA_RUTAS]: Cambio de estado/secuencia detectado. Re-calculando ruta...");
            ultimoHashPendientes = hashActual;
            dibujarTrazadosSecuenciales(ultimaMapaInstancia, window.posicionActualMensajero || null, ultimaListaGruposCache);
        }

        navegadorActivoPrevio = estaNavegando;
    }, 1500); // Intervalo de auditoría cada 1.5s
}

/**
 * Alias de compatibilidad global.
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