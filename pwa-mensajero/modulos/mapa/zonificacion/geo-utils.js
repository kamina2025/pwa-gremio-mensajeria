/**
 * PROTOCOLO MACONDO - MÓDULO DE UTILIDADES GEOESPACIALES Y ALGORITMOS DE DISTANCIA
 * Ubicación: pwa-mensajero/modulos/mapa/zonificacion/geo-utils.js
 * Arquitectura: Local-First / ES6 Module / Bindings Globales
 */

import { MAPA_ZONAS_CALI } from './geojson-cali.js';

/**
 * Evalúa si un punto de coordenadas [lng, lat] se encuentra dentro de un polígono (Ray-casting algorithm).
 * @param {Array<number>} punto - Arreglo [longitud, latitud]
 * @param {Array<Array<number>>} vs - Matriz de vértices del polígono [[lng, lat], ...]
 * @returns {boolean} True si el punto está dentro del polígono
 */
export function puntoEnPoligono(punto, vs) {
  if (!punto || !vs || !Array.isArray(vs)) return false;
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
  if (!nombreZona || !MAPA_ZONAS_CALI || !MAPA_ZONAS_CALI.features) return null;
  const target = String(nombreZona).toLowerCase().trim();
  return MAPA_ZONAS_CALI.features.find(
    (feat) => feat.properties && (
      (feat.properties.nombre && feat.properties.nombre.toLowerCase() === target) ||
      (feat.properties.key && feat.properties.key.toLowerCase() === target)
    )
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

  if (isNaN(pointLat) || isNaN(pointLng) || pointLat === 0 || pointLng === 0) return null;
  if (!MAPA_ZONAS_CALI || !MAPA_ZONAS_CALI.features) return null;

  const punto = [pointLng, pointLat];

  for (const feature of MAPA_ZONAS_CALI.features) {
    if (feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates[0]) {
      const coords = feature.geometry.coordinates[0];
      if (puntoEnPoligono(punto, coords)) {
        return feature;
      }
    }
  }
  return null;
}

/**
 * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula de Haversine.
 * @param {number|string} lat1 - Latitud origen
 * @param {number|string} lon1 - Longitud origen
 * @param {number|string} lat2 - Latitud destino
 * @param {number|string} lon2 - Longitud destino
 * @returns {number} Distancia en kilómetros
 */
export function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const l1 = parseFloat(lat1);
  const n1 = parseFloat(lon1);
  const l2 = parseFloat(lat2);
  const n2 = parseFloat(lon2);

  if (isNaN(l1) || isNaN(n1) || isNaN(l2) || isNaN(n2)) return Infinity;

  const R = 6371; // Radio terrestre en km
  const dLat = (l2 - l1) * (Math.PI / 180);
  const dLon = (n2 - n1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(l1 * (Math.PI / 180)) * Math.cos(l2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcula el centroide (latitud y longitud promedio) de un listado de paradas/nodos.
 * @param {Array<Object>} paradas - Lista de objetos de parada
 * @returns {{lat: number, lng: number}} Coordenadas del centroide calculadas
 */
export function calcularCentroide(paradas) {
  if (!paradas || !Array.isArray(paradas) || paradas.length === 0) {
    return { lat: 0, lng: 0 };
  }

  let sumLat = 0;
  let sumLng = 0;
  let validos = 0;

  paradas.forEach(p => {
    if (!p) return;
    const lat = parseFloat(p.lat || p.latitud || (p.coordenadas && p.coordenadas.lat) || (p.centroide && p.centroide.lat));
    const lng = parseFloat(p.lng || p.longitud || (p.coordenadas && p.coordenadas.lng) || (p.centroide && p.centroide.lng));

    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      sumLat += lat;
      sumLng += lng;
      validos++;
    }
  });

  if (validos === 0) return { lat: 0, lng: 0 };
  return { lat: sumLat / validos, lng: sumLng / validos };
}

/**
 * Encuentra la parada no visitada más cercana a un punto de origen dado.
 * @param {Object} origen - Objeto con latitud y longitud {lat, lng}
 * @param {Array<Object>} pendientes - Lista de paradas aún no visitadas
 * @returns {{parada: Object|null, indice: number, distanciaKm: number}}
 */
export function buscarParadaMasCercana(origen, pendientes) {
  let paradaMasCercana = null;
  let menorDistancia = Infinity;
  let indiceEncontrado = -1;

  if (!origen || !pendientes || !Array.isArray(pendientes)) {
    return { parada: null, indice: -1, distanciaKm: Infinity };
  }

  const latOrigen = parseFloat(origen.lat || origen.latitud);
  const lngOrigen = parseFloat(origen.lng || origen.longitud);

  if (isNaN(latOrigen) || isNaN(lngOrigen)) {
    return { parada: null, indice: -1, distanciaKm: Infinity };
  }

  pendientes.forEach((parada, idx) => {
    if (!parada) return;
    const latDestino = parseFloat(parada.lat || parada.latitud);
    const lngDestino = parseFloat(parada.lng || parada.longitud);

    if (isNaN(latDestino) || isNaN(lngDestino) || latDestino === 0 || lngDestino === 0) {
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

// BINDINGS GLOBALES EN WINDOW
if (typeof window !== "undefined") {
  window.puntoEnPoligono = puntoEnPoligono;
  window.obtenerZonaPorNombre = obtenerZonaPorNombre;
  window.obtenerZonaPorCoordenadas = obtenerZonaPorCoordenadas;
  window.calcularDistanciaHaversine = calcularDistanciaHaversine;
  window.calcularCentroide = calcularCentroide;
  window.buscarParadaMasCercana = buscarParadaMasCercana;
}