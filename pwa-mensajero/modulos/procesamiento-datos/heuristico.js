/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: ANALIZADOR HEURÍSTICO LOCAL DE TIRILLAS Y PLANILLAS
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/heuristico.js
 * Arquitectura: Determinista Local-First (Modo 3 Sin IA) / Captura GPS Nativa / Soporte de Planillas Refactorizadas
 */

/**
 * Procesa el texto plano extraído de un documento PDF (vía PDF.js local) y estructuración de paradas.
 * Compatible con planillas tradicionales y planillas refactorizadas con tags 'Stop #N' y 'GPS: lat,lng'.
 * 
 * @param {string} texto - Cadena cruda decodificada del buffer PDF
 * @returns {Array<Object>} Colección de paradas estructuradas
 */
export function procesarTextoHeuristico(texto) {
    console.log(">>> [HEURISTICO_LOCAL_START]: Iniciando extracción defensiva local de patrones...");
    
    if (!texto || typeof texto !== "string") {
        console.warn("⚠️ [HEURISTICO_LOCAL]: Texto de entrada nulo o no válido.");
        return [];
    }

    // Limpieza de caracteres nulos o no imprimibles
    const textoLimpio = texto.replace(/\x00/g, "").replace(/[\x01-\x09\x0B\x0C\x0E-\x1F]/g, "");
    const lineas = textoLimpio.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const paradas = [];
    let currentParada = null;

    // Expresiones regulares de detección táctica
    const regexSsc = /^\b(\d{5,8})\b$/;
    const regexTelBase = /(?:Tel(?:éfono)?:\s*)?((?:\+|00)?57)?\s*(3\d{2}[\s-]?\d{3}[\s-]?\d{4})\b/i;
    const regexCuota = /(?:Cuota(?:\s*Moderadora)?|CUOTA_M|Copago):\s*\$?\s*([\w\.\d]+)/i;
    const regexGps = /GPS:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i;
    const regexDireccionKeyword = /\b(?:carrera|cra|cr|crr|calle|cll|cl|transversal|tv|diagonal|dg|avenida|av)\b/i;

    // Filtro estricto para ignorar fragmentos y ruido del PDF
    const regexFiltroRuido = /^\s*\|?\s*(DEVUELTO|ENTREGADO|PENDIENTE|CANCELADO|EN RUTA|ASIGNADO)\s*$|\d{1,2}\/\d{1,2}\/\d{2,4}|p\.\s*m\.|a\.\s*m\.|localhost|ID PLANILLA|PLACA VEHÍCULO|REPORTE DE OPERACIONES|PLANILLA DE MENSAJERÍA|Runner\s*-\s*Mensajero|Documento oficial|FECHA PLANILLA|SCC\/SEGUIMIENTO|SCC\/STOP|DATOS DE LA PARADA|DATOS DE ENTREGA|NOVEDADES \/ ESTADO|Sincronización Local-First|Certificado Digital/i;

    const guardarParadaSiValida = (parada) => {
        if (!parada) return;
        if (parada.scc || parada.ssc || parada.direccion || parada.destinatario) {
            const sscClave = String(parada.scc || parada.ssc || `SCC-${Math.floor(100000 + Math.random() * 900000)}`).trim();
            const clienteValido = (parada.destinatario && !regexFiltroRuido.test(parada.destinatario)) 
                ? parada.destinatario.trim() 
                : "Cliente General";
            
            paradas.push({
                id: sscClave,
                ssc: sscClave,
                scc: sscClave,
                destinatario: clienteValido,
                cliente: clienteValido,
                direccion: parada.direccion ? parada.direccion.trim() : "Dirección no especificada",
                telefono: parada.telefono ? parada.telefono.trim() : "3000000000",
                lat: parada.lat !== undefined ? parada.lat : null,
                lng: parada.lng !== undefined ? parada.lng : null,
                latitud: parada.lat !== undefined ? parada.lat : null,
                longitud: parada.lng !== undefined ? parada.lng : null,
                puntoOrigen: parada.puntoOrigen || "Punto Disp. Cafam Cali Tequendama",
                cuotaModeradora: parada.cuotaModeradora || "$0",
                estado: "ASIGNADO",
                status: "asignado"
            });
        }
    };

    for (let i = 0; i < lineas.length; i++) {
        let l = lineas[i];

        // Omitir líneas vacías, decoradores o ruido estructural de la planilla
        if (!l || l.startsWith("🚚") || l.startsWith("%") || l.startsWith("#") || regexFiltroRuido.test(l)) {
            continue;
        }

        // Ignorar etiquetas tipo 'Stop #1', 'Stop #2' (usadas en planillas refactorizadas)
        if (/^Stop\s*#\d+/i.test(l)) {
            continue;
        }

        // 1. Detección de nuevo identificador de parada (SSC/SCC de 5 a 8 dígitos)
        const matchScc = l.match(regexScc);
        if (matchScc && !l.includes("Tel:") && !l.includes("$") && !l.includes("ID PLANILLA") && !l.toLowerCase().includes("gps")) {
            if (currentParada) {
                guardarParadaSiValida(currentParada);
            }

            currentParada = {
                scc: matchScc[1],
                ssc: matchScc[1],
                destinatario: "",
                direccion: "",
                telefono: "",
                lat: null,
                lng: null,
                puntoOrigen: "Punto Disp. Cafam Cali Tequendama",
                cuotaModeradora: ""
            };

            // Caso: SCC y Nombre fusionados en la misma línea separados por '|'
            if (l.includes("|")) {
                const partes = l.split("|").map(p => p.trim());
                if (partes[1] && !regexFiltroRuido.test(partes[1])) {
                    const matchDirCol = partes[1].match(regexDireccionKeyword);
                    if (matchDirCol && matchDirCol.index > 5) {
                        currentParada.destinatario = partes[1].substring(0, matchDirCol.index).trim();
                        currentParada.direccion = partes[1].substring(matchDirCol.index).trim();
                    } else if (!matchDirCol) {
                        currentParada.destinatario = partes[1];
                    }
                }
            }
            continue;
        }

        if (!currentParada) continue;

        let lineaContenido = l.startsWith("|") ? l.replace(/^\|\s*/, "").trim() : l;
        if (regexFiltroRuido.test(lineaContenido)) continue;

        // 2. Extracción de Coordenadas GPS Nativas (GPS: lat,lng)
        const matchGps = lineaContenido.match(regexGps);
        if (matchGps) {
            currentParada.lat = parseFloat(matchGps[1]);
            currentParada.lng = parseFloat(matchGps[2]);
            console.log(`📍 [HEURISTICO_GPS]: Coordenadas extraídas para SSC #${currentParada.ssc}: [${currentParada.lat}, ${currentParada.lng}]`);
            continue;
        }

        // 3. Extracción de Teléfono y Cuota Moderadora
        if (lineaContenido.toLowerCase().includes("tel:") || lineaContenido.toLowerCase().includes("cuota:")) {
            const matchTel = lineaContenido.match(regexTelBase);
            if (matchTel && matchTel[2]) {
                currentParada.telefono = matchTel[2].replace(/[\s-]/g, "");
            }

            const matchCuota = lineaContenido.match(regexCuota);
            if (matchCuota && matchCuota[1]) {
                let cuotaVal = matchCuota[1].trim();
                currentParada.cuotaModeradora = cuotaVal.startsWith("$") ? cuotaVal : `$${cuotaVal}`;
            }
            continue;
        }

        // 4. Extracción Inteligente de Dirección y Nombre
        const matchDir = lineaContenido.match(regexDireccionKeyword);
        if (matchDir) {
            // Si la dirección no inicia al principio de la línea (índice > 5), el texto anterior corresponde al destinatario
            if (matchDir.index > 5 && !currentParada.destinatario) {
                const posibleNombre = lineaContenido.substring(0, matchDir.index).trim();
                currentParada.destinatario = posibleNombre.replace(/\|/g, "").trim();
            }
            const soloDireccion = lineaContenido.substring(matchDir.index).trim();
            currentParada.direccion = currentParada.direccion 
                ? `${currentParada.direccion} ${soloDireccion}` 
                : soloDireccion;
            continue;
        }

        // 5. Captura del Nombre si se encuentra en una línea independiente
        if (!currentParada.destinatario && lineaContenido.length > 2 && !/\d/.test(lineaContenido)) {
            currentParada.destinatario = lineaContenido.replace(/\|/g, "").trim();
        }
    }

    // Flush de la última parada del documento
    if (currentParada) {
        guardarParadaSiValida(currentParada);
    }

    console.log(`>>> [HEURISTICO_LOCAL_END]: Total de paradas procesadas: ${paradas.length}`, paradas);
    return paradas;
}

