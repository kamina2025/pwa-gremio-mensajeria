/**
 * PROTOCOLO MACONDO - MAPA INTEGRADO DE ZONAS SANITIZADAS (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa/mensajero-zonificacion.js
 */

import { PALETA_ZONAS } from './paleta-zonas.js';
import { MAPA_ZONAS_CALI } from './geojson-cali.js';
import { 
  obtenerZonaPorNombre, 
  obtenerZonaPorCoordenadas, 
  puntoEnPoligono,
  calcularDistanciaHaversine,
  buscarParadaMasCercana
} from './geo-utils.js';
import { clasificarParadasPorZona, validarYAgruparParadasPorZonaEstricta } from './clasificador-zonas.js';

console.log("🌐 [ZONIFICACION]: Módulo principal de zonificación y geodesia cargado.");

export {
  PALETA_ZONAS,
  MAPA_ZONAS_CALI,
  obtenerZonaPorNombre,
  obtenerZonaPorCoordenadas,
  calcularDistanciaHaversine,
  buscarParadaMasCercana,
  clasificarParadasPorZona,
  validarYAgruparParadasPorZonaEstricta
};

// Bindings globales
window.calcularDistanciaHaversine = calcularDistanciaHaversine;
window.buscarParadaMasCercana = buscarParadaMasCercana;