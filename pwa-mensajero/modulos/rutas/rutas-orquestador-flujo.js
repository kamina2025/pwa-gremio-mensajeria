/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE ORQUESTACIÓN DE RUTAS Y PEDIDOS
 * Ubicación: modulos/rutas/rutas-orquestador-flujo.js
 */

import { 
    obtenerParadasGuardadas, 
    actualizarEstadoPedido, 
    capturarCoordenadasGPS,
    eliminarParadaLocal,
    borrarRutaCompletaLocal 
} from "../mensajero-persistencia.js";
import { procesarPayloadOStorage, buscarIndiceActivo } from "./mensajero-rutas.js";
import { renderizarConsolaOperaciones } from "../mensajero-ui.js";

let listaPedidosGlobal = [];
let indicePedidoActivo = 0;
let llamadasRealizadas = 0;

export function obtenerListaPedidosGlobal() {
    return listaPedidosGlobal;
}

export function obtenerIndicePedidoActivo() {
    return indicePedidoActivo;
}

export function obtenerLlamadasRealizadas() {
    return llamadasRealizadas;
}

export function setLlamadasRealizadas(valor) {
    llamadasRealizadas = valor;
}

export function refrescarUI() {
    console.log("🎨 [UI_REFRESH]: Re-renderizando consola de operaciones...");
    renderizarConsolaOperaciones(listaPedidosGlobal, indicePedidoActivo, llamadasRealizadas);
}

export async function determinarSiguientePedidoActivo() {
    indicePedidoActivo = await buscarIndiceActivo(listaPedidosGlobal);
    console.log(`🎯 [RUTAS]: Indice activo determinado -> ${indicePedidoActivo}`);
}

export async function inicializarRutaPayload() {
    console.log("📦 [RUTAS]: Procesando payload o lectura de almacenamiento local...");
    const resultado = await procesarPayloadOStorage();
    listaPedidosGlobal = Array.isArray(resultado) ? resultado : [];
    await determinarSiguientePedidoActivo();
    refrescarUI();
}

export async function avanzarAlSiguientePedido() {
    console.log("⏭️ [RUTAS]: Avanzando al siguiente pedido...");
    const resultado = await obtenerParadasGuardadas();
    listaPedidosGlobal = Array.isArray(resultado) ? resultado : [];
    await determinarSiguientePedidoActivo();
    refrescarUI();
}

export async function ejecutarPasoAceptarPedido(idPedido) {
    console.log(`📥 [OPERACION]: Aceptando pedido -> ${idPedido}`);
    
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: `aceptar-${idPedido}`,
            titulo: 'Aceptando Pedido',
            mensaje: 'Actualizando estado en base local...',
            estado: 'procesando',
            progreso: 50
        });
    }

    listaPedidosGlobal = await actualizarEstadoPedido(idPedido, "EN_CAMINO");
    refrescarUI();

    if (typeof window.actualizarProgresoProceso === 'function') {
        window.actualizarProgresoProceso(`aceptar-${idPedido}`, 100, '¡Pedido En Camino!', 'exito');
        window.cerrarAvisoProceso(`aceptar-${idPedido}`, 1200);
    }
}

export async function ejecutarPasoNotificarLlegada(idPedido) {
    console.log(`🔔 [OPERACION]: Notificando llegada para pedido -> ${idPedido}`);
    
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: `llegada-${idPedido}`,
            titulo: 'Notificando Llegada',
            mensaje: 'Registrando estado de arribo...',
            estado: 'procesando',
            progreso: 50
        });
    }

    llamadasRealizadas = 0;
    listaPedidosGlobal = await actualizarEstadoPedido(idPedido, "LLEGADO");
    refrescarUI();

    if (typeof window.actualizarProgresoProceso === 'function') {
        window.actualizarProgresoProceso(`llegada-${idPedido}`, 100, '¡Arribo Registrado!', 'exito');
        window.cerrarAvisoProceso(`llegada-${idPedido}`, 1200);
    }
}

export async function ejecutarPasoFinalizarPedido(idPedido) {
    console.log(`✅ [OPERACION]: Finalizando pedido -> ${idPedido}`);
    const toastId = `fin-${idPedido}`;

    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: toastId,
            titulo: 'Finalizando Pedido',
            mensaje: 'Obteniendo coordenadas GPS de entrega...',
            estado: 'procesando',
            progreso: 30
        });
    }

    try {
        const coords = await capturarCoordenadasGPS();
        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 70, 'Guardando evidencia y advancing...');
        }

        listaPedidosGlobal = await actualizarEstadoPedido(idPedido, "FINALIZADO", { coordenadasGPS: coords });
        await avanzarAlSiguientePedido();

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Entrega registrada con éxito!', 'exito');
            window.cerrarAvisoProceso(toastId, 1500);
        }
    } catch (err) {
        console.error("❌ Error finalizando pedido:", err);
        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, 'Error al capturar ubicación GPS', 'error');
            window.cerrarAvisoProceso(toastId, 2500);
        }
    }
}

export async function borrarParadaLocalUI(idParada) {
    console.log(`🗑️ [OPERACION]: Solicitud para borrar parada ID -> ${idParada}`);
    if (confirm(`>>> ¿Desea borrar la parada ID: ${idParada}?`)) {
        listaPedidosGlobal = await eliminarParadaLocal(idParada);
        await determinarSiguientePedidoActivo();
        refrescarUI();
    }
}

export async function purgarTodaLaRutaUI() {
    console.log("🧹 [OPERACION]: Purgando toda la ruta local...");
    if (confirm(">>> ¿Desea borrar TODAS las paradas?")) {
        const toastId = 'purgar-ruta';
        if (typeof window.mostrarAvisoProceso === 'function') {
            window.mostrarAvisoProceso({
                id: toastId,
                titulo: 'Eliminando Ruta',
                mensaje: 'Limpiando IndexedDB y registros...',
                estado: 'procesando',
                progreso: 50
            });
        }

        listaPedidosGlobal = await borrarRutaCompletaLocal();
        indicePedidoActivo = 0;
        refrescarUI();

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Ruta purgada completamente!', 'advertencia');
            window.cerrarAvisoProceso(toastId, 1500);
        }
    }
}

export async function iniciarRutaCompleta() {
    console.log("🚀 [OPERACION]: Iniciando recorrido completo de la ruta...");
    listaPedidosGlobal = (await obtenerParadasGuardadas()) || [];

    if (!listaPedidosGlobal || listaPedidosGlobal.length === 0) {
        alert("⚠️ [ALERTA]: No hay paradas en la ruta para iniciar.");
        return;
    }

    indicePedidoActivo = 0;
    refrescarUI();

    if (typeof window.alternarVistaPestaña === "function") {
        window.alternarVistaPestaña("mapa-fullscreen-container");
    }

    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: 'inicio-ruta',
            titulo: 'Ruta Iniciada',
            mensaje: 'Navegando a la primera parada en el mapa.',
            estado: 'exito',
            progreso: 100
        });
        window.cerrarAvisoProceso('inicio-ruta', 2000);
    }
}