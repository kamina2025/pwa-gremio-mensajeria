<?php
/**
 * PROTOCOLO MACONDO - BACKEND DE RELEVO CIEGO & NODO API REST
 * Ubicación: api.php
 */

// 1. INICIAR BUFFER DE SALIDA PARA PREVENIR SALIDAS HTML CORRUPTAS EN JSON
ob_start();

error_reporting(0);
ini_set('display_errors', '0');

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
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
 * Consulta a la API REST de Google Gemini con fallback secuencial.
 */
function ejecutarGeneracionGeminiMultimodelo($payloadBody, $apiKey) {
    $keyLimpia = trim($apiKey);
    
    $candidatos = [
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

            $ultimoErrorData = [
                'modelo_probado' => $modelo,
                'http_code' => $httpCode,
                'response' => $resData ?? $response
            ];

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

/**
 * Carga un archivo JSON de la raíz de manera segura.
 */
function cargarJSONFile($filename) {
    $path = __DIR__ . '/' . $filename;
    if (!file_exists($path)) return [];
    $content = file_get_contents($path);
    return json_decode($content, true) ?? [];
}

/**
 * Guarda datos en un archivo JSON de la raíz.
 */
function guardarJSONFile($filename, $data) {
    $path = __DIR__ . '/' . $filename;
    return file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

// DETERMINACIÓN DE MÉTODO Y ACCIÓN GLOBAL
$method = $_SERVER['REQUEST_METHOD'];
$inputJSON = file_get_contents('php://input');
$payload = json_decode($inputJSON, true) ?? [];

// Soporte para túnel _method en POST
if ($method === 'POST' && isset($payload['_method'])) {
    $method = strtoupper($payload['_method']);
}

// Extracción flexible del parámetro 'action' o 'accion'
$action = $_GET['action'] ?? ($_GET['accion'] ?? ($payload['action'] ?? ($payload['accion'] ?? ($_POST['action'] ?? ''))));

switch ($method) {
    case 'GET':
        if ($action === 'obtener_paradas' || $action === 'obtener_pedidos') {
            $paradas = cargarJSONFile('transito_pedidos.json');
            if (empty($paradas)) {
                $paradas = cargarJSONFile('pool_pedidos.json');
            }
            responderJSON(['status' => 'success', 'data' => $paradas, 'total' => count($paradas)]);
        }
        responderJSON(['status' => 'error', 'message' => 'Acción GET no válida'], 400);
        break;

    case 'POST':
    case 'PUT':
        // --- EXTRAER PUNTOS VÍA GEMINI VISION ---
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
            
            if (preg_match('/\[.*\]/s', $rawText, $matches)) {
                $cleanJsonText = $matches[0];
            } else {
                $cleanJsonText = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($rawText));
            }

            $parsedPuntos = json_decode($cleanJsonText, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($parsedPuntos)) {
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

        // --- ACTUALIZAR / MUTAR ESTADO DE UNA PARADA ---
        if ($action === 'actualizar_parada' || $action === 'mutar_estado') {
            $idTarget = trim($payload['id'] ?? ($payload['ssc'] ?? ''));
            if (empty($idTarget)) {
                responderJSON(['status' => 'error', 'message' => 'ID o SSC de la parada es requerido'], 400);
            }

            $paradas = cargarJSONFile('transito_pedidos.json');
            $encontrado = false;

            foreach ($paradas as &$p) {
                $idCur = trim($p['id'] ?? ($p['ssc'] ?? ''));
                if ($idCur === $idTarget) {
                    $p = array_merge($p, $payload);
                    $p['updated_at'] = date('Y-m-d H:i:s');
                    $encontrado = true;
                    break;
                }
            }

            if (!$encontrado) {
                // Agregar como nueva parada si no existía previamente
                $payload['id'] = $idTarget;
                $payload['updated_at'] = date('Y-m-d H:i:s');
                $paradas[] = $payload;
            }

            guardarJSONFile('transito_pedidos.json', $paradas);

            responderJSON([
                'status' => 'success',
                'message' => 'Parada actualizada correctamente en el servidor',
                'parada' => $payload
            ]);
        }

        // --- GUARDAR LISTA COMPLETA DE PARADAS ---
        if ($action === 'guardar_paradas') {
            $lista = $payload['paradas'] ?? ($payload['puntos'] ?? $payload);
            if (!is_array($lista)) {
                responderJSON(['status' => 'error', 'message' => 'Formato de paradas no válido'], 400);
            }

            guardarJSONFile('transito_pedidos.json', $lista);

            responderJSON([
                'status' => 'success',
                'message' => 'Lista de paradas persistida exitosamente',
                'count' => count($lista)
            ]);
        }

        responderJSON(["error" => "ACCION_NO_RECONOCIDA", "action_recibida" => $action], 400);
        break;

    case 'DELETE':
        if ($action === 'eliminar_parada') {
            $idTarget = trim($_GET['id'] ?? ($payload['id'] ?? ''));
            if (empty($idTarget)) {
                responderJSON(['status' => 'error', 'message' => 'ID de la parada es requerido'], 400);
            }

            $paradas = cargarJSONFile('transito_pedidos.json');
            $paradasFiltradas = array_values(array_filter($paradas, function($p) use ($idTarget) {
                $idCur = trim($p['id'] ?? ($p['ssc'] ?? ''));
                return $idCur !== $idTarget;
            }));

            guardarJSONFile('transito_pedidos.json', $paradasFiltradas);

            responderJSON([
                'status' => 'success',
                'message' => "Parada #{$idTarget} eliminada correctamente",
                'id' => $idTarget
            ]);
        }

        responderJSON(["error" => "ACCION_NO_RECONOCIDA"], 400);
        break;

    default:
        responderJSON(["error" => "METODO_NO_PERMITIDO"], 405);
}