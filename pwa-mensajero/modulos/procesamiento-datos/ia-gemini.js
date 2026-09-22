/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: EXTRACTOR MULTIMODAL IA (GEMINI / VERCEL)
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/ia-gemini.js
 * Arquitectura: Local-First con Invocación Cloud Multimodal y Fallback Heurístico
 */

import { procesarRutaHeuristica } from './heuristico.js';

/**
 * Convierte un Blob o File a cadena Base64 pura (sin el encabezado data:MIME;base64,).
 * 
 * @param {Blob|File} blob - Archivo de imagen o PDF.
 * @returns {Promise<string>} Cadena de datos en Base64.
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const rawResult = reader.result || "";
            const base64Data = rawResult.includes(",") ? rawResult.split(",")[1] : rawResult;
            resolve(base64Data);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Procesa la imagen o documento PDF de una tirilla médica.
 * Solicita el análisis a la función Cloud (Vercel / PHP) y conmuta a procesamiento
 * local heurístico de forma transparente ante cualquier falla de red o cuota.
 * 
 * @param {Blob|File} archivoBlob - Documento PDF o fotografía de la tirilla médica.
 * @param {Object} [opciones={}] - Opciones adicionales de configuración.
 * @param {number} [opciones.timeoutMs=15000] - Tiempo máximo de espera para la petición HTTP.
 * @returns {Promise<Array<Object>>} Lista de paradas/tirillas extraídas.
 */
export async function procesarImagenConGemini(archivoBlob, opciones = {}) {
    const { timeoutMs = 15000 } = opciones;
    console.log(">>> [IA_GEMINI_PREP]: Convirtiendo archivo a Base64 para consumo multimodal...");

    let base64Data;
    try {
        base64Data = await blobToBase64(archivoBlob);
    } catch (err) {
        console.error(">>> [IA_GEMINI_FILEREADER_ERROR]: Fallo al leer el archivo en Base64:", err);
        return ejecutarFallbackHeuristico(archivoBlob);
    }

    const mimeType = archivoBlob.type || (archivoBlob.name?.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    
    // Detección de Endpoint: Vercel Cloud (Producción / GitHub Pages) vs PHP API (Localhost)
    const esGitHubPages = window.location.hostname.includes("github.io");
    const vercelEndpoint = "https://pwa-gremio-mensajeria.vercel.app/api/extraer-puntos";
    
    let endpoint = window.ENDPOINT_API_VERCEL || vercelEndpoint;
    if (!esGitHubPages && window.ENDPOINT_API_PHP) {
        endpoint = `${window.ENDPOINT_API_PHP}?action=extraer_puntos_documento`;
    }

    console.log(`>>> [IA_GEMINI_FETCH]: Solicitando análisis a backend -> [${endpoint}] [MIME: ${mimeType}]`);

    // Controlador para abortar la petición si excede el tiempo límite
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                mime_type: mimeType,
                file_data: base64Data,
                prompt_instrucciones: "Extrae los 6 campos de la tirilla médica: ssc, destinatario, direccion, telefono, puntoOrigen, cuotaModeradora"
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`>>> [IA_GEMINI_HTTP_ERR]: El servidor devolvió código HTTP ${response.status}`);
            return ejecutarFallbackHeuristico(base64Data);
        }

        const textoRespuesta = await response.text();
        let resData;

        try {
            resData = JSON.parse(textoRespuesta);
        } catch (e) {
            console.error(">>> [IA_GEMINI_SYNTAX]: Respuesta JSON no válida del backend:", textoRespuesta);
            return ejecutarFallbackHeuristico(base64Data);
        }

        // Manejo específico de cuota agotada (HTTP 402 / RESOURCE_EXHAUSTED)
        if (response.status === 402 || resData.code_reason === "RESOURCE_EXHAUSTED" || resData.http_code === 402) {
            console.warn(">>> [IA_GEMINI_CUOTA_EXHAUSTED]: Créditos de API agotados (HTTP 402). Activando fallback local...");
            return ejecutarFallbackHeuristico(base64Data);
        }

        if (resData.status === "success" && Array.isArray(resData.puntos)) {
            console.log(`>>> [IA_GEMINI_OK]: Extracción completada exitosamente con el modelo [${resData.modelo || 'Gemini'}] (${resData.puntos.length} registros).`);
            return resData.puntos;
        } else {
            console.warn(">>> [IA_GEMINI_WARN]: Estructura de respuesta no válida. Ejecutando procesamiento de contingencia...");
            return ejecutarFallbackHeuristico(base64Data);
        }

    } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            console.warn(`>>> [IA_GEMINI_TIMEOUT]: Tiempo de espera agotado (${timeoutMs}ms). Ejecutando fallback local...`);
        } else {
            console.error(">>> [IA_GEMINI_ERROR]: Error de comunicación con la API de IA:", err.message || err);
        }

        return ejecutarFallbackHeuristico(base64Data);
    }
}

/**
 * Invoca la extracción heurística local si falla el consumo Cloud.
 * 
 * @param {string|Blob} entrada - Datos en Base64 o archivo.
 * @returns {Array<Object>} Arreglo de paradas procesadas localmente.
 */
function ejecutarFallbackHeuristico(entrada) {
    console.log(">>> [IA_GEMINI_FALLBACK]: Procesando documento con motor heurístico local...");
    if (typeof procesarRutaHeuristica === 'function') {
        const resultado = procesarRutaHeuristica(entrada);
        return Array.isArray(resultado) ? resultado : [resultado];
    }
    console.error(">>> [IA_GEMINI_CRITICAL]: Módulo heurístico local no disponible.");
    return [];
}