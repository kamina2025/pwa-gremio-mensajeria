/**
 * PROTOCOLO MACONDO - NORMALIZADOR DE RUTAS, PAYLOADS Y ORDENAMIENTO
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-normalizador.js
 * Arquitectura: Local-First / Rehidratación Invariante de Estado / Sincronización Primaria IndexedDB
 */

import { guardarRutaZonificada, obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

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
 * Extrae y sanitiza la clave primaria única real de una parada (priorizando SSC/SCC).
 * 
 * @param {Object|string} p 
 * @returns {string} ID biyectivo limpio
 */
export function obtenerIdUnicoParada(p) {
    if (!p) return "";
    if (typeof p === "string") return String(p).replace(/^[#PNT-]+/i, "").trim();
    const rawId = p.ssc || p.scc || p.id || p.idParada || p.id_parada || "";
    return String(rawId).replace(/^[#PNT-]+/i, "").trim();
}

/**
 * Ordena un arreglo de paradas asegurando el cumplimiento estricto de la secuencia numérica.
 * 
 * @param {Array<Object>} paradas 
 * @returns {Array<Object>} Arreglo ordenado ascendentemente por secuencia
 */
export function ordenarParadasPorSecuencia(paradas) {
    if (!Array.isArray(paradas) || !paradas.length) return [];

    return [...paradas].sort((a, b) => {
        const seqA = parseInt(a.consecutivoZona || a.secuenciaZona || a.orden || a.secuencia || 0, 10);
        const seqB = parseInt(b.consecutivoZona || b.secuenciaZona || b.orden || b.secuencia || 0, 10);
        return seqA - seqB;
    });
}

/**
 * Normaliza la estructura de una colección de paradas, homologa atributos de cliente/dirección,
 * asigna clústeres de subgrupos, preserva los estados mutados y garantiza el orden físico.
 * 
 * @param {Array<Object>} listaParadasRaw 
 * @returns {Array<Object>} Lista de paradas normalizada y ordenada
 */
export function normalizarYOrdenarColeccionParadas(listaParadasRaw) {
    if (!Array.isArray(listaParadasRaw)) return [];

    const TAMANO_CLUSTER = 4;

    const paradasNormalizadas = listaParadasRaw
        .filter(p => p && typeof p === "object")
        .map((p, idx) => {
            const secuenciaCalculada = parseInt(p.consecutivoZona || p.secuenciaZona || p.orden || p.secuencia || (idx + 1), 10);
            const claveCanonica = estandarizarZonaCanonica(obtenerZonaParadaCanonica(p) || p.zonaKey || p.nombreZona || p.zona || p.zonaNombre);
            
            // Homologación de identificadores únicos (Biyectiva)
            const idLimpio = obtenerIdUnicoParada(p) || `PNT-${secuenciaCalculada}`;

            // Homologación de atributos de cliente/destinatario para búsquedas
            const nombreCliente = p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "CLIENTE N/A";
            const direccionTexto = p.direccion || p.dir || p.direccion_entrega || "SIN DIRECCIÓN";
            const telefonoTexto = p.telefono || p.tel || p.celular || "N/A";
            const cuotaValor = p.cuotaModeradora || p.copago || p.cuota || "";
            const notasTexto = p.observaciones || p.notas || "";

            // Preservar el estado mutado (soporta estado y status)
            const estadoBruto = p.estado || p.status || p.causal || "PENDIENTE";
            const estadoUpper = String(estadoBruto).toUpperCase();
            const statusLower = String(estadoBruto).toLowerCase();

            // Extraer coordenadas numéricas válidas
            const latVal = parseFloat(p.lat ?? p.latitud ?? p.coordenadas?.lat ?? 0);
            const lngVal = parseFloat(p.lng ?? p.longitud ?? p.coordenadas?.lng ?? 0);

            // Asignación de clúster por bloque
            const numGrupo = Math.ceil(secuenciaCalculada / TAMANO_CLUSTER);
            const grupoId = p.grupoId || `GRUPO-${numGrupo.toString().padStart(2, "0")}`;

            return {
                ...p,
                id: idLimpio,
                ssc: p.ssc || idLimpio,
                scc: p.scc || idLimpio,
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
                lat: isNaN(latVal) ? 0 : latVal,
                lng: isNaN(lngVal) ? 0 : lngVal,
                latitud: isNaN(latVal) ? 0 : latVal,
                longitud: isNaN(lngVal) ? 0 : lngVal,
                zona: claveCanonica,
                zonaCanonica: claveCanonica,
                zonaKey: normalizarClaveZona(claveCanonica),
                nombreZona: `ZONA ${claveCanonica}`,
                zonaNombre: `ZONA ${claveCanonica}`,
                consecutivoZona: secuenciaCalculada,
                secuenciaZona: secuenciaCalculada,
                secuencia: secuenciaCalculada,
                orden: secuenciaCalculada,
                grupoId: grupoId,
                estado: estadoUpper,
                causal: estadoUpper,
                status: statusLower,
                registroOperaciones: p.registroOperaciones || {},
                updated_at: p.updated_at || new Date().toISOString()
            };
        });

    return ordenarParadasPorSecuencia(paradasNormalizadas);
}

/**
 * Procesa la carga inicial de paradas respetando prioritariamente IndexedDB local.
 * Si existen datos locales guardados, se utilizan para evitar sobreescribir borrados o cambios de estado con el payload URL.
 * 
 * @returns {Promise<Array<Object>>} Lista de paradas normalizada y sincronizada en memoria
 */
export async function procesarPayloadOStorage() {
    console.log(">>> [RUTAS]: Evaluando origen de datos (URL Payload vs IndexedDB Local)...");
    
    let listaPedidos = [];
    let paradasGuardadasLocal = [];

    try {
        paradasGuardadasLocal = (await obtenerParadasGuardadas()) || [];
    } catch (e) {
        console.warn("⚠️️ [RUTAS_NORMALIZADOR]: Fallo al consultar IndexedDB local:", e);
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

    const listaOrdenada = ordenarParadasPorSecuencia(listaPedidos);
    
    // AISLAMIENTO RIGUROSO DE MEMORIA RAM: Clonación estructurada individual para cada referencia de sesión
    if (typeof window !== "undefined") {
        window.__CACHE_PARADAS_MACONDO__ = structuredClone(listaOrdenada);
        window.paradasMemoriaLocal = structuredClone(listaOrdenada);
        window.paradasRutaActiva = structuredClone(listaOrdenada);
        window.pedidosGlobales = structuredClone(listaOrdenada);

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
 * @returns {Promise<number>} Índice del elemento activo
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
        const est = String(p.estado || p.status || p.causal || "").toUpperCase();
        return est !== "FINALIZADO" && est !== "NOVEDAD" && est !== "ENTREGADO" && est !== "CANCELADO";
    });

    return index !== -1 ? index : 0;
}

if (typeof window !== "undefined") {
    window.obtenerIdUnicoParada = obtenerIdUnicoParada;
    window.ordenarParadasPorSecuencia = ordenarParadasPorSecuencia;
    window.normalizarYOrdenarColeccionParadas = normalizarYOrdenarColeccionParadas;
    window.procesarPayloadOStorage = procesarPayloadOStorage;
    window.evaluarOrigenDatos = procesarPayloadOStorage;
    window.normalizarYObtenerParadasActivas = procesarPayloadOStorage;
    window.normalizarClaveZona = normalizarClaveZona;
    window.buscarIndiceActivo = buscarIndiceActivo;
}