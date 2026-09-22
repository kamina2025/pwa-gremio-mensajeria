/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: EXTRACTOR MULTIMODAL IA (GEMINI / VERCEL / PHP)
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/ia-gemini.js
 * Arquitectura: Local-First con Conexión Dinámica (XAMPP / Vercel Cloud) y Fallback Heurístico
 */

import { procesarRutaHeuristica } from './heuristico.js';

/**
 * Convierte un Blob o File a cadena Base64 pura (sin el prefijo data:URL).
 * 
 * @param {Blob|File} blob - Archivo de imagen o PDF.
 * @returns {Promise<string>} Cadena de datos en Base64.
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
 * Determina dinámicamente la URL del backend y el timeout según el entorno de ejecución.
 * 
 * @returns {Object} Configuración con URL, tiempo límite y banderas de entorno.
 */
function determinarConfiguracionEntorno() {
    const hostActual = window.location.hostname;
    const esLocal = hostActual === "localhost" || hostActual === "127.0.0.1" || hostActual.startsWith("192.168.");

    if (esLocal) {
        const urlBaseLocal = window.ENDPOINT_API_PHP || "http://localhost/pwa-gremio-mensajeria/api.php";
        const endpointPhp = urlBaseLocal.includes("?") ? urlBaseLocal : `${urlBaseLocal}?action=extraer_puntos_documento`;
        
        console.log(`🖥️ [ENTORNO_LOCAL_XAMPP]: PWA operando en local. Apuntando API local -> [${endpointPhp}]`);
        return {
            endpoint: endpointPhp,
            timeoutMs: 30000, // Timeout extendido para pruebas locales en XAMPP
            modoLocal: true
        };
    }

    const endpointVercel = window.ENDPOINT_API_VERCEL || "https://pwa-gremio-mensajeria.vercel.app/api/extraer-puntos";
    console.log(`🌐 [ENTORNO_NUBE_PROD]: PWA operando en GitHub Pages / Android. Apuntando Vercel Cloud -> [${endpointVercel}]`);
    
    return {
        endpoint: endpointVercel,
        timeoutMs: 15000,
        modoLocal: false
    };
}

/**
 * Procesa la imagen o documento PDF de una tirilla médica.
 * Solicita el análisis a la función Backend correspondiente (PHP en XAMPP o Vercel Serverless)
 * y conmuta a procesamiento local heurístico ante cualquier falla de red, timeout o cuota.
 * 
 * @param {Blob|File} archivoBlob - Documento PDF o fotografía de la tirilla médica.
 * @param {Object} [opciones={}] - Opciones de configuración adicionales.
 * @param {number} [opciones.timeoutMs] - Tiempo límite personalizado en milisegundos.
 * @returns {Promise<Array<Object>>} Lista de paradas/tirillas extraídas.
 */
export async function procesarImagenConGemini(archivoBlob, opciones = {}) {
    const configEntorno = determinarConfiguracionEntorno();
    const tiempoLimite = opciones.timeoutMs || configEntorno.timeoutMs;

    console.log(">>> [IA_GEMINI_PREP]: Convirtiendo archivo a Base64 para consumo multimodal...");

    let base64Data;
    try {
        base64Data = await blobToBase64(archivoBlob);
    } catch (err) {
        console.error(">>> [IA_GEMINI_FILEREADER_ERROR]: Fallo al convertir archivo en Base64:", err);
        return ejecutarFallbackHeuristico(archivoBlob);
    }

    const mimeType = archivoBlob.type || (archivoBlob.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    console.log(`>>> [IA_GEMINI_FETCH]: Solicitando análisis a -> [${configEntorno.endpoint}] [MIME: ${mimeType}] [Timeout: ${tiempoLimite}ms]`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), tiempoLimite);

    try {
        const response = await fetch(configEntorno.endpoint, {
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
            console.error(`>>> [IA_GEMINI_HTTP_ERR]: El servidor devolvió el código de estado HTTP ${response.status}`);
            return ejecutarFallbackHeuristico(base64Data);
        }

        const textoRespuesta = await response.text();
        let resData;

        try {
            resData = JSON.parse(textoRespuesta);
        } catch (e) {
            console.error(">>> [IA_GEMINI_SYNTAX]: Respuesta no válida devuelta por el servidor:", textoRespuesta);
            return ejecutarFallbackHeuristico(base64Data);
        }

        // Manejo de cuota o saldo agotado (HTTP 402 / RESOURCE_EXHAUSTED)
        if (response.status === 402 || resData.code_reason === "RESOURCE_EXHAUSTED" || resData.http_code === 402) {
            console.warn(">>> [IA_GEMINI_CUOTA_EXHAUSTED]: Créditos de API agotados (HTTP 402). Activando fallback local...");
            return ejecutarFallbackHeuristico(base64Data);
        }

        if (resData.status === "success" && Array.isArray(resData.puntos)) {
            console.log(`>>> [IA_GEMINI_OK]: Extracción completada exitosamente con el modelo [${resData.modelo || 'Gemini'}] (${resData.puntos.length} registros).`);
            return resData.puntos;
        } else {
            console.warn(">>> [IA_GEMINI_WARN]: Estructura no válida devuelta por el servidor. Conmutando a fallback...");
            return ejecutarFallbackHeuristico(base64Data);
        }

    } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            console.warn(`>>> [IA_GEMINI_TIMEOUT]: Tiempo de espera agotado (${tiempoLimite}ms). Ejecutando fallback local...`);
        } else {
            console.error(">>> [IA_GEMINI_ERROR]: Error de comunicación con el servicio de IA:", err.message || err);
        }

        return ejecutarFallbackHeuristico(base64Data);
    }
}

/**
 * Invoca la extracción heurística local si ocurre algún fallo con el servicio en la nube.
 * 
 * @param {string|Blob|File} entrada - Datos en Base64 o archivo.
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