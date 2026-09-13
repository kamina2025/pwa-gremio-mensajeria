<?php
/**
 * PROTOCOLO MACONDO - ENDPOINT BACKEND GEMINI REST (IA CLOUD)
 * Ubicación: test-gemini.php (o backend API PHP)
 * Descripción: Procesa peticiones de prueba o extracción multimodal (Base64) de tirillas médicas.
 */

// Silenciar warnings HTML para asegurar una salida JSON 100% limpia para la PWA
error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=UTF-8');

/**
 * Carga variables de entorno desde el archivo .env local
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

// 1. Cargar el archivo .env desde el directorio actual
cargarEnv(__DIR__ . '/.env');

// 2. Obtener la clave de API desde el entorno
$apiKey = getenv('GEMINI_API_KEY') ?: ($_ENV['GEMINI_API_KEY'] ?? '');

if (empty($apiKey)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'No se encontró la constante GEMINI_API_KEY en el archivo .env'
    ]);
    exit;
}

// 3. Obtener el cuerpo de la petición (JSON enviado por mensajero-importer.js)
$rawInput = file_get_contents('php_input') ?: file_get_contents('php://input');
$inputData = json_decode($rawInput, true) ?: [];

// 4. Configurar Modelo y Endpoint oficial de Google Gemini
$modelo = "gemini-3.6-flash";
$endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$modelo}:generateContent?key=" . trim($apiKey);

// 5. Determinar si es una prueba rápida por GET/POST simple o una extracción de documento desde la PWA
if (!empty($inputData['file_data']) && !empty($inputData['mime_type'])) {
    
    // MODO EXTRACCIÓN MULTIMODAL (FOTO DE TIRILLA O PDF DE LA PWA)
    $mimeType = $inputData['mime_type'];
    $base64Data = $inputData['file_data'];
    
    $promptInstrucciones = "Analiza detenidamente la imagen o documento de la tirilla médica de dispensación y extrae todos los puntos de entrega en un objeto JSON estricto.\n"
        . "Devuelve UNICAMENTE un objeto JSON con la clave \"puntos\", la cual debe contener un arreglo de objetos. Cada objeto debe incluir exactamente estos 6 campos clave:\n"
        . "- \"ssc\": Número o código SSC/Afiliación.\n"
        . "- \"destinatario\": Nombre completo del paciente o cliente.\n"
        . "- \"direccion\": Dirección exacta de entrega incluyendo barrio o municipio si aplica.\n"
        . "- \"telefono\": Número celular o fijo de contacto.\n"
        . "- \"puntoOrigen\": Punto de dispensación u origen (ej: Cafam Tequendama, Droguería, etc.).\n"
        . "- \"cuotaModeradora\": Valor a cobrar o copago (ej: $0, $4.500).\n\n"
        . "Si algún dato no está visible, asigna \"N/A\" o un valor por defecto razonable. Responde estrictamente en JSON.";

    $payload = [
        "contents" => [
            [
                "role" => "user",
                "parts" => [
                    ["text" => $promptInstrucciones],
                    [
                        "inline_data" => [
                            "mime_type" => $mimeType,
                            "data" => $base64Data
                        ]
                    ]
                ]
            ]
        ],
        "generationConfig" => [
            "responseMimeType" => "application/json"
        ]
    ];

} else {

    // MODO PRUEBA DE CONEXIÓN SIMPLE (HEALTH CHECK)
    $payload = [
        "contents" => [
            [
                "parts" => [
                    ["text" => "Responde únicamente con la palabra OK si la conexión fue exitosa."]
                ]
            ]
        ]
    ];

}

// 6. Ejecutar petición cURL a la API de Gemini
$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-goog-api-key: ' . trim($apiKey)
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Compatibilidad para entorno XAMPP / desarrollo local

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Error de conexión cURL: ' . $curlError
    ]);
    exit;
}

$respuestaGoogle = json_decode($response, true);

// 7. Formatear y estructurar la respuesta final para el consumo directo de la PWA
if ($httpCode === 200 && isset($respuestaGoogle['candidates'][0]['content']['parts'][0]['text'])) {
    
    $textoGenerado = $respuestaGoogle['candidates'][0]['content']['parts'][0]['text'];
    
    // Si era una extracción multimodal, parsear el texto generado por Gemini
    $jsonEstructurado = json_decode($textoGenerado, true);
    
    if (is_array($jsonEstructurado) && isset($jsonEstructurado['puntos'])) {
        echo json_encode([
            'status' => 'success',
            'modelo' => $modelo,
            'puntos' => $jsonEstructurado['puntos'],
            'usage' => $respuestaGoogle['usageMetadata'] ?? []
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } else {
        // Respuesta plana (ejemplo: "OK" en la prueba de salud)
        echo json_encode([
            'status' => 'success',
            'http_code' => $httpCode,
            'modelo' => $modelo,
            'respuesta' => $textoGenerado,
            'respuesta_raw' => $respuestaGoogle
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

} else {
    echo json_encode([
        'status' => 'error',
        'http_code' => $httpCode,
        'message' => 'Respuesta no válida o error devuelto por la API de Google Gemini',
        'detalles' => $respuestaGoogle
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
?>