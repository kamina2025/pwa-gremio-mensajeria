/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: ANALIZADOR HEURÍSTICO LOCAL DE TIRILLAS Y PLANILLAS
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/heuristico.js
 * Función: Extrae de forma robusta y divide líneas fusionadas por PDF.js (Nombre + Dirección).
 */

export function procesarTextoHeuristico(texto) {
    console.log(">>> [HEURISTICO_LOCAL_START]: Iniciando extracción defensiva local de patrones...");
    if (!texto || typeof texto !== "string") return [];

    const textoLimpio = texto.replace(/\x00/g, "").replace(/[\x01-\x09\x0B\x0C\x0E-\x1F]/g, "");
    const lineas = textoLimpio.split(/\r?\n/);

    const paradas = [];
    let currentParada = null;

    // Patrones clave (el \b asegura que no detecte letras dentro de nombres, ej: "Cristian" != "cr")
    const regexScc = /\b(\d{5,8})\b/;
    const regexTelBase = /(?:Tel(?:éfono)?:\s*)?((?:\+|00)?57)?\s*(3\d{2}[\s-]?\d{3}[\s-]?\d{4})\b/i;
    const regexCuota = /(?:Cuota(?:\s*Moderadora)?|CUOTA_M|Copago):\s*\$?\s*([\w\.\d]+)/i;
    const regexDireccionKeyword = /\b(?:carrera|cra|cr|crr|calle|cll|cl|transversal|tv|diagonal|dg|avenida|av)\b/i;

    // Filtro estricto para ignorar fragmentos del PDF
    const regexFiltroRuido = /^\s*\|?\s*(DEVUELTO|ENTREGADO|PENDIENTE|CANCELADO|EN RUTA)\s*$|\d{1,2}\/\d{1,2}\/\d{2,4}|p\.\s*m\.|a\.\s*m\.|localhost|ID PLANILLA|PLACA VEHÍCULO|REPORTE DE OPERACIONES|PLANILLA DE MENSAJERÍA|Runner\s*-\s*Mensajero|Documento oficial|FECHA PLANILLA|SCC\/SEGUIMIENTO|DATOS DE LA PARADA|NOVEDADES \/ ESTADO/i;

    const guardarParadaSiValida = (parada) => {
        if (!parada) return;
        if (parada.scc || parada.direccion || parada.destinatario) {
            paradas.push({
                ssc: parada.scc || `SCC-${Math.floor(100000 + Math.random() * 900000)}`,
                destinatario: (parada.destinatario && !regexFiltroRuido.test(parada.destinatario)) ? parada.destinatario : "Cliente General",
                direccion: parada.direccion || "Dirección no especificada",
                telefono: parada.telefono || "3000000000",
                puntoOrigen: parada.puntoOrigen || "Punto Disp. Cafam Cali Tequendama",
                cuotaModeradora: parada.cuotaModeradora || "$0"
            });
        }
    };

    for (let i = 0; i < lineas.length; i++) {
        let l = lineas[i].trim();

        // Omitir líneas vacías o de ruido estructural
        if (!l || l.startsWith("🚚") || l.startsWith("%") || l.startsWith("#") || regexFiltroRuido.test(l)) {
            continue;
        }

        // 1. Detección de número SCC
        const matchScc = l.match(regexScc);
        if (matchScc && !l.includes("Tel:") && !l.includes("$") && !l.includes("ID PLANILLA")) {
            if (currentParada) {
                guardarParadaSiValida(currentParada);
            }

            currentParada = {
                scc: matchScc[1],
                destinatario: "",
                direccion: "",
                telefono: "",
                puntoOrigen: "",
                cuotaModeradora: ""
            };

            // Caso: El SCC y el nombre están en la misma línea separados por '|'
            if (l.includes("|")) {
                const partes = l.split("|").map(p => p.trim());
                if (partes[1] && !regexFiltroRuido.test(partes[1])) {
                    // Prevenir que absorba una dirección pegada al nombre
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

        // 2. Extracción de Teléfono y Cuota
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

        // 3. Extracción Inteligente de Dirección y Posible Nombre Fusionado
        const matchDir = lineaContenido.match(regexDireccionKeyword);
        if (matchDir) {
            // Si la dirección no empieza al principio (índice > 5), lo de atrás es el nombre
            if (matchDir.index > 5 && !currentParada.destinatario) {
                const posibleNombre = lineaContenido.substring(0, matchDir.index).trim();
                currentParada.destinatario = posibleNombre.replace(/\|/g, "").trim();
            }
            // Lo de adelante es la dirección
            const soloDireccion = lineaContenido.substring(matchDir.index).trim();
            currentParada.direccion = currentParada.direccion ? `${currentParada.direccion} ${soloDireccion}` : soloDireccion;
            continue;
        }

        // 4. Captura del Nombre si está completamente solo en la línea
        if (!currentParada.destinatario && lineaContenido.length > 2) {
            currentParada.destinatario = lineaContenido.replace(/\|/g, "").trim();
        }
    }

    if (currentParada) {
        guardarParadaSiValida(currentParada);
    }

    console.log(`>>> [HEURISTICO_LOCAL_END]: Total de paradas procesadas: ${paradas.length}`, paradas);
    return paradas;
}

export function procesarRutaHeuristica(entrada) {
    if (!entrada) return procesarTextoHeuristico("");
    if (typeof entrada === "string") {
        if (/^[A-Za-z0-9+/=]+$/.test(entrada.trim()) && entrada.length > 100) {
            try { return procesarTextoHeuristico(atob(entrada.trim())); } catch (e) {}
        }
        return procesarTextoHeuristico(entrada);
    }
    if (typeof entrada === "object") {
        if (entrada.texto) return procesarTextoHeuristico(entrada.texto);
        if (entrada.data && typeof entrada.data === "string") return procesarTextoHeuristico(entrada.data);
    }
    return [];
}