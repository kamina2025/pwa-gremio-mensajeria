/**
 * PROTOCOLO MACONDO - CONSULTA Y PERSISTENCIA LOCAL DE PLANILLAS
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/planillas-db.js
 */

import { obtenerDB } from '../base-de-datos.js';

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

/**
 * Sincroniza la modificación de una parada dentro del objeto de la planilla activa en IndexedDB.
 * @param {Object} paradaActualizada 
 */
export async function actualizarParadaEnPlanillaLocal(paradaActualizada) {
    try {
        const db = await obtenerDB();
        const tx = db.transaction("planillas", "readwrite");
        const store = tx.objectStore("planillas");
        const request = store.getAll();

        request.onsuccess = () => {
            const planillas = request.result || [];
            const targetId = String(paradaActualizada.id || paradaActualizada.ssc).trim();

            planillas.forEach(planilla => {
                if (Array.isArray(planilla.paradas)) {
                    const idx = planilla.paradas.findIndex(p => String(p.id || p.ssc).trim() === targetId);
                    if (idx !== -1) {
                        planilla.paradas[idx] = { ...planilla.paradas[idx], ...paradaActualizada };
                        store.put(planilla);
                        console.log(`💾 [Planillas DB]: Parada #${targetId} actualizada dentro de Planilla ID: ${planilla.id}`);
                    }
                }
            });
        };
    } catch (err) {
        console.warn("⚠️ [Planillas DB]: No se pudo actualizar la parada en la planilla local:", err);
    }
}