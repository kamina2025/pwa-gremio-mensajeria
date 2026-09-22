/**
 * VERCEL SERVERLESS FUNCTION - GEMINI MULTIMODAL PARSER
 * Ruta: api/extraer-puntos.js
 */

export default async function handler(req, res) {
    // Configuración de CORS para permitir peticiones desde GitHub Pages
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ status: 'error', message: 'Método no permitido. Use POST.' });
    }

    try {
        const { mime_type, file_data, prompt_instrucciones } = req.body;

        if (!file_data) {
            return res.status(400).json({ status: 'error', message: 'No se recibieron datos en Base64.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ status: 'error', message: 'GEMINI_API_KEY no está configurada en Vercel.' });
        }

        const model = "gemini-3.6-flash";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const promptText = prompt_instrucciones || "Extrae los 6 campos de la tirilla médica: ssc, destinatario, direccion, telefono, puntoOrigen, cuotaModeradora";

        const payload = {
            contents: [
                {
                    parts: [
                        { text: promptText },
                        {
                            inline_data: {
                                mime_type: mime_type || "application/pdf",
                                data: file_data
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                response_mime_type: "application/json"
            }
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                status: 'error',
                http_code: response.status,
                message: 'Error devuelto por la API de Gemini Cloud',
                detalles: data
            });
        }

        // Extraer la respuesta del modelo
        const candidates = data.candidates;
        if (candidates && candidates[0]?.content?.parts) {
            let textoRespuesta = "";
            candidates[0].content.parts.forEach(part => {
                if (part.text) textoRespuesta += part.text;
            });

            let puntosExtraidos = JSON.parse(textoRespuesta.trim());
            if (!Array.isArray(puntosExtraidos)) {
                puntosExtraidos = [puntosExtraidos];
            }

            return res.status(200).json({
                status: 'success',
                modelo: model,
                puntos: puntosExtraidos
            });
        } else {
            throw new Error("Respuesta incompleta o sin contenido de la IA.");
        }

    } catch (error) {
        console.error("[Vercel Gemini API Error]:", error);
        return res.status(500).json({
            status: 'error',
            message: 'Error interno en la Serverless Function',
            error: error.message
        });
    }
}