/**
 * PROTOCOLO MACONDO - MAPA INTEGRADO DE ZONAS SANITIZADAS (PWA MENSAJERO)
 * Ubicación: modulos/mapa/zonificacion/mensajero-zonificacion.js
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

console.log("🌐 [ZONIFICACION]: Módulo principal de zonificación y geodesia cargado con éxito.");

// Bindings globales para compatibilidad local-first y scripts legacy
if (typeof window !== "undefined") {
  window.calcularDistanciaHaversine = calcularDistanciaHaversine;
  window.buscarParadaMasCercana = buscarParadaMasCercana;
  window.obtenerZonaPorCoordenadas = obtenerZonaPorCoordenadas;
  window.obtenerZonaPorNombre = obtenerZonaPorNombre;
}

// Exportación modular normalizada ES6
export {
  PALETA_ZONAS,
  MAPA_ZONAS_CALI,
  obtenerZonaPorNombre,
  obtenerZonaPorCoordenadas,
  puntoEnPoligono,
  calcularDistanciaHaversine,
  buscarParadaMasCercana,
  clasificarParadasPorZona,
  validarYAgruparParadasPorZonaEstricta
};