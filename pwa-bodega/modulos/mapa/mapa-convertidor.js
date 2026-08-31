/**
 * PROTOCOLO MACONDO - HERRAMIENTA CONVERSORA GEOJSON -> GOOGLE MAPS API
 * Ubicación: pwa-bodega/modulos/mapa/mapa-convertidor.js
 */

/**
 * Convierte una estructura GeoJSON (FeatureCollection, Feature o Polygon)
 * al array de coordenadas { lat, lng } nativo de Google Maps JavaScript API.
 * 
 * @param {Object|String} geojsonInput Objeto GeoJSON o String en dicho formato.
 * @returns {Array<{lat: number, lng: number}>} Array de vértices formateados.
 */
export function convertirGeoJSONaGoogleMaps(geojsonInput) {
  try {
    const geojson = typeof geojsonInput === "string" ? JSON.parse(geojsonInput) : geojsonInput;
    let rawCoordinates = [];

    if (geojson.type === "FeatureCollection" && geojson.features?.length > 0) {
      rawCoordinates = geojson.features[0].geometry.coordinates[0];
    } else if (geojson.type === "Feature") {
      rawCoordinates = geojson.geometry.coordinates[0];
    } else if (geojson.type === "Polygon") {
      rawCoordinates = geojson.coordinates[0];
    } else if (Array.isArray(geojson)) {
      rawCoordinates = geojson;
    } else {
      throw new Error("Estructura GeoJSON no reconociendo Polygon o FeatureCollection válido.");
    }

    // GeoJSON usa [lng, lat]. Google Maps usa { lat, lng }
    const pathGoogleMaps = rawCoordinates.map((pair) => ({
      lat: Number(pair[1]),
      lng: Number(pair[0])
    }));

    return pathGoogleMaps;
  } catch (err) {
    console.error(">>> [CONVERTIDOR_GEOJSON_FAIL]: Error al transformar coordenadas:", err);
    return [];
  }
}