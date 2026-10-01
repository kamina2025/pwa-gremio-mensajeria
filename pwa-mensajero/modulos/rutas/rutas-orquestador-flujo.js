/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE ORQUESTACIÓN DE RUTAS Y PEDIDOS
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-orquestador-flujo.js
 * Arquitectura: PWA Local-First / Sincronización Atómica RAM-IndexedDB / GitPages Ready
 */

import { 
    obtenerRutaZonificada, 
    guardarRutaZonificada, 
    capturarCoordenadasGPS 
} from "../mensajero-persistencia.js";
import { 
    procesarPayloadOStorage, 
    buscarIndiceActivo, 
    ordenarParadasPorSecuencia 
} from "./rutas-normalizador.js";
import { renderizarConsolaOperaciones } from "../mensajero-ui.js";
import { IndexedStore } from "../db/indexed-store.js";

const dbStore = new IndexedStore();
const KEY_COLA_OFFLINE = 'macondo_cola_offline_pwa';

let listaPedidosGlobal = [];
let indicePedidoActivo = 0;
let llamadasRealizadas = 0;

/**
 * Detecta si el entorno actual es un hosting estático sin API PHP (p. ej. GitHub Pages)
 * @returns {boolean}
 */
function esEntornoEstatico() {
    if (typeof window === "undefined") return false;
    return window.location.hostname.includes("github.io") || window.location.protocol === "file:";
}

/**
 * Extrae y limpia el identificador de la parada para comparaciones homogéneas.
 * @param {Object|string|number} inputParada 
 * @returns {string}
 */
function obtenerIdLimpio(inputParada) {
    if (!inputParada) return "";
    const rawId = typeof inputParada === "object" ? (inputParada.id || inputParada.ssc || inputParada.scc || inputParada.idParada || "") : inputParada;
    return String(rawId).replace(/^[#PNT-]+/i, "").trim();
}

/**
 * Registra defensivamente operaciones pendientes en la cola offline (IndexedDB o localStorage)
 * @param {string} accion 
 * @param {Object} payload 
 */
async function registrarOperacionPendienteDefensivo(accion, payload) {
    try {
        if (dbStore && typeof dbStore.registrarOperacionPendiente === "function") {
            await dbStore.registrarOperacionPendiente(accion, payload);
            console.log(`💾 [OFFLINE_QUEUE]: Operación '${accion}' registrada exitosamente en IndexedDB.`);
        } else {
            const cola = JSON.parse(localStorage.getItem(KEY_COLA_OFFLINE) || "[]");
            cola.push({ accion, payload, timestamp: new Date().toISOString() });
            localStorage.setItem(KEY_COLA_OFFLINE, JSON.stringify(cola));
            console.log(`💾 [OFFLINE_QUEUE_FALLBACK]: Operación '${accion}' guardada en localStorage.`);
        }
    } catch (err) {
        console.warn("⚠️ [OFFLINE_QUEUE]: Fallo al encolar operación offline:", err);
    }
}

/**
 * Sincroniza atómicamente la colección de pedidos con los 4 buffers RAM globales
 * y guarda la snapshot actualizada en IndexedDB y localStorage.
 * @param {Array<Object>} nuevaLista 
 */
async function sincronizarAtomicamenteRAM(nuevaLista = []) {
    listaPedidosGlobal = Array.isArray(nuevaLista) ? [...nuevaLista] : [];
    
    // Sincronización estricta de las 4 memorias de trabajo
    window.__CACHE_PARADAS_MACONDO__ = [...listaPedidosGlobal];
    window.paradasMemoriaLocal = [...listaPedidosGlobal];
    window.paradasRutaActiva = [...listaPedidosGlobal];
    window.pedidosGlobales = [...listaPedidosGlobal];

    try {
        localStorage.setItem("ruta_zonificada", JSON.stringify(listaPedidosGlobal));
        await guardarRutaZonificada(listaPedidosGlobal);
        console.log(`💾 [ORQUESTADOR_RAM]: ${listaPedidosGlobal.length} paradas sincronizadas atómicamente en RAM e IndexedDB.`);
    } catch (e) {
        console.warn("⚠️ [ORQUESTADOR_RAM]: Error al persistir snapshot en almacenamiento local:", e);
    }
}

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

/**
 * Re-renderiza la consola operacional y actualiza la capa gráfica en el visor de mapa.
 */
export function refrescarUI() {
    console.log("🎨 [UI_REFRESH]: Re-renderizando consola de operaciones y mapa...");
    
    if (typeof renderizarConsolaOperaciones === "function") {
        renderizarConsolaOperaciones(listaPedidosGlobal, indicePedidoActivo, llamadasRealizadas);
    }

    if (typeof window.actualizarPuntosEnMapa === "function") {
        window.actualizarPuntosEnMapa(listaPedidosGlobal, indicePedidoActivo);
    }
}

/**
 * Evalúa el siguiente índice activo de parada no finalizada.
 */
export async function determinarSiguientePedidoActivo() {
    indicePedidoActivo = await buscarIndiceActivo(listaPedidosGlobal);
    console.log(`🎯 [RUTAS_ORQUESTADOR]: Índice activo determinado -> ${indicePedidoActivo}`);
}

/**
 * Inicializa el flujo de la ruta leyendo la URL o el almacenamiento IndexedDB.
 */
export async function inicializarRutaPayload() {
    console.log("📦 [RUTAS_ORQUESTADOR]: Procesando payload o lectura de almacenamiento local...");
    const resultado = await procesarPayloadOStorage();
    await sincronizarAtomicamenteRAM(resultado);
    await determinarSiguientePedidoActivo();
    refrescarUI();
}

/**
 * Refresca la lista desde IndexedDB y recalcula el siguiente punto activo.
 */
export async function avanzarAlSiguientePedido() {
    console.log("⏭️ [RUTAS_ORQUESTADOR]: Avanzando al siguiente pedido...");
    const resultado = await obtenerRutaZonificada();
    await sincronizarAtomicamenteRAM(resultado || []);
    await determinarSiguientePedidoActivo();
    refrescarUI();
}

/**
 * Ejecuta el paso de Aceptar / Marcar pedido En Camino.
 * @param {string|number} idPedido 
 */
export async function ejecutarPasoAceptarPedido(idPedido) {
    console.log(`📥 [OPERACION]: Aceptando pedido -> ${idPedido}`);
    const toastId = `aceptar-${idPedido}`;
    
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: toastId,
            titulo: 'Aceptando Pedido',
            mensaje: 'Actualizando estado en base local...',
            estado: 'procesando',
            progreso: 50
        });
    }

    try {
        const cleanTargetId = obtenerIdLimpio(idPedido);
        const listaActualizada = listaPedidosGlobal.map(p => {
            if (p && obtenerIdLimpio(p) === cleanTargetId) {
                return { ...p, estado: "EN_CAMINO", status: "en-camino", updated_at: new Date().toISOString() };
            }
            return p;
        });

        await sincronizarAtomicamenteRAM(listaActualizada);
        await determinarSiguientePedidoActivo();
        refrescarUI();

        if (esEntornoEstatico()) {
            await registrarOperacionPendienteDefensivo("aceptar_pedido", { id: idPedido, estado: "EN_CAMINO" });
        }

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Pedido En Camino!', 'exito');
            window.cerrarAvisoProceso(toastId, 1200);
        }
    } catch (err) {
        console.error("❌ Error aceptando pedido:", err);
        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, 'Error al aceptar pedido', 'error');
            window.cerrarAvisoProceso(toastId, 2000);
        }
    }
}

