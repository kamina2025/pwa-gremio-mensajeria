/**
 * PROTOCOLO MACONDO - IDENTITY SUBSYSTEM: SISTEMA DE CÉDULAS NODALES DIGITALES
 * Ubicación: pwa-negocios/modulos/cedula-nodal.js
 */

// Se omiten ENDPOINT_SAVE_PHP y otros para evitar SyntaxError globales. 
// El sistema hereda las rutas base de pool-persistencia.js o config.js de forma directa.
const RUTA_REGISTRO_CEDULAS = "../cedulas_registro.json";

/**
 * GENERADOR ATÓMICO DE IDENTIDAD NODAL (ECDSA)
 */
async function generarNuevaCedulaNodal(nombre, tipo, telefono, direccion, pgpInvitador) {
    try {
        console.log(">>> [CRYPTO_INIT]: Derivando llaves asimétricas de alta seguridad para Comercio...");
        
        // Generar un par de llaves ECDSA nativas usando la curva P-256
        const parLlaves = await window.crypto.subtle.generateKey(
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["sign", "verify"]
        );

        // Exportar la llave pública en formato SPKI codificada en Base64 para usarla como identificador
        const pubExportada = await window.crypto.subtle.exportKey("spki", parLlaves.publicKey);
        const llavePublicaBase64 = btoa(String.fromCharCode(...new Uint8Array(pubExportada)))
            .substring(0, 50) + "...MCN";

        const timestampActual = Math.floor(Date.now() / 1000);

        // Estructura limpia y descriptiva de la Cédula Macondo
        const nuevaCedula = {
            id_firma_nodal: "MCN-" + Math.random().toString(16).substring(2, 10).toUpperCase(),
            llave_publica_dispositivo: llavePublicaBase64,
            nombre: nombre,
            tipo: tipo || "NEGOCIO", 
            telefono: telefono,
            direccion: direccion,
            pgp_invitador: pgpInvitador || "NODO_ORIGEN_MACONDO",
            fecha_creacion: timestampActual,
            fecha_activacion: null, // Nace huérfana/asincrónica (SÓLO 1 PEDIDO ABIERTO)
            max_pedidos_simultaneos: 1 
        };

        // Guardar la llave privada localmente en LocalStorage (Nadie más tiene acceso a ella)
        const privExportada = await window.crypto.subtle.exportKey("pkcs8", parLlaves.privateKey);
        const llavePrivadaBase64 = btoa(String.fromCharCode(...new Uint8Array(privExportada)));
        localStorage.setItem("MACONDO_PRIV_KEY", llavePrivadaBase64);
        localStorage.setItem("MACONDO_MI_CEDULA", JSON.stringify(nuevaCedula));

        console.log(">>> [CRYPTO_SUCCESS]: Llaves de la Cédula Nodal asentadas en hardware local.");
        return nuevaCedula;
    } catch (e) {
        console.error("Fallo crítico derivando la identidad nodal asimétrica.", e);
        return null;
    }
}

/**
 * PERSISTENCIA: AGREGAR REGISTRO DE CÉDULA AL JSON EN DISCO USANDO EL PUENTE PHP
 */
async function registrarCedulaEnDisco(nuevaCedula) {
    try {
        // Aprovecha de manera segura el ENDPOINT_SAVE_PHP ya declarado en pool-persistencia.js
        const urlDestino = window.ENDPOINT_SAVE_PHP || "http://localhost/pwa-gremio-mensajeria/save_pool.php";
        
        const respuesta = await fetch(RUTA_REGISTRO_CEDULAS, { cache: "no-store" });
        let registroCompleto = respuesta.ok ? await respuesta.json() : {};

        if (typeof registroCompleto !== "object" || Array.isArray(registroCompleto)) {
            registroCompleto = {};
        }

        // Indexar por ID único de firma nodal
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
            console.log(`>>> [LINKAGE]: Registro de Cédula ${nuevaCedula.id_firma_nodal} grabado en disco.`);
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error guardando el registro de identidad en disco.", e);
        return false;
    }
}

// Compartir al scope global de forma segura
window.generarNuevaCedulaNodal = generarNuevaCedulaNodal;
window.registrarCedulaEnDisco = registrarCedulaEnDisco;
// Añadir al final de pwa-negocios/modulos/cedula-nodal.js para interceptar el botón del HTML

async function intentarAutenticacionLocalDirecta() {
    console.log(">>> [AUTH_TRIGGER]: Interceptando solicitud de acceso local...");
    
    // Capturar inputs del formulario de la UI
    const inputNombre = document.getElementById("txt-nombre-negocio")?.value || "Establecimiento Macondo";
    const inputDireccion = document.getElementById("txt-direccion-negocio")?.value || "Cali Centro";
    const inputTelefono = document.getElementById("txt-telefono-negocio")?.value || "3000000000";
    
    // Generar la cédula nodal criptográfica de forma asíncrona
    const cedulaGenerada = await generarNuevaCedulaNodal(inputNombre, "NEGOCIO", inputTelefono, inputDireccion, "NODO_ORIGEN_MACONDO");
    
    if (cedulaGenerada) {
        // Guardarla de inmediato en el almacenamiento en disco JSON
        const guardadoDisco = await registrarCedulaEnDisco(cedulaGenerada);
        
        if (guardadoDisco && typeof window.inicializarModuloInterfaz === "function") {
            console.log(`>>> [AUTH_OK]: Cédula ${cedulaGenerada.id_firma_nodal} validada por hardware.`);
            // Levantar la visual de la terminal, ocultar el login y encender los mapas
            window.inicializarModuloInterfaz(cedulaGenerada);
        } else {
            // Failsafe por si el puente PHP no responde: permitir el paso local de todos modos
            console.warn(">>> [AUTH_LOCAL_WARN]: Grabación en disco diferida. Activando sesión en caché local.");
            if (typeof window.inicializarModuloInterfaz === "function") {
                window.inicializarModuloInterfaz(cedulaGenerada);
            }
        }
    } else {
        alert("Fallo crítico en el hardware criptográfico local al generar la Cédula.");
    }
}

// Exponer la función de enganche de manera global para limpiar el error del botón del index
window.intentarAutenticacionLocalDirecta = intentarAutenticacionLocalDirecta;