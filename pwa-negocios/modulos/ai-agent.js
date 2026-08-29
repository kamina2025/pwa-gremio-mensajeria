/**
 * PROTOCOLO MACONDO - AGENTE DE INTELIGENCIA DE TRIPLE CAPA (Edge / Proxy Cloud / Trinchera)
 * Ubicación: modulos/ai-agent.js
 */

async function procesarCargaConAI(datosRutaRaw) {
    console.log(">>> [AI_INIT]: Evaluando arquitectura de niveles de inteligencia...");

    // --- PRIORIDAD 1: EDGE AI LOCAL NATIVO (Gemini Nano) ---
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
            console.warn(">>> [AI_LOCAL_FAIL]: Capacidad local saturada o flags desactivados:", e);
        }
    }

    // --- PRIORIDAD 2: ENLACE SATELITAL / PROXY CLOUD (api.php) ---
    try {
        console.log(">>> [AI_CLOUD]: Conectando con nodo backend api.php...");
        const URL_BACKEND = (window.ENDPOINT_API_PHP || '../api.php') + '?action=optimizar_ia_cloud';

        const respuesta = await fetch(URL_BACKEND, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lote: datosRutaRaw })
        });

        if (respuesta.ok) {
            const data = await respuesta.json();
            if (data.status === 'SUCCESS' && Array.isArray(data.lote_optimizado)) {
                console.log(`>>> [AI_CLOUD_OK]: Ruta optimizada satelitalmente mediante modelo: ${data.modelo}`);
                return data.lote_optimizado;
            } else if (data.status === 'FALLBACK_TRINCHERA') {
                console.warn(">>> [AI_CLOUD_DEGRADATION]: Servidor ordenó fallback suave a Trinchera local.", data);
            }
        }
    } catch (err) {
        console.warn(">>> [AI_CLOUD_OFFLINE]: Canal de red no disponible para IA Cloud.", err);
    }

    // --- PRIORIDAD 3: MODO TRINCHERA (HEURÍSTICA GEOMÉTRICA LOCAL OFFLINE) ---
    console.log(">>> [AI_TRINCHERA]: Activando motor de aproximación geométrica por hardware...");
    return ejecutarHeuristicaTrinchera(datosRutaRaw);
}

/**
 * MOTOR DE RESPALDO: Ordenamiento lineal determinista (Polimórfico para Negocios y Bodega)
 */
function ejecutarHeuristicaTrinchera(lote) {
    if (!Array.isArray(lote) || lote.length <= 1) return lote;
    
    return [...lote].sort((a, b) => {
        const idA = String(a.id_pedido || a.id || a.alias || "");
        const idB = String(b.id_pedido || b.id || b.alias || "");
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });
}

// Vinculación segura al scope global
window.procesarCargaConAI = procesarCargaConAI;
window.ejecutarHeuristicaTrinchera = ejecutarHeuristicaTrinchera;