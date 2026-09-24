/**
 * PROTOCOLO MACONDO - SUBSISTEMA RENDERIZADOR DE INTERFAZ OPERACIONAL (TIRILLAS & ZONAS)
 * Ubicación: pwa-mensajero/modulos/mensajero-ui.js
 * Fachada principal modularizada y desacoplada para la consola operacional
 */

import { renderizarParadasZonificadasUI } from "./rutas/rutas-ui-acordeon.js";

let actualizarPuntosEnMapaFn = null;
let enfocarZonaEnMapaFn = null;
let PALETA_ZONAS_REF = { GENERAL: { color: "#00e5ff", label: "GENERAL" } };
let dbStore = null;
let renderizarTarjetaActivaUIFn = null;
let vincularDragDropUIFn = null;
let ejecutarZonificacionAutomaticaUIFn = null;
let moverParadaSecuenciaUIFn = null;

let paradasMemoriaLocal = [];

/**
 * Carga dinámica de módulos para compatibilidad con scripts tradicionales y módulos ES6.
 */
async function cargarModulosDependientes() {
    console.log("🔄 [MENSAJERO_UI]: Iniciando carga asíncrona de dependencias modulares...");
    try {
        const mapaVisor = await import("./mapa/mapa-visor.js").catch((err) => {
            console.warn("⚠️ [MENSAJERO_UI]: Fallo al importar 'mapa-visor.js', se usará fallback window:", err);
            return {};
        });
        actualizarPuntosEnMapaFn = mapaVisor.actualizarPuntosEnMapa || window.actualizarPuntosEnMapa;
        enfocarZonaEnMapaFn = mapaVisor.enfocarZonaEnMapa || window.enfocarZonaEnMapa;

        const zonif = await import("./mapa/zonificacion/mensajero-zonificacion.js").catch((err) => {
            console.warn("⚠️ [MENSAJERO_UI]: Fallo al importar 'mensajero-zonificacion.js':", err);
            return {};
        });
        PALETA_ZONAS_REF = zonif.PALETA_ZONAS || window.PALETA_ZONAS || PALETA_ZONAS_REF;

        const storeMod = await import("./db/indexed-store.js").catch((err) => {
            console.warn("⚠️ [MENSAJERO_UI]: Fallo al importar 'indexed-store.js':", err);
            return {};
        });
        if (storeMod.IndexedStore) {
            dbStore = new storeMod.IndexedStore();
            console.log("💾 [MENSAJERO_UI]: Instancia de IndexedStore lista.");
        }

        const uiTarjeta = await import("./ui/ui-tarjeta-activa.js").catch((err) => {
            console.warn("⚠️ [MENSAJERO_UI]: Fallo al importar 'ui-tarjeta-activa.js':", err);
            return {};
        });
        renderizarTarjetaActivaUIFn = uiTarjeta.renderizarTarjetaActivaUI || window.renderizarTarjetaActivaUI;

        const dndMod = await import("./ui/ui-dnd-persistencia.js").catch((err) => {
            console.warn("⚠️ [MENSAJERO_UI]: Fallo al importar 'ui-dnd-persistencia.js':", err);
            return {};
        });
        vincularDragDropUIFn = dndMod.vincularDragDropUI || window.vincularDragDropUI;

        const zonifMaint = await import("./ui/ui-zonificacion-mantenimiento.js").catch((err) => {
            console.warn("⚠️ [MENSAJERO_UI]: Fallo al importar 'ui-zonificacion-mantenimiento.js':", err);
            return {};
        });
        ejecutarZonificacionAutomaticaUIFn = zonifMaint.ejecutarZonificacionAutomaticaUI || window.ejecutarZonificacionAutomaticaUI;
        moverParadaSecuenciaUIFn = zonifMaint.moverParadaSecuenciaUI || window.moverParadaSecuenciaUI;

        console.log("✅ [MENSAJERO_UI]: Módulos dependientes cargados e integrados correctamente.");
    } catch (e) {
        console.warn("⚠️ [MENSAJERO_UI]: Carga diferida de módulos requerida:", e);
    }
}

// Inicializar carga de dependencias
cargarModulosDependientes();

/**
 * Emitir vibración háptica rápida en Android
 * @param {number|Array<number>} pattern 
 */
