/**
 * PROTOCOLO MACONDO - SUBSISTEMA GPS, TELEMETRÍA Y SIMULADOR TÁCTICO
 * Ubicación: pwa-mensajero/modulos/mapa/gps/mapa-gps.js
 * Arquitectura: Telemetría GPS / Interpolación rAF / Auto-Rerouting / Local-First ($0.00 COP)
 */

import { trazarRutaNavegacionInternaGPS, dibujarTrazadosSecuenciales, limpiarRutaNavegacionGPS } from "../mapa-rutas.js";
import { obtenerCoordenadasValidasParada } from "../utils/mapa-coordenadas.js";
import { obtenerUltimoEstadoNavegacion } from "../../db/indexed-store.js";

let watcherGpsId = null;
let marcadorGpsMensajero = null;
let animacionGpsFrameId = null;
let ultimoRecalculoRutaTime = 0;
let ultimaDistanciaNotificada = Infinity;

/**
 * Emite una alerta auditiva mediante la SpeechSynthesis API.
 * @param {string} texto - Mensaje a reproducir por voz
 */
export function hablarAlertaGps(texto) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    try {
        window.speechSynthesis.cancel(); // Cancelar locuciones anteriores
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = "es-CO";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
        console.log(`🔊 [GUÍA_VOZ]: Locución emitida -> "${texto}"`);
    } catch (e) {
        console.warn("⚠️ [GUÍA_VOZ]: No se pudo reproducir la alerta por voz:", e);
    }
}

/**
 * Calcula la distancia geodésica en metros entre dos coordenadas mediante la fórmula Haversine.
 */
function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Anima el marcador GPS suavemente entre dos coordenadas mediante interpolación lineal (rAF).
 * @param {number} destinoLat 
 * @param {number} destinoLng 
 */
function animarMovimientoMarcadorGps(destinoLat, destinoLng) {
    if (!marcadorGpsMensajero || typeof google === "undefined" || !google.maps) return;

    const posOrigen = marcadorGpsMensajero.getPosition();
    if (!posOrigen) {
        marcadorGpsMensajero.setPosition(new google.maps.LatLng(destinoLat, destinoLng));
        return;
    }

    const origLat = typeof posOrigen.lat === "function" ? posOrigen.lat() : posOrigen.lat;
    const origLng = typeof posOrigen.lng === "function" ? posOrigen.lng() : posOrigen.lng;

    if (Math.abs(origLat - destinoLat) < 0.000001 && Math.abs(origLng - destinoLng) < 0.000001) return;

    if (animacionGpsFrameId) cancelAnimationFrame(animacionGpsFrameId);

    const duracionMs = 600;
    const inicioTime = performance.now();

    function pasoAnimacion(currentTime) {
        const transcurrido = currentTime - inicioTime;
        const progreso = Math.min(transcurrido / duracionMs, 1);

        const actualLat = origLat + (destinoLat - origLat) * progreso;
        const actualLng = origLng + (destinoLng - origLng) * progreso;

        if (marcadorGpsMensajero) {
            marcadorGpsMensajero.setPosition(new google.maps.LatLng(actualLat, actualLng));
        }

        if (progreso < 1) {
            animacionGpsFrameId = requestAnimationFrame(pasoAnimacion);
        }
    }

    animacionGpsFrameId = requestAnimationFrame(pasoAnimacion);
}

/**
 * Dibuja o actualiza la posición del marcador GPS del mensajero en tiempo real.
 * @param {number} lat 
 * @param {number} lng 
 * @param {number} [velocidad=0] - Velocidad actual en m/s
 */
