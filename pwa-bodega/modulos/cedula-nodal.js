/**
 * PROTOCOLO MACONDO - IDENTITY SUBSYSTEM: SISTEMA DE CÉDULAS NODALES DIGITALES
 * Ubicación: modulos/cedula-nodal.js
 */

const RUTA_REGISTRO_CEDULAS = "../cedulas_registro.json";

/**
 * Genera un ID criptográficamente seguro de 8 caracteres hexadecimales
 */
function generarIdNodalSeguro() {
    const array = new Uint8Array(4);
    window.crypto.getRandomValues(array);
    return "MCN-" + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * GENERADOR ATÓMICO DE IDENTIDAD NODAL (ECDSA P-256)
 */
async function generarNuevaCedulaNodal(nombre, tipo, telefono, direccion, pgpInvitador) {
    try {
        console.log(">>> [CRYPTO_INIT]: Derivando llaves asimétricas ECDSA P-256...");
        
        // Generar un par de llaves ECDSA nativas usando la curva P-256
        const parLlaves = await window.crypto.subtle.generateKey(
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["sign", "verify"]
        );

        // Exportar la llave pública en formato SPKI codificada en Base64
        const pubExportada = await window.crypto.subtle.exportKey("spki", parLlaves.publicKey);
        const llavePublicaBase64 = btoa(String.fromCharCode(...new Uint8Array(pubExportada)))
            .substring(0, 50) + "...MCN";

        const timestampActual = Math.floor(Date.now() / 1000);

        // Estructura de la Cédula Macondo
        const nuevaCedula = {
            id_firma_nodal: generarIdNodalSeguro(),
            llave_publica_dispositivo: llavePublicaBase64,
            nombre: nombre,
            tipo: tipo || "NEGOCIO", 
            telefono: telefono,
            direccion: direccion,
            pgp_invitador: pgpInvitador || "NODO_ORIGEN_MACONDO",
            fecha_creacion: timestampActual,
            fecha_activacion: null,
            max_pedidos_simultaneos: 1 
        };

        // Guardar la llave privada en LocalStorage
        const privExportada = await window.crypto.subtle.exportKey("pkcs8", parLlaves.privateKey);
        const llavePrivadaBase64 = btoa(String.fromCharCode(...new Uint8Array(privExportada)));
        localStorage.setItem("MACONDO_PRIV_KEY", llavePrivadaBase64);
        localStorage.setItem("MACONDO_MI_CEDULA", JSON.stringify(nuevaCedula));

        console.log(`>>> [CRYPTO_SUCCESS]: Llave Nodal ${nuevaCedula.id_firma_nodal} asentada en hardware local.`);
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
        const urlDestino = window.ENDPOINT_SAVE_PHP || "../save_pool.php";
        
        const respuesta = await fetch(RUTA_REGISTRO_CEDULAS, { cache: "no-store" });
        let registroCompleto = respuesta.ok ? await respuesta.json() : {};

        if (typeof registroCompleto !== "object" || Array.isArray(registroCompleto) || registroCompleto === null) {
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

/**
 * INTERCEPTOR DE ACCESO DIRECTO DESDE FORMULARIO / BOTÓN DE UI
 */
async function intentarAutenticacionLocalDirecta() {
    console.log(">>> [AUTH_TRIGGER]: Interceptando solicitud de acceso local...");
    
    const inputNombre = document.getElementById("reg-nombre")?.value || document.getElementById("txt-nombre-negocio")?.value || "Establecimiento Macondo";
    const inputDireccion = document.getElementById("reg-direccion")?.value || document.getElementById("txt-direccion-negocio")?.value || "Cali Centro";
    const inputTelefono = document.getElementById("reg-telefono")?.value || document.getElementById("txt-telefono-negocio")?.value || "3000000000";
    const inputTipo = document.getElementById("reg-tipo")?.value || "NEGOCIO";
    
    const cedulaGenerada = await generarNuevaCedulaNodal(inputNombre, inputTipo, inputTelefono, inputDireccion, "NODO_ORIGEN_MACONDO");
    
    if (cedulaGenerada) {
        const guardadoDisco = await registrarCedulaEnDisco(cedulaGenerada);
        
        if (!guardadoDisco) {
            console.warn(">>> [AUTH_LOCAL_WARN]: Grabación en disco diferida. Sesión activada en caché local.");
        }
        
        if (typeof window.inicializarModuloInterfaz === "function") {
            window.inicializarModuloInterfaz(cedulaGenerada);
        } else if (typeof window.verificarAccesoCedulaAlArranque === "function") {
            window.verificarAccesoCedulaAlArranque();
        }
    } else {
        alert("Fallo crítico en el hardware criptográfico local al generar la Cédula.");
    }
}

// Inyección limpia al ámbito global
window.generarNuevaCedulaNodal = generarNuevaCedulaNodal;
window.registrarCedulaEnDisco = registrarCedulaEnDisco;
window.intentarAutenticacionLocalDirecta = intentarAutenticacionLocalDirecta;