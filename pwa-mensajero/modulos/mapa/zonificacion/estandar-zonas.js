/**
 * Módulo Estándar Unificado de Normalización de Zonas de Cali
 * Ubicación: pwa-mensajero/modulos/mapa/zonificacion/estandar-zonas.js
 */

import { MAPA_ZONAS_CALI } from "./geojson-cali.js";

// Claves oficiales extraídas del GeoJSON
const CLAVES_GEOJSON_OFICIALES = (MAPA_ZONAS_CALI?.features || []).map(f => f.properties?.key).filter(Boolean);

/**
 * Normaliza y estandariza cualquier cadena de entrada a la clave canónica del GeoJSON de Cali.
 * 
 * @param {any} input 
 * @returns {string} Clave oficial ('CENTRO', 'NORTE-1', 'NORTE-2', 'OESTE', 'ORIENTE', 'SUR-1', etc.)
 */
export function estandarizarZonaCanonica(input) {
  if (!input) return "GENERAL";
  
  const str = typeof input === "object" 
    ? (input.key || input.nombre || input.codigo || "") 
    : String(input);

  if (!str.trim()) return "GENERAL";

  // Limpieza inicial: Mayúsculas, sin acentos y remover prefijos 'ZONA'
  let limpia = str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Elimina acentos
    .replace(/^ZONA[_\s-]*/i, "")   // Remueve prefijos ZONA, ZONA_, ZONA-
    .replace(/[^A-Z0-9\s_-]/g, "")   // Remueve símbolos extraños
    .trim();

  if (!limpia) return "GENERAL";

  // Reemplazar espacios y guiones bajos por guion medio
  limpia = limpia.replace(/[\s_]+/g, "-");

  // Formatear letras pegadas a números (ej. "NORTE2" -> "NORTE-2")
  limpia = limpia.replace(/([A-Z]+)[\s_]*(\d+)/g, "$1-$2");

  // Limpiar guiones duplicados
  limpia = limpia.replace(/-+/g, "-");

  // Verificación directa en el listado GeoJSON
  if (CLAVES_GEOJSON_OFICIALES.includes(limpia)) {
    return limpia;
  }

  // Mapeo defensivo directo
  const mapeoDirecto = {
    "CENTRO": "CENTRO",
    "NORTE-1": "NORTE-1",
    "NORTE-2": "NORTE-2",
    "OESTE": "OESTE",
    "ORIENTE": "ORIENTE",
    "SUR-1": "SUR-1",
    "SUR-2": "SUR-2",
    "SUR-3": "SUR-3",
    "SUR-4": "SUR-4",
    "NORTE1": "NORTE-1",
    "NORTE2": "NORTE-2",
    "SUR1": "SUR-1",
    "SUR2": "SUR-2",
    "SUR3": "SUR-3",
    "SUR4": "SUR-4"
  };

  return mapeoDirecto[limpia] || limpia || "GENERAL";
}

/**
 * Inspecciona exhaustivamente el objeto Parada probando todas sus variantes de campo
 * para retornar una clave de zona canónica estandarizada.
 * 
 * @param {Object} parada 
 * @returns {string} Clave canónica
 */
export function obtenerZonaParadaCanonica(parada) {
  if (!parada) return "GENERAL";

  const candidatos = [
    parada.zonaKey,
    parada.nombreZona,
    parada.zona,
    parada.zonaNombre,
    parada.zona_id,
    (parada.zona && typeof parada.zona === "object") ? (parada.zona.key || parada.zona.nombre || parada.zona.codigo) : null
  ];

  for (const cand of candidatos) {
    if (cand) {
      const canonica = estandarizarZonaCanonica(cand);
      if (canonica && canonica !== "GENERAL") {
        return canonica;
      }
    }
  }

  return "GENERAL";
}

// Bindings globales inmediatos
window.estandarizarZonaCanonica = estandarizarZonaCanonica;
window.obtenerZonaParadaCanonica = obtenerZonaParadaCanonica;