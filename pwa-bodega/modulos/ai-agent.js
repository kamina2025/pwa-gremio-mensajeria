/**
 * PROTOCOLO MACONDO - AGENTE DE INTELIGENCIA DE TRIPLE CAPA (Edge / Cloud / Trinchera)
 * Ubicación: modulos/ai-agent.js
 */

async function procesarCargaConAI(datosRutaRaw) {
    console.log(">>> [AI_INIT]: Evaluando arquitectura de niveles de inteligencia...");

    // --- PRIORIDAD 1: INTENTAR EDGE AI LOCAL NATIVO (Gemini Nano) ---
    if (window.ai && typeof window.ai.createTextSession === "function") {
        try {
            console.log(">>> [AI_LOCAL]: Procesando optimización multipunto con Gemini Nano...");
            const session = await window.ai.createTextSession();
            
            const promptLocal = `Actúa como el motor logístico del Protocolo Macondo en Cali, Colombia. ` +
                `Optimiza la secuencia de entrega para minimizar tiempo y distancia del siguiente lote: ` +
                `${JSON.stringify(datosRutaRaw)}. ` +
                `Responde EXCLUSIVAMENTE con un JSON plano (un array de objetos con el mismo formato recibido). ` +
                `NO incluyas formateo markdown ni texto adicional.`;

            let respuestaTexto = await session.prompt(promptLocal);
            respuestaTexto = respuestaTexto.replace(/```json/g, "").replace(/```/g, "").trim();
            
            const datosOptimizados = JSON.parse(respuestaTexto);
            if (Array.isArray(datosOptimizados) && datosOptimizados.length > 0) {
                return datosOptimizados;
            }
        } catch (e) {
            console.warn(">>> [AI_LOCAL_FAIL]: Capacidad local saturada o flags desactivados.", e);
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
    console.log(">>> [AI_TRINCHERA]: Activando motor de aproximación geométrica por hardware...");
    return ejecutarHeuristicaTrinchera(datosRutaRaw);
}

/**
 * MOTOR DE RESPALDO: Ordenamiento lineal determinista
 */
function ejecutarHeuristicaTrinchera(lote) {
    if (!Array.isArray(lote) || lote.length <= 1) return lote;
    
    return [...lote].sort((a, b) => {
        const idA = String(a.id_pedido || a.id || "");
        const idB = String(b.id_pedido || b.id || "");
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });
}

// Vinculación segura al scope global
window.procesarCargaConAI = procesarCargaConAI;
window.ejecutarHeuristicaTrinchera = ejecutarHeuristicaTrinchera;