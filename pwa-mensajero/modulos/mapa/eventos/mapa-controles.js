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

// Estilo Noche (Dark Cyberpunk)
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

// Estilo Día (Claro Estándar / Alto Contraste)
const ESTILO_MAPA_DIA = []; // Array vacío restaura la paleta estándar de Google Maps

/**
 * Obtiene de forma resiliente la instancia activa del mapa en memoria RAM.
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
 * Asigna manualmente una parada como destino activo, autoenfoca y guarda persistencia Local-First.
 * @param {Object} parada - Objeto de la parada seleccionada
 * @param {google.maps.Map} [mapaInstancia=null] - Instancia del mapa
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

        // Persistencia Local-First del estado de navegación
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
                console.warn("⚠️ [MAPA_CONTROLES]: Error en fallback localStorage:", err);
            }
        }

        // Re-dibujar polilíneas dinámicas con la nueva parada destino
        const posGps = window.posicionActualMensajero || null;
        const grupos = window.gruposParadasRutaActiva || [];

        if (typeof dibujarTrazadosSecuenciales === "function") {
            dibujarTrazadosSecuenciales(mapa, posGps, grupos, parada);
        }
    }
}

/**
 * Enfoca suavemente la cámara sobre la última parada del grupo activo.
 */
export function enfocarUltimaParadaDelGrupo() {
    const mapa = obtenerInstanciaMapaActiva();
    const grupos = window.gruposParadasRutaActiva || [];

    if (!mapa || !Array.isArray(grupos) || grupos.length === 0) {
        console.warn("⚠️ [MAPA_CONTROLES]: No hay grupos de paradas activos para enfocar.");
        return;
    }

    // Obtener el grupo activo (primer grupo con paradas pendientes o primer grupo disponible)
    const grupoActivo = grupos.find(g => Array.isArray(g) && g.some(p => !p.completada && !p.entregado)) || grupos[0];

    if (!grupoActivo || grupoActivo.length === 0) return;

    // Obtener la última parada del grupo
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

    /**
     * Vincula los botones de interacción y controles del lienzo.
     * @param {google.maps.Map} [mapa=null] 
     */
    inicializar(mapa = null) {
        this.mapaInstancia = mapa || obtenerInstanciaMapaActiva();
        console.log("🎮 [MAPA_CONTROLES]: Inicializando controlador de eventos laterales...");

        this.registrarEventListeners();
        this.restaurarEstadoBloqueo();
        this.restaurarTemaMapa();
    },

    registrarEventListeners() {
        // 1. Botón Zoom In
        const btnZoomIn = document.getElementById("btn-zoom-in");
        if (btnZoomIn) {
            btnZoomIn.onclick = (e) => {
                e.preventDefault();
                this.ejecutarZoom(1);
            };
        }

        // 2. Botón Zoom Out
        const btnZoomOut = document.getElementById("btn-zoom-out");
        if (btnZoomOut) {
            btnZoomOut.onclick = (e) => {
                e.preventDefault();
                this.ejecutarZoom(-1);
            };
        }

        // 3. Botón Recentrante / GPS
        const btnGPS = document.getElementById("btn-recenter-gps");
        if (btnGPS) {
            btnGPS.onclick = (e) => {
                e.preventDefault();
                const pos = window.posicionActualMensajero;
                const mapa = this.mapaInstancia || obtenerInstanciaMapaActiva();
                if (pos && mapa) {
                    mapa.panTo(pos);
                    mapa.setZoom(17);
                }
            };
        }

        // 4. Botón Enfocar Última Parada del Grupo
        const btnEnfocarUltima = document.getElementById("btn-enfocar-ultima-parada") || document.querySelector(".btn-enfocar-parada");
        if (btnEnfocarUltima) {
            btnEnfocarUltima.onclick = (e) => {
                e.preventDefault();
                enfocarUltimaParadaDelGrupo();
            };
        }

        // 5. Botón Refrescar Mapa
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

        // 6. Botón Toggle Lock/Unlock Mapa
        const btnToggleLock = document.getElementById("btn-toggle-lock");
        if (btnToggleLock) {
            btnToggleLock.onclick = (e) => {
                e.preventDefault();
                this.alternarBloqueoMapa();
            };
        }

        // 7. Botón Conmutador de Tema Día/Noche
        const btnToggleTema = document.getElementById("btn-toggle-tema-mapa");
        if (btnToggleTema) {
            btnToggleTema.onclick = (e) => {
                e.preventDefault();
                this.alternarTemaMapa();
            };
        }
    },

    /**
     * Alterna entre el tema Noche (Oscuro Cyberpunk) y Día (Claro Alto Contraste).
     * @param {string|null} [temaForzado=null] - 'dia' | 'noche' (opcional)
     */
    alternarTemaMapa(temaForzado = null) {
        const mapa = this.mapaInstancia || obtenerInstanciaMapaActiva();
        const iconTema = document.getElementById("icon-tema-state");
        const esNocheActual = iconTema ? iconTema.textContent.trim() === "🌙" : true;

        let nuevoTema = temaForzado;
        if (!nuevoTema) {
            nuevoTema = esNocheActual ? "dia" : "noche";
        }

        console.log(`🎨 [MAPA_CONTROLES]: Conmutando tema de mapa a -> ${nuevoTema.toUpperCase()}`);

        if (iconTema) {
            iconTema.textContent = nuevoTema === "dia" ? "☀️" : "🌙";
        }

        if (nuevoTema === "dia") {
            document.body.classList.add("mapa-tema-dia");
        } else {
            document.body.classList.remove("mapa-tema-dia");
        }

        if (mapa && typeof mapa.setOptions === "function") {
            mapa.setOptions({
                styles: nuevoTema === "dia" ? ESTILO_MAPA_DIA : ESTILO_MAPA_NOCHE
            });
        }

        try {
            localStorage.setItem(KEY_PERSISTENCIA_TEMA, nuevoTema);
        } catch (err) {
            console.warn("⚠️ [MAPA_CONTROLES]: Error guardando preferencia de tema:", err);
        }
    },

    restaurarTemaMapa() {
        try {
            const temaGuardado = localStorage.getItem(KEY_PERSISTENCIA_TEMA) || "noche";
            this.alternarTemaMapa(temaGuardado);
        } catch (err) {
            console.warn("⚠️ [MAPA_CONTROLES]: Error al recuperar preferencia de tema:", err);
        }
    },

    ejecutarZoom(delta) {
        const mapa = this.mapaInstancia || obtenerInstanciaMapaActiva();
        if (!mapa) return;

        if (typeof mapa.getZoom === "function") {
            const currentZoom = mapa.getZoom();
            mapa.setZoom(currentZoom + delta);
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

// BINDINGS GLOBALES Y RETROCOMPATIBILIDAD EN WINDOW
if (typeof window !== "undefined") {
    window.mapaControles = mapaControles;
    window.MapaControles = mapaControles;
    window.seleccionarParadaDestino = seleccionarParadaDestino;
    window.enfocarUltimaParadaDelGrupo = enfocarUltimaParadaDelGrupo;
}