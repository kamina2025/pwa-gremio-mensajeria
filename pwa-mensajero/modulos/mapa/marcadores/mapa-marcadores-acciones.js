/**
 * Ubicación: pwa-mensajero/modulos/mapa/marcadores/mapa-marcadores-acciones.js
 * Función: Drag & Drop, Eliminación y Sincronización Local-First
 */

import { IndexedStore } from "../../db/indexed-store.js";
import { actualizarParadaEnPlanillaLocal } from "../../procesamiento-datos/planillas-db.js";
import { guardarRutaZonificada } from "../../mensajero-persistencia.js";

const dbStore = new IndexedStore();
const KEY_COLA_OFFLINE = 'macondo_cola_offline_pwa';

function esEntornoEstatico() {
    if (typeof window === "undefined") return false;
    return window.location.hostname.includes("github.io") || window.location.protocol === "file:";
}

function obtenerEndpointAPI() {
    if (typeof window !== "undefined" && window.API_ENDPOINT) return window.API_ENDPOINT;
    const origin = window.location.origin;
    return window.location.pathname.includes("/pwa-gremio-mensajeria/") ? `${origin}/pwa-gremio-mensajeria/api.php` : `${origin}/api.php`;
}

export function compararIdsParada(idA, idB) {
    if (!idA || !idB) return false;
    const normA = String(idA).replace(/^[#PNT-]+/i, '').trim();
    const normB = String(idB).replace(/^[#PNT-]+/i, '').trim();
    return normA === normB || String(idA).trim() === String(idB).trim();
}

async function registrarOperacionPendienteDefensivo(accion, payload) {
    try {
        if (typeof dbStore.registrarOperacionPendiente === "function") {
            await dbStore.registrarOperacionPendiente(accion, payload);
            console.log(`💾 [OFFLINE]: '${accion}' persistida en IndexedDB.`);
        } else {
            const colaExistente = JSON.parse(localStorage.getItem(KEY_COLA_OFFLINE) || "[]");
            colaExistente.push({ accion, payload, timestamp: new Date().toISOString() });
            localStorage.setItem(KEY_COLA_OFFLINE, JSON.stringify(colaExistente));
        }
    } catch (err) {
        console.warn("⚠️ [OFFLINE]: Error guardando operación local:", err);
    }
}

export function limpiarParadaDeBuffersRAM(idTarget) {
    const filtrarArray = (arr) => Array.isArray(arr) ? arr.filter(p => p && !compararIdsParada(p.id || p.ssc, idTarget)) : [];

    const nuevoCache = filtrarArray(window.__CACHE_PARADAS_MACONDO__);
    window.__CACHE_PARADAS_MACONDO__ = nuevoCache;
    window.paradasMemoriaLocal = filtrarArray(window.paradasMemoriaLocal);
    window.paradasRutaActiva = filtrarArray(window.paradasRutaActiva);
    window.pedidosGlobales = filtrarArray(window.pedidosGlobales);

    if (typeof guardarRutaZonificada === "function") {
        guardarRutaZonificada(nuevoCache).catch(() => {});
    }
    return nuevoCache;
}

export function activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion) {
    if (marker.esAvanzado) marker.gmpDraggable = true;
    else if (typeof marker.setDraggable === "function") marker.setDraggable(true);

    const handlerDragEnd = async (event) => {
        const latLngTarget = event.latLng || marker.position;
        const nuevaLat = typeof latLngTarget.lat === "function" ? latLngTarget.lat() : latLngTarget.lat;
        const nuevaLng = typeof latLngTarget.lng === "function" ? latLngTarget.lng() : latLngTarget.lng;

        pedido.lat = pedido.latitud = nuevaLat;
        pedido.lng = pedido.longitud = nuevaLng;
        pedido.updated_at = new Date().toISOString();

        geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, async (results, status) => {
            if (status === "OK" && results[0]) pedido.direccion = pedido.dir = results[0].formatted_address;

            try {
                if (typeof dbStore.actualizarParada === "function") await dbStore.actualizarParada(pedido, "paradas_rutas");
                await actualizarParadaEnPlanillaLocal(pedido);
                
                let listadoActual = window.__CACHE_PARADAS_MACONDO__ || [];
                if (typeof window.procesarNumeracionConsecutivaPorZona === "function") {
                    listadoActual = await window.procesarNumeracionConsecutivaPorZona(listadoActual);
                } else if (typeof guardarRutaZonificada === "function") {
                    await guardarRutaZonificada(listadoActual);
                }
            } catch (err) {}

            const payload = { action: "actualizar_parada", id: pedido.id, lat: nuevaLat, lng: nuevaLng, direccion: pedido.direccion };

            if (esEntornoEstatico()) {
                await registrarOperacionPendienteDefensivo("actualizar_parada", payload);
            } else {
                fetch(`${obtenerEndpointAPI()}?action=actualizar_parada`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
                }).catch(async () => await registrarOperacionPendienteDefensivo("actualizar_parada", payload));
            }

            if (typeof callbackActualizacion === "function") callbackActualizacion(pedido);
        });

        if (marker.esAvanzado) marker.gmpDraggable = false;
        else if (typeof marker.setDraggable === "function") marker.setDraggable(false);
    };

    if (marker.esAvanzado && typeof marker.addListener === "function") marker.addListener("dragend", handlerDragEnd);
    else if (typeof google !== "undefined" && google.maps?.event) google.maps.event.addListenerOnce(marker, "dragend", handlerDragEnd);
}

export async function eliminarParadaProceso(marker, idParada, callbackActualizacion) {
    if (!confirm(`¿Eliminar la parada ${idParada} del mapa y registro local?`)) return;

    if (marker) {
        if (typeof google !== "undefined" && google.maps?.event) google.maps.event.clearInstanceListeners(marker);
        if (marker.esAvanzado) marker.map = null; else if (typeof marker.setMap === "function") marker.setMap(null);
    }
    if (Array.isArray(window.marcadoresRutaMensajero)) {
        window.marcadoresRutaMensajero = window.marcadoresRutaMensajero.filter(m => m !== marker);
    }

    let paradasActualizadas = limpiarParadaDeBuffersRAM(idParada);
    if (typeof window.procesarNumeracionConsecutivaPorZona === "function") paradasActualizadas = await window.procesarNumeracionConsecutivaPorZona(paradasActualizadas);

    try {
        if (typeof dbStore.eliminarParada === "function") {
            await dbStore.eliminarParada(idParada, "paradas_rutas");
            await dbStore.eliminarParada(idParada, "rutas_zonificadas").catch(() => {});
        }
    } catch(e) {}

    const payload = { action: "eliminar_parada", id: idParada };
    if (esEntornoEstatico()) {
        await registrarOperacionPendienteDefensivo("eliminar_parada", payload);
    } else {
        fetch(`${obtenerEndpointAPI()}?action=eliminar_parada&id=${encodeURIComponent(idParada)}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        }).catch(async () => await registrarOperacionPendienteDefensivo("eliminar_parada", payload));
    }

    if (typeof window.refrescarConsolaOperacionesUI === "function") await window.refrescarConsolaOperacionesUI(paradasActualizadas);
    if (typeof callbackActualizacion === "function") callbackActualizacion(paradasActualizadas);
}