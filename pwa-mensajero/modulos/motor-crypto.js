/**
 * PROTOCOLO MACONDO - MESSENGER SUBSYSTEM: MOTOR CRIPTOGRÁFICO DE HARDWARE
 * Ubicación: pwa-mensajero/modulos/motor-crypto.js
 */

function descifrarPayloadLocal(stringCifrado) {
    try {
        if (!stringCifrado || stringCifrado === "[DATOS_NO_CIFRADOS]") return null;
        // Reversa del empaquetamiento Base64 URI nativo cypherpunk
        const jsonString = decodeURIComponent(atob(stringCifrado));
        return JSON.parse(jsonString);
    } catch (e) {
        console.error(">>> [CRITICAL_CRYPTO_ERROR]: Imposible derivar llave o carga corrupta.");
        return null;
    }
}

// Inyección limpia al Scope Global sin export
window.descifrarPayloadLocal = descifrarPayloadLocal;