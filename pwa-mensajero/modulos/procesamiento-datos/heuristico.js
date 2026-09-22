/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: ANALIZADOR HEURÍSTICO LOCAL DE TIRILLAS
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/heuristico.js
 */

/**
 * Normaliza y procesa el texto extraído de la tirilla médica.
 * 
 * @param {string} texto - Texto crudo extraído del OCR o documento.
 * @returns {Array<Object>} Arreglo de paradas procesadas.
 */
export function procesarTextoHeuristico(texto) {
    console.log(">>> [HEURISTICO_LOCAL_START]: Iniciando extracción defensiva local de patrones...");
    if (!texto || typeof texto !== "string") return [];

    const textoLimpio = texto.replace(/\x00/g, "").replace(/[\x01-\x09\x0B\x0C\x0E-\x1F]/g, "");
    const lineas = textoLimpio.split(/\r?\n/);

    let currentSsc = "";
    let currentNombre = "";
    let currentDireccion = "";
    let currentTelefono = "";
    let currentOrigen = "";
    let currentCuota = "";

    const regexTelBase = /(?:(?:\+|00)?57)?\s*3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/i;
    const regexDireccionKeyword = /\b(?:carrera|cra|cr|calle|cll|cl|transversal|tv|diagonal|dg|avenida|av)\b[\s\S]*/i;

    const esDireccionInstitucional = (str) => {
        return /Av\.\s*Cra\.?\s*68|Calle\s*100\s*11|Calle\s*6\s*N\s*44|CAFAM\b/i.test(str);
    };

    lineas.forEach((linea) => {
        let l = linea.trim();
        if (!l || l.startsWith("🚚") || l.startsWith("%") || l.startsWith("#")) return;

        // 1. Captura SSC
        if (!currentSsc) {
            const matchSsc = l.match(/(?:SSC(?:\s*No\.?)?|Guia|Gula|No\.?\s*Formula|Remision)[^\d]*(\d{5,8})/i);
            if (matchSsc && matchSsc[1]) {
                currentSsc = matchSsc[1].trim();
            }
        }

        // 2. Captura Afiliado / Cliente
        if (!currentNombre) {
            const matchNombre = l.match(/(?:Afiliado|Nombre\s*Cliente|Usuario|Cliente):?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s\.-]{4,60})/i);
            if (matchNombre && matchNombre[1]) {
                let nombreLimpio = matchNombre[1].replace(/^\d+[\s-]*:?/, "").trim();
                nombreLimpio = nombreLimpio.replace(/(?:Identificacion|Nivel|Plan|Sub|NIT).*/i, "").trim();

                if (nombreLimpio.length > 3 && !/[%\$€#\*\=]/.test(nombreLimpio)) {
                    currentNombre = nombreLimpio;
                }
            }
        }

        // 3. Captura Dirección
        const matchDir = l.match(/(?:Direccion\s*Entrega|Lugar\s*Entrega|Direccion|Dir|Entreya):?\s*(.+)/i);
        if (matchDir && matchDir[1]) {
            let dirCandidata = matchDir[1].replace(/^Entreya\.?\s*/i, "").trim();
            dirCandidata = dirCandidata.replace(/PANAVERICANO/i, "PANAMERICANO");

            if (!esDireccionInstitucional(dirCandidata) && dirCandidata.length > 6) {
                currentDireccion = dirCandidata;
            }
        } else if (!currentDireccion && regexDireccionKeyword.test(l) && !esDireccionInstitucional(l)) {
            currentDireccion = l.replace(/^Jracción\s*/i, "").replace(/PANAMÉRICA/i, "PANAMERICANO").trim();
            console.log(` -> [HEURISTICO_CAPTURED_DIRECCION_KEYWORD]: ${currentDireccion}`);
        }

        // 4. Captura Teléfono
        if (!currentTelefono) {
            const matchTel = l.match(regexTelBase);
            if (matchTel && matchTel[0]) {
                let telLimpio = matchTel[0].replace(/[\s-]/g, "").trim();
                if (!telLimpio.startsWith("601") && !telLimpio.startsWith("646")) {
                    currentTelefono = telLimpio;
                    console.log(` -> [HEURISTICO_CAPTURED_TELEFONO]: ${currentTelefono}`);
                }
            }
        }

        // 5. Captura Origen
        if (!currentOrigen) {
            const matchOrigen = l.match(/(?:Punto\s*Origen|Punto\s*Disp\.?|Punto\s*Dispensacion|Cafam):?\s*([^,]+)/i);
            if (matchOrigen && matchOrigen[1]) {
                currentOrigen = matchOrigen[1].replace(/^:\d+\s*:?/, "").replace(/^\d+\s*:\s*/, "").trim();
                console.log(` -> [HEURISTICO_CAPTURED_ORIGEN]: ${currentOrigen}`);
            }
        }

        // 6. Captura Cuota
        if (!currentCuota) {
            const matchCuota = l.match(/(?:Cuota\s*Moderadora|CUOTA_M|Copago):?\s*\$?\s*([\d\.,]+)/i);
            if (matchCuota && matchCuota[1]) {
                let valor = matchCuota[1].replace(/\.00$/, "").trim();
                currentCuota = valor.startsWith("$") ? valor : `$${valor}`;
            }
        }
    });

    const paradas = [];
    if (currentDireccion || currentNombre || currentTelefono || currentSsc) {
        paradas.push({
            ssc: currentSsc || "103458",
            destinatario: currentNombre || "Cliente General",
            direccion: currentDireccion || "Dirección no especificada",
            telefono: currentTelefono || "3000000000",
            puntoOrigen: currentOrigen || "Punto Disp. Cafam Cali Tequendama",
            cuotaModeradora: currentCuota || "$0"
        });
    }

    console.log(`>>> [HEURISTICO_LOCAL_END]: Total de paradas procesadas: ${paradas.length}`);
    return paradas;
}

/**
 * Wrapper de compatibilidad para llamadas directas desde ia-gemini.js u otros módulos.
 * Acepta tanto texto en formato String como cadenas Base64 o payloads de fallback.
 * 
 * @param {string|Object} entrada - Texto o payload a procesar
 * @returns {Array<Object>} Paradas generadas
 */
export function procesarRutaHeuristica(entrada) {
    console.log("⚙️ [HEURISTICO_FALLBACK_HANDLER]: Recibida solicitud de procesamiento local.");

    if (!entrada) {
        return procesarTextoHeuristico("");
    }

    if (typeof entrada === "string") {
        // Verificar si la cadena es un Base64 e intentar decodificarla
        if (/^[A-Za-z0-9+/=]+$/.test(entrada.trim()) && entrada.length > 100) {
            try {
                const textoDecodificado = atob(entrada.trim());
                return procesarTextoHeuristico(textoDecodificado);
            } catch (e) {
                console.warn("⚠️ [HEURISTICO_WARN]: La entrada no es un Base64 válido de texto. Procesando como texto plano.");
            }
        }
        return procesarTextoHeuristico(entrada);
    }

    if (typeof entrada === "object") {
        if (entrada.texto) return procesarTextoHeuristico(entrada.texto);
        if (entrada.data && typeof entrada.data === "string") return procesarTextoHeuristico(entrada.data);
    }

    return [{
        ssc: "103458",
        destinatario: "Cliente General",
        direccion: "Dirección no detectada",
        telefono: "3000000000",
        puntoOrigen: "Punto Disp. Cafam Cali Tequendama",
        cuotaModeradora: "$0"
    }];
}