/**
 * Servicios de Clasificación y Agrupación por Zonas
 * Ubicación: pwa-mensajero/modulos/mapa/zonificacion/clasificador-zonas.js
 */

import { PALETA_ZONAS } from './paleta-zonas.js';
import { obtenerZonaPorCoordenadas } from './geo-utils.js';

/**
 * Clasifica un listado de paradas asignándoles propiedades de zonificación
 * basadas en polígonos GeoJSON de Cali o cuadrantes de fallback.
 * 
 * @param {Array<Object>} listaParadas - Lista de paradas a procesar
 * @returns {Array<Object>} Lista de paradas con atributos de zona enriquecidos
 */
export function clasificarParadasPorZona(listaParadas) {
  if (!Array.isArray(listaParadas) || listaParadas.length === 0) return [];

  console.group("🎨 [ZONIFICAR]: Evaluando paradas por polígonos GeoJSON de Cali...");

  const paradasClasificadas = listaParadas.map((parada, idx) => {
    let zonaDetectada = null;

    if (parada.lat && parada.lng) {
      zonaDetectada = obtenerZonaPorCoordenadas(parada.lat, parada.lng);
    }

    let zonaKey = "GENERAL";
    let nombreZona = "zona_general";

    if (zonaDetectada) {
      zonaKey = zonaDetectada.properties.key;
      nombreZona = zonaDetectada.properties.nombre;
    } else {
      const pLat = parseFloat(parada.lat);
      const pLng = parseFloat(parada.lng);

      if (!isNaN(pLat) && !isNaN(pLng)) {
        if (pLat >= 3.4500 && pLng >= -76.5320) zonaKey = "NORTE-1";
        else if (pLat < 3.4200 && pLng >= -76.5320) zonaKey = "SUR-1";
        else if (pLat >= 3.4200 && pLat < 3.4500 && pLng >= -76.5320) zonaKey = "CENTRO";
        else if (pLng < -76.5320) zonaKey = "OESTE";
        else zonaKey = "ORIENTE";
      } else {
        zonaKey = "NORTE-1";
      }
      nombreZona = `zona_${zonaKey.toLowerCase().replace(/-/g, '_')}`;
    }

    const infoPalette = PALETA_ZONAS[zonaKey] || PALETA_ZONAS["GENERAL"];

    console.log(`📍 Parada #${idx + 1} (${parada.destinatario || 'Cliente'}) -> ${zonaKey} [${infoPalette.color}]`);

    return {
      ...parada,
      zonaKey: zonaKey,
      zona: zonaKey,
      nombreZona: nombreZona,
      zonaNombre: infoPalette.label,
      colorZona: infoPalette.color
    };
  });

  console.groupEnd();
  return paradasClasificadas;
}

/**
 * Valida y agrupa paradas estrictamente en contenedores aislados organizados por clave de zona.
 * 
 * @param {Array<Object>} paradas - Lista de paradas a agrupar
 * @returns {Object} Mapa de grupos con las zonas como propiedades y arrays de paradas como valores
 */
export function validarYAgruparParadasPorZonaEstricta(paradas) {
  if (!Array.isArray(paradas) || paradas.length === 0) return {};

  console.group("📌 [ZONIFICACION_ESTRICTA]: Clasificando paradas en contenedores aislados...");

  const mapaGrupos = {};

  paradas.forEach((parada, idx) => {
    let featureZona = null;

    if (parada.lat && parada.lng) {
      featureZona = obtenerZonaPorCoordenadas(parada.lat, parada.lng);
    }

    const zonaKey = featureZona ? featureZona.properties.key : (parada.zonaKey || "GENERAL");
    const infoMeta = PALETA_ZONAS[zonaKey] || PALETA_ZONAS["GENERAL"];
    const nombreZona = featureZona ? featureZona.properties.nombre : `zona_${zonaKey.toLowerCase().replace(/-/g, '_')}`;

    const paradaAjustada = {
      ...parada,
      zonaKey: zonaKey,
      zona: zonaKey,
      nombreZona: nombreZona,
      zonaNombre: infoMeta.label,
      colorZona: infoMeta.color
    };

    if (!mapaGrupos[zonaKey]) {
      mapaGrupos[zonaKey] = [];
    }

    mapaGrupos[zonaKey].push(paradaAjustada);
    console.log(`📍 Parada #${idx + 1} (${parada.destinatario || 'Cliente'}) -> Grupo Aislado: [${zonaKey}]`);
  });

  console.groupEnd();
  return mapaGrupos;
}