<?php
/**
 * PROTOCOLO MACONDO - SCRIPT DE COMPROBACIÓN DIRECTA GEMINI REST
 */

// Silenciar warnings HTML para depurar salida JSON limpia
error_reporting(E_ALL);
ini_set('display_errors', '1');

/**
 * Función para parser local de archivos .env
 */
function cargarEnv($ruta) {
    if (!file_exists($ruta)) return false;
    $lineas = file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lineas as $linea) {
        $linea = trim($linea);
        if (empty($linea) || strpos($linea, '#') === 0) continue;
        if (strpos($linea, '=') !== false) {
            list($nombre, $valor) = explode('=', $linea, 2);
            $nombre = trim($nombre);
            $valor = trim($valor, " \t\n\r\0\x0B\"'");
            putenv("{$nombre}={$valor}");
            $_ENV[$nombre] = $valor;
        }
    }
    return true;
}

// 1. Cargar el archivo .env desde la raíz
cargarEnv(__DIR__ . '/.env');

// 2. Obtener la clave de API desde el entorno
$apiKey = getenv('GEMINI_API_KEY') ?: ($_ENV['GEMINI_API_KEY'] ?? '');

if (empty($apiKey)) {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No se encontró la constante GEMINI_API_KEY en el archivo .env']);
    exit;
}

// 3. Definir modelo oficial y endpoint REST
$modelo = "gemini-3.6-flash"; // O "gemini-1.5-flash"
$endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$modelo}:generateContent?key=" . trim($apiKey);

$payload = [
    "contents" => [
        [
            "parts" => [
                ["text" => "Responde únicamente con la palabra OK si la conexión fue exitosa."]
            ]
        ]
    ]
];

// 4. Iniciar petición cURL
$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-goog-api-key: ' . trim($apiKey)
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Compatibilidad para entorno XAMPP local

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

header('Content-Type: application/json');
echo json_encode([
    'http_code' => $httpCode,
    'respuesta_google' => json_decode($response, true)
], JSON_PRETTY_PRINT);
?>