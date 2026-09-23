/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE CAPAS Y ZONIFICACIÓN DE MAPA (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-mensajero-zonas.js
 */

import { MAPA_ZONAS_CALI, obtenerZonaPorNombre } from "./zonificacion/mensajero-zonificacion.js";

const PALETA_ZONAS = {
  "CENTRO":   { fill: "#ff007f", stroke: "#ff66b2" }, // Rosa Neón
  "NORTE-1":  { fill: "#00f0ff", stroke: "#80f8ff" }, // Cyan Electrón
  "NORTE-2":  { fill: "#39ff14", stroke: "#85ff70" }, // Verde Neón
  "OESTE":    { fill: "#ff9900", stroke: "#ffcc80" }, // Naranja Ámbar
  "ORIENTE":  { fill: "#ffe600", stroke: "#ffff80" }, // Amarillo Neón
  "SUR-1":    { fill: "#b359ff", stroke: "#d9b3ff" }, // Púrpura Neón
  "SUR-2":    { fill: "#0077ff", stroke: "#66abff" }, // Azul Cobalto
  "SUR-3":    { fill: "#ff0033", stroke: "#ff6680" }, // Rojo Carmesí
  "SUR-4":    { fill: "#00ffaa", stroke: "#80ffcd" }  // Verde Esmeralda
};

// Flag de estado local para prevenir re-inyectar GeoJSON repetidamente en la misma instancia de mapa
let geojsonCargadoEnMapa = false;

/**
 * Normaliza claves o nombres de zonas para comparaciones robustas.
 * Remueve prefijos como 'ZONA ', espacios y caracteres especiales.
 * 
 * @param {string} str 
 * @returns {string}
 */
function limpiarClaveZona(str) {
  if (!str) return "";
  return str
    .toString()
    .toUpperCase()
    .replace(/^ZONA\s+/, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

/**
 * Genera un color HSL dinámico determinista para zonas sin paleta explícita.
 * 
 * @param {string} texto 
 * @returns {{fill: string, stroke: string}}
 */
function obtenerColorFallback(texto) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return { fill: `hsl(${hue}, 80%, 50%)`, stroke: `hsl(${hue}, 90%, 75%)` };
}

/**
 * Despliega o actualiza los estilos de las capas de zonas en el mapa sin re-cargar GeoJSON si ya existe.
 * 
 * @param {google.maps.Map} instanciaMapa 
 * @param {string|null} zonaTargetKey - Clave de la zona a resaltar
 */
export function desplegarZonaMensajeroEnMapa(instanciaMapa, zonaTargetKey = null) {
  if (!instanciaMapa || typeof google === "undefined" || !google.maps) {
    console.warn(">>> [ZONAS_WARN]: Instancia de Google Maps no está lista.");
    return;
  }

  try {
    const targetClean = limpiarClaveZona(zonaTargetKey);

    // Inyectar GeoJSON únicamente si aún no ha sido cargado previamente en esta sesión del mapa
    if (!geojsonCargadoEnMapa) {
      // Limpiar entidades previas si existieran por seguridad
      instanciaMapa.data.forEach((feature) => {
        instanciaMapa.data.remove(feature);
      });

      instanciaMapa.data.addGeoJson(MAPA_ZONAS_CALI);
      geojsonCargadoEnMapa = true;
      console.log(">>> [ZONAS_OK]: Capas vectoriales de GeoJSON cargadas exitosamente.");
    } else {
      console.log(`>>> [ZONAS_REUSE]: Capas vectoriales ya cargadas. Aplicando actualización de estilos para target: '${targetClean || 'TODAS'}'`);
    }

    // Aplicar/Actualizar únicamente las reglas de estilo visual
    instanciaMapa.data.setStyle((feature) => {
      const keyZona = feature.getProperty("key") || "";
      const nombreZona = feature.getProperty("nombre") || "";
      
      const keyLimpia = limpiarClaveZona(keyZona);
      const nombreLimpio = limpiarClaveZona(nombreZona);

      const colores = PALETA_ZONAS[keyZona] || PALETA_ZONAS[keyLimpia] || obtenerColorFallback(nombreZona);

      // Determinar si esta entidad corresponde a la zona objetivo resaltada
      const esTarget = Boolean(
        targetClean && 
        (keyLimpia === targetClean || nombreLimpio === targetClean)
      );

      return {
        fillColor: colores.fill,
        fillOpacity: esTarget ? 0.45 : 0.15,
        strokeColor: colores.stroke,
        strokeWeight: esTarget ? 3 : 1,
        clickable: true
      };
    });

  } catch (err) {
    console.error(">>> [ZONAS_ERROR]: Falló la inyección o estilizado GeoJSON en el mapa:", err);
  }
}

// Exponer en el scope global para compatibilidad con scripts desacoplados / legacy
window.desplegarZonaMensajeroEnMapa = desplegarZonaMensajeroEnMapa;
window.obtenerZonaPorNombre = obtenerZonaPorNombre;