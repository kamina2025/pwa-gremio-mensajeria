/**
 * PROTOCOLO MACONDO - CONTROL DE LIENZO Y CÁMARA
 * Ubicación: pwa-mensajero/modulos/mapa/core/mapa-lienzo.js
 * Arquitectura: Google Maps SDK / Viewport Operations / Geocoding Fallback
 */

import { obtenerCoordenadasValidasParada } from "../utils/mapa-coordenadas.js";
import { guardarRutaZonificada } from "../../mensajero-persistencia.js";

let temporizadorDebounceResize = null;
const KEY_ULTIMA_PARADA = 'macondo_ultima_parada_id';

/**
 * Redimensiona el lienzo del mapa de forma segura tras cambios en el DOM o transiciones de vista.
 */
export function refrescarLienzoMapa() {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) return;

    const contenedor = mapa.getDiv();
    if (!contenedor || contenedor.clientWidth === 0 || contenedor.clientHeight === 0) return;

    if (temporizadorDebounceResize) clearTimeout(temporizadorDebounceResize);

    temporizadorDebounceResize = setTimeout(() => {
        requestAnimationFrame(() => {
            if (contenedor.clientWidth > 0 && contenedor.clientHeight > 0) {
                const centroActual = mapa.getCenter();
                google.maps.event.trigger(mapa, "resize");
                if (centroActual) {
                    mapa.setCenter(centroActual);
                }
                console.log("⚡ [MAPA_LIENZO]: Re-renderizado Post-Paint de lienzo ejecutado con éxito.");
            }
        });
    }, 80);
}

/**
 * Enfoca una zona ajustando sus límites geográficos (FitBounds).
 * @param {Array<Object>} paradasZona - Paradas pertenecientes a la zona
 */
