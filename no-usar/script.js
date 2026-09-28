/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL Y ORQUESTADOR TÁCTICO
 * Ubicación: pwa-mensajero/script.js
 */

import { 
    guardarRutaZonificada, 
    obtenerRutaZonificada, 
    actualizarEstadoPedido, 
    capturarCoordenadasGPS,
    sincronizarYRenderizarPool,
    sincronizarYRenderizarTransito
} from "./modulos/mensajero-persistencia.js";

import { inicializarMapaMensajero } from "./modulos/mapa-mensajero-visor.js";
import { cargarRutaDesdeTextoOEnlace } from "./modulos/mensajero-importer.js";
import { renderizarConsolaOperaciones } from "./modulos/mensajero-ui.js";
import { 
    registrarIntentoLlamada, 
    configurarEventosFormularioNovedad 
} from "./modulos/mensajero-flujo.js";

// --- ESTADOS GLOBALES ---
let listaPedidosGlobal = [];
let indicePedidoActivo = 0;
let llamadasRealizadas = 0;

document.addEventListener("DOMContentLoaded", () => {
    console.log(">>> [ORQUESTADOR_INIT]: Consola cargada. Arrancando servicios telemáticos...");
    
    // Disparar la inicialización del mapa con reintentos
    inicializarMapaMensajero();
    inicializarRutaPayload();
    
    configurarEventosFormularioNovedad(
        () => listaPedidosGlobal[indicePedidoActivo],
        () => llamadasRealizadas,
        avanzarAlSiguientePedido
    );

    if (typeof sincronizarYRenderizarPool === "function") sincronizarYRenderizarPool();
    if (typeof sincronizarYRenderizarTransito === "function") sincronizarYRenderizarTransito();
});

function inicializarRutaPayload() {
    const urlParams = new URLSearchParams(window.location.search);
    const payloadRaw = urlParams.get("payload");

    if (payloadRaw) {
        try {
            listaPedidosGlobal = JSON.parse(decodeURIComponent(payloadRaw)).map(pedido => ({
                ...pedido,
                estado: pedido.estado || "ASIGNADO",
                registroOperaciones: pedido.registroOperaciones || {}
            }));
            console.log(`>>> [PAYLOAD_OK]: Se cargaron ${listaPedidosGlobal.length} pedidos desde URL.`);
            guardarRutaZonificada(listaPedidosGlobal);
        } catch (e) {
            console.error(">>> [PAYLOAD_ERROR]: Error al deserializar payload URL:", e);
            listaPedidosGlobal = obtenerRutaZonificada();
        }
    } else {
        console.log(">>> [STORAGE_READ]: Leyendo ruta zonificada desde almacenamiento local.");
        listaPedidosGlobal = obtenerRutaZonificada();
    }

    determinarSiguientePedidoActivo();
    refrescarUI();
}

function determinarSiguientePedidoActivo() {
    const index = listaPedidosGlobal.findIndex(p => p.estado !== "FINALIZADO" && p.estado !== "NOVEDAD");
    indicePedidoActivo = index !== -1 ? index : (listaPedidosGlobal.length > 0 ? listaPedidosGlobal.length - 1 : 0);
    console.log(`>>> [ESTADO_ACTIVO]: Pedido activo seleccionado en el índice ${indicePedidoActivo}`);
}

function refrescarUI() {
    console.log(">>> [UI_REFRESH]: Actualizando consola de operaciones y mapa...");
    renderizarConsolaOperaciones(listaPedidosGlobal, indicePedidoActivo, llamadasRealizadas);
}

function avanzarAlSiguientePedido() {
    listaPedidosGlobal = obtenerRutaZonificada();
    determinarSiguientePedidoActivo();
    refrescarUI();
}

// --- BINDINGS A WINDOW ---
window.ejecutarPasoAceptarPedido = function(idPedido) {
    console.log(`>>> [FLUJO_PASO_1]: Aceptando pedido ${idPedido}`);
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "EN_CAMINO");
    refrescarUI();
};

window.ejecutarPasoNotificarLlegada = function(idPedido) {
    console.log(`>>> [FLUJO_PASO_2]: Notificando llegada para ${idPedido}`);
    llamadasRealizadas = 0;
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "LLEGADO");
    refrescarUI();
};

window.ejecutarPasoFinalizarPedido = async function(idPedido) {
    console.log(`>>> [FLUJO_PASO_3]: Finalizando pedido ${idPedido}`);
    const coords = await capturarCoordenadasGPS();
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "FINALIZADO", { coordenadasGPS: coords });
    avanzarAlSiguientePedido();
};

window.registrarIntentoLlamada = function() {
    registrarIntentoLlamada(() => llamadasRealizadas, (v) => llamadasRealizadas = v, refrescarUI);
};

window.procesarCargaManualEnlace = function() {
    const inputTxt = document.getElementById("txt-payload-manual");
    if (inputTxt) {
        cargarRutaDesdeTextoOEnlace(inputTxt.value, (nuevasParadas) => {
            listaPedidosGlobal = nuevasParadas;
            indicePedidoActivo = 0;
            refrescarUI();
        });
    }
};