function emitirHaptico(pattern = 30) {
    if ('vibrate' in navigator) {
        try { 
            navigator.vibrate(pattern);
            console.log(`📳 [HAPTIC]: Vibración háptica emitida (${JSON.stringify(pattern)}ms)`);
        } catch (e) {
            console.warn("⚠️ [HAPTIC]: Vibración no soportada o denegada por navegador:", e);
        }
    }
}

/**
 * Renderiza la consola de operaciones delegando acordeones a rutas-ui-acordeon.js.
 * @param {Array<Object>} listaPedidos 
 * @param {number} [indiceActivo=0] 
 * @param {number} [llamadasRealizadas=0] 
 */
export async function renderizarConsolaOperaciones(listaPedidos, indiceActivo = 0, llamadasRealizadas = 0) {
    console.group("🖥️ [MENSAJERO_UI]: Renderizando Consola de Operaciones");
    
    paradasMemoriaLocal = Array.isArray(listaPedidos) ? [...listaPedidos] : [];
    console.log(`📊 Paradas totales recibidas: ${paradasMemoriaLocal.length} | Ítem Activo: Índice ${indiceActivo}`);

    const contenedorActivo = document.getElementById("contenedor-tarjeta-activa");
    const txtTotal = document.getElementById("txt-total-paradas");

    if (txtTotal) txtTotal.innerText = `${paradasMemoriaLocal.length} PARADAS`;

    console.log("🗺️ [MENSAJERO_UI]: Notificando al visor de mapa para actualizar waypoints...");
    if (typeof actualizarPuntosEnMapaFn === "function") {
        actualizarPuntosEnMapaFn(paradasMemoriaLocal, indiceActivo);
    } else if (typeof window.actualizarPuntosEnMapa === "function") {
        window.actualizarPuntosEnMapa(paradasMemoriaLocal, indiceActivo);
    }

    if (paradasMemoriaLocal.length === 0) {
        console.warn("⚠️ [MENSAJERO_UI]: La lista de pedidos está vacía. Mostrando estado [SIN_RUTA].");
        if (contenedorActivo && typeof renderizarTarjetaActivaUIFn === "function") {
            renderizarTarjetaActivaUIFn(contenedorActivo, null, 0, 0);
        }
        if (typeof renderizarParadasZonificadasUI === "function") {
            await renderizarParadasZonificadasUI([]);
        }
        console.groupEnd();
        return;
    }

    const pedido = paradasMemoriaLocal[indiceActivo] || paradasMemoriaLocal[0];

    // 1. TARJETA ACTIVA EN FOCO (si el contenedor existe en la vista actual)
    const renderFn = renderizarTarjetaActivaUIFn || window.renderizarTarjetaActivaUI;
    if (contenedorActivo && typeof renderFn === "function") {
        console.log(`🎯 [MENSAJERO_UI]: Renderizando Tarjeta Activa -> ID: ${pedido.id || pedido.ssc || 'N/A'}`);
        renderFn(contenedorActivo, pedido, indiceActivo, llamadasRealizadas);
    } else if (!contenedorActivo) {
        console.log("ℹ️ [MENSAJERO_UI]: Vista Activa sin `#contenedor-tarjeta-activa`. Omitiendo renderizado de tarjeta estática.");
    }

    // 2. DELEGACIÓN DE ACORDEONES ZONIFICADOS (Evita doble renderizado y colisión de bordes)
    console.log("📋 [MENSAJERO_UI]: Delegando construcción de acordeones a 'rutas-ui-acordeon.js'...");
    if (typeof renderizarParadasZonificadasUI === "function") {
        await renderizarParadasZonificadasUI(paradasMemoriaLocal);
    } else if (typeof window.renderizarParadasZonificadasUI === "function") {
        await window.renderizarParadasZonificadasUI(paradasMemoriaLocal);
    }

    console.log("✅ [MENSAJERO_UI]: Consola de operaciones renderizada exitosamente.");
    console.groupEnd();
}

