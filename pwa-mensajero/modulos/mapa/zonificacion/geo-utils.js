/**
 * Funciones Matemáticas y de Intersección Geoespacial
 * Ubicación: pwa-mensajero/modulos/mapa/zonificacion/geo-utils.js
 */

import { MAPA_ZONAS_CALI } from './geojson-cali.js';

export function puntoEnPoligono(punto, vs) {
  const x = punto[0], y = punto[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function obtenerZonaPorNombre(nombreZona) {
  if (!nombreZona) return null;
  console.log(`🔍 [GEO_UTILS]: Buscando zona por nombre: "${nombreZona}"`);
  return MAPA_ZONAS_CALI.features.find(
    (feat) => feat.properties.nombre.toLowerCase() === nombreZona.toLowerCase() ||
              feat.properties.key.toLowerCase() === nombreZona.toLowerCase()
  ) || null;
}

export function obtenerZonaPorCoordenadas(lat, lng) {
  const pointLat = parseFloat(lat);
  const pointLng = parseFloat(lng);

  if (isNaN(pointLat) || isNaN(pointLng)) return null;

  const punto = [pointLng, pointLat];

  for (const feature of MAPA_ZONAS_CALI.features) {
    const coords = feature.geometry.coordinates[0];
    if (puntoEnPoligono(punto, coords)) {
      return feature;
    }
  }
  return null;
}