/**
 * Módulo de Operaciones Tácticas, Zonificación y Edición de Paradas
 * Ubicación: pwa-mensajero/modulos/ui/ui-zonificacion-mantenimiento.js
 */

import { clasificarParadasPorZona } from "../mapa/zonificacion/mensajero-zonificacion.js";
import { guardarRutaZonificada } from "../mensajero-persistencia.js"; // <- IMPORTACIÓN CORREGIDA
import { estandarizarZonaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

/**
 * Ejecuta la clasificación espacial táctica por polígonos GeoJSON de Cali,
 * estandariza atómicamente las claves de zona canónicas y unifica la persistencia.
 * 
 * @param {Array<Object>} paradasMemoriaLocal 
 * @param {Function} renderCallback 
 * @returns {Promise<Array<Object>>}
 */
export async function ejecutarZonificacionAutomaticaUI(paradasMemoriaLocal, renderCallback) {
    console.group("🎨 [ZONIFICAR_UI]: Iniciando clasificación espacial táctica...");
    
    const txtTotal = document.getElementById("txt-total-paradas");
    if (txtTotal) txtTotal.innerText = "ZONIFICANDO...";

    if (!Array.isArray(paradasMemoriaLocal) || paradasMemoriaLocal.length === 0) {
        console.warn("⚠️ [ZONIFICAR_UI]: No hay paradas en memoria para zonificar.");
        console.groupEnd();
        return paradasMemoriaLocal;
    }

    const geocoder = (typeof google !== "undefined" && google.maps) ? new google.maps.Geocoder() : null;

    // 1. Geocodificación pasiva para paradas sin coordenadas lat/lng
    for (let i = 0; i < paradasMemoriaLocal.length; i++) {
        const p = paradasMemoriaLocal[i];
        
        if ((!p.lat || !p.lng) && geocoder && p.direccion) {
            const dirCompleta = p.direccion.toLowerCase().includes("cali") 
                ? p.direccion 
                : `${p.direccion}, Cali, Valle del Cauca, Colombia`;
            
            try {
                const res = await new Promise((resolve) => {
                    geocoder.geocode({ address: dirCompleta }, (results, status) => {
                        if (status === "OK" && results && results[0]) {
                            resolve(results[0].geometry.location);
                        } else {
                            resolve(null);
                        }
                    });
                });

                if (res) {
                    p.lat = res.lat();
                    p.lng = res.lng();
                    console.log(`📍 Geocodificada parada #${i + 1} (${p.destinatario}): [${p.lat}, ${p.lng}]`);
                }
            } catch (err) {
                console.warn(`⚠️ Error geocodificando dirección de parada #${i + 1}:`, err);
            }
        }
    }

    // 2. Clasificación por polígonos espacial GeoJSON
    const paradasProcesadas = clasificarParadasPorZona(paradasMemoriaLocal);

    // 3. ESTANDARIZACIÓN ATÓMICA DE CLAVE CANÓNICA A NIVEL DE PARADA
    paradasProcesadas.forEach((p) => {
        const zonaRaw = p.zonaKey || p.nombreZona || p.zona || p.zonaNombre;
        const claveCanonica = estandarizarZonaCanonica(zonaRaw);

        p.zona = claveCanonica;
        p.zonaKey = claveCanonica.toLowerCase();
        p.nombreZona = `ZONA ${claveCanonica}`;
        p.zonaNombre = `ZONA ${claveCanonica}`;
        p.colorZona = p.colorZona || p.color || "#FFE600";
        p.updated_at = new Date().toISOString();
    });

    // 4. PERSISTENCIA UNIFICADA EN LA FUENTE GLOBAL (Single Source of Truth)
    await guardarRutaZonificada(paradasProcesadas);

    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasProcesadas));
    window.__CACHE_PARADAS_MACONDO__ = [...paradasProcesadas];
    window.paradasMemoriaLocal = [...paradasProcesadas];

    console.log("💾 [ZONIFICAR_UI]: Paradas estandarizadas y actualizadas globalmente en IndexedDB, LocalStorage y RAM.");

    // 5. Refresco visual del mapa y callback de renderizado UI
    if (typeof window.actualizarPuntosEnMapa === "function") {
        window.actualizarPuntosEnMapa(paradasProcesadas, 0);
    }

    if (typeof renderCallback === "function") {
        renderCallback(paradasProcesadas);
    }

    console.groupEnd();
    return paradasProcesadas;
}

/**
 * Reordena la secuencia de una parada según delta visual (+1 / -1) y sincroniza almacenamiento global.
 * 
 * @param {Array<Object>} paradasMemoriaLocal 
 * @param {string|number} idParada 
 * @param {number} delta 
 * @param {Function} renderCallback 
 */
export async function moverParadaSecuenciaUI(paradasMemoriaLocal, idParada, delta, renderCallback) {
    console.group(`⚡ [REORDENAMIENTO_UI]: Moviendo parada ${idParada} con delta ${delta}`);
    
    let listaParadas = paradasMemoriaLocal;
    if (!Array.isArray(listaParadas) || listaParadas.length === 0) {
        listaParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
    }

    const index = listaParadas.findIndex(p => String(p.id || p.ssc) === String(idParada));
    if (index === -1) {
        console.warn("⚠️ [REORDENAMIENTO_UI]: Parada no encontrada.");
        console.groupEnd();
        return;
    }

    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= listaParadas.length) {
        console.warn("⚠️ [REORDENAMIENTO_UI]: Índice fuera de límites.");
        console.groupEnd();
        return;
    }

    // Intercambio físico de posiciones
    const temp = listaParadas[index];
    listaParadas[index] = listaParadas[newIndex];
    listaParadas[newIndex] = temp;

    // Recalcular secuencias numéricas
    for (let i = 0; i < listaParadas.length; i++) {
        listaParadas[i].secuencia = i + 1;
        listaParadas[i].secuenciaZona = i + 1;
        listaParadas[i].orden = i + 1;
        listaParadas[i].updated_at = new Date().toISOString();
    }

    // Persistencia unificada
    await guardarRutaZonificada(listaParadas);

    // Sincronizar RAM y UI
    localStorage.setItem("ruta_zonificada", JSON.stringify(listaParadas));
    window.__CACHE_PARADAS_MACONDO__ = [...listaParadas];
    window.paradasMemoriaLocal = [...listaParadas];

    if (typeof window.actualizarPuntosEnMapa === "function") {
        window.actualizarPuntosEnMapa(listaParadas, 0);
    }

    if (typeof renderCallback === "function") {
        renderCallback(listaParadas);
    }

    console.groupEnd();
}

// Bindings globales inmediatos
window.ejecutarZonificacionAutomaticaUI = ejecutarZonificacionAutomaticaUI;
window.moverParadaSecuenciaUI = moverParadaSecuenciaUI;