export function renderizarUbicacionGpsEnMapa(lat, lng, velocidad = 0) {
    const mapa = window.mapaMensajero || window.mapaInstancia || window.mapaVisorInstancia || window.mapaInstanciaGlobal;
    if (!mapa || typeof google === "undefined" || !google.maps) {
        console.warn("⚠️ [MAPA_GPS]: Objeto mapa o Google SDK no disponible.");
        return;
    }

    const posActual = { lat, lng };
    window.posicionActualMensajero = posActual;

    if (!marcadorGpsMensajero) {
        const iconoGpsSvg = {
            path: google.maps.SymbolPath ? google.maps.SymbolPath.CIRCLE : 0,
            scale: 10,
            fillColor: "#00e5ff",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3
        };

        marcadorGpsMensajero = new google.maps.Marker({
            position: new google.maps.LatLng(lat, lng),
            map: mapa,
            title: "Mi Ubicación Táctica (GPS)",
            icon: iconoGpsSvg,
            zIndex: 999999
        });

        console.log(`📍 [MAPA_GPS]: Marcador GPS creado exitosamente en [${lat.toFixed(5)}, ${lng.toFixed(5)}]`);
    } else {
        animarMovimientoMarcadorGps(lat, lng);
    }

    // Centrado suave de cámara ajustado a velocidad
    if (velocidad > 1 && typeof mapa.panTo === "function") {
        mapa.panTo(posActual);
    }

    // Evaluación de proximidad y alertas de voz hacia la parada objetivo activa
    const objetivo = window.paradaObjetivoNavegacion || window.paradaDestinoSeleccionada;
    if (objetivo) {
        const destCoords = obtenerCoordenadasValidasParada(objetivo);
        if (destCoords) {
            const distMetros = calcularDistanciaMetros(lat, lng, destCoords.lat, destCoords.lng);

            if (distMetros <= 100 && ultimaDistanciaNotificada > 100) {
                hablarAlertaGps("A 100 metros de la parada destino");
                ultimaDistanciaNotificada = distMetros;
            } else if (distMetros <= 15 && ultimaDistanciaNotificada > 15) {
                hablarAlertaGps("Has llegado a la parada destino");
                ultimaDistanciaNotificada = distMetros;
                limpiarRutaNavegacionGPS();
            }
        }
    }

    // AUTO-REROUTE Y TRAZADOS DINÁMICOS EN VIVO
    const ahora = Date.now();
    if (ahora - ultimoRecalculoRutaTime > 3000) {
        ultimoRecalculoRutaTime = ahora;

        const grupos = window.gruposParadasRutaActiva || [];
        if (typeof dibujarTrazadosSecuenciales === "function") {
            dibujarTrazadosSecuenciales(mapa, posActual, grupos, objetivo);
        }

        if (window.paradaObjetivoNavegacion && typeof trazarRutaNavegacionInternaGPS === "function") {
            trazarRutaNavegacionInternaGPS(window.paradaObjetivoNavegacion, false);
        }
    }
}

/**
 * Coordenada estimada de fallback cerca del primer punto de la ruta activa o Cali.
 */
function activarFallbackUbicacionGPS() {
    const paradas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
    let lat = 3.442708;
    let lng = -76.493357;

    if (Array.isArray(paradas) && paradas.length > 0) {
        const coords = obtenerCoordenadasValidasParada(paradas[0]);
        if (coords) {
            lat = coords.lat + 0.0015;
            lng = coords.lng - 0.0015;
        }
    }

    console.log(`📍 [MAPA_GPS_FALLBACK]: Usando coordenada estimada [Lat: ${lat}, Lng: ${lng}]`);
    renderizarUbicacionGpsEnMapa(lat, lng, 0);
}

/**
 * Genera micro-pasos interpolados localmente entre nodos de coordenadas para simular fluidez sin API comercial.
 * @param {Array<{lat: number, lng: number}>} puntosBase 
 * @param {number} pasosPorTramo 
 * @returns {Array<{lat: number, lng: number}>}
 */
