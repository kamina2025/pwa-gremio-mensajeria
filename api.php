<?php
/**
 * PROTOCOLO MACONDO - BACKEND DE RELEVO CIEGO (BLIND RELAY)
 * Servidor no-custodial de datos. No descifra, solo transporta.
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

// Rutas de almacenamiento en texto plano local (XAMPP)
define('POOL_FILE', __DIR__ . '/pool_pedidos.json');
define('HISTORIAL_FILE', __DIR__ . '/historial_pedidos.json');

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'POST':
        // CAPTURAR EL PAYLOAD ENVIADO POR LA PWA
        $inputJSON = file_get_contents('php://input');
        $payload = json_decode($inputJSON, true);

        if (!$payload || !isset($payload['id'])) {
            http_response_code(400);
            echo json_encode(["error" => "PAYLOAD_INVALIDO_O_VACIO"]);
            break;
        }

        $loteId = $payload['id'];

        // 1. Cargar el buffer/pool de pedidos activa
        $pool = [];
        if (file_exists(POOL_FILE)) {
            $pool = json_decode(file_get_contents(POOL_FILE), true) ?? [];
        }

        // =========================================================================
        // FLUJO A: FINALIZACIÓN Y MUTACIÓN DE CONTRATO (El lote ya existe en la pool)
        // =========================================================================
        if (isset($pool[$loteId]) && isset($payload['status']) && $payload['status'] === 'CONTRATO_COMPLETADO') {
            
            $loteCompletado = $pool[$loteId];
            
            // Inyectamos la metadata de cierre y mutamos el estado de control
            $loteCompletado['status'] = "CONTRATO_COMPLETADO";
            $loteCompletado['estado'] = "HISTORIAL_ARCHIVADO"; 
            $loteCompletado['transaccion'] = [
                "timestamp" => date("m-d H:i"),
                "id" => $loteId
            ];
            
            // Si la PWA envió firmas u otros campos de la liquidación, los consolidamos de forma segura
            if (isset($payload['transaccion'])) {
                $loteCompletado['transaccion'] = array_merge($loteCompletado['transaccion'], $payload['transaccion']);
            }

            // Cargar o crear el archivo histórico secundario
            $historial = [];
            if (file_exists(HISTORIAL_FILE)) {
                $historial = json_decode(file_get_contents(HISTORIAL_FILE), true) ?? [];
            }

            // Indexamos el lote cerrado en la Hoja de Confianza Histórica
            $historial[$loteId] = $loteCompletado;
            file_put_contents(HISTORIAL_FILE, json_encode($historial, JSON_PRETTY_PRINT));

            // PASO CRÍTICO DE DEPURACIÓN: Eliminamos el lote de la pool activa
            unset($pool[$loteId]);
            file_put_contents(POOL_FILE, json_encode($pool, JSON_PRETTY_PRINT));

            echo json_encode([
                "status" => "SUCCESS", 
                "msg" => "CONTRATO_MUTADO_Y_ARCHIVADO", 
                "id" => $loteId
            ]);
            break;
        }

        // =========================================================================
        // FLUJO B: CREACIÓN / INDEXACIÓN DE NUEVO CONTRATO (Entrada regular a la pool)
        // =========================================================================
        $payload['timestamp_relevo'] = time();
        $payload['estado'] = 'POOL_DISPONIBLE'; // Forzar estado base audible por el tabloide

        // Inyectamos preservando el ID como llave absoluta
        $pool[$loteId] = $payload;
        file_put_contents(POOL_FILE, json_encode($pool, JSON_PRETTY_PRINT));

        echo json_encode([
            "status" => "SUCCESS", 
            "msg" => "CONTRATO_INDEXADO_EN_RELEVO_CIEGO", 
            "id" => $loteId
        ]);
        break;

    case 'GET':
        // ENTREGAR LA POOL DE PEDIDOS DISPONIBLES EN FORMATO ESTRUCTURADO (Objeto de Objetos)
        if (!file_exists(POOL_FILE)) {
            echo json_encode(new stdClass()); // Devolver objeto vacío {} en vez de un array []
            break;
        }

        $pool = json_decode(file_get_contents(POOL_FILE), true) ?? [];

        // Filtramos conservando las llaves asociativas originales (IDs de los lotes)
        $disponibles = array_filter($pool, function($lote) {
            return is_array($lote) && isset($lote['estado']) && $lote['estado'] === 'POOL_DISPONIBLE';
        });

        // Retornamos la pool limpia estructurada tal y como la lee la interfaz
        echo json_encode($disponibles ? $disponibles : new stdClass(), JSON_PRETTY_PRINT);
        break;

    default:
        http_response_code(405);
        echo json_encode(["error" => "METODO_NO_PERMITIDO"]);
        break;
}