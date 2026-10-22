/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: ANALIZADOR HEURÍSTICO LOCAL DE TIRILLAS Y PLANILLAS
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/heuristico.js
 * Arquitectura: Determinista Local-First (Modo 3 Sin IA) / Captura GPS Nativa / Parser OCR Resiliente
 */

export function procesarTextoHeuristico(texto) {
    console.log(">>> [HEURISTICO_LOCAL_START]: Iniciando extracción defensiva local de patrones...");
    
    if (!texto || typeof texto !== "string") {
        console.warn("⚠️ [HEURISTICO_LOCAL]: Texto de entrada nulo o no válido.");
        return [];
    }

    // 1. Sanitización de caracteres nulos o de control
    const textoSanitizado = texto.replace(/\x00/g, "").replace(/[\x01-\x09\x0B\x0C\x0E-\x1F]/g, "");

    // 2. Autodetección de total de paradas explícito
    let totalParadasEsperadas = null;
    const matchTotal = textoSanitizado.match(/TOTAL\s*PARADAS:\s*(\d+)/i);
    if (matchTotal) {
        totalParadasEsperadas = parseInt(matchTotal[1], 10);
        console.log(`📊 [HEURISTICO_LOCAL]: Límite explícito detectado en documento: ${totalParadasEsperadas} paradas.`);
    }

    // Filtros de ruido para excluir cabeceras o meta-información
    const regexFiltroRuido = /PLANILLA DE MENSAJERÍA|REPORTE DE TRAZABILIDAD|MENSAJERO:|SCC\/STOP|DATOS DE ENTREGA|ESTADO & TRAZABILIDAD|Sincronización Local-First|Certificado Digital|FECHA PLANILLA:|TOTAL PARADAS:|Exportado:|#PLN-/i;

    // Split y limpieza inicial de la tubería OCR '|' al inicio de cada línea
    const lineas = textoSanitizado
        .split(/\r?\n/)
        .map(l => l.replace(/^\|\s*/, "").trim())
        .filter(l => l.length > 0 && !regexFiltroRuido.test(l));

    const paradas = [];
    let currentParada = null;

    // RegEx de alta tolerancia
    const regexSscFlexible = /\b(\d{5,8})\b/;
    const regexStopTag = /^Stop\s*#(\d+)/i;
    const regexTelBase = /(?:Tel(?:éfono)?:\s*)?((?:\+|00)?57)?\s*(3\d{2}[\s-]?\d{3}[\s-]?\d{4})\b/i;
    const regexCuota = /(?:Cuota(?:\s*Moderadora)?|CUOTA_M|Copago|Valor):\s*\$?\s*([\w\.\d]+)/i;
    const regexGps = /GPS:\s*(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)|GPS:\s*(-?\d+\.\d+)(-76\.\d+)/i;
    const regexDireccionKeyword = /\b(?:carrera|cra|cr|crr|calle|cll|cl|transversal|tv|diagonal|dg|avenida|av|auto|autopista)\b/i;

    const guardarParadaSiValida = (parada) => {
        if (!parada || !parada.ssc) return;
        
        const sscClave = String(parada.ssc).trim();
        const clienteValido = (parada.destinatario && parada.destinatario.length > 2) 
            ? parada.destinatario.trim() 
            : "Cliente General";
        
        paradas.push({
            id: sscClave,
            ssc: sscClave,
            scc: sscClave,
            stopNum: parada.stopNum || paradas.length + 1,
            destinatario: clienteValido,
            cliente: clienteValido,
            direccion: parada.direccion ? parada.direccion.trim() : "Dirección no especificada",
            dir: parada.direccion ? parada.direccion.trim() : "Dirección no especificada",
            telefono: parada.telefono ? parada.telefono.trim() : "3000000000",
            tel: parada.telefono ? parada.telefono.trim() : "3000000000",
            lat: parada.lat !== undefined ? parada.lat : null,
            lng: parada.lng !== undefined ? parada.lng : null,
            latitud: parada.lat !== undefined ? parada.lat : null,
            longitud: parada.lng !== undefined ? parada.lng : null,
            puntoOrigen: "Punto Disp. Cafam Cali Tequendama",
            cuotaModeradora: parada.cuotaModeradora || "$0",
            estado: "ASIGNADO",
            status: "asignado"
        });
    };

    for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];

        const matchStop = l.match(regexStopTag);
        if (matchStop) {
            if (currentParada) {
                currentParada.stopNum = parseInt(matchStop[1], 10);
            }
            continue;
        }

        const matchSsc = l.match(regexSscFlexible);
        const esLineaNuevoBloque = matchSsc && !l.includes("Tel:") && !l.includes("$") && 
                                  !l.toLowerCase().includes("gps") && !regexDireccionKeyword.test(l);

        if (esLineaNuevoBloque) {
            const numElegido = matchSsc[1];
            if (!numElegido.startsWith("202") && !numElegido.startsWith("300")) {
                if (currentParada) guardarParadaSiValida(currentParada);

                currentParada = {
                    ssc: numElegido,
                    scc: numElegido,
                    stopNum: null,
                    destinatario: "",
                    direccion: "",
                    telefono: "",
                    lat: null,
                    lng: null,
                    cuotaModeradora: "$0"
                };

                // Si viene nombre anidado con pipeline en la misma línea
                if (l.includes("|")) {
                    const partes = l.split("|").map(p => p.trim());
                    if (partes[1] && !partes[1].includes("ASIGNADO") && !partes[1].includes("ENTREGADO")) {
                        currentParada.destinatario = partes[1];
                    }
                }
                continue;
            }
        }

        if (!currentParada) continue;

        // Captura GPS
        const matchGps = l.match(regexGps);
        if (matchGps) {
            currentParada.lat = parseFloat(matchGps[1] || matchGps[3]);
            currentParada.lng = parseFloat(matchGps[2] || matchGps[4]);
            console.log(`📍 [HEURISTICO_GPS]: Coordenadas extraídas para SSC #${currentParada.ssc}: [${currentParada.lat}, ${currentParada.lng}]`);
            continue;
        }

        // Captura Teléfono y Cuota
        if (l.toLowerCase().includes("tel:") || l.toLowerCase().includes("cuota:")) {
            const matchTel = l.match(regexTelBase);
            if (matchTel && matchTel[2]) {
                currentParada.telefono = matchTel[2].replace(/[\s-]/g, "");
            }

            const matchCuota = l.match(regexCuota);
            if (matchCuota && matchCuota[1]) {
                let cuotaVal = matchCuota[1].trim();
                currentParada.cuotaModeradora = cuotaVal.startsWith("$") ? cuotaVal : `$${cuotaVal}`;
            }
            continue;
        }

        // Captura Dirección
        const matchDir = l.match(regexDireccionKeyword);
        if (matchDir) {
            currentParada.direccion = currentParada.direccion ? `${currentParada.direccion} ${l}` : l;
            continue;
        }

        // 6. Captura de Nombre de Destinatario (Resiliente a nombres de empresa con números)
        if (!currentParada.destinatario && l.length > 2 && !l.includes("ASIGNADO") && !l.includes("ENTREGADO")) {
            // Evaluamos que la línea NO sea un bloque únicamente de números (ej: un teléfono mal parseado)
            const sinEspacios = l.replace(/[\s-]/g, "");
            if (!/^\d+$/.test(sinEspacios)) {
                currentParada.destinatario = l.trim();
            }
        }
    }

    if (currentParada) guardarParadaSiValida(currentParada);

    // Truncamiento defensivo
    let paradasFinales = paradas;
    if (totalParadasEsperadas && paradas.length > totalParadasEsperadas) {
        console.warn(`⚠️ [HEURISTICO_LOCAL]: Ajustando colección de ${paradas.length} a las ${totalParadasEsperadas} declaradas en planilla.`);
        paradasFinales = paradas.slice(0, totalParadasEsperadas);
    }

    console.log(`>>> [HEURISTICO_LOCAL_END]: Total de paradas procesadas: ${paradasFinales.length}`, paradasFinales);
    return paradasFinales;
}

export function procesarRutaHeuristica(entrada) {
    if (!entrada) return procesarTextoHeuristico("");
    if (typeof entrada === "string") {
        if (/^[A-Za-z0-9+/=]+$/.test(entrada.trim()) && entrada.length > 100) {
            try { return procesarTextoHeuristico(atob(entrada.trim())); } 
            catch (e) { console.warn("⚠️ [HEURISTICO]: Falló decodificación Base64. Procesando como texto directo."); }
        }
        return procesarTextoHeuristico(entrada);
    }
    if (typeof entrada === "object") {
        if (entrada.texto) return procesarTextoHeuristico(entrada.texto);
        if (entrada.data && typeof entrada.data === "string") return procesarTextoHeuristico(entrada.data);
    }
    return [];
}

// Bindings globales de interoperabilidad
if (typeof window !== "undefined") {
    window.procesarTextoHeuristico = procesarTextoHeuristico;
    window.procesarRutaHeuristica = procesarRutaHeuristica;
    window.extraerParadasHeuristicoLocal = procesarTextoHeuristico;
}