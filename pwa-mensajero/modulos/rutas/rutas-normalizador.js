/**
 * PROTOCOLO MACONDO - NORMALIZADOR DE RUTAS, PAYLOADS Y ORDENAMIENTO
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-normalizador.js
 * Arquitectura: Local-First / Rehidratación Invariante de Estado / Sincronización Primaria IndexedDB
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
    if (!zonaRaw || typeof zonaRaw !== "string") return "GENERAL";
    
    let limpia = zonaRaw.trim().toLowerCase();
    limpia = limpia.replace(/^zona[_\s-]*/i, "");
    limpia = limpia.replace(/\s+/g, "-").replace(/_/g, "-");

    return limpia ? limpia.toUpperCase() : "GENERAL";
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
 * Normaliza la estructura de una colección de paradas, homologa atributos de cliente/dirección,
 * preserva los estados de entrega (sin resetear a ASIGNADO) y garantiza su orden físico.
 * 
 * @param {Array<Object>} listaParadasRaw 
 * @returns {Array<Object>} Lista de paradas normalizada y ordenada
 */
export function normalizarYOrdenarColeccionParadas(listaParadasRaw) {
    if (!Array.isArray(listaParadasRaw)) return [];

    const paradasNormalizadas = listaParadasRaw
        .filter(p => p && typeof p === "object") // Filtrar elementos nulos o corruptos
        .map((p, idx) => {
            const secuenciaCalculada = parseInt(p.secuenciaZona || p.orden || p.secuencia || (idx + 1), 10);
            const claveCanonica = estandarizarZonaCanonica(p.zonaKey || p.nombreZona || p.zona || p.zonaNombre);
            
            // Homologación de identificadores únicos (Biyectiva)
            const idUnico = String(p.id || p.ssc || p.scc || p.idParada || `#PNT-${secuenciaCalculada}`).trim();

            // Homologación de atributos de cliente/destinatario para búsquedas
            const nombreCliente = p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "CLIENTE N/A";
            const direccionTexto = p.direccion || p.dir || p.direccion_entrega || "SIN DIRECCIÓN";
            const telefonoTexto = p.telefono || p.tel || p.celular || "N/A";
            const cuotaValor = p.cuotaModeradora || p.copago || p.cuota || "";
            const notasTexto = p.observaciones || p.notas || "";

            // Preservar el estado mutado (soporta estado y status)
            const estadoBruto = p.estado || p.status || "ASIGNADO";
            const estadoUpper = String(estadoBruto).toUpperCase();
            const statusLower = String(estadoBruto).toLowerCase();

            return {
                ...p,
                id: idUnico,
                ssc: p.ssc || p.scc || idUnico,
                scc: p.scc || p.ssc || idUnico,
                destinatario: nombreCliente,
                cliente: nombreCliente,
                nombre_cliente: nombreCliente,
                direccion: direccionTexto,
                dir: direccionTexto,
                telefono: telefonoTexto,
                tel: telefonoTexto,
                cuotaModeradora: cuotaValor,
                copago: cuotaValor,
                observaciones: notasTexto,
                notas: notasTexto,
                lat: p.lat || p.latitud || null,
                lng: p.lng || p.longitud || null,
                zona: claveCanonica,
                zonaKey: normalizarClaveZona(claveCanonica),
                nombreZona: `ZONA ${claveCanonica}`,
                zonaNombre: `ZONA ${claveCanonica}`,
                secuencia: secuenciaCalculada,
                secuenciaZona: secuenciaCalculada,
                orden: secuenciaCalculada,
                estado: estadoUpper,
                status: statusLower,
                registroOperaciones: p.registroOperaciones || {}
            };
        });

    return ordenarParadasPorSecuencia(paradasNormalizadas);
}

/**
 * Procesa la carga inicial de paradas respetando prioritariamente IndexedDB local.
 * Si existen datos locales guardados, se utilizan para evitar sobreescribir borrados o cambios de estado con el payload URL.
 * 
 * @returns {Promise<Array<Object>>}
 */