function interpolarPuntosTelemetria(puntosBase, pasosPorTramo = 15) {
    if (!Array.isArray(puntosBase) || puntosBase.length < 2) return puntosBase || [];

    const rutaInterpolada = [];
    for (let i = 0; i < puntosBase.length - 1; i++) {
        const p1 = puntosBase[i];
        const p2 = puntosBase[i + 1];

        for (let paso = 0; paso < pasosPorTramo; paso++) {
            const t = paso / pasosPorTramo;
            const latInterp = p1.lat + (p2.lat - p1.lat) * t;
            const lngInterp = p1.lng + (p2.lng - p1.lng) * t;
            rutaInterpolada.push({ lat: latInterp, lng: lngInterp });
        }
    }
    rutaInterpolada.push(puntosBase[puntosBase.length - 1]);
    return rutaInterpolada;
}

/**
 * SIMULADOR TÁCTICO DE GEOLOCALIZACIÓN NAVEGABLE POR VÍAS REALES (LOCAL-FIRST $0.00 COP)
 * @param {number} [intervaloMs=800] - Tiempo en milisegundos entre cada paso
 */
export function simularMovimientoGPS(intervaloMs = 800) {
    let puntosViales = window.rutaNavegacionPuntosActiva;

    if (!Array.isArray(puntosViales) || puntosViales.length === 0) {
        console.warn("⚠️ [SIMULADOR_GPS]: Activa primero 'Viajar GPS' sobre una parada.");
        if (typeof window.notificarMensajeroUI === "function") {
            window.notificarMensajeroUI("⚠️ Selecciona una parada y presiona 'Viajar GPS' para simular el recorrido.", "advertencia");
        }
        return;
    }

    // Interpolación dinámica para garantizar animación fluida local
    if (puntosViales.length < 10) {
        console.log("🎮 [SIMULADOR_GPS]: Generando micro-pasos de telemetría local ($0.00 COP)...");
        puntosViales = interpolarPuntosTelemetria(puntosViales, 20);
    }

    console.log(`🎮 [SIMULADOR_GPS]: Iniciando recorrido simular por (${puntosViales.length} puntos)...`);
    let pasoActual = 0;

    if (window.__TIMER_SIMULADOR_GPS__) {
        clearInterval(window.__TIMER_SIMULADOR_GPS__);
    }

    window.__TIMER_SIMULADOR_GPS__ = setInterval(() => {
        if (pasoActual >= puntosViales.length) {
            clearInterval(window.__TIMER_SIMULADOR_GPS__);
            window.__TIMER_SIMULADOR_GPS__ = null;

            console.log("🏁 [SIMULADOR_GPS]: Recorrido completado. Limpiando traza residual de la polilínea...");
            hablarAlertaGps("Has llegado a la parada destino");
            limpiarRutaNavegacionGPS();

            if (typeof window.notificarMensajeroUI === "function") {
                window.notificarMensajeroUI("🏁 [DEV_MODE]: Has llegado a la parada objetivo.", "éxito");
            }
            return;
        }

        const puntoVial = puntosViales[pasoActual];
        renderizarUbicacionGpsEnMapa(puntoVial.lat, puntoVial.lng, 8); // Simula ~28 km/h
        console.log(`📍 [SIMULADOR_GPS_STEP]: Paso [${pasoActual + 1}/${puntosViales.length}] -> Lat: ${puntoVial.lat.toFixed(5)}, Lng: ${puntoVial.lng.toFixed(5)}`);
        pasoActual++;
    }, intervaloMs);
}

/**
 * Renderiza el botón flotante de simulación en localhost / 127.0.0.1
 */
export function renderizarBotonDevSimulacion() {
    if (typeof window === "undefined") return;
    const esLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!esLocal || document.getElementById("btn-simular-gps-dev")) return;

    const btnHTML = `
        <button id="btn-simular-gps-dev" 
                onclick="window.simularMovimientoGPS(800)" 
                style="position: fixed; top: 75px; right: 15px; z-index: 99999; background: #0d1117; border: 1.5px solid #00e5ff; color: #00e5ff; padding: 8px 12px; border-radius: 8px; font-family: 'Fira Code', monospace; font-size: 0.75rem; font-weight: bold; box-shadow: 0 0 10px rgba(0, 229, 255, 0.3); cursor: pointer;">
            🎮 SIMULAR VIAJE
        </button>
    `;
    document.body.insertAdjacentHTML("beforeend", btnHTML);
}

