<?php
/**
 * PROTOCOLO MACONDO - PUENTE DE PERSISTENCIA MULTI-ESTADO
 * Ubicación: Raíz / save_pool.php
 */
header("Content-Type: application/json");
header("Cache-Control: no-store, no-cache, must-revalidate");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $jsonCarga = file_get_contents('php://input');
    
    if ($jsonCarga === false || empty($jsonCarga)) {
        http_response_code(400);
        echo json_encode(["error" => "BUFFER_VACIO"]);
        exit;
    }

    $datosValidados = json_decode($jsonCarga, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(["error" => "JSON_INVALIDO", "mensaje" => json_last_error_msg()]);
        exit;
    }

    // Por defecto escribe sobre la pool, a menos que el cliente envíe un header indicando destino alterno
    $archivoDestino = 'pool_pedidos.json';
    if (isset($_SERVER['HTTP_X_TARGET_FILE'])) {
        $archivoFiltro = $_SERVER['HTTP_X_TARGET_FILE'];
        if (in_array($archivoFiltro, ['transito_pedidos.json', 'finalizados_pedidos.json', 'pool_pedidos.json'])) {
            $archivoDestino = $archivoFiltro;
        }
    }

    // Escritura segura con bloqueo de hardware exclusivo
    $resultado = file_put_contents($archivoDestino, $jsonCarga, LOCK_EX);

    if ($resultado === false) {
        http_response_code(500);
        echo json_encode(["error" => "PERMISOS_DENEGADOS"]);
    } else {
        http_response_code(200);
        echo json_encode(["status" => "SINCRONIZADO_OK", "archivo" => $archivoDestino, "bytes" => $resultado]);
    }
    exit;
}

http_response_code(405);
echo json_encode(["error" => "METODO_NO_PERMITIDO"]);
?>