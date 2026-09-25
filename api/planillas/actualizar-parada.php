<?php
// api/planillas/actualizar-parada.php

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || (!isset($data['id']) && !isset($data['ssc']))) {
    http_response_code(400);
    echo json_encode(['error' => 'Identificador de parada no proporcionado']);
    exit;
}

if (!isset($data['lat'], $data['lng']) && !isset($data['latitud'], $data['longitud'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Coordenadas geográficas no proporcionadas']);
    exit;
}

$paradaId  = $data['id'] ?? $data['ssc'];
$ssc       = $data['ssc'] ?? $paradaId;
$planillaId = $data['planilla_id'] ?? null;
$latitud   = $data['lat'] ?? $data['latitud'];
$longitud  = $data['lng'] ?? $data['longitud'];
$direccion = $data['direccion'] ?? null;

try {
    // Si se proporciona planilla_id, se filtra por ella; de lo contrario, por id/ssc
    if ($planillaId) {
        $stmt = $pdo->prepare("
            UPDATE paradas_planilla 
            SET latitud = :lat, longitud = :lng, direccion = COALESCE(:dir, direccion), updated_at = NOW() 
            WHERE (id = :parada_id OR ssc = :ssc) AND planilla_id = :planilla_id
        ");
        $stmt->execute([
            ':lat' => $latitud,
            ':lng' => $longitud,
            ':dir' => $direccion,
            ':parada_id' => $paradaId,
            ':ssc' => $ssc,
            ':planilla_id' => $planillaId
        ]);
    } else {
        $stmt = $pdo->prepare("
            UPDATE paradas_planilla 
            SET latitud = :lat, longitud = :lng, direccion = COALESCE(:dir, direccion), updated_at = NOW() 
            WHERE id = :parada_id OR ssc = :ssc
        ");
        $stmt->execute([
            ':lat' => $latitud,
            ':lng' => $longitud,
            ':dir' => $direccion,
            ':parada_id' => $paradaId,
            ':ssc' => $ssc
        ]);
    }

    echo json_encode(['success' => true, 'message' => 'Ubicación de parada actualizada en el servidor']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error al actualizar en la base de datos: ' . $e->getMessage()]);
}