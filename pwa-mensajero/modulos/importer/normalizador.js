/**
 * PROTOCOLO MACONDO - ESPECIALIDAD: NORMALIZADOR DE PARADAS
 * Ubicación: pwa-mensajero/modulos/importer/normalizador.js
 * Función: Estructura y valida los campos requeridos para la tirilla/hoja de ruta.
 */

export function normalizarParadaTirilla(p, idx) {
    console.log(`>>> [NORMALIZADOR_EVAL]: Evaluando objeto crudo en índice [${idx}]...`, p);

    let nombreCandidato = p.destinatario || p.nombre || p.afiliado || "";

    // Filtro final: Prevenir desbordamientos del pie de página en el nombre
    const esRuido = /^(DEVUELTO|ENTREGADO|PENDIENTE|CANCELADO|EN RUTA)$/i.test(nombreCandidato.trim()) || 
                    /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(nombreCandidato) ||
                    /Runner|localhost|PLACA|PLANILLA|MENSAJERO/i.test(nombreCandidato);

    if (esRuido) {
        nombreCandidato = "";
    }

    const paradaNormalizada = {
        id: p.id || `#PNT-${Math.floor(1000 + Math.random() * 9000)}`,
        ssc: p.ssc || p.ssc_no || "N/A",
        destinatario: nombreCandidato.trim() || `Cliente ${idx + 1}`,
        direccion: p.direccion || p.direccion_entrega || "Dirección no especificada",
        telefono: p.telefono || "3000000000",
        puntoOrigen: p.puntoOrigen || p.punto_origen || "Cafam Cali Tequendama",
        cuotaModeradora: p.cuotaModeradora || p.cuota_moderadora || "$0",
        carga: p.carga || "Medicamentos Dispensación",
        estado: p.estado || "ASIGNADO",
        lat: p.lat ? parseFloat(p.lat) : null,
        lng: p.lng ? parseFloat(p.lng) : null,
        zonaKey: p.zonaKey || p.zona || null,
        nombreZona: p.nombreZona || null,
        colorZona: p.colorZona || null,
        registroOperaciones: p.registroOperaciones || {}
    };

    console.log(
        `>>> [NORMALIZADOR_TIRILLA]: Parada adaptada -> SSC: ${paradaNormalizada.ssc} | Cliente: ${paradaNormalizada.destinatario}`
    );
    return paradaNormalizada;
}