/**
 * PROTOCOLO MACONDO - PERSISTENCIA Y SINCRONIZACIÓN DEL PERFIL DE CONDUCTOR
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/perfil-db.js
 * Arquitectura: Async Local-First / IndexedDB / Fallback LocalStorage / Sync API REST
 */

import { obtenerDB } from './base-de-datos.js';

const KEY_PERFIL = "perfil_activo";
const STORE_PERFIL = "perfil_conductor";
const KEY_LOCALSTORAGE_CACHE = "perfil_conductor_cache";

/**
 * Consulta y obtiene los datos del perfil guardado en IndexedDB / localStorage.
 * 
 * @returns {Promise<Object|null>} Datos del perfil
 */
export async function obtenerPerfilLocal() {
    console.log(">>> [Perfil DB]: Consultando perfil de conductor local...");
    try {
        const db = await obtenerDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_PERFIL, "readonly");
            const store = tx.objectStore(STORE_PERFIL);
            const request = store.get(KEY_PERFIL);

            request.onsuccess = () => {
                if (request.result) {
                    console.log("✅ [Perfil DB]: Perfil recuperado exitosamente desde IndexedDB.");
                    resolve(request.result);
                } else {
                    console.log("ℹ️ [Perfil DB]: No hay registro en IndexedDB. Verificando localStorage...");
                    const fallback = localStorage.getItem(KEY_LOCALSTORAGE_CACHE);
                    resolve(fallback ? JSON.parse(fallback) : null);
                }
            };

            request.onerror = (evt) => {
                console.warn("⚠️ [Perfil DB]: Error leyendo IndexedDB. Recurriendo a localStorage...", evt.target.error);
                const fallback = localStorage.getItem(KEY_LOCALSTORAGE_CACHE);
                resolve(fallback ? JSON.parse(fallback) : null);
            };
        });
    } catch (error) {
        console.warn("⚠️ [Perfil DB]: Fallo en motor IndexedDB. Consultando fallback...", error);
        const fallback = localStorage.getItem(KEY_LOCALSTORAGE_CACHE);
        return fallback ? JSON.parse(fallback) : null;
    }
}

/**
 * Guarda los datos del perfil localmente en IndexedDB e intenta sincronizar con la API PHP.
 * 
 * @param {Object} datosPerfil 
 * @returns {Promise<boolean>}
 */
export async function guardarPerfilLocal(datosPerfil) {
    if (!datosPerfil || typeof datosPerfil !== "object") return false;

    const registro = { 
        id: KEY_PERFIL, 
        ...datosPerfil, 
        actualizadoEn: new Date().toISOString() 
    };

    console.log(">>> [Perfil DB]: Persistiendo perfil de conductor localmente...");

    // 1. Guardado Inmediato Local-First
    let guardadoExitoso = false;
    try {
        const db = await obtenerDB();
        const tx = db.transaction(STORE_PERFIL, "readwrite");
        const store = tx.objectStore(STORE_PERFIL);
        store.put(registro);
        
        localStorage.setItem(KEY_LOCALSTORAGE_CACHE, JSON.stringify(registro));

        // Actualizar datos de respaldo rápido para la interfaz
        if (datosPerfil.nombre) localStorage.setItem("nombreMensajero", datosPerfil.nombre);
        if (datosPerfil.placa) localStorage.setItem("placaMensajero", datosPerfil.placa);

        console.log("💾 [Perfil DB]: Perfil guardado exitosamente en IndexedDB y localStorage.");
        guardadoExitoso = true;
    } catch (err) {
        console.error("❌ [Perfil DB]: Error al guardar en IndexedDB. Respaldando en localStorage:", err);
        localStorage.setItem(KEY_LOCALSTORAGE_CACHE, JSON.stringify(registro));
        guardadoExitoso = true;
    }

    // 2. Sincronización transparente con API PHP en segundo plano
    sincronizarPerfilCloud(registro).catch(err => {
        console.warn("🌐 [Perfil DB]: Dispositivo sin conexión o API inalcanzable. Cambios diferidos.", err);
    });

    return guardadoExitoso;
}

/**
 * Envía la información actualizada del perfil a la API PHP REST.
 * 
 * @param {Object} datosPerfil 
 */
export async function sincronizarPerfilCloud(datosPerfil) {
    if (typeof window !== "undefined" && window.location && window.location.hostname.includes("github.io")) {
        console.log("🌐 [Perfil Sync]: Entorno estático detectado. Sincronización Cloud omitida.");
        return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
        console.log("🌐 [Perfil Sync]: Sin red. Sincronización pospuesta.");
        return;
    }

    const endpoint = (typeof window !== "undefined" && window.ENDPOINT_API_PHP) || "./api.php";
    
    try {
        const response = await fetch(`${endpoint}?action=guardar_perfil`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosPerfil)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const resData = await response.json();
        console.log("✅ [Perfil Sync]: Sincronización con el servidor exitosa:", resData);
    } catch (err) {
        console.warn("⚠️ [Perfil Sync]: Fallo en la llamada a la API REST:", err);
    }
}

// Alias de exportación para compatibilidad completa con el ecosistema PWA
export const obtenerPerfilConductorLocal = obtenerPerfilLocal;
export const guardarPerfilConductorLocal = guardarPerfilLocal;

// Bindings globales en window
if (typeof window !== "undefined") {
    window.obtenerPerfilLocal = obtenerPerfilLocal;
    window.guardarPerfilLocal = guardarPerfilLocal;
    window.obtenerPerfilConductorLocal = obtenerPerfilConductorLocal;
    window.guardarPerfilConductorLocal = guardarPerfilConductorLocal;
}