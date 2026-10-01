/**
 * PROTOCOLO MACONDO - MÓDULO DE AISLAMIENTO Y SECUENCIACIÓN DE RUTAS POR ZONA
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-aislamiento.js
 * Arquitectura: Async Local-First / Multi-Zone Mapping / Sincronización RAM Atómica
 */

import { normalizarClaveZona } from "./rutas-normalizador.js";
import { obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { trazarPolilineaRuta, dibujarTrazadosSecuenciales } from "../mapa/mapa-rutas.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

// Control de caché en memoria para evitar ciclos de re-renderizado duplicados sobre el Canvas
let ultimaZonaAislada = null;
let ultimoHashParadas = "";

/**
 * Parsea y extrae el valor numérico de la secuencia de una parada.
 * @param {Object} p - Objeto de parada
 * @returns {number}
 */
function obtenerNumeroSecuencia(p) {
    if (!p) return 0;
    const val = p.consecutivoZona ?? p.secuenciaZona ?? p.orden ?? p.secuencia ?? 0;
    const num = parseInt(val, 10);
    return isNaN(num) ? 999999 : num;
}

/**
 * Extrae o construye un identificador único limpio para la parada.
 * @param {Object} p - Objeto de parada
 * @returns {string}
 */
function obtenerIdUnicoParada(p) {
    if (!p) return "";
    return String(p.id || p.ssc || p.scc || p.idParada || p.id_parada || "").trim();
}

/**
 * Procesa y aísla las paradas de la zona activa asegurando su orden físico secuencial.
 * 
 * @param {string} zonaKeyInput - Clave o nombre crudo de la zona a aislar
 * @param {boolean} [forzarRefresco=false] - Si es true, ignora la caché de hash y fuerza el re-dibujado
 * @returns {Promise<Array<Object>>} Lista de paradas filtradas y secuenciadas
 */
export async function calcularRutaAisladaPorZona(zonaKeyInput, forzarRefresco = false) {
    if (!zonaKeyInput) {
        console.warn("⚠️ [ZONA_ISOLATION]: Se requiere una zonaKey válida para aislar la ruta.");
        return [];
    }

    const targetCanonico = estandarizarZonaCanonica(zonaKeyInput);
    const targetLimpio = normalizarClaveZona(targetCanonico);

    console.group(`⚡ [ZONA_ISOLATION]: Procesando secuencia exclusiva para zona: [${zonaKeyInput}] -> '${targetCanonico}'`);

    // 1. Obtener los datos más recientes desde IndexedDB para evitar trabajar con RAM obsoleta
    let todasLasParadas = [];
    try {
        todasLasParadas = (await obtenerParadasGuardadas()) || [];
    } catch (err) {
        console.warn("⚠ [ZONA_ISOLATION]: Fallo al consultar IndexedDB local. Recurriendo a RAM:", err);
    }

    if (!todasLasParadas || todasLasParadas.length === 0) {
        todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
    } else {
        // Sincronizar atómicamente las 4 memorias RAM de sesión activa con la lectura fresca de IndexedDB
        window.__CACHE_PARADAS_MACONDO__ = structuredClone(todasLasParadas);
        window.paradasMemoriaLocal = structuredClone(todasLasParadas);
        window.paradasRutaActiva = structuredClone(todasLasParadas);
        window.pedidosGlobales = structuredClone(todasLasParadas);
    }

    // 2. Filtrado canónico estricto de paradas pertenecientes a la zona objetivo
    let paradasDeZona = todasLasParadas.filter((p) => {
        if (!p) return false;
        return obtenerZonaParadaCanonica(p) === targetCanonico;
    });

    if (paradasDeZona.length === 0) {
        console.warn(`⚠️ [ZONA_ISOLATION]: No hay paradas registradas para la zona canónica: '${targetCanonico}'`);
        console.groupEnd();
        return [];
    }

    // 3. Ordenamiento numérico estricto por secuencia
    paradasDeZona.sort((a, b) => obtenerNumeroSecuencia(a) - obtenerNumeroSecuencia(b));

    // 4. Generación de Hash de Control inmune a reordenamientos, clústeres y estados
    const listaIdsConSecuencia = paradasDeZona.map(p => {
        const idStr = obtenerIdUnicoParada(p);
        const seqNum = obtenerNumeroSecuencia(p);
        const grupoStr = p.grupoId || "";
        const updatedStr = p.updated_at || "";
        const estadoStr = p.estado || p.status || "";
        return `${idStr}_${seqNum}_${grupoStr}_${updatedStr}_${estadoStr}`;
    }).join("|");

    const hashActual = `${targetCanonico}_${listaIdsConSecuencia}`;

    if (!forzarRefresco && ultimaZonaAislada === targetCanonico && ultimoHashParadas === hashActual) {
        console.log(`ℹ️ [ZONA_ISOLATION]: Omitiendo re-renderizado duplicado para Zona: [${targetCanonico}] (Sin cambios detectados).`);
        console.groupEnd();
        return paradasDeZona;
    }

    // Actualizar estado de caché interna
    ultimaZonaAislada = targetCanonico;
    ultimoHashParadas = hashActual;

    console.log(`💾 [ZONA_ISOLATION]: ${paradasDeZona.length} parada(s) aisladas y ORDENADAS con éxito.`);

    // 5. Delegación del Renderizado Gráfico sobre el lienzo de mapa
    if (typeof window.actualizarPuntosEnMapa === "function") {
        console.log("🗺️ [ZONA_ISOLATION]: Delegando al renderizador principal del mapa...");
        window.actualizarPuntosEnMapa(paradasDeZona, 0);
    } else {
        const mapaInstancia = window.mapaMensajero || window.mapaInstanciaGlobal;
        if (mapaInstancia && typeof dibujarTrazadosSecuenciales === "function") {
            dibujarTrazadosSecuenciales(mapaInstancia, window.posicionActualMensajero, [paradasDeZona]);
        } else if (typeof trazarPolilineaRuta === "function") {
            trazarPolilineaRuta(paradasDeZona, targetLimpio);
        }
        if (typeof window.enfocarZonaEnMapa === "function") {
            window.enfocarZonaEnMapa(paradasDeZona);
        }
    }

    console.groupEnd();
    return paradasDeZona;
}

// BINDINGS GLOBALES EN WINDOW (Compatibilidad Legacy PWA)
if (typeof window !== "undefined") {
    window.calcularRutaAisladaPorZona = calcularRutaAisladaPorZona;
    window.aislarParadasPorZona = calcularRutaAisladaPorZona;
}

console.log("🟢 [ZONA_ISOLATION]: Módulo de aislamiento de rutas por zona inicializado y listo.");