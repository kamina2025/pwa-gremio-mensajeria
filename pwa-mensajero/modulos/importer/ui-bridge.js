/**
 * PROTOCOLO MACONDO - ESPECIALIDAD: UI BRIDGE & NOTIFICACIONES
 * Ubicación: pwa-mensajero/modulos/importer/ui-bridge.js
 * Función: Desacopla la lógica de refresco de interfaz, eventos y mensajes visuales del importador.
 */

/**
 * Dispara el refresco dinámico en cascada de la UI actualizando la consola de operaciones y el mapa.
 * 
 * @param {Array<Object>} listaParadasActualizada - Arreglo de paradas guardadas/unificadas.
 * @param {Function} [callbackRefresco] - Callback opcional pasado desde el orquestador.
 */
export function dispararRefrescoUI(listaParadasActualizada, callbackRefresco) {
    console.log(`>>> [UI_BRIDGE]: Disparando refresco visual con ${listaParadasActualizada?.length || 0} parada(s)...`);

    if (typeof callbackRefresco === "function") {
        callbackRefresco(listaParadasActualizada);
        return;
    }

    // 1. Prioridad: Renderizado directo pasando el array de paradas
    if (typeof window.renderizarConsolaOperaciones === "function") {
        window.renderizarConsolaOperaciones(listaParadasActualizada, 0, 0);
    } else if (typeof window.refrescarConsolaOperaciones === "function") {
        window.refrescarConsolaOperaciones(listaParadasActualizada);
    } else if (typeof window.refrescarUI === "function") {
        window.refrescarUI();
    }

    // 2. Notificar al mapa si el visor global está instanciado
    if (window.actualizarPuntosEnMapa && Array.isArray(listaParadasActualizada)) {
        console.log("🗺️ [UI_BRIDGE]: Notificando al visor del mapa para actualizar marcadores...");
        window.actualizarPuntosEnMapa(listaParadasActualizada);
    }
}

/**
 * Actualiza la etiqueta de estado de ingestión de la interfaz en la pestaña Crear Ruta.
 * 
 * @param {string} mensaje - Texto explicativo.
 * @param {string} colorHex - Color CSS para la etiqueta.
 */
export function actualizarEstadoIngestionUI(mensaje, colorHex = "var(--neon-green, #00ff66)") {
    const lblEstado = document.getElementById("txt-estado-ingestion");
    if (lblEstado) {
        lblEstado.innerText = mensaje;
        lblEstado.style.color = colorHex;
    }
}

/**
 * Muestra alertas o diálogos al mensajero.
 * 
 * @param {string} titulo 
 * @param {string} detalle 
 * @param {boolean} esError 
 */
export function notificarResultadoImportacion(titulo, detalle, esError = false) {
    const mensajeLimpio = `>>> ${titulo}:\n\n${detalle}`;
    console.log(esError ? `❌ [UI_BRIDGE_ALERT]: ${mensajeLimpio}` : `✅ [UI_BRIDGE_ALERT]: ${mensajeLimpio}`);
    alert(mensajeLimpio);
}