/**
 * PROTOCOLO MACONDO - GESTOR DE RUTAS, ACCIONES DE ZONA Y DATOS DE PEDIDOS
 * Ubicación: pwa-mensajero/modulos/mensajero-rutas.js
 * Arquitectura: Fachada Principal Modularizada / Local-First
 */

import { normalizarClaveZona, procesarPayloadOStorage, buscarIndiceActivo } from "./rutas/rutas-normalizador.js";
import { calcularRutaAisladaPorZona } from "./rutas/rutas-aislamiento.js";
import { optimizarRutaPorProximidadZona, invertirSecuenciaRutaZona } from "./rutas/rutas-optimizacion.js";
import { renderizarParadasZonificadasUI } from "./rutas/rutas-ui-acordeon.js";
import { registrarHandlersGlobales } from "./rutas/rutas-handlers.js";

console.log("GM 🛣️ [RUTAS_MODULAR]: Módulo de gestión de rutas desacoplado cargado exitosamente.");

// 1. Inicializar y registrar controladores globales de eventos y botones en el objeto window
registrarHandlersGlobales();

// 2. Bindings directos inmediatos para compatibilidad con scripts legados y consola
if (typeof window !== "undefined") {
    window.renderizarParadasZonificadasUI = renderizarParadasZonificadasUI;
    window.renderizarAcordeonesZonasUI = renderizarParadasZonificadasUI;
    window.renderizarTablaZonificadaUI = renderizarParadasZonificadasUI;
    window.buscarIndiceActivo = buscarIndiceActivo;
    window.procesarPayloadOStorage = procesarPayloadOStorage;
    window.calcularRutaAisladaPorZona = calcularRutaAisladaPorZona;

    // BINDINGS UNIFICADOS EN WINDOW
    window.optimizarRutaPorProximidadZona = optimizarRutaPorProximidadZona;
    window.optimizarProximidadZona = optimizarRutaPorProximidadZona;
    window.optimizarRutaPorProximidad = optimizarRutaPorProximidadZona;
    window.invertirSecuenciaRutaZona = invertirSecuenciaRutaZona;
}

// 3. Exportación unificada ES6
export {
    normalizarClaveZona,
    procesarPayloadOStorage,
    buscarIndiceActivo,
    calcularRutaAisladaPorZona,
    optimizarRutaPorProximidadZona,
    invertirSecuenciaRutaZona,
    renderizarParadasZonificadasUI
};