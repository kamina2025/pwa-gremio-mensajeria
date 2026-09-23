/**
 * CONTROLLER FACHADA PARA ALERTAS RÁPIDAS
 * Ubicación: pwa-mensajero/modulos/ui/avisos/avisos-controller.js
 */

import { visorAnimaciones } from "./visor-animaciones.js";

/**
 * Muestra una alerta rápida de éxito
 */
export function notificarExito(titulo, mensaje, tiempoMs = 2000) {
    const id = `exito-${Date.now()}`;
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
 * Muestra una alerta rápida de error con opción a cerrar
 */
export function notificarError(titulo, mensaje) {
    const id = `err-${Date.now()}`;
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

if (typeof window !== "undefined") {
    window.notificarExito = notificarExito;
    window.notificarError = notificarError;
}