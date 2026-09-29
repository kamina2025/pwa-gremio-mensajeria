/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: AGENTE DE INTELIGENCIA DE TRIPLE CAPA
 * Ubicación: pwa-mensajero/modulos/ai-agent.js
 * Arquitectura: Edge AI Local (Gemini Nano) -> Cloud Nodal Proxy (Gemini API) -> Trinchera Heurística
 */

/**
 * Optimiza la secuencia de la ruta de entregas reduciendo los tokens del payload.
 * 
 * @param {Array<Object>} datosRutaRaw - Arreglo de paradas con los datos de las tirillas médicas.
 * @returns {Promise<Array<Object>>} Arreglo de paradas optimizado secuencialmente.
 */
export async function procesarCargaConAI(datosRutaRaw) {
    console.log(">>> [AI_MENSAJERO_INIT]: Evaluando arquitectura de niveles de inteligencia táctica...");

    if (!Array.isArray(datosRutaRaw) || datosRutaRaw.length <= 1) {
        console.log(">>> [AI_MENSAJERO_SKIP]: Lote insuficiente para optimización. Devolviendo sin cambios.");
        return datosRutaRaw;
    }

    // Proyección ligera de datos para reducir el consumo de tokens en Gemini
    const payloadMinificado = datosRutaRaw.map((p, idx) => ({
        _idx: idx,
        ssc: p.ssc || "",
        dir: p.direccion || "",
        origen: p.puntoOrigen || ""
    }));

    // --- PRIORIDAD 1: INTENTAR EDGE AI LOCAL NATIVO (Gemini Nano) ---
    const windowAI = typeof window !== "undefined" ? (window.ai?.languageModel || window.ai) : null;

    if (windowAI) {
        try {
            console.log(">>> [AI_LOCAL]: Intentando procesar ruta en chip local con Gemini Nano...");
            
            let session;
            if (window.ai.languageModel && typeof window.ai.languageModel.create === "function") {
                session = await window.ai.languageModel.create();
            } else if (typeof window.ai.createTextSession === "function") {
                session = await window.ai.createTextSession();
            }

            if (session) {
                const promptLocal = `Eres un copiloto telemático de entregas en Cali, Colombia. ` +
                    `Ordena la siguiente lista para optimizar el recorrido vial: ` +
                    `${JSON.stringify(payloadMinificado)}. ` +
                    `Responde EXCLUSIVAMENTE un JSON plano (un array de objetos con las mismas llaves y orden óptimo). Sin markdown.`;

                let respuestaTexto = await session.prompt(promptLocal);
                respuestaTexto = respuestaTexto.replace(/```json/gi, "").replace(/```/g, "").trim();

                const indicesOptimizados = JSON.parse(respuestaTexto);

                if (Array.isArray(indicesOptimizados) && indicesOptimizados.length === datosRutaRaw.length) {
                    console.log(">>> [AI_LOCAL_OK]: Secuencia de ruta optimizada localmente con éxito.");
                    // Mapear los datos completos basados en la respuesta devuelta por el modelo
                    return indicesOptimizados.map(item => datosRutaRaw[item._idx] || item);
                }
            }
        } catch (e) {
            console.warn(">>> [AI_LOCAL_FAIL]: Gemini Nano local no disponible o respuesta no parseable.", e);
        }
    }

    // --- PRIORIDAD 2: ENLACE SATELITAL / CLOUD (Vía Backend REST API PHP) ---
    try {
        console.log(">>> [AI_CLOUD]: Conectando con Google Gemini API REST vía Nodal Proxy...");
        
        const targetUrl = (window.ENDPOINT_API_PHP || '../api.php') + '?action=optimizar_ia_cloud';

        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lote: payloadMinificado })
        });

        if (!res.ok) {
            throw new Error(`Servidor HTTP error status ${res.status}`);
        }

        const data = await res.json();
        
        if (data.status === 'success' && Array.isArray(data.lote_optimizado)) {
            console.log(">>> [AI_CLOUD_OK]: Vector de optimización satelital recibido exitosamente.");
            
            // Reconstruir el lote completo a partir de la minificación devuelta
            return data.lote_optimizado.map(item => {
                const original = datosRutaRaw.find(r => String(r.ssc) === String(item.ssc));
                return original ? { ...original, ...item } : item;
            });
        } else {
            throw new Error(data.message || 'Respuesta Cloud no estructurada');
        }
    } catch (err) {
        console.warn(">>> [AI_CLOUD_FAIL]: Enlace satelital no disponible. Conmutando a Trinchera.", err);
    }

    // --- PRIORIDAD 3: MODO TRINCHERA (HEURÍSTICA GEOMÉTRICA LOCAL OFFLINE) ---
    console.log(">>> [AI_TRINCHERA]: Activando motor de ordenamiento determinista offline...");
    return ejecutarHeuristicaTrinchera(datosRutaRaw);
}

/**
 * MOTOR DE RESPALDO: Ordenamiento lineal determinista por SSC / ID de Parada
 * 
 * @param {Array<Object>} lote - Arreglo de paradas a ordenar.
 * @returns {Array<Object>} Arreglo ordenado por heurística local.
 */
export function ejecutarHeuristicaTrinchera(lote) {
    if (!Array.isArray(lote) || lote.length <= 1) return lote;
    
    return [...lote].sort((a, b) => {
        const idA = String(a.ssc || a.id_pedido || a.id || "");
        const idB = String(b.ssc || b.id_pedido || b.id || "");
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });
}

// Vinculación explícita al scope global de window para llamados dinámicos en PWA
if (typeof window !== "undefined") {
    window.procesarCargaConAI = procesarCargaConAI;
    window.ejecutarHeuristicaTrinchera = ejecutarHeuristicaTrinchera;
}