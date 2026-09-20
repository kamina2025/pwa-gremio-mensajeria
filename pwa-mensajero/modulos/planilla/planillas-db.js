/**
 * PROTOCOLO MACONDO - CONSULTA Y PERSISTENCIA LOCAL DE PLANILLAS
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/planillas-db.js
 */

import { obtenerDB } from '../base-de-datos.js';
/**
 * Consulta y retorna todas las planillas reportadas registradas en IndexedDB/Local.
 * @returns {Promise<Array>} Lista de planillas guardadas
 */
export async function obtenerPlanillasReportadas() {
    try {
        const db = await obtenerDB();
        const tx = db.transaction("planillas", "readonly");
        const store = tx.objectStore("planillas");
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (err) => reject("Error consultando planillas localmente: " + err);
        });
    } catch (error) {
        console.warn("⚠️ [Planillas DB]: Fallo en IndexedDB. Recuperando de respaldo local...", error);
        const backup = localStorage.getItem("planillas_reportadas_cache");
        return backup ? JSON.parse(backup) : [];
    }
}
/**
 * Guarda una nueva planilla en IndexedDB.
 * @param {Object} nuevaPlanilla 
 * @returns {Promise<number>} ID asignado
 */
export async function guardarPlanillaReportada(nuevaPlanilla) {
    try {
        const db = await obtenerDB();
        const tx = db.transaction("planillas", "readwrite");
        const store = tx.objectStore("planillas");
        const request = store.add(nuevaPlanilla);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = (err) => reject("Error guardando planilla: " + err);
        });
    } catch (error) {
        console.warn("⚠️ [Planillas DB]: Guardando respaldo en localStorage...", error);
        const actual = JSON.parse(localStorage.getItem("planillas_reportadas_cache") || "[]");
        actual.push(nuevaPlanilla);
        localStorage.setItem("planillas_reportadas_cache", JSON.stringify(actual));
        return Date.now();
    }
}