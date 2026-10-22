/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE CONTROLES FLOTANTES, TEMAS Y ENFOQUE
 * Ubicación: pwa-mensajero/modulos/mapa/eventos/mapa-controles.js
 * Arquitectura: Event-Driven / Canvas Controls / Local-First
 */

import { recargarMapaCompleto } from "../core/mapa-sincronizacion.js";
import { dibujarTrazadosSecuenciales } from "../mapa-rutas.js";
import { indexedStore, guardarUltimoEstadoNavegacion } from "../../db/indexed-store.js";
import { obtenerCoordenadasValidasParada } from "../utils/mapa-coordenadas.js";

const KEY_PERSISTENCIA_LOCK = "map_interaction_locked";
const KEY_PERSISTENCIA_TEMA = "macondo_mapa_theme_mode";

// Estilo Noche (Dark Cyberpunk) - Fallback para mapas dinámicos sin Map ID Cloud
const ESTILO_MAPA_NOCHE = [
    { elementType: "geometry", stylers: [{ color: "#0d1117" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0d1117" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8b949e" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#c9d1d9" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#00e5ff" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0d1f2d" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#21262d" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#30363d" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#161b22" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#ffb300" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#030308" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#58a6ff" }] }
];

const ESTILO_MAPA_DIA = []; 

/**
 * Obtiene de forma resiliente la instancia activa del mapa en RAM.
 * @returns {google.maps.Map|null}
 */
function obtenerInstanciaMapaActiva() {
    return (
        window.mapaMensajero ||
        window.mapaInstancia ||
        window.mapaVisorInstancia ||
        window.mapaInstanciaGlobal ||
        null
    );
}

/**
 * Asigna manualmente una parada como destino activo y autoenfoca la cámara.
 * @param {Object} parada - Objeto de la parada seleccionada
 * @param {google.maps.Map} [mapaInstancia=null]
 */
export function seleccionarParadaDestino(parada, mapaInstancia = null) {
    if (!parada) return;

    const mapa = mapaInstancia || obtenerInstanciaMapaActiva();
    window.paradaDestinoSeleccionada = parada;
    window.paradaObjetivoNavegacion = parada;

    const coords = obtenerCoordenadasValidasParada(parada);
    const idParada = parada.id || parada.ssc || "";

    console.log(`📍 [MAPA_CONTROLES]: Parada seleccionada como destino: ${idParada}`);

    if (mapa && coords) {
        mapa.panTo({ lat: coords.lat, lng: coords.lng });

        const payloadEstado = {
            paradaId: idParada,
            centro: { lat: coords.lat, lng: coords.lng },
            zoom: mapa.getZoom ? mapa.getZoom() : 16
        };

        if (typeof guardarUltimoEstadoNavegacion === "function") {
            guardarUltimoEstadoNavegacion(payloadEstado);
        } else {
            try {
                localStorage.setItem("macondo_ultimo_estado_mapa", JSON.stringify(payloadEstado));
            } catch (err) {
                console.warn("⚠️️ [MAPA_CONTROLES]: Error en fallback localStorage:", err);
            }
        }

        const posGps = window.posicionActualMensajero || null;
        const grupos = window.gruposParadasRutaActiva || [];

        if (typeof dibujarTrazadosSecuenciales === "function") {
            dibujarTrazadosSecuenciales(mapa, posGps, grupos, parada);
        }
    }
}

/**
 * Enfoca la cámara sobre la última parada del grupo activo.
 */
export function enfocarUltimaParadaDelGrupo() {
    const mapa = obtenerInstanciaMapaActiva();
    const grupos = window.gruposParadasRutaActiva || [];

    if (!mapa || !Array.isArray(grupos) || grupos.length === 0) {
        console.warn("⚠️ [MAPA_CONTROLES]: No hay grupos de paradas activos para enfocar.");
        return;
    }

    const grupoActivo = grupos.find(g => Array.isArray(g) && g.some(p => !p.completada && !p.entregado)) || grupos[0];

    if (!grupoActivo || grupoActivo.length === 0) return;

    const ultimaParada = grupoActivo[grupoActivo.length - 1];
    const coords = obtenerCoordenadasValidasParada(ultimaParada);

    if (coords && mapa) {
        mapa.panTo({ lat: coords.lat, lng: coords.lng });
        mapa.setZoom(16);

        console.log(`🎯 [MAPA_CONTROLES]: Enfocada última parada del grupo: ${ultimaParada.id || ultimaParada.ssc}`);

        const payloadEstado = {
            paradaId: ultimaParada.id || ultimaParada.ssc,
            centro: { lat: coords.lat, lng: coords.lng },
            zoom: 16
        };

        if (typeof guardarUltimoEstadoNavegacion === "function") {
            guardarUltimoEstadoNavegacion(payloadEstado);
        }
    }
}

export const mapaControles = {
    mapaInstancia: null,

    inicializar(mapa = null) {
        this.mapaInstancia = mapa || obtenerInstanciaMapaActiva();
        console.log("🎮 [MAPA_CONTROLES]: Inicializando controlador de eventos laterales...");

        this.registrarEventListeners();
        this.restaurarEstadoBloqueo();
        this.restaurarTemaMapa();
    },

    registrarEventListeners() {
        const agregarEventoSeguro = (idSelector, evento, handler) => {
            const el = document.getElementById(idSelector) || document.querySelector(`.${idSelector}`);
            if (el) {
                el.removeEventListener(evento, handler);
                el.addEventListener(evento, handler);
            }
        };

        const handleZoomIn = (e) => {
            e.preventDefault();
            this.ejecutarZoom(1);
        };
        agregarEventoSeguro("btn-zoom-in", "click", handleZoomIn);

        const handleZoomOut = (e) => {
            e.preventDefault();
            this.ejecutarZoom(-1);
        };
        agregarEventoSeguro("btn-zoom-out", "click", handleZoomOut);

        const handleGps = (e) => {
            e.preventDefault();
            const pos = window.posicionActualMensajero;
            const mapa = this.mapaInstancia || obtenerInstanciaMapaActiva();
            if (pos && mapa) {
                mapa.panTo(pos);
                mapa.setZoom(17);
                console.log("🛰️ [MAPA_CONTROLES]: Recentrando cámara en posición GPS actual:", pos);
            }
        };
        agregarEventoSeguro("btn-recenter-gps", "click", handleGps);

        const handleEnfocar = (e) => {
            e.preventDefault();
            enfocarUltimaParadaDelGrupo();
        };
        agregarEventoSeguro("btn-enfocar-ultima-parada", "click", handleEnfocar);

        const btnRefresh = document.getElementById("btn-refresh-map") || document.getElementById("btn-refrescar-mapa");
        if (btnRefresh) {
            btnRefresh.onclick = async (e) => {
                e.preventDefault();
                console.log("🔄 [MAPA_CONTROLES]: Solicitud de recarga manual activada por el usuario.");

                if (btnRefresh.classList.contains("spinning")) return;

                btnRefresh.classList.add("spinning");
                btnRefresh.disabled = true;

                try {
                    if (typeof recargarMapaCompleto === "function") {
                        await recargarMapaCompleto();
                    } else if (typeof window.recargarMapaCompleto === "function") {
                        await window.recargarMapaCompleto();
                    }
                    console.log("✅ [MAPA_CONTROLES]: Sincronización Local-First del mapa completada.");
                } catch (err) {
                    console.error("❌ [MAPA_CONTROLES]: Error crítico durante la recarga del mapa:", err);
                } finally {
                    setTimeout(() => {
                        btnRefresh.classList.remove("spinning");
                        btnRefresh.disabled = false;
                    }, 400);
                }
            };
        }

        const handleToggleLock = (e) => {
            e.preventDefault();
            this.alternarBloqueoMapa();
        };
        agregarEventoSeguro("btn-toggle-lock", "click", handleToggleLock);

        const handleToggleTema = (e) => {
            e.preventDefault();
            this.alternarTemaMapa();
        };
        agregarEventoSeguro("btn-toggle-tema-mapa", "click", handleToggleTema);
    },

    /**
     * Alterna o impone el tema visual en el mapa.
     * Forzado en NOCHE para garantizar estética Cyberpunk.
     * @param {string|null} [temaForzado=null]
     */
    alternarTemaMapa(temaForzado = null) {
        const mapa = this.mapaInstancia || obtenerInstanciaMapaActiva();
        const iconTema = document.getElementById("icon-tema-state");
        
        let nuevoTema = temaForzado;
        if (!nuevoTema) {
            const esNocheActual = iconTema ? iconTema.textContent.trim() === "🌙" : true;
            nuevoTema = esNocheActual ? "DIA" : "NOCHE";
        }

        nuevoTema = String(nuevoTema).toUpperCase();
        console.log(`🎨 [MAPA_CONTROLES]: Conmutando tema de mapa a -> ${nuevoTema}`);

        if (iconTema) {
            iconTema.textContent = nuevoTema === "DIA" ? "☀️" : "🌙";
        }

        if (nuevoTema === "DIA") {
            document.body.classList.add("mapa-tema-dia");
        } else {
            document.body.classList.remove("mapa-tema-dia");
        }

        const contenedorMapa = mapa && typeof mapa.getDiv === "function" 
            ? mapa.getDiv() 
            : document.getElementById("mapa-fullscreen-container");

        const tieneMapId = mapa && (typeof mapa.get === "function" ? mapa.get("mapId") : mapa.mapId);

        if (tieneMapId && contenedorMapa) {
            const capaTiles = contenedorMapa.querySelector(".gm-style > div:first-child");
            const objetivoFiltro = capaTiles || contenedorMapa;

            if (nuevoTema === "DIA") {
                objetivoFiltro.style.filter = "none";
                contenedorMapa.style.backgroundColor = "#ffffff";
            } else {
                objetivoFiltro.style.filter = "invert(100%) hue-rotate(180deg) contrast(1.2) brightness(0.95)";
                contenedorMapa.style.backgroundColor = "#0c080f";
            }
        } else if (mapa && typeof mapa.setOptions === "function") {
            mapa.setOptions({
                styles: nuevoTema === "DIA" ? ESTILO_MAPA_DIA : ESTILO_MAPA_NOCHE
            });
        }

        try {
            localStorage.setItem(KEY_PERSISTENCIA_TEMA, nuevoTema.toLowerCase());
        } catch (err) {
            console.warn("⚠️ [MAPA_CONTROLES]: Error guardando preferencia de tema:", err);
        }
    },

    restaurarTemaMapa() {
        try {
            // Purgar explícitamente cualquier persistencia 'dia' heredada para imponer el modo Cyberpunk NOCHE
            localStorage.setItem(KEY_PERSISTENCIA_TEMA, "noche");
            this.alternarTemaMapa("NOCHE");
        } catch (err) {
            console.warn("⚠️ [MAPA_CONTROLES]: Error al recuperar preferencia de tema:", err);
            this.alternarTemaMapa("NOCHE");
        }
    },

    ejecutarZoom(delta) {
        const mapa = this.mapaInstancia || obtenerInstanciaMapaActiva();
        if (!mapa) return;

        if (typeof mapa.getZoom === "function") {
            const currentZoom = mapa.getZoom();
            mapa.setZoom(currentZoom + delta);
            console.log(`🔍 [MAPA_CONTROLES]: Zoom modificado (${delta > 0 ? '+1' : '-1'}). Nivel actual: ${currentZoom + delta}`);
        }
    },

    alternarBloqueoMapa(estadoForzado = null) {
        const mapa = this.mapaInstancia || obtenerInstanciaMapaActiva();
        const btnToggleLock = document.getElementById("btn-toggle-lock");
        const iconLockState = document.getElementById("icon-lock-state");

        let estaBloqueado = btnToggleLock ? btnToggleLock.getAttribute("data-locked") === "true" : false;

        if (estadoForzado !== null) {
            estaBloqueado = !estadoForzado;
        }

        const nuevoEstado = !estaBloqueado;

        if (btnToggleLock) {
            btnToggleLock.setAttribute("data-locked", nuevoEstado ? "true" : "false");
        }

        if (iconLockState) {
            iconLockState.textContent = nuevoEstado ? "🔒" : "🔓";
        }

        if (mapa && typeof mapa.setOptions === "function") {
            mapa.setOptions({
                draggable: !nuevoEstado,
                scrollwheel: !nuevoEstado,
                disableDoubleClickZoom: nuevoEstado
            });
        }

        console.log(`🔒 [MAPA_CONTROLES]: Estado de interacción del mapa conmutado a -> ${nuevoEstado ? "BLOQUEADO" : "DESBLOQUEADO"}`);

        try {
            localStorage.setItem(KEY_PERSISTENCIA_LOCK, JSON.stringify(nuevoEstado));
        } catch (err) {
            console.warn("⚠️ [MAPA_CONTROLES]: Error en persistencia de bloqueo:", err);
        }
    },

    restaurarEstadoBloqueo() {
        try {
            const estadoGuardado = localStorage.getItem(KEY_PERSISTENCIA_LOCK);
            if (estadoGuardado !== null) {
                const estaBloqueado = JSON.parse(estadoGuardado);
                if (estaBloqueado) {
                    this.alternarBloqueoMapa(true);
                }
            }
        } catch (err) {
            console.warn("⚠️ [MAPA_CONTROLES]: Error al recuperar estado de bloqueo:", err);
        }
    }
};

if (typeof window !== "undefined") {
    window.mapaControles = mapaControles;
    window.MapaControles = mapaControles;
    window.seleccionarParadaDestino = seleccionarParadaDestino;
    window.enfocarUltimaParadaDelGrupo = enfocarUltimaParadaDelGrupo;
}