/**
 * Inicializa la lectura continua de coordenadas del dispositivo.
 */
export function inicializarSeguimientoGPS() {
    const mapa = window.mapaMensajero || window.mapaInstancia || window.mapaVisorInstancia || window.mapaInstanciaGlobal;
    if (!mapa || typeof google === "undefined" || !google.maps) {
        console.warn("⚠️ [MAPA_GPS]: Mapa no listo. Reintentando activación de GPS en 1s...");
        setTimeout(inicializarSeguimientoGPS, 1000);
        return;
    }

    if (!("geolocation" in navigator)) {
        console.warn("⚠️ [MAPA_GPS]: Geolocalización no soportada. Activando ubicación estimada de fallback.");
        activarFallbackUbicacionGPS();
        return;
    }

    if (watcherGpsId !== null) {
        navigator.geolocation.clearWatch(watcherGpsId);
    }

    console.log("🛰️ [MAPA_GPS]: Activando sensor de posición continua (watchPosition)...");

    watcherGpsId = navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude, speed } = pos.coords;
            renderizarUbicacionGpsEnMapa(latitude, longitude, speed || 0);
        },
        (error) => {
            console.warn(`⚠️ [MAPA_GPS]: Error capturando señal GPS (${error.code}): ${error.message}`);
            activarFallbackUbicacionGPS();
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
}

/**
 * Recupera el último estado de navegación guardado localmente y autoenfoca la cámara del mapa.
 * @param {google.maps.Map} mapaInstancia 
 * @param {Array<Object>} todasLasParadas 
 */
export async function restaurarEnfoqueNavegacion(mapaInstancia, todasLasParadas = []) {
    const estadoGuardado = await obtenerUltimoEstadoNavegacion();
    if (!estadoGuardado || !mapaInstancia) return;

    console.log("📂 [MAPA_GPS]: Restaurando encuadre de navegación previo...", estadoGuardado);

    if (estadoGuardado.paradaId) {
        const paradaEncontrada = todasLasParadas.find(p => String(p.id || p.ssc) === String(estadoGuardado.paradaId));
        if (paradaEncontrada) {
            window.paradaDestinoSeleccionada = paradaEncontrada;
            window.paradaObjetivoNavegacion = paradaEncontrada;
            const coords = obtenerCoordenadasValidasParada(paradaEncontrada);

            if (coords) {
                mapaInstancia.setCenter({ lat: coords.lat, lng: coords.lng });
                mapaInstancia.setZoom(estadoGuardado.zoom || 16);
                console.log(`🎯 [MAPA_GPS]: Cámara autoenfocada en última parada: ${estadoGuardado.paradaId}`);
            }
        }
    } else if (estadoGuardado.centro) {
        mapaInstancia.setCenter(estadoGuardado.centro);
        mapaInstancia.setZoom(estadoGuardado.zoom || 15);
    }
}

// BINDINGS GLOBALES EN WINDOW
if (typeof window !== "undefined") {
    window.inicializarSeguimientoGPS = inicializarSeguimientoGPS;
    window.iniciarSeguimientoGps = inicializarSeguimientoGPS;
    window.renderizarUbicacionGpsEnMapa = renderizarUbicacionGpsEnMapa;
    window.restaurarEnfoqueNavegacion = restaurarEnfoqueNavegacion;
    window.hablarAlertaGps = hablarAlertaGps;
    window.simularMovimientoGPS = simularMovimientoGPS;
    window.renderizarBotonDevSimulacion = renderizarBotonDevSimulacion;
}