/**
 * Registra el arribo/llegada a la dirección del pedido.
 * @param {string|number} idPedido 
 */
export async function ejecutarPasoNotificarLlegada(idPedido) {
    console.log(`🔔 [OPERACION]: Notificando llegada para pedido -> ${idPedido}`);
    const toastId = `llegada-${idPedido}`;

    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: toastId,
            titulo: 'Notificando Llegada',
            mensaje: 'Registrando estado de arribo...',
            estado: 'procesando',
            progreso: 50
        });
    }

    try {
        llamadasRealizadas = 0;
        const cleanTargetId = obtenerIdLimpio(idPedido);
        const listaActualizada = listaPedidosGlobal.map(p => {
            if (p && obtenerIdLimpio(p) === cleanTargetId) {
                return { ...p, estado: "LLEGADO", status: "llegado", updated_at: new Date().toISOString() };
            }
            return p;
        });

        await sincronizarAtomicamenteRAM(listaActualizada);
        refrescarUI();

        if (esEntornoEstatico()) {
            await registrarOperacionPendienteDefensivo("notificar_llegada", { id: idPedido, estado: "LLEGADO" });
        }

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Arribo Registrado!', 'exito');
            window.cerrarAvisoProceso(toastId, 1200);
        }
    } catch (err) {
        console.error("❌ Error notificando llegada:", err);
        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, 'Error al notificar llegada', 'error');
            window.cerrarAvisoProceso(toastId, 2000);
        }
    }
}

/**
 * Finaliza la parada capturando coordenadas GPS y actualizando la snapshot local.
 * @param {string|number} idPedido 
 */
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
        let coords = null;
        if (typeof capturarCoordenadasGPS === "function") {
            coords = await capturarCoordenadasGPS().catch(() => null);
        }

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 70, 'Guardando evidencia y avanzando...');
        }

        const cleanTargetId = obtenerIdLimpio(idPedido);
        const listaActualizada = listaPedidosGlobal.map(p => {
            if (p && obtenerIdLimpio(p) === cleanTargetId) {
                return { 
                    ...p, 
                    estado: "FINALIZADO", 
                    status: "entregado", 
                    coordenadasEntrega: coords,
                    updated_at: new Date().toISOString() 
                };
            }
            return p;
        });

        await sincronizarAtomicamenteRAM(listaActualizada);
        await avanzarAlSiguientePedido();

        if (esEntornoEstatico()) {
            await registrarOperacionPendienteDefensivo("finalizar_pedido", { id: idPedido, coords, estado: "FINALIZADO" });
        }

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Entrega registrada con éxito!', 'exito');
            window.cerrarAvisoProceso(toastId, 1500);
        }
    } catch (err) {
        console.error("❌ Error finalizando pedido:", err);
        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, 'Error al procesar la entrega', 'error');
            window.cerrarAvisoProceso(toastId, 2500);
        }
    }
}