export function enfocarZonaEnMapa(paradasZona) {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    if (!mapa || !Array.isArray(paradasZona) || paradasZona.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let puntosValidos = 0;

    paradasZona.forEach(p => {
        if (p) {
            const coords = obtenerCoordenadasValidasParada(p);
            if (coords) {
                bounds.extend(new google.maps.LatLng(coords.lat, coords.lng));
                puntosValidos++;
            }
        }
    });

    if (puntosValidos > 0) {
        if (puntosValidos === 1) {
            mapa.setCenter(bounds.getCenter());
            mapa.setZoom(15);
        } else {
            mapa.fitBounds(bounds);
        }
        refrescarLienzoMapa();
    }
}

/**
 * Centra y acerca suavemente la cámara a una parada específica.
 * Incluye fallback por dirección de texto con geocodificación e auto-guardado en IndexedDB.
 * @param {Object|string} paradaOrId - Objeto de la parada o ID a enfocar
 */
export function enfocarParadaEnMapa(paradaOrId) {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    
    if (!mapa) {
        console.warn("⚠️ [MAPA_LIENZO]: Instancia del mapa no disponible para enfocar la parada.", paradaOrId);
        return;
    }

    let parada = null;
    if (typeof paradaOrId === "object" && paradaOrId !== null) {
        parada = paradaOrId;
    } else if (paradaOrId) {
        const idTarget = String(paradaOrId).trim();
        const paradas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || [];
        parada = paradas.find(p => String(p.id || p.scc || p.ssc).trim() === idTarget);
    }

    if (!parada) {
        console.warn("⚠️ [MAPA_LIENZO]: Referencia de parada no hallada en memoria local.");
        return;
    }

    const idTargetLocal = String(parada.id || parada.scc || parada.ssc || "").trim();
    if (idTargetLocal) {
        try {
            localStorage.setItem(KEY_ULTIMA_PARADA, idTargetLocal);
            console.log(`💾 [MAPA_LIENZO]: 'macondo_ultima_parada_id' actualizado -> ${idTargetLocal}`);
        } catch (err) {
            console.warn("⚠️ Error guardando ID de última parada:", err);
        }
    }

    const coords = obtenerCoordenadasValidasParada(parada);

    if (coords) {
        console.log(`🎯 [MAPA_LIENZO]: Enfocando posición en mapa -> [Lat: ${coords.lat}, Lng: ${coords.lng}]`);
        const centroObjetivo = new google.maps.LatLng(coords.lat, coords.lng);
        mapa.panTo(centroObjetivo);
        mapa.setZoom(17);
        refrescarLienzoMapa();
        return;
    }

    // Fallback: Geocodificación por dirección de texto
    const direccionTexto = parada?.direccion || parada?.dir;
    if (direccionTexto && typeof google !== "undefined" && google.maps && google.maps.Geocoder) {
        console.warn(`⚠️ [MAPA_LIENZO]: Parada sin coordenadas directas. Geocodificando dirección en vivo: "${direccionTexto}"`);
        const geocoder = new google.maps.Geocoder();
        const query = direccionTexto.toLowerCase().includes("cali") ? direccionTexto : `${direccionTexto}, Cali, Colombia`;

        geocoder.geocode({ address: query }, async (results, status) => {
            if (status === "OK" && results[0]) {
                const loc = results[0].geometry.location;
                const latNum = loc.lat();
                const lngNum = loc.lng();

                console.log(`✅ [MAPA_LIENZO]: Dirección geocodificada con éxito -> [Lat: ${latNum}, Lng: ${lngNum}]`);

                parada.lat = latNum;
                parada.lng = lngNum;
                parada.latitud = latNum;
                parada.longitud = lngNum;

                let coleccionActual = window.paradasRutaActiva || window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
                if (Array.isArray(coleccionActual) && coleccionActual.length > 0) {
                    try {
                        await guardarRutaZonificada(coleccionActual);
                        
                        // Sincronizar memorias RAM
                        window.__CACHE_PARADAS_MACONDO__ = [...coleccionActual];
                        window.paradasMemoriaLocal = [...coleccionActual];
                        window.paradasRutaActiva = [...coleccionActual];
                        window.pedidosGlobales = [...coleccionActual];

                        console.log(`💾 [MAPA_LIENZO]: Coordenadas de la parada ${parada.id || parada.ssc} persistidas en IndexedDB y RAM.`);
                    } catch (err) {
                        console.warn("⚠️ [MAPA_LIENZO]: No se pudo auto-guardar la coordenada en IndexedDB:", err);
                    }
                }

                mapa.panTo(loc);
                mapa.setZoom(17);
                refrescarLienzoMapa();
            } else {
                console.error(`❌ [MAPA_LIENZO]: No se pudo geocodificar la dirección "${query}". Status: ${status}`);
            }
        });
        return;
    }

    console.error("❌ [MAPA_LIENZO]: Parada con coordenadas e información de dirección inválidas:", parada);
}

/**
 * Centra la cámara en la parada seleccionada por SCC y resalta los marcadores del mismo clúster.
 * @param {Object} parada - Objeto de la parada a resaltar
 */
export function enfocarYResaltarGrupoSCC(parada) {
    if (!parada) return;

    enfocarParadaEnMapa(parada);

    const grupoBuscado = String(parada.grupoId || parada.grupo || parada.cluster || "").trim();
    if (!grupoBuscado) return;

    const marcadoresDOM = document.querySelectorAll(".cyber-pin-marker, [data-grupo], [data-grupo-id], [data-cluster]");
    let contadorResaltados = 0;

    marcadoresDOM.forEach(el => {
        const grupoAttr = String(
            el.getAttribute("data-grupo") || 
            el.getAttribute("data-grupo-id") || 
            el.getAttribute("data-cluster") || ""
        ).trim();
        
        if (grupoAttr && grupoAttr.toLowerCase() === grupoBuscado.toLowerCase()) {
            el.classList.add("activa");
            if (el.style) el.style.zIndex = "9999";
            contadorResaltados++;
        } else {
            el.classList.remove("activa");
        }
    });

    console.log(`⚡ [MAPA_LIENZO]: Resaltados ${contadorResaltados} marcadores del clúster [${grupoBuscado}]`);
}