/**
 * PROTOCOLO MACONDO - GESTOR DE RUTAS Y DATOS DE PEDIDOS
 * Ubicación: pwa-mensajero/modulos/mensajero-rutas.js
 */

import { guardarRutaZonificada, obtenerRutaZonificada } from "./mensajero-persistencia.js";

export function procesarPayloadOStorage() {
    let listaPedidos = [];
    const urlParams = new URLSearchParams(window.location.search);
    const payloadRaw = urlParams.get("payload");

    if (payloadRaw) {
        try {
            listaPedidos = JSON.parse(decodeURIComponent(payloadRaw)).map((pedido) => ({
                ...pedido,
                estado: pedido.estado || "ASIGNADO",
                registroOperaciones: pedido.registroOperaciones || {}
            }));
            guardarRutaZonificada(listaPedidos);
        } catch (e) {
            console.error(">>> [PAYLOAD_ERROR]: Error procesando payload URL:", e);
            listaPedidos = obtenerRutaZonificada();
        }
    } else {
        listaPedidos = obtenerRutaZonificada();
    }
    return listaPedidos;
}

export function buscarIndiceActivo(listaPedidos) {
    const index = listaPedidos.findIndex((p) => p.estado !== "FINALIZADO" && p.estado !== "NOVEDAD");
    return index !== -1 ? index : listaPedidos.length > 0 ? listaPedidos.length - 1 : 0;
}