/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: EXTRACTOR MULTIMODAL IA (GEMINI / VERCEL / PHP)
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/ia-gemini.js
 */

import { procesarRutaHeuristica } from './heuristico.js';
import { optimizarImagenParaGemini } from '../image-processor.js';

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

function determinarConfiguracionEntorno() {
    const hostActual = window.location.hostname;
    const esLocal = hostActual === "localhost" || hostActual === "127.0.0.1" || hostActual.startsWith("192.168.");

    if (esLocal) {
        let baseApi = window.ENDPOINT_API_PHP;

        if (!baseApi) {
            try {
                baseApi = new URL('../api.php', window.location.href).href;
            } catch (e) {
                baseApi = "../api.php";
            }
        }

        if (baseApi.includes("?")) {
            baseApi = baseApi.split("?")[0];
        }

        const endpointFinalPhp = `${baseApi}?action=extraer_puntos_documento`;
        
        console.log(`🖥️ [ENTORNO_LOCAL_XAMPP]: PWA operando en local. Apuntando API local -> [${endpointFinalPhp}]`);
        return {
            endpoint: endpointFinalPhp,
            endpointFallback: "../api.php?action=extraer_puntos_documento",
            timeoutMs: 30000,
            modoLocal: true
        };
    }

    const endpointVercel = window.ENDPOINT_API_VERCEL || "https://pwa-gremio-mensajeria.vercel.app/api/extraer-puntos";
    console.log(`🌐 [ENTORNO_NUBE_PROD]: PWA operando en Producción. Apuntando Vercel Cloud -> [${endpointVercel}]`);
    
    return {
        endpoint: endpointVercel,
        endpointFallback: null,
        timeoutMs: 15000,
        modoLocal: false
    };
}

export async function procesarImagenConGemini(archivoBlob, opciones = {}) {
    const configEntorno = determinarConfiguracionEntorno();
    const tiempoLimite = opciones.timeoutMs || configEntorno.timeoutMs;

    let archivoAProcesar = archivoBlob;

    if (archivoBlob.type && archivoBlob.type.startsWith("image/")) {
        try {
            console.log(`📷 [IA_GEMINI_PREPROC]: Binarizando "${archivoBlob.name || 'foto'}" para optimizar tokens OCR...`);
            const blobOpt = await optimizarImagenParaGemini(archivoBlob, { maxDimension: 1024, contraste: 1.4 });
            archivoAProcesar = new File([blobOpt], archivoBlob.name || "tirilla.jpg", { type: "image/jpeg" });
        } catch (e) {
            console.warn("⚠️ [IA_GEMINI_PREPROC_WARN]: Error en binarización visual. Usando archivo original:", e);
        }
    }

    console.log(">>> [IA_GEMINI_PREP]: Convirtiendo archivo procesado a Base64 para consumo multimodal...");

    let base64Data;
    try {
        base64Data = await blobToBase64(archivoAProcesar);
    } catch (err) {
        console.error(">>> [IA_GEMINI_FILEREADER_ERROR]: Fallo al convertir archivo en Base64:", err);
        return ejecutarFallbackHeuristico(archivoBlob);
    }

    const mimeType = archivoAProcesar.type || (archivoAProcesar.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    const enviarSolicitudFetch = async (targetEndpoint) => {
        console.log(`>>> [IA_GEMINI_FETCH]: Solicitando análisis a -> [${targetEndpoint}] [MIME: ${mimeType}] [Timeout: ${tiempoLimite}ms]`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), tiempoLimite);

        const response = await fetch(targetEndpoint, {
            method: "POST",
            cache: "no-store",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            signal: controller.signal,
            body: JSON.stringify({
                action: "extraer_puntos_documento",
                mime_type: mimeType,
                file_data: base64Data
            })
        });

        clearTimeout(timeoutId);
        return response;
    };

    try {
        let response = await enviarSolicitudFetch(configEntorno.endpoint);

        // Fallback defensivo: si la ruta absoluta falla, intentamos con la ruta relativa clásica
        if (response.status === 404 && configEntorno.endpointFallback) {
            console.warn(`⚠ [IA_GEMINI_404]: Endpoint [${configEntorno.endpoint}] devolvió 404. Reintentando con fallback [${configEntorno.endpointFallback}]...`);
            response = await enviarSolicitudFetch(configEntorno.endpointFallback);
        }

        if (!response.ok) {
            console.error(`>>> [IA_GEMINI_HTTP_ERR]: El servidor devolvió el código de estado HTTP ${response.status}`);
            return ejecutarFallbackHeuristico(archivoBlob);
        }

        const textoRespuesta = await response.text();
        let resData;

        try {
            resData = JSON.parse(textoRespuesta);
        } catch (e) {
            console.error(">>> [IA_GEMINI_SYNTAX]: Respuesta no válida devuelta por el servidor:", textoRespuesta);
            return ejecutarFallbackHeuristico(archivoBlob);
        }

        if (resData.status === "success" && Array.isArray(resData.puntos)) {
            console.log(`>>> [IA_GEMINI_OK]: Extracción completada exitosamente con el modelo [${resData.modelo || 'Gemini'}] (${resData.puntos.length} registros).`);
            return resData.puntos;
        } else {
            console.warn(">>> [IA_GEMINI_WARN]: Estructura no válida devuelta por el servidor. Conmutando a fallback...");
            return ejecutarFallbackHeuristico(archivoBlob);
        }

    } catch (err) {
        if (err.name === 'AbortError') {
            console.warn(`>>> [IA_GEMINI_TIMEOUT]: Tiempo de espera agotado (${tiempoLimite}ms). Ejecutando fallback local...`);
        } else {
            console.error(">>> [IA_GEMINI_ERROR]: Error de comunicación con el servicio de IA:", err.message || err);
        }

        return ejecutarFallbackHeuristico(archivoBlob);
    }
}

function ejecutarFallbackHeuristico(entrada) {
    console.log(">>> [IA_GEMINI_FALLBACK]: Procesando documento con motor heurístico local...");
    if (typeof procesarRutaHeuristica === 'function') {
        const resultado = procesarRutaHeuristica(entrada);
        return Array.isArray(resultado) ? resultado : [resultado];
    }
    console.error(">>> [IA_GEMINI_CRITICAL]: Módulo heurístico local no disponible.");
    return [];
}

if (typeof window !== "undefined") {
    window.procesarImagenConGemini = procesarImagenConGemini;
}