export async function procesarPayloadOStorage() {
    console.log(">>> [RUTAS]: Evaluando origen de datos (URL Payload vs IndexedDB Local)...");
    
    let listaPedidos = [];
    let paradasGuardadasLocal = [];

    try {
        paradasGuardadasLocal = await obtenerParadasGuardadas();
    } catch (e) {
        console.warn("⚠️ [RUTAS_NORMALIZADOR]: Fallo al consultar IndexedDB local:", e);
    }

    // 1. Prioridad Local-First: Si ya hay datos en IndexedDB, respetarlos prioritariamente
    if (Array.isArray(paradasGuardadasLocal) && paradasGuardadasLocal.length > 0) {
        console.log(`💾 [RUTAS_NORMALIZADOR]: Datos locales detectados en IndexedDB (${paradasGuardadasLocal.length} paradas). Priorizando Local-First.`);
        listaPedidos = normalizarYOrdenarColeccionParadas(paradasGuardadasLocal);
    } else {
        // 2. Fallback: Si IndexedDB está vacío, intentar leer Payload de URL
        const urlParams = typeof window !== "undefined" && window.location ? new URLSearchParams(window.location.search) : null;
        const payloadRaw = urlParams ? urlParams.get("payload") : null;

        if (payloadRaw) {
            try {
                const parsed = JSON.parse(decodeURIComponent(payloadRaw));
                listaPedidos = normalizarYOrdenarColeccionParadas(parsed);
                await guardarRutaZonificada(listaPedidos);
                console.log(`📥 [RUTAS_NORMALIZADOR]: Payload de URL procesado, ordenado y guardado: ${listaPedidos.length} paradas.`);
            } catch (e) {
                console.error("❌ [PAYLOAD_ERROR]: Error procesando payload URL:", e);
                listaPedidos = [];
            }
        } else {
            console.log("ℹ️ [RUTAS_NORMALIZADOR]: No hay datos locales ni payload en URL. Se mantiene lista vacía.");
            listaPedidos = [];
        }
    }

    // Asegurar ordenamiento físico antes de devolver al orquestador
    const listaOrdenada = ordenarParadasPorSecuencia(listaPedidos);
    
    // Asignación explícita y sincronizada a las 4 memorias de sesión para Local-First
    if (typeof window !== "undefined") {
        window.__CACHE_PARADAS_MACONDO__ = [...listaOrdenada];
        window.paradasMemoriaLocal = [...listaOrdenada];
        window.paradasRutaActiva = [...listaOrdenada];
        window.pedidosGlobales = [...listaOrdenada];

        try {
            localStorage.setItem("ruta_zonificada", JSON.stringify(listaOrdenada));
        } catch (err) {
            console.warn("⚠️ [RUTAS_NORMALIZADOR]: No se pudo actualizar localStorage de respaldo:", err);
        }
    }

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

    if (!listaPedidos || typeof listaPedidos.then === "function" || !Array.isArray(listaPedidos)) {
        listaPedidos = await obtenerParadasGuardadas();
    }

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        return 0;
    }

    const index = listaPedidos.findIndex((p) => {
        if (!p) return false;
        const est = String(p.estado || p.status || "").toUpperCase();
        return est !== "FINALIZADO" && est !== "NOVEDAD" && est !== "ENTREGADO" && est !== "CANCELADO";
    });

    return index !== -1 ? index : 0;
}

// Bindings globales inmediatos para compatibilidad desacoplada
if (typeof window !== "undefined") {
    window.ordenarParadasPorSecuencia = ordenarParadasPorSecuencia;
    window.normalizarYOrdenarColeccionParadas = normalizarYOrdenarColeccionParadas;
    window.procesarPayloadOStorage = procesarPayloadOStorage;
    window.evaluarOrigenDatos = procesarPayloadOStorage; // Alias de compatibilidad
    window.normalizarYObtenerParadasActivas = procesarPayloadOStorage; // Alias de compatibilidad
    window.normalizarClaveZona = normalizarClaveZona;
    window.buscarIndiceActivo = buscarIndiceActivo;
}