/**
 * PROTOCOLO MACONDO - MANEJADOR DE CARGA MANUAL Y ENLACES
 * Ubicación: modulos/importer/carga-manual-handler.js
 */

import { cargarRutaDesdeTextoOEnlace } from "../mensajero-importer.js";
import { 
    determinarSiguientePedidoActivo, 
    refrescarUI, 
    obtenerListaPedidosGlobal 
} from "../rutas/rutas-orquestador-flujo.js";

export function procesarCargaManualEnlace() {
    const inputTxt = document.getElementById("txt-payload-manual");
    if (inputTxt && inputTxt.value.trim()) {
        console.log("📝 [OPERACION]: Cargando enlace/payload manual...");
        
        const toastId = 'carga-manual';
        if (typeof window.mostrarAvisoProceso === 'function') {
            window.mostrarAvisoProceso({
                id: toastId,
                titulo: 'Procesando Enlace',
                mensaje: 'Decodificando paradas de la ruta...',
                estado: 'procesando',
                progreso: 30
            });
        }

        cargarRutaDesdeTextoOEnlace(inputTxt.value, async (nuevasParadas) => {
            if (typeof window.actualizarProgresoProceso === 'function') {
                window.actualizarProgresoProceso(toastId, 80, 'Actualizando consola y mapa...');
            }

            let lista = obtenerListaPedidosGlobal();
            lista.length = 0;
            lista.push(...nuevasParadas);

            await determinarSiguientePedidoActivo();
            refrescarUI();

            if (typeof window.actualizarProgresoProceso === 'function') {
                window.actualizarProgresoProceso(toastId, 100, '¡Ruta cargada exitosamente!', 'exito');
                window.cerrarAvisoProceso(toastId, 1500);
            }
        });
    } else {
        alert("⚠️ [ALERTA]: Por favor ingrese un texto o enlace de payload válido.");
    }
}