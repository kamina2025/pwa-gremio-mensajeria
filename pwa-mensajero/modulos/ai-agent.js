/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: AGENTE DE INTELIGENCIA DE TRIPLE CAPA
 * Ubicación: pwa-mensajero/modulos/ai-agent.js
 * Arquitectura: Edge AI Local (Gemini Nano) -> Cloud Nodal Proxy (Gemini API) -> Trinchera Heurística
 */

/**
 * Optimiza la secuencia de la ruta de entregas evaluando la capacidad de cómputo disponible.
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

    // --- PRIORIDAD 1: INTENTAR EDGE AI LOCAL NATIVO (Gemini Nano en Dispositivo) ---
    if (typeof window !== "undefined" && window.ai && typeof window.ai.createTextSession === "function") {
        try {
            console.log(">>> [AI_LOCAL]: Procesando optimización de ruta en la trinchera con Gemini Nano...");
            const session = await window.ai.createTextSession();
            
            const promptLocal = `Actúa como el copiloto telemático de entregas en Cali, Colombia. ` +
                `Optimiza la secuencia de entrega para minimizar el tiempo de tráfico y distancia entre paradas: ` +
                `${JSON.stringify(datosRutaRaw)}. ` +
                `Mantén los campos ssc, destinatario, direccion, telefono, puntoOrigen y cuotaModeradora intactos. ` +
                `Responde EXCLUSIVAMENTE con un JSON plano (un array de objetos con el mismo formato recibido). ` +
                `NO incluyas formateo markdown ni texto adicional.`;

            let respuestaTexto = await session.prompt(promptLocal);
            respuestaTexto = respuestaTexto.replace(/```json/gi, "").replace(/```/g, "").trim();
            
            const datosOptimizados = JSON.parse(respuestaTexto);
            if (Array.isArray(datosOptimizados) && datosOptimizados.length > 0) {
                console.log(">>> [AI_LOCAL_OK]: Secuencia de ruta optimizada en chip local.");
                return datosOptimizados;
            }
        } catch (e) {
            console.warn(">>> [AI_LOCAL_FAIL]: Gemini Nano no disponible o capacidad local saturada.", e);
        }
    }

    // --- PRIORIDAD 2: ENLACE SATELITAL / CLOUD (Vía Backend REST API PHP) ---
    try {
        console.log(">>> [AI_CLOUD]: Conectando con Google Gemini API REST vía Nodal Proxy...");
        
        const targetUrl = (window.ENDPOINT_API_PHP || '../api.php') + '?action=optimizar_ia_cloud';

        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lote: datosRutaRaw })
        });

        if (!res.ok) {
            throw new Error(`Servidor HTTP error status ${res.status}`);
        }

        const data = await res.json();
        
        if (data.status === 'success' && Array.isArray(data.lote_optimizado)) {
            console.log(">>> [AI_CLOUD_OK]: Vector de optimización satelital recibido exitosamente.");
            return data.lote_optimizado;
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