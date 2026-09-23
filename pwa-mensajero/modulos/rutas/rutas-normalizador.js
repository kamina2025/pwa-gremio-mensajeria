/**
 * Módulo de Normalización de Claves y Procesamiento de Payload
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-normalizador.js
 */

import { guardarRutaZonificada, obtenerParadasGuardadas } from "../mensajero-persistencia.js";

/**
 * Normaliza y limpia una clave de zona de forma determinista eliminando prefijos "zona".
 * Ejemplos: "ZONA ORIENTE" -> "oriente", "zona_oriente" -> "oriente", "ZONA NORTE-1" -> "norte-1"
 * @param {string} zonaRaw - Cadena cruda recibida de la UI o payload
 * @returns {string} Clave limpia estandarizada
 */
export function normalizarClaveZona(zonaRaw) {
    if (!zonaRaw || typeof zonaRaw !== "string") return "";
    
    let limpia = zonaRaw.trim().toLowerCase();
    
    // Remover prefijos habituales 'zona ', 'zona_', 'zona-'
    limpia = limpia.replace(/^zona[_\s-]*/i, "");
    
    // Estandarizar separadores
    limpia = limpia.replace(/\s+/g, "-").replace(/_/g, "-");

    return limpia;
}

/**
 * Procesa la carga inicial de paradas desde la URL (payload=) o lee la persistencia local IndexedDB.
 */
export async function procesarPayloadOStorage() {
    console.log(">>> [RUTAS]: Evaluando origen de datos (URL Payload vs IndexedDB Local)...");
    let listaPedidos = [];
    const urlParams = new URLSearchParams(window.location.search);
    const payloadRaw = urlParams.get("payload");

    if (payloadRaw) {
        try {
            listaPedidos = JSON.parse(decodeURIComponent(payloadRaw)).map((pedido) => ({
                ...pedido,
                estado: pedido.estado || "ASIGNADO",
                registroOperaciones: pedido.registroOperaciones || {}
            }));
            await guardarRutaZonificada(listaPedidos);
            console.log(`>>> [RUTAS] Payload de URL procesado y guardado: ${listaPedidos.length} paradas.`);
        } catch (e) {
            console.error(">>> [PAYLOAD_ERROR]: Error procesando payload URL, recayendo a IndexedDB:", e);
            listaPedidos = (await obtenerParadasGuardadas()) || [];
        }
    } else {
        listaPedidos = (await obtenerParadasGuardadas()) || [];
    }

    return Array.isArray(listaPedidos) ? listaPedidos : [];
}

/**
 * Busca el índice del primer pedido activo o pendiente.
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