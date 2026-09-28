/**
 * PROTOCOLO MACONDO - SINCRONIZACIÓN LOCAL-FIRST Y ACTUALIZACIÓN DE ESTADO
 * Ubicación: pwa-mensajero/modulos/mapa/core/mapa-sincronizacion.js
 * Arquitectura: Google Maps SDK / Local-First / Orden Persistente
 */

import { obtenerParadasGuardadas } from "../../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../zonificacion/estandar-zonas.js";
import { refrescarLienzoMapa } from "./mapa-lienzo.js";
import { obtenerCoordenadasValidasParada } from "../utils/mapa-coordenadas.js";
import { desplegarZonaMensajeroEnMapa } from "../mapa-mensajero-zonas.js";
import { trazarPolilineaRuta } from "../mapa-rutas.js";
import { renderizarMarcadoresInteractivos } from "../mapa-marcadores.js";

/**
 * Consulta IndexedDB, resincroniza la RAM global y fuerza la actualización del canvas,
 * respetando de forma SAGRADA la secuenciaZona guardada por el usuario.
 * @returns {Promise<boolean>}
 */
export async function recargarMapaCompleto() {
    console.group("🔄 [MAPA_SYNC]: Ejecutando sincronización y refresco Local-First del mapa...");

    try {
        let paradasFrescas = await obtenerParadasGuardadas() || [];
        if (!Array.isArray(paradasFrescas) || paradasFrescas.length === 0) {
            paradasFrescas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
        }

        console.log(`📦 [MAPA_SYNC]: Total de paradas recuperadas para refresco: ${paradasFrescas.length}`);

        // ORDENACIÓN ESTRICTA: Respetar la secuencia exacta guardada por el usuario
        paradasFrescas.sort((a, b) => {
            const seqA = parseInt(a.secuenciaZona || a.secuencia || a.orden || 0, 10);
            const seqB = parseInt(b.secuenciaZona || b.secuencia || b.orden || 0, 10);
            return seqA - seqB;
        });

        // Sincronizar memorias RAM
        window.__CACHE_PARADAS_MACONDO__ = [...paradasFrescas];
        window.paradasMemoriaLocal = [...paradasFrescas];
        window.paradasRutaActiva = [...paradasFrescas];
        window.pedidosGlobales = [...paradasFrescas];

        const mapa = window.mapaMensajero || window.mapaInstancia;
        const zonaActiva = localStorage.getItem("zona_activa_operacion") || "ORIENTE";
        const targetCanonico = estandarizarZonaCanonica(zonaActiva);

        if (mapa && typeof google !== "undefined" && google.maps) {
            google.maps.event.trigger(mapa, "resize");
            console.log("📐 [MAPA_SYNC]: Disparado 'resize' sobre Google Maps.");

            await actualizarPuntosEnMapa(paradasFrescas, 0);

            const paradasDeZona = paradasFrescas.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico);
            const listaParaBounds = paradasDeZona.length > 0 ? paradasDeZona : paradasFrescas;

            const bounds = new google.maps.LatLngBounds();
            let puntosValidos = 0;

            listaParaBounds.forEach((p) => {
                const coords = obtenerCoordenadasValidasParada(p);
                if (coords) {
                    bounds.extend(new google.maps.LatLng(coords.lat, coords.lng));
                    puntosValidos++;
                }
            });

            if (puntosValidos > 0) {
                mapa.fitBounds(bounds);
                console.log(`🔍 [MAPA_SYNC]: Bounds re-ajustados para ${puntosValidos} coordenadas de la zona [${targetCanonico}].`);
            }
        } else {
            console.warn("⚠️ [MAPA_SYNC]: Instancia del mapa no disponible durante el refresco.");
        }

        if (typeof window.renderizarParadasZonificadasUI === "function") {
            await window.renderizarParadasZonificadasUI(paradasFrescas);
        }

        refrescarLienzoMapa();
        console.groupEnd();
        return true;

    } catch (error) {
        console.error("❌ [MAPA_SYNC]: Error crítico ejecutando recargarMapaCompleto:", error);
        console.groupEnd();
        throw error;
    }
}

/**
 * Actualiza waypoints, minirutas por clúster y marcadores sobre el mapa.
 * @param {Array<Object>} listaPedidos 
 * @param {number} [indiceActivo=0] 
 */
export async function actualizarPuntosEnMapa(listaPedidos, indiceActivo = 0) {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) {
        window.pendientesParaRenderizar = { listaPedidos, indiceActivo };
        return;
    }

    const zonaDetectada = localStorage.getItem("zona_activa_operacion") || (Array.isArray(listaPedidos) && listaPedidos.length > 0 
        ? (listaPedidos[0]?.zonaKey || listaPedidos[0]?.zona || "GENERAL") 
        : "TODAS");

    const targetCanonico = estandarizarZonaCanonica(zonaDetectada);

    if (typeof desplegarZonaMensajeroEnMapa === "function") {
        desplegarZonaMensajeroEnMapa(mapa, targetCanonico);
    }

    if (typeof trazarPolilineaRuta === "function") {
        trazarPolilineaRuta(listaPedidos, targetCanonico);
    }

    if (typeof renderizarMarcadoresInteractivos === "function") {
        renderizarMarcadoresInteractivos(listaPedidos, indiceActivo);
    }
}

// BINDINGS GLOBALES EN WINDOW
window.recargarMapaCompleto = recargarMapaCompleto;
window.ejecutarRefrescoLocalMapa = recargarMapaCompleto;
window.actualizarPuntosEnMapa = actualizarPuntosEnMapa;