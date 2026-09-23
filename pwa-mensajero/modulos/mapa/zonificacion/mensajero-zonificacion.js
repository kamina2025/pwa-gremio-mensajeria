/**
 * PROTOCOLO MACONDO - MAPA INTEGRADO DE ZONAS SANITIZADAS (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa/mensajero-zonificacion.js
 * Fachada/Punto de entrada modularizado
 */

import { PALETA_ZONAS } from './paleta-zonas.js';
import { MAPA_ZONAS_CALI } from './geojson-cali.js';
import { obtenerZonaPorNombre, obtenerZonaPorCoordenadas, puntoEnPoligono } from './geo-utils.js';
import { clasificarParadasPorZona, validarYAgruparParadasPorZonaEstricta } from './clasificador-zonas.js';

console.log("🌐 [ZONIFICACION]: Módulo principal de zonificación cargado correctamente.");

// Re-exportación ES Modules
export {
  PALETA_ZONAS,
  MAPA_ZONAS_CALI,
  obtenerZonaPorNombre,
  obtenerZonaPorCoordenadas,
  clasificarParadasPorZona,
  validarYAgruparParadasPorZonaEstricta
};

// Bindings globales (Compatibilidad con llamadas legacy en PWA)
window.validarYAgruparParadasPorZonaEstricta = validarYAgruparParadasPorZonaEstricta;
window.clasificarParadasPorZona = clasificarParadasPorZona;
window.obtenerZonaPorCoordenadas = obtenerZonaPorCoordenadas;