/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: EXTRACTOR MULTIMODAL IA (GEMINI)
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/ia-gemini.js
 */

export async function procesarImagenConGemini(archivoBlob) {
    return new Promise((resolve, reject) => {
        console.log(">>> [IA_GEMINI_PREP]: Convirtiendo archivo a Base64 para consumo multimodal...");
        const reader = new FileReader();

        reader.onload = async () => {
            try {
                const base64Data = reader.result.split(",")[1];
                const mimeType = archivoBlob.type || "image/jpeg";
                
                // Consumo del Endpoint configurado dinámicamente
                const baseUrl = window.ENDPOINT_API_PHP || "/api.php";
                const endpoint = `${baseUrl}?action=extraer_puntos_documento`;

                console.log(`>>> [IA_GEMINI_FETCH]: Solicitando análisis a endpoint PHP -> [${endpoint}] [MIME: ${mimeType}]`);

                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mime_type: mimeType,
                        file_data: base64Data,
                        prompt_instrucciones: "Extrae los 6 campos de la tirilla médica: ssc, destinatario, direccion, telefono, puntoOrigen, cuotaModeradora"
                    })
                });

                if (!response.ok) {
                    console.error(`>>> [IA_GEMINI_HTTP_ERR]: El servidor devolvió código de estado HTTP ${response.status}`);
                    return reject(new Error(`Fallo HTTP ${response.status} en la solicitud a ${endpoint}. Verifique que api.php exista en el directorio.`));
                }

                const textoRespuesta = await response.text();
                let resData;
                
                try {
                    resData = JSON.parse(textoRespuesta);
                } catch (e) {
                    console.error(">>> [IA_GEMINI_SYNTAX]: Respuesta no válida del servidor:", textoRespuesta);
                    return reject(new Error("Respuesta sintácticamente no válida del backend PHP."));
                }

                if (resData.status === "success" && Array.isArray(resData.puntos)) {
                    console.log(`>>> [IA_GEMINI_OK]: Extracción completada exitosamente con el modelo [${resData.modelo || 'Gemini'}] (${resData.puntos.length} registros).`);
                    resolve(resData.puntos);
                } else {
                    reject(new Error(resData.message || resData.error || "Fallo al procesar la tirilla en la nube. Verifique la API Key de Gemini."));
                }
            } catch (err) {
                console.error(">>> [IA_GEMINI_ERROR]: Error de comunicación con la API:", err);
                reject(err);
            }
        };

        reader.onerror = (error) => {
            console.error(">>> [IA_GEMINI_FILEREADER_ERROR]: Fallo al leer el blob de la imagen:", error);
            reject(error);
        };

        reader.readAsDataURL(archivoBlob);
    });
}