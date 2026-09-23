/**
 * Módulo de Aislamiento y Secuenciación de Rutas por Zona
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-aislamiento.js
 */

import { normalizarClaveZona } from "./rutas-normalizador.js";
import { obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { trazarPolilineaRuta } from "../mapa/mapa-rutas.js";

/**
 * Procesa y recalcula la secuencia de entrega aislando únicamente la zona seleccionada.
 * 
 * @param {string} zonaKeyInput - Clave o nombre crudo de la zona a aislar
 * @returns {Promise<Array<Object>>} Lista de paradas filtradas y secuenciadas
 */
export async function calcularRutaAisladaPorZona(zonaKeyInput) {
    if (!zonaKeyInput) {
        console.warn("⚠️ [MENSAJERO_RUTAS]: Se requiere una zonaKey para aislar la ruta.");
        return [];
    }

    const targetLimpio = normalizarClaveZona(zonaKeyInput);
    console.group(`⚡ [ZONA_ISOLATION]: Procesando secuencia exclusiva para zona: [${zonaKeyInput}] (Clave limpia target: '${targetLimpio}')`);

    let todasLasParadas = [];

    if (Array.isArray(window.__CACHE_PARADAS_MACONDO__) && window.__CACHE_PARADAS_MACONDO__.length > 0) {
        todasLasParadas = [...window.__CACHE_PARADAS_MACONDO__];
    } else if (Array.isArray(window.paradasMemoriaLocal) && window.paradasMemoriaLocal.length > 0) {
        todasLasParadas = [...window.paradasMemoriaLocal];
    } else {
        try {
            todasLasParadas = (await obtenerParadasGuardadas()) || [];
        } catch (err) {
            console.warn("⚠️ [ZONA_ISOLATION]: Fallo al leer IndexedDB, intentando fallback a localStorage...", err);
        }

        if (!todasLasParadas || todasLasParadas.length === 0) {
            todasLasParadas = JSON.parse(localStorage.getItem("ruta_zonificada") || "[]");
        }
    }

    console.log(`🔍 [ZONA_ISOLATION]: Total de paradas evaluables: ${todasLasParadas.length}`);

    const paradasDeZona = todasLasParadas.filter((p, index) => {
        if (!p) return false;
        
        const k1 = normalizarClaveZona(p.zonaKey || "");
        const k2 = normalizarClaveZona(p.nombreZona || "");
        const k3 = normalizarClaveZona(p.zona || "");
        const k4 = normalizarClaveZona(p.zonaNombre || "");

        const keys = [k1, k2, k3, k4].filter(val => val !== "");

        const busquedaDirecta = keys.some(val => val === targetLimpio);
        const busquedaSinGuiones = keys.some(val => val.replace(/-/g, "") === targetLimpio.replace(/-/g, ""));
        
        const fallbackTextoRaw = (p.zonaNombre || p.zona || p.nombreZona || "").toLowerCase();
        const busquedaInclusion = fallbackTextoRaw.includes(targetLimpio) || targetLimpio.includes(fallbackTextoRaw);

        const esMatch = busquedaDirecta || busquedaSinGuiones || (keys.length === 0 && busquedaInclusion);

        console.log(` [EVAL_PARADA #${index + 1}]: Target='${targetLimpio}' | Keys Encontradas=[${keys.join(", ")}] | Match=${esMatch}`);
        return esMatch;
    });

    if (paradasDeZona.length === 0) {
        console.warn(`⚠️ [ZONA_ISOLATION]: No hay paradas registradas que coincidan con la zona: ${zonaKeyInput} (Target: '${targetLimpio}')`);
        console.groupEnd();
        return [];
    }

    const paradasSecuenciadas = paradasDeZona.map((parada, index) => ({
        ...parada,
        secuenciaZona: index + 1,
        sincronizado: 0,
        updated_at: new Date().toISOString()
    }));

    console.log(`💾 [ZONA_ISOLATION]: ${paradasSecuenciadas.length} parada(s) aislada(s) con éxito para [${targetLimpio}].`);

    if (typeof trazarPolilineaRuta === "function") {
        trazarPolilineaRuta(paradasSecuenciadas, targetLimpio);
    }

    if (typeof window.enfocarZonaEnMapa === "function") {
        window.enfocarZonaEnMapa(paradasSecuenciadas);
    }

    console.groupEnd();
    return paradasSecuenciadas;
}