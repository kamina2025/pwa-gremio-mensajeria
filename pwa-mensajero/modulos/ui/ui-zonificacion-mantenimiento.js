/**
 * Módulo de Operaciones Tácticas, Zonificación y Edición de Paradas
 * Ubicación: pwa-mensajero/modulos/ui/ui-zonificacion-mantenimiento.js
 */

import { clasificarParadasPorZona } from "../mapa/zonificacion/mensajero-zonificacion.js";
import { IndexedStore } from "../db/indexed-store.js";

const dbStore = new IndexedStore();

export async function ejecutarZonificacionAutomaticaUI(paradasMemoriaLocal, renderCallback) {
    console.group("🎨 [ZONIFICAR_UI]: Iniciando clasificación espacial táctica...");
    
    const txtTotal = document.getElementById("txt-total-paradas");
    if (txtTotal) txtTotal.innerText = "ZONIFICANDO...";

    if (!Array.isArray(paradasMemoriaLocal) || paradasMemoriaLocal.length === 0) {
        console.warn("⚠️ [ZONIFICAR_UI]: No hay paradas en memoria para zonificar.");
        console.groupEnd();
        return paradasMemoriaLocal;
    }

    const geocoder = (typeof google !== "undefined" && google.maps) ? new google.maps.Geocoder() : null;

    for (let i = 0; i < paradasMemoriaLocal.length; i++) {
        const p = paradasMemoriaLocal[i];
        
        if ((!p.lat || !p.lng) && geocoder && p.direccion) {
            const dirCompleta = p.direccion.toLowerCase().includes("cali") 
                ? p.direccion 
                : `${p.direccion}, Cali, Valle del Cauca, Colombia`;
            
            try {
                const res = await new Promise((resolve) => {
                    geocoder.geocode({ address: dirCompleta }, (results, status) => {
                        if (status === "OK" && results && results[0]) {
                            resolve(results[0].geometry.location);
                        } else {
                            resolve(null);
                        }
                    });
                });

                if (res) {
                    p.lat = res.lat();
                    p.lng = res.lng();
                    console.log(`📍 Geocodificada parada #${i + 1} (${p.destinatario}): [${p.lat}, ${p.lng}]`);
                }
            } catch (err) {
                console.warn(`⚠️ Error geocodificando dirección de parada #${i + 1}:`, err);
            }
        }
    }

    const paradasProcesadas = clasificarParadasPorZona(paradasMemoriaLocal);

    for (const p of paradasProcesadas) {
        await dbStore.actualizarParada(p);
    }
    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasProcesadas));
    console.log("💾 [ZONIFICAR_UI]: Paradas actualizadas en IndexedDB y localStorage.");

    if (typeof renderCallback === "function") renderCallback(paradasProcesadas);
    console.groupEnd();
    return paradasProcesadas;
}

export async function moverParadaSecuenciaUI(paradasMemoriaLocal, idParada, delta, renderCallback) {
    console.group(`⚡ [REORDENAMIENTO_UI]: Moviendo parada ${idParada} con delta ${delta}`);
    const index = paradasMemoriaLocal.findIndex(p => String(p.id) === String(idParada));
    if (index === -1) {
        console.warn("⚠️ [REORDENAMIENTO_UI]: Parada no encontrada.");
        console.groupEnd();
        return;
    }

    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= paradasMemoriaLocal.length) {
        console.warn("⚠️ [REORDENAMIENTO_UI]: Índice fuera de límites.");
        console.groupEnd();
        return;
    }

    const temp = paradasMemoriaLocal[index];
    paradasMemoriaLocal[index] = paradasMemoriaLocal[newIndex];
    paradasMemoriaLocal[newIndex] = temp;

    for (let i = 0; i < paradasMemoriaLocal.length; i++) {
        paradasMemoriaLocal[i].secuencia = i + 1;
        paradasMemoriaLocal[i].secuenciaZona = i + 1;
        await dbStore.actualizarParada(paradasMemoriaLocal[i]);
    }

    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
    if (typeof renderCallback === "function") renderCallback(paradasMemoriaLocal);
    console.groupEnd();
}