// --- BUS DE EVENTOS DE SINCRONIZACIÓN LOCAL-FIRST ---
window.addEventListener('sincronizacion:inicio', (e) => {
    const { taskId, totalItems } = e.detail || { taskId: 'sync-queue', totalItems: 1 };
    console.log(`🔄 [MENSAJERO_UI_EVENT]: Evento 'sincronizacion:inicio' capturado -> TaskID: ${taskId} | Total: ${totalItems}`);
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: taskId,
            titulo: 'Sincronizando Offline',
            mensaje: `Sincronizando 0 de ${totalItems} registros pendientes...`,
            estado: 'procesando',
            progreso: 0,
            acciones: [
                {
                    texto: 'Cancelar',
                    clase: 'danger',
                    accion: (id) => {
                        console.log(`🚫 [MENSAJERO_UI]: Sincronización cancelada por el usuario -> ${id}`);
                        if (typeof window.cerrarAvisoProceso === 'function') window.cerrarAvisoProceso(id);
                    }
                }
            ]
        });
    }
});

window.addEventListener('sincronizacion:progreso', (e) => {
    const { taskId, completados, totalItems } = e.detail || {};
    const porcentaje = totalItems > 0 ? (completados / totalItems) * 100 : 0;
    console.log(`📊 [MENSAJERO_UI_EVENT]: Evento 'sincronizacion:progreso' -> TaskID: ${taskId} | ${completados}/${totalItems} (${porcentaje.toFixed(1)}%)`);
    if (typeof window.actualizarProgresoProceso === 'function') {
        window.actualizarProgresoProceso(taskId, porcentaje, `Sincronizando ${completados} de ${totalItems} registros...`);
    }
});

window.addEventListener('sincronizacion:completado', (e) => {
    const { taskId } = e.detail || {};
    console.log(`✅ [MENSAJERO_UI_EVENT]: Evento 'sincronizacion:completado' -> TaskID: ${taskId}`);
    if (typeof window.actualizarProgresoProceso === 'function') {
        window.actualizarProgresoProceso(taskId, 100, '¡Sincronización completada con éxito!', 'exito');
    }
    if (typeof window.cerrarAvisoProceso === 'function') {
        window.cerrarAvisoProceso(taskId, 2000);
    }
});

window.addEventListener('sincronizacion:error', (e) => {
    const { taskId, errorMsg } = e.detail || {};
    console.error(`❌ [MENSAJERO_UI_EVENT]: Evento 'sincronizacion:error' -> TaskID: ${taskId} | Error: ${errorMsg}`);
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: taskId,
            titulo: 'Error de Sincronización',
            mensaje: errorMsg || 'Error al conectar con la API REST.',
            estado: 'error',
            progreso: 100,
            acciones: [
                {
                    texto: 'Cerrar',
                    clase: 'danger',
                    accion: (id) => {
                        console.log(`✖️ [MENSAJERO_UI]: Cerrando aviso de error -> ${id}`);
                        if (typeof window.cerrarAvisoProceso === 'function') window.cerrarAvisoProceso(id);
                    }
                }
            ]
        });
    }
});

// Bindings globales en Window con monitoreo completo
window.renderizarConsolaOperaciones = renderizarConsolaOperaciones;
window.refrescarConsolaOperaciones = function() { 
    console.log("🔄 [MENSAJERO_UI]: Refrescando consola con datos en memoria local...");
    renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0); 
};

window.ejecutarZonificacionAutomatica = async function() {
    console.log("⚡ [MENSAJERO_UI]: Solicitando zonificación automática...");
    emitirHaptico(30);
    const zonifFn = ejecutarZonificacionAutomaticaUIFn || window.ejecutarZonificacionAutomaticaUI;
    if (typeof zonifFn === "function") {
        paradasMemoriaLocal = await zonifFn(paradasMemoriaLocal, (p) => renderizarConsolaOperaciones(p, 0, 0));
        console.log("✅ [MENSAJERO_UI]: Zonificación automática completada.");
    } else {
        console.warn("⚠️ [MENSAJERO_UI]: Función 'ejecutarZonificacionAutomatica' no disponible.");
    }
};

window.moverParadaSecuencia = async function(idParada, delta) {
    console.log(`↕️ [MENSAJERO_UI]: Moviendo secuencia de parada ID '${idParada}' (delta: ${delta})...`);
    emitirHaptico(20);
    const moverFn = moverParadaSecuenciaUIFn || window.moverParadaSecuenciaUI;
    if (typeof moverFn === "function") {
        await moverFn(paradasMemoriaLocal, idParada, delta, (p) => renderizarConsolaOperaciones(p, 0, 0));
    } else {
        console.warn("⚠️ [MENSAJERO_UI]: Función 'moverParadaSecuencia' no disponible.");
    }
};

