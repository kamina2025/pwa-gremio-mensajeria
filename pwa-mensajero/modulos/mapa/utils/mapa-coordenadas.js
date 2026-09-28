/**
 * PROTOCOLO MACONDO - UTILIDADES DE COORDENADAS
 * Ubicación: pwa-mensajero/modulos/mapa/utils/mapa-coordenadas.js
 */

/**
 * Extrae y valida coordenadas numéricas de un objeto parada soportando múltiples esquemas de datos.
 * @param {Object} parada 
 * @returns {{lat: number, lng: number}|null}
 */
export function obtenerCoordenadasValidasParada(parada) {
    if (!parada || typeof parada !== "object") return null;

    let rawLat = parada.lat ?? parada.latitud ?? parada.latitud_num ?? parada.y ?? parada.lat_num;
    if ((rawLat === undefined || rawLat === null) && parada.coordenadas) {
        rawLat = parada.coordenadas.lat ?? parada.coordenadas.latitud;
    }

    let rawLng = parada.lng ?? parada.longitud ?? parada.longitud_num ?? parada.x ?? parada.lng_num;
    if ((rawLng === undefined || rawLng === null) && parada.coordenadas) {
        rawLng = parada.coordenadas.lng ?? parada.coordenadas.longitud;
    }

    if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) {
        return null;
    }

    const latStr = String(rawLat).trim().replace(',', '.');
    const lngStr = String(rawLng).trim().replace(',', '.');

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        return null;
    }

    return { lat, lng };
}