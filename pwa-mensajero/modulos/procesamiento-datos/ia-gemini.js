/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: EXTRACTOR MULTIMODAL IA (GEMINI)
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/ia-gemini.js
 */

import { procesarRutaHeuristica } from './heuristico.js';

/**
 * Convierte un Blob o File a cadena Base64 pura.
 * @param {Blob} blob 
 * @returns {Promise<string>}
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Procesa la imagen de una tirilla médica enviándola a la API Backend de Gemini,
 * con degradación suave a procesamiento heurístico local si falla la cuota o conexión.
 * 
 * @param {Blob|File} archivoBlob 
 * @param {Object} [opciones]
 * @param {number} [opciones.timeoutMs=15000] - Tiempo de espera para la petición HTTP
 * @returns {Promise<Array<Object>>} Lista de puntos extraídos
 */
export async function procesarImagenConGemini(archivoBlob, opciones = {}) {
    const { timeoutMs = 15000 } = opciones;
    console.log(">>> [IA_GEMINI_PREP]: Iniciando conversión de archivo a Base64...");

    let base64Data;
    try {
        base64Data = await blobToBase64(archivoBlob);
    } catch (err) {
        console.error(">>> [IA_GEMINI_FILEREADER_ERROR]: Fallo al leer el blob de la imagen:", err);
        throw new Error("No se pudo leer el archivo de imagen proporcionado.");
    }

    const mimeType = archivoBlob.type || "image/jpeg";
    const baseUrl = window.ENDPOINT_API_PHP || "/api.php";
    const endpoint = `${baseUrl}?action=extraer_puntos_documento`;

    console.log(`>>> [IA_GEMINI_FETCH]: Solicitando análisis a backend -> [${endpoint}] [MIME: ${mimeType}]`);

    // Controlador de tiempo de espera (Timeout)
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

        const textoRespuesta = await response.text();
        let resData;

        try {
            resData = JSON.parse(textoRespuesta);
        } catch (e) {
            console.error(">>> [IA_GEMINI_SYNTAX]: Respuesta no válida del servidor:", textoRespuesta);
            throw new Error("Respuesta sintácticamente no válida del backend PHP.");
        }

        // Manejo específico de cuota/crédito agotado (HTTP 402 / RESOURCE_EXHAUSTED)
        if (response.status === 402 || resData.code_reason === "RESOURCE_EXHAUSTED") {
            console.warn(">>> [IA_GEMINI_CUOTA_EXHAUSTED]: Créditos de API agotados (HTTP 402). Activando fallback heurístico local...");
            return ejecutarFallbackHeuristico(base64Data);
        }

        if (!response.ok) {
            console.error(`>>> [IA_GEMINI_HTTP_ERR]: El servidor devolvió código HTTP ${response.status}`);
            throw new Error(resData.message || `Fallo HTTP ${response.status} en la solicitud.`);
        }

        if (resData.status === "success" && Array.isArray(resData.puntos)) {
            console.log(`>>> [IA_GEMINI_OK]: Extracción completada exitosamente con modelo [${resData.modelo || 'Gemini'}] (${resData.puntos.length} registros).`);
            return resData.puntos;
        } else {
            throw new Error(resData.message || resData.error || "Fallo al procesar la tirilla en la nube.");
        }

    } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            console.warn(`>>> [IA_GEMINI_TIMEOUT]: Tiempo de espera agotado (${timeoutMs}ms). Ejecutando fallback local...`);
        } else {
            console.error(">>> [IA_GEMINI_ERROR]: Error de comunicación con la API de IA:", err.message);
        }

        // Si falla la red o la llamada, intentamos procesar de forma local si está disponible
        return ejecutarFallbackHeuristico(base64Data);
    }
}

/**
 * Función auxiliar para ejecutar el procesamiento heurístico en caso de fallo en la nube.
 */
function ejecutarFallbackHeuristico(datosBase64) {
    if (typeof procesarRutaHeuristica === 'function') {
        console.log(">>> [IA_GEMINI_FALLBACK]: Procesando documento con motor heurístico local...");
        const resultadoHeuristico = procesarRutaHeuristica(datosBase64);
        return Array.isArray(resultadoHeuristico) ? resultadoHeuristico : [resultadoHeuristico];
    }
    
    throw new Error("Servicio de IA no disponible y no se encontró el módulo heurístico local.");
}