/**
 * PROTOCOLO MACONDO - MÓDULO DE UTILIDADES GEOESPACIALES Y ALGORITMOS DE DISTANCIA
 * Ubicación: pwa-mensajero/modulos/mapa/zonificacion/geo-utils.js
 * Arquitectura: Local-First / ES6 Module / Bindings Globales
 */

import { MAPA_ZONAS_CALI } from './geojson-cali.js';

/**
 * Extrae y normaliza las coordenadas (lat, lng) de un objeto de parada o nodo.
 * @param {Object} p 
 * @returns {{lat: number, lng: number}|null}
 */
function extraerCoordenadasValidas(p) {
  if (!p || typeof p !== "object") return null;

  let rawLat = p.lat ?? p.latitud ?? p.latitud_num ?? p.y ?? p.lat_num;
  if ((rawLat === undefined || rawLat === null) && p.coordenadas) {
    rawLat = p.coordenadas.lat ?? p.coordenadas.latitud;
  }
  if ((rawLat === undefined || rawLat === null) && p.centroide) {
    rawLat = p.centroide.lat ?? p.centroide.latitud;
  }

  let rawLng = p.lng ?? p.longitud ?? p.longitud_num ?? p.x ?? p.lng_num;
  if ((rawLng === undefined || rawLng === null) && p.coordenadas) {
    rawLng = p.coordenadas.lng ?? p.coordenadas.longitud;
  }
  if ((rawLng === undefined || rawLng === null) && p.centroide) {
    rawLng = p.centroide.lng ?? p.centroide.longitud;
  }

  if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) {
    return null;
  }

  const lat = parseFloat(String(rawLat).trim().replace(',', '.'));
  const lng = parseFloat(String(rawLng).trim().replace(',', '.'));

  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return null;
  }

  return { lat, lng };
}

/**
 * Evalúa si un punto de coordenadas [lng, lat] se encuentra dentro de un polígono (Ray-casting algorithm).
 * @param {Array<number>} punto - Arreglo [longitud, latitud]
 * @param {Array<Array<number>>} vs - Matriz de vértices del polígono [[lng, lat], ...]
 * @returns {boolean} True si el punto está dentro del polígono
 */
export function puntoEnPoligono(punto, vs) {
  if (!punto || !vs || !Array.isArray(vs) || vs.length === 0) return false;
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
      (feat.properties.nombre && String(feat.properties.nombre).toLowerCase().trim() === target) ||
      (feat.properties.key && String(feat.properties.key).toLowerCase().trim() === target)
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
  const coords = extraerCoordenadasValidas({ lat, lng });
  if (!coords) return null;

  if (!MAPA_ZONAS_CALI || !MAPA_ZONAS_CALI.features) return null;

  const punto = [coords.lng, coords.lat];

  for (const feature of MAPA_ZONAS_CALI.features) {
    if (feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates[0]) {
      const vs = feature.geometry.coordinates[0];
      if (puntoEnPoligono(punto, vs)) {
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
  const c1 = extraerCoordenadasValidas({ lat: lat1, lng: lon1 });
  const c2 = extraerCoordenadasValidas({ lat: lat2, lng: lon2 });

  if (!c1 || !c2) return Infinity;

  const R = 6371; // Radio terrestre en km
  const dLat = (c2.lat - c1.lat) * (Math.PI / 180);
  const dLon = (c2.lng - c1.lng) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1.lat * (Math.PI / 180)) * Math.cos(c2.lat * (Math.PI / 180)) *
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
    const coords = extraerCoordenadasValidas(p);
    if (coords) {
      sumLat += coords.lat;
      sumLng += coords.lng;
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

  const coordsOrigen = extraerCoordenadasValidas(origen);
  if (!coordsOrigen) {
    return { parada: null, indice: -1, distanciaKm: Infinity };
  }

  pendientes.forEach((parada, idx) => {
    const coordsDestino = extraerCoordenadasValidas(parada);
    if (!coordsDestino) return;

    const dist = calcularDistanciaHaversine(
      coordsOrigen.lat,
      coordsOrigen.lng,
      coordsDestino.lat,
      coordsDestino.lng
    );

    if (dist < menorDistancia) {
      menorDistancia = dist;
      paradaMasCercana = parada;
      indiceEncontrado = idx;
    }
  });

  return { parada: paradaMasCercana, indice: indiceEncontrado, distanciaKm: menorDistancia };
}

// BINDINGS GLOBALES EN WINDOW EN ENTORNO DE NAVEGADOR
if (typeof window !== "undefined") {
  window.puntoEnPoligono = puntoEnPoligono;
  window.obtenerZonaPorNombre = obtenerZonaPorNombre;
  window.obtenerZonaPorCoordenadas = obtenerZonaPorCoordenadas;
  window.calcularDistanciaHaversine = calcularDistanciaHaversine;
  window.calcularCentroide = calcularCentroide;
  window.buscarParadaMasCercana = buscarParadaMasCercana;
}