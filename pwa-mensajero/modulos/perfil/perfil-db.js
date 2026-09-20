/**
 * PROTOCOLO MACONDO - PERSISTENCIA Y SINCRONIZACIÓN DEL PERFIL DE CONDUCTOR
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/perfil-db.js
 */

import { obtenerDB } from '../base-de-datos.js';

const KEY_PERFIL = "perfil_activo";

/**
 * Consulta y obtiene los datos del perfil guardado en IndexedDB / localStorage.
 * @returns {Promise<Object|null>} Datos del perfil
 */
export async function obtenerPerfilLocal() {
    try {
        const db = await obtenerDB();
        const tx = db.transaction("perfil_conductor", "readonly");
        const store = tx.objectStore("perfil_conductor");
        const request = store.get(KEY_PERFIL);

        return new Promise((resolve) => {
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result);
                } else {
                    const fallback = localStorage.getItem("perfil_conductor_cache");
                    resolve(fallback ? JSON.parse(fallback) : null);
                }
            };
            request.onerror = () => {
                const fallback = localStorage.getItem("perfil_conductor_cache");
                resolve(fallback ? JSON.parse(fallback) : null);
            };
        });
    } catch (error) {
        console.warn("⚠️ [Perfil DB]: Fallo consultando IndexedDB. Consultando fallback...", error);
        const fallback = localStorage.getItem("perfil_conductor_cache");
        return fallback ? JSON.parse(fallback) : null;
    }
}

/**
 * Guarda los datos del perfil localmente en IndexedDB e intenta sincronizar con la API PHP.
 * @param {Object} datosPerfil 
 */
export async function guardarPerfilLocal(datosPerfil) {
    const registro = { id: KEY_PERFIL, ...datosPerfil, actualizadoEn: new Date().toISOString() };

    // 1. Guardado Inmediato Local-First
    try {
        const db = await obtenerDB();
        const tx = db.transaction("perfil_conductor", "readwrite");
        const store = tx.objectStore("perfil_conductor");
        store.put(registro);
        localStorage.setItem("perfil_conductor_cache", JSON.stringify(registro));

        // Actualizar datos de respaldo rápido
        if (datosPerfil.nombre) localStorage.setItem("nombreMensajero", datosPerfil.nombre);
        if (datosPerfil.placa) localStorage.setItem("placaMensajero", datosPerfil.placa);

        console.log("💾 [Perfil DB]: Perfil guardado exitosamente en local.");
    } catch (err) {
        console.error("❌ [Perfil DB]: Error al guardar localmente:", err);
        localStorage.setItem("perfil_conductor_cache", JSON.stringify(registro));
    }

    // 2. Sincronización transparente con API PHP en segundo plano
    sincronizarPerfilCloud(registro).catch(err => {
        console.warn("🌐 [Perfil DB]: Dispositivo sin conexión o API inalcanzable. Cambios diferidos.", err);
    });
}

/**
 * Envía la información actualizada del perfil a la API PHP REST.
 */
export async function sincronizarPerfilCloud(datosPerfil) {
    if (!navigator.onLine) {
        console.log("🌐 [Perfil Sync]: Sin red. Sincronización pospuesta.");
        return;
    }

    const endpoint = window.ENDPOINT_API_PHP || "./api.php";
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
}