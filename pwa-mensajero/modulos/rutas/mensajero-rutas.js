/**
 * PROTOCOLO MACONDO - GESTOR DE RUTAS, ACCIONES DE ZONA Y DATOS DE PEDIDOS
 * Ubicación: pwa-mensajero/modulos/mensajero-rutas.js
 * Fachada principal modularizada
 */

import { normalizarClaveZona, procesarPayloadOStorage, buscarIndiceActivo } from "./rutas-normalizador.js";
import { calcularRutaAisladaPorZona } from "./rutas-aislamiento.js";
import { renderizarParadasZonificadasUI } from "./rutas-ui-acordeon.js";
import { registrarHandlersGlobales } from "./rutas-handlers.js";

console.log("🛣️ [RUTAS_MODULAR]: Módulo de gestión de rutas desacoplado cargado exitosamente.");

// Registrar funciones en el ámbito Window
registrarHandlersGlobales();

window.renderizarParadasZonificadasUI = renderizarParadasZonificadasUI;
window.renderizarAcordeonesZonasUI = renderizarParadasZonificadasUI;
window.renderizarTablaZonificadaUI = renderizarParadasZonificadasUI;
window.buscarIndiceActivo = buscarIndiceActivo;
window.procesarPayloadOStorage = procesarPayloadOStorage;
window.calcularRutaAisladaPorZona = calcularRutaAisladaPorZona;

// Exportación unificada ES6
export {
    normalizarClaveZona,
    procesarPayloadOStorage,
    buscarIndiceActivo,
    calcularRutaAisladaPorZona,
    renderizarParadasZonificadasUI
};