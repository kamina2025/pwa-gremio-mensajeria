/**
 * CONTROLLER FACHADA PARA ALERTAS RÁPIDAS Y NOTIFICACIONES
 * Ubicación: pwa-mensajero/modulos/ui/avisos/avisos-controller.js
 */

import { visorAnimaciones } from "./visor-animaciones.js";

/**
 * Muestra una alerta rápida de éxito.
 * @param {string} titulo - Título principal del aviso
 * @param {string} mensaje - Mensaje descriptivo
 * @param {number} [tiempoMs=2500] - Tiempo antes de auto-cerrar en milisegundos
 */
export function notificarExito(titulo, mensaje, tiempoMs = 2500) {
    const id = `exito-${Date.now()}`;
    console.log(`🟢 [AvisosController] Notificando Éxito: "${titulo}"`);
    visorAnimaciones.mostrarAvisoProceso({
        id,
        titulo,
        mensaje,
        estado: 'exito',
        progreso: 100
    });
    visorAnimaciones.cerrarAvisoProceso(id, tiempoMs);
}

/**
 * Muestra una alerta de advertencia.
 * @param {string} titulo - Título principal
 * @param {string} mensaje - Mensaje descriptivo
 * @param {number} [tiempoMs=4000] - Tiempo de exhibición
 */
export function notificarAdvertencia(titulo, mensaje, tiempoMs = 4000) {
    const id = `warn-${Date.now()}`;
    console.log(`🟡 [AvisosController] Notificando Advertencia: "${titulo}"`);
    visorAnimaciones.mostrarAvisoProceso({
        id,
        titulo,
        mensaje,
        estado: 'advertencia',
        progreso: 100,
        acciones: [
            {
                texto: 'Entendido',
                clase: 'cyber-btn-touch',
                accion: (toastId) => visorAnimaciones.cerrarAvisoProceso(toastId)
            }
        ]
    });
    if (tiempoMs > 0) {
        visorAnimaciones.cerrarAvisoProceso(id, tiempoMs);
    }
}

/**
 * Muestra una alerta de error con botón explícito de cierre.
 * @param {string} titulo - Título principal de la falla
 * @param {string} mensaje - Explicación del error o causa raíz
 */
export function notificarError(titulo, mensaje) {
    const id = `err-${Date.now()}`;
    console.warn(`🔴 [AvisosController] Notificando Error: "${titulo}" - ${mensaje}`);
    visorAnimaciones.mostrarAvisoProceso({
        id,
        titulo,
        mensaje,
        estado: 'error',
        progreso: 100,
        acciones: [
            {
                texto: 'Cerrar',
                clase: 'danger',
                accion: (toastId) => visorAnimaciones.cerrarAvisoProceso(toastId)
            }
        ]
    });
}

// Bindings globales inmediatos
if (typeof window !== "undefined") {
    window.notificarExito = notificarExito;
    window.notificarAdvertencia = notificarAdvertencia;
    window.notificarError = notificarError;
}