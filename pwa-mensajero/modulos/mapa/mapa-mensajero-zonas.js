/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE CAPAS Y ZONIFICACIÓN DE MAPA (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa-mensajero-zonas.js
 */

import { MAPA_ZONAS_CALI, obtenerZonaPorNombre } from "./mensajero-zonificacion.js";

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

function obtenerColorFallback(texto) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return { fill: `hsl(${hue}, 80%, 50%)`, stroke: `hsl(${hue}, 90%, 75%)` };
}

export function desplegarZonaMensajeroEnMapa(instanciaMapa, zonaTargetKey = null) {
  if (!instanciaMapa || typeof google === "undefined" || !google.maps) {
    console.warn(">>> [ZONAS_WARN]: Instancia de Google Maps no está lista.");
    return;
  }

  try {
    instanciaMapa.data.forEach((feature) => {
      instanciaMapa.data.remove(feature);
    });

    instanciaMapa.data.addGeoJson(MAPA_ZONAS_CALI);

    instanciaMapa.data.setStyle((feature) => {
      const keyZona = feature.getProperty("key") || "";
      const nombreZona = feature.getProperty("nombre") || "";
      const colores = PALETA_ZONAS[keyZona] || obtenerColorFallback(nombreZona);

      const esTarget = zonaTargetKey && keyZona.toUpperCase() === zonaTargetKey.toUpperCase();

      return {
        fillColor: colores.fill,
        fillOpacity: esTarget ? 0.45 : 0.15,
        strokeColor: colores.stroke,
        strokeWeight: esTarget ? 3 : 1,
        clickable: true
      };
    });

    console.log(">>> [ZONAS_OK]: Capas vectoriales de GeoJSON cargadas exitosamente.");
  } catch (err) {
    console.error(">>> [ZONAS_ERROR]: Falló la inyección GeoJSON en el mapa:", err);
  }
}

window.desplegarZonaMensajeroEnMapa = desplegarZonaMensajeroEnMapa;
window.obtenerZonaPorNombre = obtenerZonaPorNombre;