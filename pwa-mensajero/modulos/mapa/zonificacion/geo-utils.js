/**
 * Módulo de Utilidades Geoespaciales y Algoritmos de Distancia
 * Ubicación: pwa-mensajero/modulos/mapa/zonificacion/geo-utils.js
 */

import { MAPA_ZONAS_CALI } from './geojson-cali.js';

/**
 * Evalúa si un punto de coordenadas [lng, lat] se encuentra dentro de un polígono (Ray-casting algorithm).
 * @param {Array<number>} punto - Arreglo [longitud, latitud]
 * @param {Array<Array<number>>} vs - Matriz de vértices del polígono [[lng, lat], ...]
 * @returns {boolean} True si el punto está dentro del polígono
 */
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

/**
 * Busca una zona dentro del FeatureCollection GeoJSON por su nombre o clave.
 * @param {string} nombreZona - Nombre o key de la zona
 * @returns {Object|null} Feature GeoJSON de la zona encontrada o null
 */
export function obtenerZonaPorNombre(nombreZona) {
  if (!nombreZona) return null;
  return MAPA_ZONAS_CALI.features.find(
    (feat) => feat.properties.nombre.toLowerCase() === nombreZona.toLowerCase() ||
              feat.properties.key.toLowerCase() === nombreZona.toLowerCase()
  ) || null;
}

/**
 * Determina a qué polígono de zona pertenece un par de coordenadas (lat, lng).
 * @param {number|string} lat - Latitud
 * @param {number|string} lng - Longitud
 * @returns {Object|null} Feature GeoJSON de la zona coincidente o null
 */
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

/**
 * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula de Haversine.
 * @param {number} lat1 - Latitud origen
 * @param {number} lon1 - Longitud origen
 * @param {number} lat2 - Latitud destino
 * @param {number} lon2 - Longitud destino
 * @returns {number} Distancia en kilómetros
 */
export function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio terrestre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Encuentra la parada no visitada más cercana a un punto de origen dado.
 * @param {Object} origen - Objeto con latitud y longitud {lat, lng}
 * @param {Array<Object>} pendientes - Lista de paradas aún no visitadas
 * @returns {Object} Objeto con la parada seleccionada, su índice en pendientes y la distancia en km
 */
export function buscarParadaMasCercana(origen, pendientes) {
  let paradaMasCercana = null;
  let menorDistancia = Infinity;
  let indiceEncontrado = -1;

  pendientes.forEach((parada, idx) => {
    const latOrigen = parseFloat(origen.lat);
    const lngOrigen = parseFloat(origen.lng);
    const latDestino = parseFloat(parada.lat);
    const lngDestino = parseFloat(parada.lng);

    if (isNaN(latOrigen) || isNaN(lngOrigen) || isNaN(latDestino) || isNaN(lngDestino)) {
      return;
    }

    const dist = calcularDistanciaHaversine(latOrigen, lngOrigen, latDestino, lngDestino);

    if (dist < menorDistancia) {
      menorDistancia = dist;
      paradaMasCercana = parada;
      indiceEncontrado = idx;
    }
  });

  return { parada: paradaMasCercana, indice: indiceEncontrado, distanciaKm: menorDistancia };
}