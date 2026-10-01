/**
 * PROTOCOLO MACONDO - ESPECIALIDAD: NORMALIZADOR DE PARADAS Y TIRILLAS
 * Ubicación: pwa-mensajero/modulos/importer/normalizador.js
 * Arquitectura: Adaptación de Payload Local-First / Preservación de Coordenadas GPS / Sincronización Biyectiva
 */

import { estandarizarZonaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

/**
 * Sanitiza y valida el nombre del destinatario eliminando ruido estructural de planillas o PDFs.
 * 
 * @param {string} nombreRaw 
 * @param {number} idx 
 * @returns {string} Nombre limpio normalizado
 */
function sanitizarNombreDestinatario(nombreRaw, idx = 0) {
    if (!nombreRaw || typeof nombreRaw !== "string") {
        return `Cliente ${idx + 1}`;
    }

    const candidato = nombreRaw.trim();

    // Filtro defensivo contra fragmentos de encabezado, pie de página o trazabilidad
    const esRuido = /^(DEVUELTO|ENTREGADO|PENDIENTE|CANCELADO|EN RUTA|ASIGNADO)$/i.test(candidato) ||
                    /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(candidato) ||
                    /Runner|localhost|PLACA|PLANILLA|MENSAJERO|ID PLANILLA|REPORTE DE OPERACIONES|Certificado Digital|Local-First|Stop\s*#/i.test(candidato);

    if (esRuido) {
        return `Cliente ${idx + 1}`;
    }

    return candidato;
}

/**
 * Extrae coordenadas numéricas válidas de cualquier alias posible en el objeto crudo.
 * 
 * @param {Object} p 
 * @returns {{lat: number|null, lng: number|null}}
 */
function extraerCoordenadasNumericas(p) {
    if (!p) return { lat: null, lng: null };

    const latVal = p.lat !== undefined ? p.lat : (p.latitud !== undefined ? p.latitud : p.coordenadas?.lat);
    const lngVal = p.lng !== undefined ? p.lng : (p.longitud !== undefined ? p.longitud : p.coordenadas?.lng);

    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);

    const latValida = !isNaN(lat) && lat !== 0 ? lat : null;
    const lngValida = !isNaN(lng) && lng !== 0 ? lng : null;

    return { lat: latValida, lng: lngValida };
}

/**
 * Estructura, valida y normaliza los campos requeridos para la tirilla y hoja de ruta.
 * 
 * @param {Object} p - Objeto de parada crudo
 * @param {number} [idx=0] - Índice de secuencia en la colección
 * @returns {Object} Parada completamente normalizada
 */
export function normalizarParadaTirilla(p, idx = 0) {
    if (!p || typeof p !== "object") return null;

    console.log(`>>> [NORMALIZADOR_EVAL]: Evaluando objeto crudo en índice [${idx}]...`, p);

    const secuenciaCalculada = parseInt(p.consecutivoZona || p.secuenciaZona || p.orden || p.secuencia || (idx + 1), 10);
    const sscLimpio = String(p.ssc || p.scc || p.ssc_no || p.id || `PNT-${secuenciaCalculada}`).replace(/^[#PNT-]+/i, "").trim() || `PNT-${secuenciaCalculada}`;
    const idUnico = sscLimpio;

    const nombreCliente = sanitizarNombreDestinatario(p.destinatario || p.cliente || p.nombre || p.afiliado, idx);
    const direccionTexto = String(p.direccion || p.dir || p.direccion_entrega || "Dirección no especificada").trim();
    const telefonoTexto = String(p.telefono || p.tel || p.celular || "3000000000").trim();
    const origenTexto = String(p.puntoOrigen || p.punto_origen || "Cafam Cali Tequendama").trim();
    const cuotaValor = String(p.cuotaModeradora || p.cuota_moderadora || p.copago || p.cuota || "$0").trim();
    const cargaTexto = String(p.carga || "Medicamentos Dispensación").trim();

    // Preservar estado mutado o asignar PENDIENTE/ASIGNADO por defecto
    const estadoBruto = p.estado || p.status || p.causal || "ASIGNADO";
    const estadoUpper = String(estadoBruto).toUpperCase();
    const statusLower = String(estadoBruto).toLowerCase();

    // Extraer coordenadas GPS
    const { lat, lng } = extraerCoordenadasNumericas(p);

    // Estandarizar Zona
    const zonaRaw = p.zonaKey || p.nombreZona || p.zona || p.zonaNombre;
    const claveCanonica = estandarizarZonaCanonica(zonaRaw);

    // Clúster por bloques de 4
    const TAMANO_CLUSTER = 4;
    const numGrupo = Math.ceil(secuenciaCalculada / TAMANO_CLUSTER);
    const grupoId = p.grupoId || `GRUPO-${numGrupo.toString().padStart(2, "0")}`;

    const paradaNormalizada = {
        ...p,
        id: idUnico,
        ssc: sscLimpio,
        scc: sscLimpio,
        destinatario: nombreCliente,
        cliente: nombreCliente,
        nombre_cliente: nombreCliente,
        direccion: direccionTexto,
        dir: direccionTexto,
        telefono: telefonoTexto,
        tel: telefonoTexto,
        puntoOrigen: origenTexto,
        cuotaModeradora: cuotaValor,
        copago: cuotaValor,
        carga: cargaTexto,
        estado: estadoUpper,
        status: statusLower,
        causal: estadoUpper,
        lat: lat,
        lng: lng,
        latitud: lat,
        longitud: lng,
        zona: claveCanonica,
        zonaCanonica: claveCanonica,
        zonaKey: claveCanonica.toLowerCase(),
        nombreZona: `ZONA ${claveCanonica}`,
        zonaNombre: `ZONA ${claveCanonica}`,
        consecutivoZona: secuenciaCalculada,
        secuenciaZona: secuenciaCalculada,
        secuencia: secuenciaCalculada,
        orden: secuenciaCalculada,
        grupoId: grupoId,
        colorZona: p.colorZona || p.color || "#FFE600",
        registroOperaciones: p.registroOperaciones || {},
        updated_at: p.updated_at || new Date().toISOString()
    };

    console.log(`>>> [NORMALIZADOR_TIRILLA]: Parada adaptada -> SSC: ${paradaNormalizada.ssc} | Cliente: ${paradaNormalizada.destinatario}`);
    return paradaNormalizada;
}

/**
 * Normaliza una colección completa de paradas locales.
 * 
 * @param {Array<Object>} coleccion 
 * @returns {Array<Object>}
 */
export function normalizarColeccionTirillas(coleccion) {
    if (!Array.isArray(coleccion)) return [];
    return coleccion
        .filter(p => p && typeof p === "object")
        .map((p, idx) => normalizarParadaTirilla(p, idx));
}

// Bindings globales para interoperabilidad desacoplada
if (typeof window !== "undefined") {
    window.normalizarParadaTirilla = normalizarParadaTirilla;
    window.normalizarColeccionTirillas = normalizarColeccionTirillas;
    window.normalizarParadaLocal = normalizarParadaTirilla;
}