/**
 * Módulo de Normalización de Claves, Procesamiento de Payload y Ordenamiento
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-normalizador.js
 */

import { guardarRutaZonificada, obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

/**
 * Normaliza y limpia una clave de zona de forma determinista eliminando prefijos "zona".
 * 
 * @param {string} zonaRaw - Cadena cruda recibida de la UI o payload
 * @returns {string} Clave limpia estandarizada
 */
export function normalizarClaveZona(zonaRaw) {
    if (!zonaRaw || typeof zonaRaw !== "string") return "";
    
    let limpia = zonaRaw.trim().toLowerCase();
    limpia = limpia.replace(/^zona[_\s-]*/i, "");
    limpia = limpia.replace(/\s+/g, "-").replace(/_/g, "-");

    return limpia;
}

/**
 * Ordena un arreglo de paradas asegurando el cumplimiento estricto del campo `secuenciaZona` u `orden`.
 * 
 * @param {Array<Object>} paradas 
 * @returns {Array<Object>} Arreglo ordenado ascendentemente por secuencia
 */
export function ordenarParadasPorSecuencia(paradas) {
    if (!Array.isArray(paradas) || !paradas.length) return [];

    return [...paradas].sort((a, b) => {
        const seqA = parseInt(a.secuenciaZona || a.orden || a.secuencia || 0, 10);
        const seqB = parseInt(b.secuenciaZona || b.orden || b.secuencia || 0, 10);
        
        if (seqA !== 0 && seqB !== 0) {
            return seqA - seqB;
        }
        return 0;
    });
}

/**
 * Normaliza la estructura de una colección de paradas y garantiza su orden físico secuencial.
 * 
 * @param {Array<Object>} listaParadasRaw 
 * @returns {Array<Object>} Lista de paradas normalizada y ordenada
 */
export function normalizarYOrdenarColeccionParadas(listaParadasRaw) {
    if (!Array.isArray(listaParadasRaw)) return [];

    const paradasNormalizadas = listaParadasRaw.map((p, idx) => {
        const claveCanonica = estandarizarZonaCanonica(p.zonaKey || p.nombreZona || p.zona || p.zonaNombre);
        
        return {
            ...p,
            id: p.id || p.ssc || p.idParada || `parada_${idx + 1}`,
            zona: claveCanonica,
            zonaKey: normalizarClaveZona(claveCanonica),
            nombreZona: `ZONA ${claveCanonica}`,
            zonaNombre: `ZONA ${claveCanonica}`,
            secuenciaZona: parseInt(p.secuenciaZona || p.orden || p.secuencia || (idx + 1), 10),
            orden: parseInt(p.orden || p.secuenciaZona || p.secuencia || (idx + 1), 10),
            estado: p.estado || "ASIGNADO",
            registroOperaciones: p.registroOperaciones || {}
        };
    });

    return ordenarParadasPorSecuencia(paradasNormalizadas);
}

/**
 * Procesa la carga inicial de paradas desde la URL (payload=) o lee la persistencia local IndexedDB
 * asegurando el orden numérico estricto en el retorno.
 * 
 * @returns {Promise<Array<Object>>}
 */
export async function procesarPayloadOStorage() {
    console.log(">>> [RUTAS]: Evaluando origen de datos (URL Payload vs IndexedDB Local)...");
    let listaPedidos = [];
    const urlParams = new URLSearchParams(window.location.search);
    const payloadRaw = urlParams.get("payload");

    if (payloadRaw) {
        try {
            const parsed = JSON.parse(decodeURIComponent(payloadRaw));
            listaPedidos = normalizarYOrdenarColeccionParadas(parsed);
            await guardarRutaZonificada(listaPedidos);
            console.log(`>>> [RUTAS] Payload de URL procesado, ordenado y guardado: ${listaPedidos.length} paradas.`);
        } catch (e) {
            console.error(">>> [PAYLOAD_ERROR]: Error procesando payload URL, recayendo a IndexedDB:", e);
            listaPedidos = (await obtenerParadasGuardadas()) || [];
        }
    } else {
        listaPedidos = (await obtenerParadasGuardadas()) || [];
    }

    // Asegurar ordenamiento físico antes de devolver al orquestador
    const listaOrdenada = ordenarParadasPorSecuencia(listaPedidos);
    
    window.__CACHE_PARADAS_MACONDO__ = [...listaOrdenada];
    window.paradasMemoriaLocal = [...listaOrdenada];

    return listaOrdenada;
}

/**
 * Busca el índice del primer pedido activo o pendiente.
 * 
 * @param {Array<Object>|Promise<Array<Object>>} listaPedidosRaw 
 * @returns {Promise<number>}
 */
export async function buscarIndiceActivo(listaPedidosRaw) {
    let listaPedidos = await Promise.resolve(listaPedidosRaw);

    if (!listaPedidos || typeof listaPedidos.then === "function") {
        listaPedidos = await obtenerParadasGuardadas();
    }

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        return 0;
    }

    const index = listaPedidos.findIndex(
        (p) => p && p.estado !== "FINALIZADO" && p.estado !== "NOVEDAD" && p.estado !== "ENTREGADO"
    );

    return index !== -1 ? index : listaPedidos.length - 1;
}

// Bindings globales inmediatos para compatibilidad desacoplada
window.ordenarParadasPorSecuencia = ordenarParadasPorSecuencia;
window.normalizarYOrdenarColeccionParadas = normalizarYOrdenarColeccionParadas;
window.procesarPayloadOStorage = procesarPayloadOStorage;