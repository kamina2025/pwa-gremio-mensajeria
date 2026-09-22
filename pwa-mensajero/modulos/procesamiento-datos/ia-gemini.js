/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: EXTRACTOR MULTIMODAL IA (GEMINI / VERCEL)
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/ia-gemini.js
 * Arquitectura: Local-First con Conexión Serverless Vercel Cloud y Fallback Heurístico
 */

import { procesarRutaHeuristica } from './heuristico.js';

/**
 * Convierte un Blob o File a cadena Base64 pura (sin prefijo data:URL).
 * 
 * @param {Blob|File} blob - Archivo a procesar.
 * @returns {Promise<string>} Cadena de texto en Base64.
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result || "";
            const base64Data = result.includes(",") ? result.split(",")[1] : result;
            resolve(base64Data);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
    });
}

/**
 * Procesa la imagen o PDF de una tirilla médica enviándola a la API de Vercel/Gemini Cloud,
 * con degradación suave hacia el motor heurístico local si ocurre algún fallo.
 * 
 * @param {Blob|File} archivoBlob - Fotografía o documento PDF de la tirilla médica.
 * @param {Object} [opciones={}] - Opciones de configuración adicionales.
 * @param {number} [opciones.timeoutMs=15000] - Tiempo máximo de espera en ms.
 * @returns {Promise<Array<Object>>} Lista de paradas/tirillas extraídas.
 */
export async function procesarImagenConGemini(archivoBlob, opciones = {}) {
    const { timeoutMs = 15000 } = opciones;
    console.log(">>> [IA_GEMINI_PREP]: Iniciando conversión de archivo a Base64...");

    let base64Data;
    try {
        base64Data = await blobToBase64(archivoBlob);
    } catch (err) {
        console.error(">>> [IA_GEMINI_FILEREADER_ERROR]: Fallo al convertir el archivo a Base64:", err);
        throw new Error("No se pudo leer el archivo proporcionado.");
    }

    const mimeType = archivoBlob.type || (archivoBlob.name?.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    
    // Endpoint predeterminado apunta a la Serverless Function en Vercel
    const endpointDefault = "https://pwa-gremio-mensajeria.vercel.app/api/extraer-puntos";
    const vercelEndpoint = window.ENDPOINT_API_VERCEL || window.ENDPOINT_API_PHP || endpointDefault;

    console.log(`>>> [IA_GEMINI_FETCH]: Solicitando análisis a Vercel Cloud -> [${vercelEndpoint}] [MIME: ${mimeType}]`);

    // AbortController para control estricto de timeout en redes móviles
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(vercelEndpoint, {
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
            throw new Error(`Fallo HTTP ${response.status} en la solicitud Cloud.`);
        }

        const resData = await response.json();

        // Manejo específico de cuota o restricción devuelta por la API (HTTP 402 / RESOURCE_EXHAUSTED)
        if (resData.http_code === 402 || resData.code_reason === "RESOURCE_EXHAUSTED") {
            console.warn(">>> [IA_GEMINI_CUOTA_EXHAUSTED]: Créditos de API agotados. Activando fallback local...");
            return ejecutarFallbackHeuristico(base64Data);
        }

        if (resData.status === "success" && Array.isArray(resData.puntos)) {
            console.log(`>>> [IA_GEMINI_OK]: Extracción completada exitosamente con modelo [${resData.modelo || 'gemini-3.6-flash'}] (${resData.puntos.length} registro/s).`);
            return resData.puntos;
        } else {
            console.warn(">>> [IA_GEMINI_WARN]: Respuesta Cloud no estructurada como array. Conmutando a fallback...");
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
 * Función auxiliar para invocar el procesamiento heurístico local en caso de falla en la nube.
 * 
 * @param {string} datosBase64 - Datos del archivo en formato Base64.
 * @returns {Array<Object>} Arreglo de paradas obtenidas por el parser local.
 */
function ejecutarFallbackHeuristico(datosBase64) {
    if (typeof procesarRutaHeuristica === 'function') {
        console.log(">>> [IA_GEMINI_FALLBACK]: Procesando documento con motor heurístico local...");
        const resultadoHeuristico = procesarRutaHeuristica(datosBase64);
        return Array.isArray(resultadoHeuristico) ? resultadoHeuristico : [resultadoHeuristico];
    }
    
    console.error(">>> [IA_GEMINI_CRITICAL]: No se encontró disponible el módulo heurístico de respaldo.");
    throw new Error("Servicio de IA Cloud no disponible y no se pudo ejecutar el procesamiento local.");
}