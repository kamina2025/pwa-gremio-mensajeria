/**
 * Módulo de Operaciones Tácticas, Zonificación y Edición de Paradas
 * Ubicación: pwa-mensajero/modulos/ui/ui-zonificacion-mantenimiento.js
 */

import { clasificarParadasPorZona } from "../mapa/zonificacion/mensajero-zonificacion.js";
import { guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

/**
 * Clasifica paradas por polígonos GeoJSON de Cali, estandariza claves de zona y unifica persistencia.
 * 
 * @param {Array<Object>} paradasMemoriaLocal 
 * @param {Function} [renderCallback] 
 * @returns {Promise<Array<Object>>}
 */
export async function ejecutarZonificacionAutomaticaUI(paradasMemoriaLocal, renderCallback) {
    console.group("🎨 [ZONIFICAR_UI]: Iniciando clasificación espacial...");
    
    const txtTotal = document.getElementById("txt-total-paradas");
    if (txtTotal) txtTotal.innerText = "ZONIFICANDO...";

    let lista = Array.isArray(paradasMemoriaLocal) && paradasMemoriaLocal.length > 0
        ? paradasMemoriaLocal
        : (window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || []);

    if (!Array.isArray(lista) || lista.length === 0) {
        console.warn("⚠️ [ZONIFICAR_UI]: No hay paradas en memoria.");
        console.groupEnd();
        return [];
    }

    const geocoder = (typeof google !== "undefined" && google.maps) ? new google.maps.Geocoder() : null;

    // 1. Geocodificación secuencial para paradas incompletas
    for (let i = 0; i < lista.length; i++) {
        const p = lista[i];
        
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
                    console.log(`📍 Geocodificada parada #${i + 1}: [${p.lat}, ${p.lng}]`);
                }
            } catch (err) {
                console.warn(`⚠️ Error geocodificando parada #${i + 1}:`, err);
            }
        }
    }

    // 2. Clasificación espacial por polígonos
    const paradasProcesadas = clasificarParadasPorZona(lista);

    // 3. Estandarización canónica de zona por parada
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

    // 4. Persistencia global en IndexedDB, LocalStorage y RAM
    await guardarRutaZonificada(paradasProcesadas);

    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasProcesadas));
    window.__CACHE_PARADAS_MACONDO__ = [...paradasProcesadas];
    window.paradasMemoriaLocal = [...paradasProcesadas];
    window.paradasRutaActiva = [...paradasProcesadas];

    console.log("💾 [ZONIFICAR_UI]: Paradas estandarizadas y guardadas globalmente.");

    // 5. Refresco de marcadores y callback UI
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
 * Mueve manualmente la secuencia de una parada y sincroniza almacenamiento.
 */
export async function moverParadaSecuenciaUI(paradasMemoriaLocal, idParada, delta, renderCallback) {
    console.group(`⚡ [REORDENAMIENTO_UI]: Moviendo parada ${idParada} (delta: ${delta})`);
    
    let listaParadas = Array.isArray(paradasMemoriaLocal) && paradasMemoriaLocal.length > 0
        ? paradasMemoriaLocal
        : (window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || []);

    const index = listaParadas.findIndex(p => String(p.id || p.ssc || "").trim() === String(idParada).trim());
    if (index === -1) {
        console.warn("⚠️ [REORDENAMIENTO_UI]: Parada no encontrada.");
        console.groupEnd();
        return;
    }

    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= listaParadas.length) {
        console.warn("⚠️ [REORDENAMIENTO_UI]: Índice fuera de rango.");
        console.groupEnd();
        return;
    }

    // Intercambio físico de posiciones
    const temp = listaParadas[index];
    listaParadas[index] = listaParadas[newIndex];
    listaParadas[newIndex] = temp;

    // Recalcular secuencias
    for (let i = 0; i < listaParadas.length; i++) {
        listaParadas[i].secuencia = i + 1;
        listaParadas[i].secuenciaZona = i + 1;
        listaParadas[i].orden = i + 1;
        listaParadas[i].updated_at = new Date().toISOString();
    }

    // Persistencia unificada
    await guardarRutaZonificada(listaParadas);
    localStorage.setItem("ruta_zonificada", JSON.stringify(listaParadas));

    window.__CACHE_PARADAS_MACONDO__ = [...listaParadas];
    window.paradasMemoriaLocal = [...listaParadas];
    window.paradasRutaActiva = [...listaParadas];

    if (typeof window.actualizarPuntosEnMapa === "function") {
        window.actualizarPuntosEnMapa(listaParadas, 0);
    }

    if (typeof renderCallback === "function") {
        renderCallback(listaParadas);
    }

    console.groupEnd();
}

// Bindings globales
if (typeof window !== "undefined") {
    window.ejecutarZonificacionAutomaticaUI = ejecutarZonificacionAutomaticaUI;
    window.moverParadaSecuenciaUI = moverParadaSecuenciaUI;
}