/**
 * PROTOCOLO MACONDO - MÓDULO DE OPERACIONES TÁCTICAS, ZONIFICACIÓN Y EDICIÓN DE PARADAS
 * Ubicación: pwa-mensajero/modulos/ui/ui-zonificacion-mantenimiento.js
 * Arquitectura: Async Local-First / Sincronización Quad-RAM / Resistencia Offline / Geocodificación Defensiva
 */

import { clasificarParadasPorZona } from "../mapa/zonificacion/mensajero-zonificacion.js";
import { guardarRutaZonificada, obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

/**
 * Obtiene las coordenadas numéricas válidas de una parada.
 * @param {Object} p 
 * @returns {{lat: number, lng: number}|null}
 */
function obtenerCoordenadasValidas(p) {
    if (!p) return null;
    const latVal = p.lat !== undefined ? p.lat : (p.latitud !== undefined ? p.latitud : p.coordenadas?.lat);
    const lngVal = p.lng !== undefined ? p.lng : (p.longitud !== undefined ? p.longitud : p.coordenadas?.lng);
    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
    return { lat, lng };
}

/**
 * Sincroniza atómicamente la lista de paradas en las 4 estructuras de memoria de sesión global.
 * @param {Array<Object>} paradas 
 */
function sincronizarMemoriaGlobalRAM(paradas) {
    if (typeof window === "undefined" || !Array.isArray(paradas)) return;
    const copia = [...paradas];
    window.__CACHE_PARADAS_MACONDO__ = structuredClone(copia);
    window.paradasMemoriaLocal = structuredClone(copia);
    window.paradasRutaActiva = structuredClone(copia);
    window.pedidosGlobales = structuredClone(copia);
}

/**
 * Clasifica paradas por polígonos GeoJSON de Cali, estandariza claves de zona y unifica persistencia Local-First.
 * 
 * @param {Array<Object>} paradasMemoriaLocal 
 * @param {Function} [renderCallback] 
 * @returns {Promise<Array<Object>>}
 */
export async function ejecutarZonificacionAutomaticaUI(paradasMemoriaLocal, renderCallback) {
    console.group("🎨 [ZONIFICAR_UI]: Iniciando clasificación espacial...");
    
    const txtTotal = document.getElementById("txt-total-paradas");
    if (txtTotal) txtTotal.innerText = "ZONIFICANDO...";

    try {
        let lista = Array.isArray(paradasMemoriaLocal) && paradasMemoriaLocal.length > 0
            ? paradasMemoriaLocal
            : (window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.pedidosGlobales || []);

        if (!Array.isArray(lista) || lista.length === 0) {
            console.warn("⚠️ [ZONIFICAR_UI]: No hay paradas disponibles en memoria activa.");
            if (txtTotal) txtTotal.innerText = "0 PARADAS";
            return [];
        }

        const gMapsListo = typeof google !== "undefined" && google && google.maps && google.maps.Geocoder;
        const geocoder = gMapsListo && navigator.onLine ? new google.maps.Geocoder() : null;

        // 1. Geocodificación defensiva para paradas incompletas
        for (let i = 0; i < lista.length; i++) {
            const p = lista[i];
            const coordsExistentes = obtenerCoordenadasValidas(p);

            // Si carece de coordenadas numéricas, se intenta resolver por geocodificador
            if (!coordsExistentes && p.direccion) {
                let coordsResueltas = null;

                // Nivel 1: Intento vía Google Maps Geocoder (si hay conexión)
                if (geocoder) {
                    const dirCompleta = p.direccion.toLowerCase().includes("cali") 
                        ? p.direccion 
                        : `${p.direccion}, Cali, Valle del Cauca, Colombia`;
                    
                    try {
                        coordsResueltas = await new Promise((resolve) => {
                            geocoder.geocode({ address: dirCompleta }, (results, status) => {
                                if (status === "OK" && results && results[0]) {
                                    resolve({
                                        lat: results[0].geometry.location.lat(),
                                        lng: results[0].geometry.location.lng()
                                    });
                                } else {
                                    resolve(null);
                                }
                            });
                        });
                    } catch (err) {
                        console.warn(`⚠️ [ZONIFICAR_UI]: Error en geocodificación Google Maps para parada #${i + 1}:`, err);
                    }
                }

                // Nivel 2: Fallback Nominatim / OpenStreetMap / Servicio Gratuito en ventana
                if (!coordsResueltas && typeof window.geocodificarDireccionGratis === "function") {
                    console.log(`🔍 [ZONIFICAR_UI]: Ejecutando fallback de geocodificación gratuita para: ${p.direccion}`);
                    try {
                        coordsResueltas = await window.geocodificarDireccionGratis(p.direccion, "Cali, Colombia");
                    } catch (errOsm) {
                        console.warn(`⚠️ [ZONIFICAR_UI]: Error en fallback OSM para parada #${i + 1}:`, errOsm);
                    }
                }

                // Asignación de resultados o fallback final estático (Centroide de respaldo Cali)
                if (coordsResueltas) {
                    p.lat = coordsResueltas.lat;
                    p.lng = coordsResueltas.lng;
                    p.latitud = coordsResueltas.lat;
                    p.longitud = coordsResueltas.lng;
                    console.log(`📍 Geocodificada parada #${i + 1}: [${p.lat}, ${p.lng}]`);
                } else {
                    console.warn(`⚠️ [ZONIFICAR_UI]: No se pudo geocodificar parada #${i + 1}. Asignando punto predeterminado.`);
                    p.lat = p.lat || 3.4516;
                    p.lng = p.lng || -76.5320;
                }
            }
        }

        // 2. Clasificación espacial por polígonos GeoJSON
        const paradasProcesadas = clasificarParadasPorZona(lista);
        const TAMANO_CLUSTER = 4;

        // 3. Estandarización canónica de zona y reconstrucción de secuencia/clúster
        paradasProcesadas.forEach((p, idx) => {
            const zonaRaw = p.zonaKey || p.nombreZona || p.zona || p.zonaNombre;
            const claveCanonica = estandarizarZonaCanonica(zonaRaw);

            const numSecuencia = p.secuenciaZona || p.secuencia || p.orden || (idx + 1);

            p.zona = claveCanonica;
            p.zonaKey = claveCanonica.toLowerCase();
            p.nombreZona = `ZONA ${claveCanonica}`;
            p.zonaNombre = `ZONA ${claveCanonica}`;
            p.colorZona = p.colorZona || p.color || "#FFE600";
            p.secuencia = numSecuencia;
            p.secuenciaZona = numSecuencia;
            p.orden = numSecuencia;
            p.grupoId = `GRUPO-${Math.ceil(numSecuencia / TAMANO_CLUSTER).toString().padStart(2, "0")}`;
            p.updated_at = new Date().toISOString();
        });

        // 4. Persistencia unificada en IndexedDB, LocalStorage y Quad-RAM
        await guardarRutaZonificada(paradasProcesadas);
        try {
            localStorage.setItem("ruta_zonificada", JSON.stringify(paradasProcesadas));
        } catch (errLs) {
            console.warn("⚠️ [ZONIFICAR_UI]: No se pudo actualizar localStorage de respaldo:", errLs);
        }

        sincronizarMemoriaGlobalRAM(paradasProcesadas);

        console.log("💾 [ZONIFICAR_UI]: Paradas estandarizadas y guardadas globalmente.");

        if (txtTotal) {
            txtTotal.innerText = `${paradasProcesadas.length} PARADAS`;
        }

        // 5. Refresco de visualización en lienzo de mapa y callback UI
        if (typeof window.actualizarPuntosEnMapa === "function") {
            window.actualizarPuntosEnMapa(paradasProcesadas, 0);
        }

        if (typeof window.refrescarConsolaOperacionesUI === "function") {
            window.refrescarConsolaOperacionesUI(paradasProcesadas);
        }

        if (typeof renderCallback === "function") {
            await renderCallback(paradasProcesadas);
        }

        return paradasProcesadas;
    } catch (errorGlobal) {
        console.error("❌ [ZONIFICAR_UI]: Error crítico durante la zonificación automática:", errorGlobal);
        if (txtTotal) txtTotal.innerText = "ERROR ZONIFICAR";
        return [];
    } finally {
        console.groupEnd();
    }
}

/**
 * Mueve manualmente la secuencia de una parada y sincroniza almacenamiento Local-First.
 * 
 * @param {Array<Object>} paradasMemoriaLocal 
 * @param {string|number} idParada 
 * @param {number} delta 
 * @param {Function} [renderCallback] 
 */
export async function moverParadaSecuenciaUI(paradasMemoriaLocal, idParada, delta, renderCallback) {
    console.group(`⚡ [REORDENAMIENTO_UI]: Moviendo parada #${idParada} (delta: ${delta})`);
    
    try {
        let listaParadas = Array.isArray(paradasMemoriaLocal) && paradasMemoriaLocal.length > 0
            ? paradasMemoriaLocal
            : (window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.pedidosGlobales || []);

        const cleanTargetId = String(idParada || "").replace(/^[#PNT-]+/i, "").trim();

        const index = listaParadas.findIndex((p) => {
            if (!p) return false;
            const currentId = String(p.id || p.ssc || p.scc || p.idParada || "").replace(/^[#PNT-]+/i, "").trim();
            return currentId === cleanTargetId;
        });

        if (index === -1) {
            console.warn("⚠️ [REORDENAMIENTO_UI]: Parada no encontrada.");
            return;
        }

        const newIndex = index + delta;
        if (newIndex < 0 || newIndex >= listaParadas.length) {
            console.warn("⚠️ [REORDENAMIENTO_UI]: Índice de destino fuera de rango.");
            return;
        }

        // Intercambio físico de posiciones
        const temp = listaParadas[index];
        listaParadas[index] = listaParadas[newIndex];
        listaParadas[newIndex] = temp;

        // Recalcular secuencias y clústeres por grupo
        const TAMANO_CLUSTER = 4;
        for (let i = 0; i < listaParadas.length; i++) {
            const seq = i + 1;
            listaParadas[i].consecutivoZona = seq;
            listaParadas[i].secuenciaZona = seq;
            listaParadas[i].secuencia = seq;
            listaParadas[i].orden = seq;
            listaParadas[i].grupoId = `GRUPO-${Math.ceil(seq / TAMANO_CLUSTER).toString().padStart(2, "0")}`;
            listaParadas[i].updated_at = new Date().toISOString();
        }

        // Persistencia unificada
        await guardarRutaZonificada(listaParadas);
        try {
            localStorage.setItem("ruta_zonificada", JSON.stringify(listaParadas));
        } catch (errLs) {
            console.warn("⚠️ [REORDENAMIENTO_UI]: Error guardando respaldo localStorage:", errLs);
        }

        sincronizarMemoriaGlobalRAM(listaParadas);

        if (typeof window.actualizarPuntosEnMapa === "function") {
            window.actualizarPuntosEnMapa(listaParadas, 0);
        }

        if (typeof window.refrescarConsolaOperacionesUI === "function") {
            window.refrescarConsolaOperacionesUI(listaParadas);
        }

        if (typeof renderCallback === "function") {
            await renderCallback(listaParadas);
        }
    } catch (error) {
        console.error("❌ [REORDENAMIENTO_UI]: Error al mover la secuencia de la parada:", error);
    } finally {
        console.groupEnd();
    }
}

// Bindings globales para compatibilidad y desacoplamiento
if (typeof window !== "undefined") {
    window.ejecutarZonificacionAutomaticaUI = ejecutarZonificacionAutomaticaUI;
    window.moverParadaSecuenciaUI = moverParadaSecuenciaUI;
}