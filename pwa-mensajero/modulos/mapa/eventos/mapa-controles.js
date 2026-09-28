/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE CONTROLES FLOTANTES Y ENFOQUE
 * Ubicación: pwa-mensajero/modulos/mapa/eventos/mapa-controles.js
 * Arquitectura: Event-Driven / Canvas Controls / Local-First
 */

import { recargarMapaCompleto } from "../core/mapa-sincronizacion.js";
import { dibujarTrazadosSecuenciales } from "../mapa-rutas.js";
import { guardarUltimoEstadoNavegacion } from "../../db/indexed-store.js";
import { obtenerCoordenadasValidasParada } from "../utils/mapa-coordenadas.js";

const KEY_PERSISTENCIA_LOCK = 'map_interaction_locked';

/**
 * Obtiene de forma resiliente la instancia activa del mapa en memoria.
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
 * Asigna manualmente una parada como destino activo, autoenfoca y guarda persistencia.
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
        guardarUltimoEstadoNavegacion({
            paradaId: idParada,
            centro: { lat: coords.lat, lng: coords.lng },
            zoom: mapa.getZoom ? mapa.getZoom() : 16
        });

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

    // Obtener el grupo activo (el primer grupo que contenga paradas pendientes o el primer grupo disponible)
    const grupoActivo = grupos.find(g => Array.isArray(g) && g.some(p => !p.completada && !p.entregado)) || grupos[0];

    if (!grupoActivo || grupoActivo.length === 0) return;

    // Obtener la última parada del grupo
    const ultimaParada = grupoActivo[grupoActivo.length - 1];
    const coords = obtenerCoordenadasValidasParada(ultimaParada);

    if (coords && mapa) {
        mapa.panTo({ lat: coords.lat, lng: coords.lng });
        mapa.setZoom(16);

        console.log(`🎯 [MAPA_CONTROLES]: Enfocada última parada del grupo: ${ultimaParada.id || ultimaParada.ssc}`);

        // Persistir la parada enfocado
        guardarUltimoEstadoNavegacion({
            paradaId: ultimaParada.id || ultimaParada.ssc,
            centro: { lat: coords.lat, lng: coords.lng },
            zoom: 16
        });
    }
}

export const mapaControles = {
    mapaInstancia: null,

    /**
     * Vincula los botones de interacción básica del lienzo.
     * @param {google.maps.Map} [mapa=null] 
     */
    inicializar(mapa = null) {
        this.mapaInstancia = mapa || obtenerInstanciaMapaActiva();

        const btnZoomIn = document.getElementById('btn-zoom-in');
        const btnZoomOut = document.getElementById('btn-zoom-out');
        const btnRefresh = document.getElementById('btn-refresh-map') || document.getElementById('btn-refrescar-mapa');
        const btnToggleLock = document.getElementById('btn-toggle-lock');
        const btnEnfocarUltima = document.getElementById('btn-enfocar-ultima-parada') || document.querySelector('.btn-enfocar-parada');

        if (btnZoomIn) {
            btnZoomIn.onclick = (e) => {
                e.preventDefault();
                this.ejecutarZoom(1);
            };
        }

        if (btnZoomOut) {
            btnZoomOut.onclick = (e) => {
                e.preventDefault();
                this.ejecutarZoom(-1);
            };
        }

        if (btnEnfocarUltima) {
            btnEnfocarUltima.onclick = (e) => {
                e.preventDefault();
                enfocarUltimaParadaDelGrupo();
            };
        }

        if (btnRefresh) {
            btnRefresh.onclick = async (e) => {
                e.preventDefault();
                console.log("🔄 [MAPA_CONTROLES]: Solicitud de recarga manual activada por el usuario.");

                if (btnRefresh.classList.contains("spinning")) {
                    console.warn("⚠️ [MAPA_CONTROLES]: Refresco en ejecución. Operación omitida.");
                    return;
                }

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

        if (btnToggleLock) {
            btnToggleLock.onclick = (e) => {
                e.preventDefault();
                this.alternarBloqueoMapa();
            };
            this.restaurarEstadoBloqueo();
        }
    },

    ejecutarZoom(delta) {
        const mapa = this.mapaInstancia || obtenerInstanciaMapaActiva();
        if (!mapa) return;

        if (typeof mapa.getZoom === 'function') {
            const currentZoom = mapa.getZoom();
            mapa.setZoom(currentZoom + delta);
        }
    },

    alternarBloqueoMapa(estadoForzado = null) {
        const mapa = this.mapaInstancia || obtenerInstanciaMapaActiva();
        const btnToggleLock = document.getElementById('btn-toggle-lock');
        const iconLockState = document.getElementById('icon-lock-state');

        let estaBloqueado = btnToggleLock ? btnToggleLock.getAttribute('data-locked') === 'true' : false;
        
        if (estadoForzado !== null) {
            estaBloqueado = !estadoForzado;
        }

        const nuevoEstado = !estaBloqueado;

        if (btnToggleLock) {
            btnToggleLock.setAttribute('data-locked', nuevoEstado ? 'true' : 'false');
        }

        if (iconLockState) {
            iconLockState.textContent = nuevoEstado ? '🔒' : '🔓';
        }

        if (mapa && typeof mapa.setOptions === 'function') {
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

// BINDINGS GLOBALES EN WINDOW
if (typeof window !== "undefined") {
    window.mapaControles = mapaControles;
    window.seleccionarParadaDestino = seleccionarParadaDestino;
    window.enfocarUltimaParadaDelGrupo = enfocarUltimaParadaDelGrupo;
}