window.activarEdicionParadaUI = function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    console.log(`✏️ [MENSAJERO_UI]: Activando modo edición en interfaz para índice -> ${idx}`);
    emitirHaptico(20);
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'none';
    if (edicion) edicion.style.display = 'flex';
};

window.cancelarEdicionParadaUI = function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    console.log(`↩️ [MENSAJERO_UI]: Cancelando edición para índice -> ${idx}`);
    emitirHaptico(20);
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'flex';
    if (edicion) edicion.style.display = 'none';
};

window.guardarEdicionParadaUI = async function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    console.log(`💾 [MENSAJERO_UI]: Guardando edición realizada en índice -> ${idx}`);
    emitirHaptico(40);
    if (paradasMemoriaLocal[idx]) {
        paradasMemoriaLocal[idx].destinatario = document.getElementById(`input-edit-destinatario-${idx}`)?.value || paradasMemoriaLocal[idx].destinatario;
        paradasMemoriaLocal[idx].cliente = paradasMemoriaLocal[idx].destinatario;
        paradasMemoriaLocal[idx].telefono = document.getElementById(`input-edit-telefono-${idx}`)?.value || paradasMemoriaLocal[idx].telefono;
        paradasMemoriaLocal[idx].tel = paradasMemoriaLocal[idx].telefono;
        paradasMemoriaLocal[idx].direccion = document.getElementById(`input-edit-direccion-${idx}`)?.value || paradasMemoriaLocal[idx].direccion;
        paradasMemoriaLocal[idx].dir = paradasMemoriaLocal[idx].direccion;
        paradasMemoriaLocal[idx].ssc = document.getElementById(`input-edit-ssc-${idx}`)?.value || paradasMemoriaLocal[idx].ssc;
        paradasMemoriaLocal[idx].cuotaModeradora = document.getElementById(`input-edit-cuota-${idx}`)?.value || paradasMemoriaLocal[idx].cuotaModeradora;

        console.log(`📝 [MENSAJERO_UI]: Datos actualizados -> ${paradasMemoriaLocal[idx].destinatario} | ${paradasMemoriaLocal[idx].direccion}`);

        if (dbStore && typeof dbStore.actualizarParada === "function") {
            console.log("💾 [MENSAJERO_UI]: Persistiendo cambios en IndexedDB...");
            await dbStore.actualizarParada(paradasMemoriaLocal[idx]);
        }
        localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
        console.log("✅ [MENSAJERO_UI]: Cambios guardados en LocalStorage y renderizado actualizado.");
        renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
    } else {
        console.error(`❌ [MENSAJERO_UI]: No se encontró la parada en memoria para el índice -> ${idx}`);
    }
};

window.eliminarParadaUI = async function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    console.log(`🗑️ [MENSAJERO_UI]: Solicitud para eliminar parada en índice -> ${idx}`);
    emitirHaptico([50, 30, 50]);
    if (!confirm("¿Desea eliminar esta parada de la ruta?")) {
        console.log("❌ [MENSAJERO_UI]: Eliminación cancelada por el usuario.");
        return;
    }

    const paradaEliminada = paradasMemoriaLocal.splice(idx, 1);
    console.log("🗑️ [MENSAJERO_UI]: Parada removida de memoria local:", paradaEliminada[0]);

    if (paradaEliminada[0]?.id && dbStore && typeof dbStore.eliminarParada === "function") {
        console.log(`💾 [MENSAJERO_UI]: Purgando registro ID '${paradaEliminada[0].id}' de IndexedDB...`);
        await dbStore.eliminarParada(paradaEliminada[0].id);
    }

    console.log("🔢 [MENSAJERO_UI]: Re-secuenciando paradas restantes...");
    for (let i = 0; i < paradasMemoriaLocal.length; i++) {
        paradasMemoriaLocal[i].secuencia = i + 1;
        paradasMemoriaLocal[i].secuenciaZona = i + 1;
        if (dbStore && typeof dbStore.actualizarParada === "function") {
            await dbStore.actualizarParada(paradasMemoriaLocal[i]);
        }
    }

    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
    console.log("✅ [MENSAJERO_UI]: Parada eliminada y consola refrescada.");
    renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
};