<?php
/**
 * PROTOCOLO MACONDO - BACKEND DE RELEVO CIEGO & NODO API REST
 * Servidor no-custodial de datos. No descifra, solo transporta y audita.
 */

// Configuración de cabeceras para permitir peticiones desde cualquier PWA local o en la nube
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

// Manejo de peticiones de control pre-vuelo (CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Rutas de almacenamiento en texto plano local (XAMPP / Producción)
define('POOL_FILE', __DIR__ . '/pool_pedidos.json');
define('HISTORIAL_FILE', __DIR__ . '/historial_pedidos.json');
define('BODEGA_FILE', __DIR__ . '/bodega_puntos.json');
define('BILLETERA_FILE', __DIR__ . '/billetera_transacciones.json');

/**
 * Función auxiliar para leer JSON con bloqueo compartido (LOCK_SH)
 */
function leerJsonSeguro($filepath) {
    if (!file_exists($filepath)) return [];
    $fp = fopen($filepath, 'r');
    if ($fp && flock($fp, LOCK_SH)) {
        $size = filesize($filepath);
        $content =$size > 0 ? fread($fp,$size) : '{}';
        flock($fp, LOCK_UN);
        fclose($fp);
        return json_decode($content, true) ?? [];
    }
    return [];
}

/**
 * Función auxiliar para escribir JSON con bloqueo exclusivo (LOCK_EX)
 */
function escribirJsonSeguro($filepath,$data) {
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

$method =$_SERVER['REQUEST_METHOD'];
$action =$_GET['action'] ?? '';

switch ($method) {
    case 'POST':
        $inputJSON = file_get_contents('php://input');
        $payload = json_decode($inputJSON, true) ?? [];

        // =========================================================================
        // ACCIÓN: PROXY SEGURO PARA GEMINI CLOUD (PWA-BODEGA / NEGOCIOS)
        // =========================================================================
        if ($action === 'optimizar_ia_cloud') {
            if (!isset($payload['lote']) \vert{}\vert{} !is_array($payload['lote'])) {
                http_response_code(400);
                echo json_encode(["error" => "ESTRUCTURA_LOTE_INVALIDA"]);
                break;
            }

            // Clave privada del backend (reemplazar por variable de entorno o tu API Key)
            $apiKeyGemini = getenv('GEMINI_API_KEY') ?: "TU_API_KEY_DE_GOOGLE_AQUI";
            $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $apiKeyGemini;

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

            $ch = curl_init($endpoint);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($bodyData));

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200 \vert{}\vert{} !$response) {
                http_response_code(502);
                echo json_encode(["error" => "ERROR_COMUNICACION_GEMINI_CLOUD"]);
                break;
            }

            $resData = json_decode($response, true);
            $rawText =$resData['candidates'][0]['content']['parts'][0]['text'] ?? '';
            
            // Sanitización contra markdown ```json
            $cleanJsonText = trim(preg_replace('/^```json\s*|```$/m', '', $rawText));
            $parsedLote = json_decode($cleanJsonText, true);

            if (json_last_error() === JSON_ERROR_NONE) {
                echo json_encode([
                    "status" => "SUCCESS",
                    "lote_optimizado" => $parsedLote
                ]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "RESPUESTA_IA_NO_ES_JSON_VALIDO", "raw" => $rawText]);
            }
            break;
        }

        // =========================================================================
        // ACCIÓN: RECARGA Y COMPRA DE CRÉDITOS DE BILLETERA
        // =========================================================================
        if ($action === 'comprar_creditos_bodega' || (isset($payload['action']) && $payload['action'] === 'comprar_creditos_bodega')) {
            if (!isset($payload['bodega_id']) || !isset($payload['creditos']) || !isset($payload['monto_cop'])) {
                http_response_code(400);
                echo json_encode(["error" => "DATOS_COMPRA_INCOMPLETOS"]);
                break;
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
                echo json_encode([
                    "status" => "SUCCESS",
                    "msg" => "CREDITOS_RECARGADOS",
                    "transaccion" => $recibo
                ]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "ERROR_ESCRITURA_BILLETERA"]);
            }
            break;
        }

        // =========================================================================
        // FLUJO BODEGA: CREACIÓN Y TARIFADO DE PUNTOS (500 COP / 1 CRÉDITO)
        // =========================================================================
        if ($action === 'crear_punto_bodega' || (isset($payload['action']) && $payload['action'] === 'crear_punto_bodega')) {
            if (!isset($payload['bodega_id']) || !isset($payload['latitud']) || !isset($payload['longitud'])) {
                http_response_code(400);
                echo json_encode(["error" => "DATOS_BODEGA_INCOMPLETOS"]);
                break;
            }

            $tarifaAporte = 500; // Tarifa fija en COP por punto generado
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
                echo json_encode([
                    "status" => "SUCCESS",
                    "msg" => "PUNTO_BODEGA_REGISTRADO",
                    "punto" => $nuevoPunto,
                    "aporte_desarrollador" => $tarifaAporte
                ]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "ERROR_ESCRITURA_BODEGA"]);
            }
            break;
        }

        // VALIDACIÓN PARA FLUJOS REGULARES DE CONTRATO
        if (!$payload || !isset($payload['id'])) {
            http_response_code(400);
            echo json_encode(["error" => "PAYLOAD_INVALIDO_O_VACIO"]);
            break;
        }

        $loteId = $payload['id'];
        $pool = leerJsonSeguro(POOL_FILE);

        // =========================================================================
        // FLUJO A: FINALIZACIÓN Y MUTACIÓN DE CONTRATO
        // =========================================================================
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

            echo json_encode([
                "status" => "SUCCESS", 
                "msg" => "CONTRATO_MUTADO_Y_ARCHIVADO", 
                "id" => $loteId
            ]);
            break;
        }

        // =========================================================================
        // FLUJO B: CREACIÓN / INDEXACIÓN DE NUEVO CONTRATO
        // =========================================================================
        $payload['timestamp_relevo'] = time();
        $payload['estado'] = 'POOL_DISPONIBLE';

        $pool[$loteId] = $payload;
        
        if (escribirJsonSeguro(POOL_FILE, $pool)) {
            echo json_encode([
                "status" => "SUCCESS", 
                "msg" => "CONTRATO_INDEXADO_EN_RELEVO_CIEGO", 
                "id" => $loteId
            ]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "ERROR_ESCRITURA_POOL"]);
        }
        break;

    case 'GET':
        // CONSULTAR HISTORIAL Y MOVIMIENTOS DE BILLETERA
        if ($action === 'obtener_billetera_bodega') {
            $bodegaId = $_GET['bodega_id'] ?? '';
            $transacciones = leerJsonSeguro(BILLETERA_FILE);
            
            if ($bodegaId) {
                $transacciones = array_values(array_filter($transacciones, function($tx) use ($bodegaId) {
                    return isset($tx['bodega_id']) && $tx['bodega_id'] === $bodegaId;
                }));
            }
            
            echo json_encode($transacciones, JSON_PRETTY_PRINT);
            break;
        }

        // CONSULTA DE POOL POR DEFECTO
        $pool = leerJsonSeguro(POOL_FILE);

        $disponibles = array_filter($pool, function($lote) {
            return is_array($lote) && isset($lote['estado']) && $lote['estado'] === 'POOL_DISPONIBLE';
        });

        echo json_encode($disponibles ? $disponibles : new stdClass(), JSON_PRETTY_PRINT);
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "METODO_NO_PERMITIDO"]);
        break;
}