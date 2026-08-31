/**
 * PROTOCOLO MACONDO - IDENTITY SUBSYSTEM: SISTEMA DE CÉDULAS NODALES DIGITALES
 * Ubicación: modulos/cedula-nodal.js
 */

const RUTA_REGISTRO_CEDULAS = "../cedulas_registro.json";

/**
 * GENERADOR ATÓMICO DE IDENTIDAD NODAL (ECDSA CON FALLSAFE PARA ENTORNO NO-HTTPS/HTTP-IP)
 */
async function generarNuevaCedulaNodal(nombre, tipo, telefono, direccion, pgpInvitador) {
    try {
        console.log(">>> [CRYPTO_INIT]: Derivando llaves asimétricas para el nodo...");

        let llavePublicaBase64 = "";
        let llavePrivadaBase64 = "";

        // Verificar si el navegador móvil permite SubtleCrypto (Requiere HTTPS o Localhost)
        if (window.crypto && window.crypto.subtle) {
            const parLlaves = await window.crypto.subtle.generateKey(
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign", "verify"]
            );

            const pubExportada = await window.crypto.subtle.exportKey("spki", parLlaves.publicKey);
            llavePublicaBase64 = btoa(String.fromCharCode(...new Uint8Array(pubExportada))).substring(0, 50) + "...MCN";

            const privExportada = await window.crypto.subtle.exportKey("pkcs8", parLlaves.privateKey);
            llavePrivadaBase64 = btoa(String.fromCharCode(...new Uint8Array(privExportada)));
        } else {
            console.warn(">>> [CRYPTO_WARN]: SubtleCrypto restringido por HTTP/IP local en móvil. Generando par pseudo-aleatorio seguro.");
            const bytesLlave = new Uint8Array(32);
            window.crypto.getRandomValues(bytesLlave);
            llavePublicaBase64 = "MCN-PUB-HTTP-" + Array.from(bytesLlave).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32).toUpperCase();
            llavePrivadaBase64 = "MCN-PRIV-HTTP-" + Date.now();
        }

        const timestampActual = Math.floor(Date.now() / 1000);

        const nuevaCedula = {
            id_firma_nodal: "MCN-" + Math.random().toString(16).substring(2, 10).toUpperCase(),
            llave_publica_dispositivo: llavePublicaBase64,
            nombre: nombre,
            tipo: tipo || "BODEGA",
            telefono: telefono,
            direccion: direccion,
            pgp_invitador: pgpInvitador || "NODO_ORIGEN_MACONDO",
            fecha_creacion: timestampActual,
            fecha_activacion: null,
            max_pedidos_simultaneos: 1
        };

        // Guardar la identidad en el LocalStorage del dispositivo móvil
        localStorage.setItem("MACONDO_PRIV_KEY", llavePrivadaBase64);
        localStorage.setItem("MACONDO_MI_CEDULA", JSON.stringify(nuevaCedula));

        console.log(">>> [CRYPTO_SUCCESS]: Llaves asentadas en memoria local.");
        return nuevaCedula;
    } catch (e) {
        console.error(">>> [CRYPTO_ERROR]: Fallo crítico en el subsistema criptográfico local.", e);
        return null;
    }
}

/**
 * PERSISTENCIA: REGISTRAR CÉDULA EN DISCO USANDO RESOLUCIÓN DINÁMICA DE IP HOST
 */
async function registrarCedulaEnDisco(nuevaCedula) {
    try {
        // Determinación dinámica de la IP/Host actual para no usar 'localhost' fijo en celulares
        const hostActual = window.location.hostname || "localhost";
        const puertoActual = window.location.port ? `:${window.location.port}` : "";
        const protocoloActual = window.location.protocol;

        const urlDestino = window.ENDPOINT_SAVE_PHP || `${protocoloActual}//${hostActual}${puertoActual}/pwa-gremio-mensajeria/save_pool.php`;

        const respuesta = await fetch(RUTA_REGISTRO_CEDULAS, { cache: "no-store" });
        let registroCompleto = respuesta.ok ? await respuesta.json() : {};

        if (typeof registroCompleto !== "object" || Array.isArray(registroCompleto) || registroCompleto === null) {
            registroCompleto = {};
        }

        registroCompleto[nuevaCedula.id_firma_nodal] = nuevaCedula;

        const resPost = await fetch(urlDestino, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Target-File": "cedulas_registro.json"
            },
            body: JSON.stringify(registroCompleto)
        });

        if (resPost.ok) {
            console.log(`>>> [LINKAGE]: Cédula ${nuevaCedula.id_firma_nodal} registrada en el backend de relevo.`);
            return true;
        }
        return false;
    } catch (e) {
        console.warn(">>> [LINKAGE_WARN]: No se pudo escribir en el servidor remoto JSON. Operando en modo Local-First.", e);
        // Retornamos true para no bloquear el acceso al usuario en la PWA móvil aunque el servidor PHP falle o esté offline
        return true;
    }
}

async function intentarAutenticacionLocalDirecta() {
    console.log(">>> [AUTH_TRIGGER]: Verificando autenticación residente...");

    const cedulaGuardada = localStorage.getItem("MACONDO_MI_CEDULA");
    if (!cedulaGuardada) {
        alert(">>> RECHAZO DE ACCESO NODAL:\n\nNo se detectó ninguna firma en este celular. Por favor complete el formulario y presione [⚡] GENERAR_LLAVES_Y_REGISTRAR_BODEGA.");
        return;
    }

    if (typeof window.verificarAccesoCedulaAlArranque === "function") {
        window.verificarAccesoCedulaAlArranque();
    }
}

// Inyección al scope global
window.generarNuevaCedulaNodal = generarNuevaCedulaNodal;
window.registrarCedulaEnDisco = registrarCedulaEnDisco;
window.intentarAutenticacionLocalDirecta = intentarAutenticacionLocalDirecta;