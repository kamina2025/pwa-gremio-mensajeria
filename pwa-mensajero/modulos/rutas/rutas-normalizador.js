/**
 * PROTOCOLO MACONDO - NORMALIZADOR DE RUTAS, PAYLOADS Y ORDENAMIENTO
 * Ubicación: modulos/rutas/rutas-normalizador.js
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
 * Normaliza la estructura de una colección de paradas, homologa atributos de cliente/dirección y garantiza su orden físico.
 * 
 * @param {Array<Object>} listaParadasRaw 
 * @returns {Array<Object>} Lista de paradas normalizada y ordenada
 */
export function normalizarYOrdenarColeccionParadas(listaParadasRaw) {
    if (!Array.isArray(listaParadasRaw)) return [];

    const paradasNormalizadas = listaParadasRaw.map((p, idx) => {
        const secuenciaCalculada = parseInt(p.secuenciaZona || p.orden || p.secuencia || (idx + 1), 10);
        const claveCanonica = estandarizarZonaCanonica(p.zonaKey || p.nombreZona || p.zona || p.zonaNombre);
        
        // Homologación de atributos de cliente/destinatario para búsquedas
        const nombreCliente = p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "CLIENTE N/A";
        const direccionTexto = p.direccion || p.dir || p.direccion_entrega || "SIN DIRECCIÓN";
        const telefonoTexto = p.telefono || p.tel || p.celular || "N/A";

        return {
            ...p,
            id: p.id || p.ssc || p.idParada || `#PNT-${secuenciaCalculada}`,
            destinatario: nombreCliente,
            cliente: nombreCliente,
            nombre_cliente: nombreCliente,
            direccion: direccionTexto,
            dir: direccionTexto,
            telefono: telefonoTexto,
            lat: p.lat || p.latitud || null,
            lng: p.lng || p.longitud || null,
            zona: claveCanonica,
            zonaKey: normalizarClaveZona(claveCanonica),
            nombreZona: `ZONA ${claveCanonica}`,
            zonaNombre: `ZONA ${claveCanonica}`,
            secuencia: secuenciaCalculada,
            secuenciaZona: secuenciaCalculada,
            orden: secuenciaCalculada,
            estado: (p.estado || "ASIGNADO").toUpperCase(),
            registroOperaciones: p.registroOperaciones || {}
        };
    });

    return ordenarParadasPorSecuencia(paradasNormalizadas);
}

/**
 * Procesa la carga inicial de paradas desde la URL (payload=) o lee la persistencia local IndexedDB
 * asegurando el orden numérico estricto y la sincronización con variables de memoria global.
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
            const guardadas = await obtenerParadasGuardadas();
            listaPedidos = normalizarYOrdenarColeccionParadas(guardadas || []);
        }
    } else {
        const guardadas = await obtenerParadasGuardadas();
        listaPedidos = normalizarYOrdenarColeccionParadas(guardadas || []);
    }

    // Asegurar ordenamiento físico antes de devolver al orquestador
    const listaOrdenada = ordenarParadasPorSecuencia(listaPedidos);
    
    // Asignación explícita a memorias de sesión para Local-First
    window.__CACHE_PARADAS_MACONDO__ = [...listaOrdenada];
    window.paradasMemoriaLocal = [...listaOrdenada];
    window.paradasRutaActiva = [...listaOrdenada];
    window.pedidosGlobales = [...listaOrdenada];

    console.log(`✅ [RUTAS_NORMALIZADOR]: ${listaOrdenada.length} paradas listas y sincronizadas en memoria activa.`);

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
window.normalizarClaveZona = normalizarClaveZona;