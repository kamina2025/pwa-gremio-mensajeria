/**
 * PROTOCOLO MACONDO - AGENTE DE INTELIGENCIA DE TRIPLE CAPA (Fijación Local / Edge Definitiva)
 * Ubicación: pwa-negocios/modulos/ai-agent.js
 */

async function procesarCargaConAI(datosRutaRaw) {
    console.log(">>> [AI_INIT]: Evaluando arquitectura de niveles de inteligencia...");

    // --- PRIORIDAD 1: INTENTAR EDGE AI LOCAL NATIVO ---
    if (window.ai && typeof window.ai.createTextSession === "function") {
        try {
            console.log(">>> [AI_LOCAL]: Procesando optimización multipunto con Gemini Nano...");
            const session = await window.ai.createTextSession();
            const promptLocal = `Actúa como el motor logístico del Protocolo Macondo. Optimiza la ruta para el siguiente lote de Cali: ${JSON.stringify(datosRutaRaw)}. Devuelve solo JSON plano.`;
            const respuestaLocal = await session.prompt(promptLocal);
            return JSON.parse(respuestaLocal);
        } catch (e) {
            console.warn(">>> [AI_LOCAL_FAIL]: Capacidad local saturada o flags desactivados.");
        }
    }

    // --- PRIORIDAD 2: ENLACE SATELITAL / CLOUD (DESACTIVADO PROVISIONALMENTE) ---
    /* TODO: Para reincorporar la API en la nube en el futuro (Concurso de Google):
    1. Definir la constante: const API_KEY_GEMINI = "TU_NUEVA_API_KEY";
    2. Realizar la petición POST a: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY_GEMINI}
    3. Asegurar el esquema estructurado en el body: { contents: [{ parts: [{ text: prompt }] }] }
    console.log(">>> [AI_CLOUD]: Saltando canal satelital provisionalmente por optimización de costos.");
    */

    // --- PRIORIDAD 3: MODO TRINCHERA (HEURÍSTICA GEOMÉTRICA LOCAL OFFLINE) ---
    console.log(">>> [AI_TRINCHERA]: Activando motor de aproximación geométrica por hardware...");
    return ejecutarHeuristicaTrinchera(datosRutaRaw);
}

/**
 * MOTOR DE RESPALDO: Ordenamiento lineal inalterable para tramos de Cali
 */
function ejecutarHeuristicaTrinchera(lote) {
    if (!Array.isArray(lote) || lote.length <= 1) return lote;
    // Clasificación determinista por ID de pedido para asegurar coherencia y velocidad en ruta
    return [...lote].sort((a, b) => (Number(a.id_pedido) > Number(b.id_pedido) ? 1 : -1));
}

// Vinculación segura al scope global
window.procesarCargaConAI = procesarCargaConAI;