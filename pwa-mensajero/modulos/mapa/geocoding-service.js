/**
 * PROTOCOLO MACONDO - SERVICIO DE GEOCODIFICACIÓN GRATUITO / LOCAL
 * Ubicación: pwa-mensajero/modulos/mapa/geocoding-service.js
 * Reemplaza Google Geocoding API usando OpenStreetMap Nominatim + Cache Local ($0 USD)
 */

const GEOCODE_CACHE_KEY = "macondo_geocode_cache_v1";

function obtenerCacheGeocode() {
  try {
    return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function guardarCacheGeocode(cache) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("⚠️ [GEOCODE]: No se pudo guardar en caché local:", e);
  }
}

/**
 * Geocodifica una dirección usando OpenStreetMap Nominatim ($0 USD)
 * @param {string} direccion - Dirección textual
 * @param {string} ciudad - Ciudad base para acotar (ej. 'Cali, Colombia')
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
export async function geocodificarDireccionGratis(direccion, ciudad = "Cali, Colombia") {
  if (!direccion || typeof direccion !== "string") return null;

  const queryLimpia = `${direccion.trim()}, ${ciudad}`.toLowerCase();
  const cache = obtenerCacheGeocode();

  // 1. Verificación en Caché Local (Costo $0 USD / 0ms)
  if (cache[queryLimpia]) {
    console.log(`⚡ [GEOCODE_CACHE]: Dirección encontrada en caché local: "${direccion}"`);
    return cache[queryLimpia];
  }

  console.log(`🔍 [GEOCODE_NOMINATIM]: Buscando coordenadas en OpenStreetMap para: "${queryLimpia}"`);

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryLimpia)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "PWA-Gremio-Mensajeria/1.0"
      }
    });

    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

    const data = await response.json();

    if (data && data.length > 0) {
      const coords = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };

      // Guardar en caché local
      cache[queryLimpia] = coords;
      guardarCacheGeocode(cache);

      console.log(`✅ [GEOCODE_NOMINATIM]: Coordenadas obtenidas:`, coords);
      return coords;
    }

    console.warn(`⚠️ [GEOCODE_NOMINATIM]: Sin resultados para "${queryLimpia}"`);
    return null;

  } catch (error) {
    console.error(`❌ [GEOCODE_NOMINATIM]: Error al consultar Nominatim:`, error);
    return null;
  }
}

// Vinculación atómica inmediata al objeto global window
if (typeof window !== "undefined") {
  window.geocodificarDireccionGratis = geocodificarDireccionGratis;
  window.geocidificarDireccionGratis = geocodificarDireccionGratis; // Alias defensivo para typos
}