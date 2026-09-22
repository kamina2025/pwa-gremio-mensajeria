<?php
/**
 * PROTOCOLO MACONDO - BACKEND DE RELEVO CIEGO & NODO API REST (GEMINI VISION FIX)
 * Ubicación: api.php
 */

// 1. INICIAR BUFFER DE SALIDA PARA PREVENIR SALIDAS HTML CORRUPTAS EN JSON
ob_start();

error_reporting(0);
ini_set('display_errors', '0');

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function responderJSON($data, $httpCode = 200) {
    http_response_code($httpCode);
    $bufferLength = ob_get_length();
    if ($bufferLength !== false && $bufferLength > 0) {
        ob_clean();
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function cargarVariablesEntornoEnv($rutaEnv) {
    if (!file_exists($rutaEnv)) return;
    $lineas = file($rutaEnv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lineas as $linea) {
        $lineaLimpia = trim($linea);
        if (empty($lineaLimpia) || strpos($lineaLimpia, '#') === 0) continue;
        if (strpos($lineaLimpia, '=') !== false) {
            list($nombre, $valor) = explode('=', $lineaLimpia, 2);
            $nombreLimpio = trim($nombre);
            $valorLimpio = trim($valor, " \t\n\r\0\x0B\"'");
            putenv("{$nombreLimpio}={$valorLimpio}");
            $_ENV[$nombreLimpio] = $valorLimpio;
        }
    }
}

cargarVariablesEntornoEnv(__DIR__ . '/.env');

/**
 * Consulta a la API REST de Google Gemini con fallback secuencial y parsing defensivo.
 */
function ejecutarGeneracionGeminiMultimodelo($payloadBody, $apiKey) {
    $keyLimpia = trim($apiKey);
    
    // Lista priorizada de modelos
    $candidatos = [
        "gemini-3.6-flash",
        "gemini-2.5-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ];

    if (!isset($payloadBody['generationConfig'])) {
        $payloadBody['generationConfig'] = [
            "response_mime_type" => "application/json"
        ];
    }

    $ultimoErrorData = null;

    foreach ($candidatos as $modelo) {
        $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$modelo}:generateContent?key=" . $keyLimpia;
        $headers = ['Content-Type: application/json'];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payloadBody));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            $ultimoErrorData = ["curl_error" => $curlError, "modelo_probado" => $modelo];
            continue;
        }

        if ($response !== false) {
            $resData = json_decode($response, true);
            
            // Extracción robusta navegando sobre todas las partes del contenido generado
            if ($httpCode === 200 && is_array($resData) && isset($resData['candidates'][0]['content']['parts'])) {
                $textoResultado = '';
                foreach ($resData['candidates'][0]['content']['parts'] as $part) {
                    if (isset($part['text'])) {
                        $textoResultado .= $part['text'];
                    }
                }

                if (!empty($textoResultado)) {
                    return [
                        'exito' => true,
                        'modelo' => $modelo,
                        'text' => $textoResultado,
                        'usage' => $resData['usageMetadata'] ?? null
                    ];
                }
            }

            // Registrar detalle específico de cuotas o límites
            $ultimoErrorData = [
                'modelo_probado' => $modelo,
                'http_code' => $httpCode,
                'response' => $resData ?? $response
            ];

            // Si es un error de cuota/crédito (402), abortamos el bucle para informar a la PWA inmediatamente
            if ($httpCode === 402) {
                break;
            }
        }
    }

    return [
        'exito' => false,
        'detalles' => $ultimoErrorData
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'POST':
        $inputJSON = file_get_contents('php://input');
        $payload = json_decode($inputJSON, true) ?? [];

        // --- EXTRACCIÓN MULTIMODAL DE TIRILLAS MÉDICAS ---
        if ($action === 'extraer_puntos_documento') {
            if (!isset($payload['file_data']) || !isset($payload['mime_type'])) {
                responderJSON(['status' => 'error', 'message' => 'Estructura de archivo no válida.'], 400);
            }

            $apiKeyGemini = getenv('GEMINI_API_KEY') ?: ($_ENV['GEMINI_API_KEY'] ?? '');

            if (empty($apiKeyGemini)) {
                responderJSON(['status' => 'error', 'message' => 'GEMINI_API_KEY no configurada en el servidor.'], 400);
            }

            $promptText = "Actúa como un extractor de datos logísticos para tirillas médicas en Cali, Colombia. " .
                          "Extrae los 6 campos clave: ssc, destinatario, direccion, telefono, puntoOrigen, cuotaModeradora. " .
                          "Devuelve EXCLUSIVAMENTE un JSON plano (un array de objetos con estos campos): " .
                          "[{\"ssc\": \"...\", \"destinatario\": \"...\", \"direccion\": \"...\", \"telefono\": \"...\", \"puntoOrigen\": \"...\", \"cuotaModeradora\": \"...\"}].";

            $bodyData = [
                "contents" => [
                    [
                        "parts" => [
                            ["text" => $promptText],
                            [
                                "inline_data" => [
                                    "mime_type" => $payload['mime_type'],
                                    "data" => $payload['file_data']
                                ]
                            ]
                        ]
                    ]
                ]
            ];

            $resultado = ejecutarGeneracionGeminiMultimodelo($bodyData, $apiKeyGemini);

            if (!$resultado['exito']) {
                $httpStatus = ($resultado['detalles']['http_code'] ?? 500);
                responderJSON([
                    'status' => 'error', 
                    'message' => 'Fallo al procesar el documento en la nube. Verifique la API Key de Gemini o los límites de cuota.', 
                    'detalles' => $resultado['detalles']
                ], $httpStatus);
            }

            $rawText = $resultado['text'];
            
            // Extracción limpia de la estructura JSON
            if (preg_match('/\[.*\]/s', $rawText, $matches)) {
                $cleanJsonText = $matches[0];
            } else {
                $cleanJsonText = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($rawText));
            }

            $parsedPuntos = json_decode($cleanJsonText, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($parsedPuntos)) {
                // Si el modelo devolvió un solo objeto en lugar de una lista, se envuelve en un arreglo
                if (isset($parsedPuntos['destinatario']) || isset($parsedPuntos['ssc'])) {
                    $parsedPuntos = [$parsedPuntos];
                }

                responderJSON([
                    'status' => 'success', 
                    'modelo' => $resultado['modelo'], 
                    'puntos' => $parsedPuntos
                ]);
            } else {
                responderJSON([
                    'status' => 'error', 
                    'message' => 'Estructura JSON no válida devuelta por la IA.', 
                    'raw' => $rawText
                ], 500);
            }
        }

        responderJSON(["error" => "ACCION_NO_RECONOCIDA"], 400);

    default:
        responderJSON(["error" => "METODO_NO_PERMITIDO"], 405);
}