/**
 * PROTOCOLO MACONDO - ESPECIALIDAD: PARSER DE TEXTOS Y PAYLOADS
 * Ubicación: pwa-mensajero/modulos/importer/parser-payload.js
 * Función: Decodifica entradas de WhatsApp, expresiones planas y fragmentos JSON/URL.
 */

import { procesarTextoHeuristico } from "../procesamiento-datos/heuristico.js";

/**
 * Parsea un texto plano estructurado (WhatsApp / Chat).
 */
export function parsearTextoPlanoWhatsApp(texto) {
    console.log(">>> [IMPORTER_PARSE_TEXTO]: Invocando análisis sobre texto plano...");
    if (!texto || typeof texto !== "string") {
        console.warn(">>> [PARSER_LOCAL_WARN]: Texto nulo o inválido recibido.");
        return [];
    }

    if (texto.includes("%PDF-") || texto.includes("/Root") || texto.includes("endobj")) {
        console.warn(">>> [PARSER_LOCAL_ABORT]: Código binario PDF detectado en lectura plana.");
        return [];
    }

    const textoLimpio = texto.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, "");
    const lineas = textoLimpio.split(/\r?\n/);

    let currentSsc = "";
    let currentNombre = "";
    let currentDireccion = "";
    let currentTelefono = "";
    let currentOrigen = "";
    let currentCuota = "";

    const regexTelBase = /(?:(?:\+|00)57)?\s*3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/;

    lineas.forEach((linea) => {
        let l = linea.trim();
        if (!l || l.startsWith("🚚") || l.startsWith("%") || l.startsWith("#")) return;

        const matchSsc = l.match(/SSC(?:\s*No\.?)?:?\s*(\d+)/i);
        if (matchSsc) currentSsc = matchSsc[1];

        const matchNombre = l.match(/(?:Afiliado|Nombre Cliente|Usuario):?\s*([A-Za-z\s]+)/i);
        if (matchNombre) currentNombre = matchNombre[1].trim();

        const matchDireccion = l.match(/(?:Direccion Entrega|Direccion):?\s*([^TEL]+)/i);
        if (matchDireccion) currentDireccion = matchDireccion[1].trim();

        const matchTel = l.match(regexTelBase);
        if (matchTel && matchTel[0]) currentTelefono = matchTel[0].replace(/[\s-]/g, "").trim();

        const matchOrigen = l.match(/(?:Punto Origen|Punto Disp\.?):?\s*([^,]+)/i);
        if (matchOrigen) currentOrigen = matchOrigen[1].trim();

        const matchCuota = l.match(/(?:Cuota Moderadora|CUOTA_M\.?|Copago):?\s*(\$?\s*[\d\.]+)/i);
        if (matchCuota) currentCuota = matchCuota[1];
    });

    const paradas = [];
    if (currentDireccion || currentNombre || currentTelefono) {
        paradas.push({
            ssc: currentSsc || "103458",
            destinatario: currentNombre || "Cliente General",
            direccion: currentDireccion || "Dirección no especificada",
            telefono: currentTelefono || "3000000000",
            puntoOrigen: currentOrigen || "Cafam Cali Tequendama",
            cuotaModeradora: currentCuota || "$0"
        });
    }

    return paradas.length > 0 ? paradas : procesarTextoHeuristico(textoLimpio);
}

/**
 * Procesa entradas heterogéneas (JSON, URL con payload o Texto).
 */
export function parsearPayloadODocumento(entrada) {
    if (!entrada || !entrada.trim()) return [];
    const entradaLimpia = entrada.trim();
    let listaParadas = [];

    try {
        const matchPayload = entradaLimpia.match(/(?:payload=)([^&\s]+)/);
        if (matchPayload && matchPayload[1]) {
            listaParadas = JSON.parse(decodeURIComponent(matchPayload[1]));
        } else if (entradaLimpia.startsWith("[") || entradaLimpia.startsWith("{")) {
            listaParadas = JSON.parse(entradaLimpia);
        } else {
            listaParadas = parsearTextoPlanoWhatsApp(entradaLimpia);
        }

        if (!Array.isArray(listaParadas)) listaParadas = [listaParadas];
        return listaParadas;
    } catch (err) {
        return parsearTextoPlanoWhatsApp(entradaLimpia);
    }
}