/**
 * Función wrapper compatible con payloads en Base64, strings directos u objetos estructurados.
 * 
 * @param {string|Object} entrada 
 * @returns {Array<Object>}
 */
export function procesarRutaHeuristica(entrada) {
    if (!entrada) return procesarTextoHeuristico("");
    
    if (typeof entrada === "string") {
        if (/^[A-Za-z0-9+/=]+$/.test(entrada.trim()) && entrada.length > 100) {
            try { 
                return procesarTextoHeuristico(atob(entrada.trim())); 
            } catch (e) {
                console.warn("⚠️ [HEURISTICO]: Falló decodificación Base64. Procesando como texto directo.");
            }
        }
        return procesarTextoHeuristico(entrada);
    }
    
    if (typeof entrada === "object") {
        if (entrada.texto) return procesarTextoHeuristico(entrada.texto);
        if (entrada.data && typeof entrada.data === "string") return procesarTextoHeuristico(entrada.data);
    }
    
    return [];
}

// Bindings globales inmediatos para interoperabilidad y compatibilidad
if (typeof window !== "undefined") {
    window.procesarTextoHeuristico = procesarTextoHeuristico;
    window.procesarRutaHeuristica = procesarRutaHeuristica;
    window.extraerParadasHeuristicoLocal = procesarTextoHeuristico;
}