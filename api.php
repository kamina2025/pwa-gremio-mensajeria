<?php
/**
 * PROTOCOLO MACONDO - BACKEND DE RELEVO CIEGO & NODO API REST
 * Servidor no-custodial de datos. No descifra, solo transporta y audita.
 */

// 1. INICIAR BUFFER DE SALIDA PARA ATRAPAR WARNINGS HTML
ob_start();

error_reporting(0);
ini_set('display_errors', '0');

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

/**
 * Función centralizada para garantizar respuesta JSON pura
 * Destruye cualquier advertencia HTML ( <br><b> ) en el buffer antes de imprimir
 */
function responderJSON($data, $httpCode = 200) {
    http_response_code($httpCode);
    $bufferLength = ob_get_length();
    if ($bufferLength !== false && $bufferLength > 0) {
        ob_clean(); // Limpia la basura HTML acumulada
    }
    echo json_encode($data);
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

define('POOL_FILE', __DIR__ . '/pool_pedidos.json');
define('HISTORIAL_FILE', __DIR__ . '/historial_pedidos.json');
define('BODEGA_FILE', __DIR__ . '/bodega_puntos.json');
define('BILLETERA_FILE', __DIR__ . '/billetera_transacciones.json');

function leerJsonSeguro($filepath) {
    if (!file_exists($filepath)) return [];
    $fp = fopen($filepath, 'r');
    if ($fp && flock($fp, LOCK_SH)) {
        $size = filesize($filepath);
        $content = $size > 0 ? fread($fp, $size) : '{}';
        flock($fp, LOCK_UN);
        fclose($fp);
        return json_decode($content, true) ?? [];
    }
    return [];
}

function escribirJsonSeguro($filepath, $data) {
    $fp = fopen($filepath, 'c+');
    if ($fp && flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        return true;
    }
    return false;
}

function ejecutarGeneracionGeminiMultimodelo($payloadBody, $apiKey) {
    $keyLimpia = trim($apiKey);
    
    // Prioridad absoluta al modelo validado en tu entorno
    $candidatos = [
        "gemini-3.6-flash",
        "gemini-1.5-flash",
        "gemini-2.0-flash-exp"
    ];

    $ultimoErrorData = null;
    $ultimoHttpCode = 500;

    foreach ($candidatos as $modelo) {
        $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$modelo}:generateContent?key=" . $keyLimpia;

        $headers = [
            'Content-Type: application/json',
            'X-goog-api-key: ' . $keyLimpia
        ];

        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payloadBody));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response !== false) {
            $resData = json_decode($response, true);
            
            // Validación defensiva para evitar "Undefined array key"
            if ($httpCode === 200 && isset($resData['candidates'][0]['content']['parts'][0]['text'])) {
                return [
                    'exito' => true,
                    'modelo' => $modelo,
                    'text' => $resData['candidates'][0]['content']['parts'][0]['text']
                ];
            }
            $ultimoErrorData = $resData ?? ["raw_response" => $response];
            $ultimoHttpCode = $httpCode;
        }
    }

    return [
        'exito' => false,
        'http_code' => $ultimoHttpCode,
        'detalles' => $ultimoErrorData
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'POST':
        $inputJSON = file_get_contents('php://input');
        $payload = json_decode($inputJSON, true) ?? [];

        if ($action === 'optimizar_ia_cloud') {
            if (!isset($payload['lote']) || !is_array($payload['lote'])) {
                responderJSON(["error" => "ESTRUCTURA_LOTE_INVALIDA"], 400);
            }

            $apiKeyGemini = getenv('GEMINI_API_KEY') ?: ($_ENV['GEMINI_API_KEY'] ?? ($payload['api_key'] ?? ""));

            if (empty($apiKeyGemini)) {
                responderJSON([
                    "status" => "FALLBACK_TRINCHERA",
                    "mensaje" => "No se detectó GEMINI_API_KEY en el servidor.",
                    "lote_optimizado" => $payload['lote']
                ]);
            }

            $promptText = "Actúa como el motor logístico del Protocolo Macondo en Cali, Colombia. " .
                          "Optimiza la secuencia de entrega para minimizar tiempo y distancia del siguiente lote: " . 
                          json_encode($payload['lote']) . ". " .
                          "Devuelve EXCLUSIVAMENTE un JSON plano (un array de objetos con las mismas propiedades recibidas). " .
                          "Sin etiquetas markdown ni explicaciones adicionales.";

            $bodyData = [
                "contents" => [
                    ["parts" => [["text" => $promptText]]]
                ]
            ];

            $resultado = ejecutarGeneracionGeminiMultimodelo($bodyData, $apiKeyGemini);

            if (!$resultado['exito']) {
                responderJSON([
                    "status" => "FALLBACK_TRINCHERA",
                    "error_cloud" => "ERROR_COMUNICACION_GEMINI_CLOUD",
                    "http_code" => $resultado['http_code'],
                    "detalles_google" => $resultado['detalles'],
                    "lote_optimizado" => $payload['lote']
                ]);
            }

            $rawText = $resultado['text'];
            $cleanJsonText = trim(preg_replace('/^```json\s*|```$/m', '', $rawText));
            $parsedLote = json_decode($cleanJsonText, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($parsedLote)) {
                responderJSON([
                    "status" => "SUCCESS",
                    "modelo" => $resultado['modelo'],
                    "lote_optimizado" => $parsedLote
                ]);
            } else {
                responderJSON([
                    "status" => "FALLBACK_TRINCHERA",
                    "error" => "RESPUESTA_IA_NO_ES_JSON_VALIDO",
                    "raw" => $rawText,
                    "lote_optimizado" => $payload['lote']
                ]);
            }
        }

        if ($action === 'extraer_puntos_documento') {
            if (!isset($payload['file_data']) || !isset($payload['mime_type'])) {
                responderJSON(['status' => 'error', 'message' => 'Estructura de archivo no válida.'], 400);
            }

            $apiKeyGemini = getenv('GEMINI_API_KEY') ?: ($_ENV['GEMINI_API_KEY'] ?? ($payload['api_key'] ?? ""));

            if (empty($apiKeyGemini)) {
                responderJSON(['status' => 'error', 'message' => 'GEMINI_API_KEY no configurada en el archivo .env del servidor.'], 400);
            }

            $promptText = "Actúa como un extractor de datos logísticos exacto. Analiza el documento u imagen adjunta y extrae la lista de entregas. " .
                          "Devuelve EXCLUSIVAMENTE un JSON plano (un array de objetos) con la siguiente estructura: " .
                          "[{\"destinatario\": \"Nombre\", \"direccion\": \"Direccion completa en Cali o alrededores\", \"telefono\": \"Numero de contacto\", \"carga\": \"Detalle paquete\"}]. " .
                          "Sin formato markdown, ni texto explicativo adicional.";

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
                responderJSON([
                    'status' => 'error', 
                    'message' => 'Fallo al procesar el documento en la nube. Verifique la clave o formato.', 
                    'detalles' => $resultado['detalles']
                ], 502);
            }

            $rawText = $resultado['text'];
            $cleanJsonText = trim(preg_replace('/^```json\s*|```$/m', '', $rawText));
            $parsedPuntos = json_decode($cleanJsonText, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($parsedPuntos)) {
                responderJSON(['status' => 'success', 'modelo' => $resultado['modelo'], 'puntos' => $parsedPuntos]);
            } else {
                responderJSON(['status' => 'error', 'message' => 'No se pudo interpretar la estructura del documento.', 'raw' => $rawText], 500);
            }
        }

        if ($action === 'comprar_creditos_bodega' || (isset($payload['action']) && $payload['action'] === 'comprar_creditos_bodega')) {
            if (!isset($payload['bodega_id']) || !isset($payload['creditos']) || !isset($payload['monto_cop'])) {
                responderJSON(["error" => "DATOS_COMPRA_INCOMPLETOS"], 400);
            }

            $recibo = [
                'id_tx' => 'TX-CRD-' . uniqid(),
                'bodega_id' => $payload['bodega_id'],
                'tipo' => 'RECARGA_CREDITOS',
                'creditos_adquiridos' => (int)$payload['creditos'],
                'monto_cop' => (int)$payload['monto_cop'],
                'metodo' => $payload['metodo'] ?? 'NEQUI_PROVISIONAL',
                'fecha' => date('c')
            ];

            $transacciones = leerJsonSeguro(BILLETERA_FILE);
            $transacciones[] = $recibo;

            if (escribirJsonSeguro(BILLETERA_FILE, $transacciones)) {
                responderJSON(["status" => "SUCCESS", "msg" => "CREDITOS_RECARGADOS", "transaccion" => $recibo]);
            } else {
                responderJSON(["error" => "ERROR_ESCRITURA_BILLETERA"], 500);
            }
        }

        if ($action === 'crear_punto_bodega' || (isset($payload['action']) && $payload['action'] === 'crear_punto_bodega')) {
            if (!isset($payload['bodega_id']) || !isset($payload['latitud']) || !isset($payload['longitud'])) {
                responderJSON(["error" => "DATOS_BODEGA_INCOMPLETOS"], 400);
            }

            $tarifaAporte = 500;
            $nuevoPunto = [
                'id' => 'PNT-' . uniqid(),
                'bodega_id' => $payload['bodega_id'],
                'alias' => $payload['alias'] ?? 'Punto sin nombre',
                'latitud' => $payload['latitud'],
                'longitud' => $payload['longitud'],
                'tarifa_aplicada' => $tarifaAporte,
                'fecha_creacion' => date('c')
            ];

            $puntos = leerJsonSeguro(BODEGA_FILE);
            $puntos[] = $nuevoPunto;

            if (escribirJsonSeguro(BODEGA_FILE, $puntos)) {
                responderJSON(["status" => "SUCCESS", "msg" => "PUNTO_BODEGA_REGISTRADO", "punto" => $nuevoPunto, "aporte_desarrollador" => $tarifaAporte]);
            } else {
                responderJSON(["error" => "ERROR_ESCRITURA_BODEGA"], 500);
            }
        }

        if (!$payload || !isset($payload['id'])) {
            responderJSON(["error" => "PAYLOAD_INVALIDO_O_VACIO"], 400);
        }

        $loteId = $payload['id'];
        $pool = leerJsonSeguro(POOL_FILE);

        if (isset($pool[$loteId]) && isset($payload['status']) && $payload['status'] === 'CONTRATO_COMPLETADO') {
            $loteCompletado = $pool[$loteId];
            $loteCompletado['status'] = "CONTRATO_COMPLETADO";
            $loteCompletado['estado'] = "HISTORIAL_ARCHIVADO"; 
            $loteCompletado['transaccion'] = [
                "timestamp" => date("m-d H:i"),
                "id" => $loteId
            ];
            
            if (isset($payload['transaccion'])) {
                $loteCompletado['transaccion'] = array_merge($loteCompletado['transaccion'], $payload['transaccion']);
            }

            $historial = leerJsonSeguro(HISTORIAL_FILE);
            $historial[$loteId] = $loteCompletado;
            escribirJsonSeguro(HISTORIAL_FILE, $historial);

            unset($pool[$loteId]);
            escribirJsonSeguro(POOL_FILE, $pool);

            responderJSON(["status" => "SUCCESS", "msg" => "CONTRATO_MUTADO_Y_ARCHIVADO", "id" => $loteId]);
        }

        $payload['timestamp_relevo'] = time();
        $payload['estado'] = 'POOL_DISPONIBLE';
        $pool[$loteId] = $payload;
        
        if (escribirJsonSeguro(POOL_FILE, $pool)) {
            responderJSON(["status" => "SUCCESS", "msg" => "CONTRATO_INDEXADO_EN_RELEVO_CIEGO", "id" => $loteId]);
        } else {
            responderJSON(["error" => "ERROR_ESCRITURA_POOL"], 500);
        }

    case 'GET':
        if ($action === 'obtener_billetera_bodega') {
            $bodegaId = $_GET['bodega_id'] ?? '';
            $transacciones = leerJsonSeguro(BILLETERA_FILE);
            
            if ($bodegaId) {
                $transacciones = array_values(array_filter($transacciones, function($tx) use ($bodegaId) {
                    return isset($tx['bodega_id']) && $tx['bodega_id'] === $bodegaId;
                }));
            }
            responderJSON($transacciones);
        }

        $pool = leerJsonSeguro(POOL_FILE);
        $disponibles = array_filter($pool, function($lote) {
            return is_array($lote) && isset($lote['estado']) && $lote['estado'] === 'POOL_DISPONIBLE';
        });

        responderJSON($disponibles ? $disponibles : new stdClass());

    default:
        responderJSON(["error" => "METODO_NO_PERMITIDO"], 405);
}