/**
 * Elimina individualmente una parada de la sesión en caliente y persiste la snapshot reducida.
 * @param {string|number} idParada 
 */
export async function borrarParadaLocalUI(idParada) {
    console.log(`🗑️ [OPERACION]: Solicitud para borrar parada ID -> ${idParada}`);
    if (confirm(`>>> ¿Desea borrar la parada ID: ${idParada}?`)) {
        const cleanTargetId = obtenerIdLimpio(idParada);
        
        const listaFiltrada = listaPedidosGlobal.filter(p => {
            if (!p) return false;
            return obtenerIdLimpio(p) !== cleanTargetId;
        });

        // Re-secuenciar paradas restantes
        const TAMANO_CLUSTER = 4;
        const listaResecuenciada = listaFiltrada.map((p, idx) => {
            const seq = idx + 1;
            return {
                ...p,
                secuencia: seq,
                secuenciaZona: seq,
                orden: seq,
                grupoId: `GRUPO-${Math.ceil(seq / TAMANO_CLUSTER).toString().padStart(2, "0")}`,
                updated_at: new Date().toISOString()
            };
        });

        await sincronizarAtomicamenteRAM(listaResecuenciada);
        await determinarSiguientePedidoActivo();
        refrescarUI();

        if (dbStore && typeof dbStore.eliminarParada === "function") {
            await dbStore.eliminarParada(idParada, "paradas_rutas").catch(() => {});
        }

        if (esEntornoEstatico()) {
            await registrarOperacionPendienteDefensivo("eliminar_parada", { id: idParada });
        }
    }
}

/**
 * Purga totalmente la ruta local de IndexedDB, RAM y LocalStorage.
 */
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

        await sincronizarAtomicamenteRAM([]);
        indicePedidoActivo = 0;
        refrescarUI();

        try {
            if (dbStore && typeof dbStore.limpiarTabla === "function") {
                await dbStore.limpiarTabla("paradas_rutas").catch(() => {});
                await dbStore.limpiarTabla("rutas_zonificadas").catch(() => {});
            }
            localStorage.removeItem("ruta_zonificada");
            localStorage.removeItem("zona_activa_operacion");
        } catch (err) {
            console.warn("⚠️ [PURGAR_RUTA]: Advertencia al limpiar tablas IndexedDB:", err);
        }

        if (esEntornoEstatico()) {
            await registrarOperacionPendienteDefensivo("purgar_ruta", { timestamp: new Date().toISOString() });
        }

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Ruta purgada completamente!', 'advertencia');
            window.cerrarAvisoProceso(toastId, 1500);
        }
    }
}

/**
 * Inicia el recorrido visual completo navegando a la pantalla full-screen del mapa.
 */
export async function iniciarRutaCompleta() {
    console.log("🚀 [OPERACION]: Iniciando recorrido completo de la ruta...");
    const paradasStorage = await obtenerRutaZonificada();
    listaPedidosGlobal = Array.isArray(paradasStorage) && paradasStorage.length > 0 ? paradasStorage : listaPedidosGlobal;

    if (!listaPedidosGlobal || listaPedidosGlobal.length === 0) {
        alert("⚠️ [ALERTA]: No hay paradas en la ruta para iniciar.");
        return;
    }

    await sincronizarAtomicamenteRAM(listaPedidosGlobal);
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

// Bindings globales inmediatos para compatibilidad desacoplada
if (typeof window !== "undefined") {
    window.obtenerListaPedidosGlobal = obtenerListaPedidosGlobal;
    window.obtenerIndicePedidoActivo = obtenerIndicePedidoActivo;
    window.obtenerLlamadasRealizadas = obtenerLlamadasRealizadas;
    window.setLlamadasRealizadas = setLlamadasRealizadas;
    window.refrescarUI = refrescarUI;
    window.determinarSiguientePedidoActivo = determinarSiguientePedidoActivo;
    window.inicializarRutaPayload = inicializarRutaPayload;
    window.avanzarAlSiguientePedido = avanzarAlSiguientePedido;
    window.ejecutarPasoAceptarPedido = ejecutarPasoAceptarPedido;
    window.ejecutarPasoNotificarLlegada = ejecutarPasoNotificarLlegada;
    window.ejecutarPasoFinalizarPedido = ejecutarPasoFinalizarPedido;
    window.borrarParadaLocalUI = borrarParadaLocalUI;
    window.purgarTodaLaRutaUI = purgarTodaLaRutaUI;
    window.iniciarRutaCompleta = iniciarRutaCompleta;
}