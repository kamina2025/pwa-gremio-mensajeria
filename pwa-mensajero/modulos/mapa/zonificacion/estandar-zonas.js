/**
 * PROTOCOLO MACONDO - MÓDULO ESTÁNDAR UNIFICADO DE NORMALIZACIÓN DE ZONAS DE CALI
 * Ubicación: modulos/mapa/zonificacion/estandar-zonas.js
 */

import { MAPA_ZONAS_CALI } from "./geojson-cali.js";

/**
 * Extrae y retorna el listado de claves oficiales del GeoJSON de Cali en tiempo de ejecución.
 * @returns {Array<string>}
 */
function obtenerClavesOficialesGeoJSON() {
  if (MAPA_ZONAS_CALI && Array.isArray(MAPA_ZONAS_CALI.features)) {
    return MAPA_ZONAS_CALI.features
      .map(f => f.properties?.key)
      .filter(Boolean);
  }
  return [];
}

/**
 * Diccionario canónico de respaldo para alias, variantes y errores tipográficos comunes.
 */
const MAPEO_DIRECTO_CANONICO = {
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
  "SUR4": "SUR-4",
  "NORTE": "NORTE-1",
  "SUR": "SUR-1",
  "ORIENTE-1": "ORIENTE",
  "OESTE-1": "OESTE"
};

/**
 * Normaliza y estandariza cualquier cadena de entrada a la clave canónica del GeoJSON de Cali.
 * 
 * @param {any} input - Cadena, número u objeto que representa la zona
 * @returns {string} Clave oficial ('CENTRO', 'NORTE-1', 'NORTE-2', 'OESTE', 'ORIENTE', 'SUR-1', etc.)
 */
export function estandarizarZonaCanonica(input) {
  if (!input) return "GENERAL";
  
  const str = typeof input === "object" 
    ? (input.key || input.zonaKey || input.nombre || input.codigo || "") 
    : String(input);

  if (!str.trim()) return "GENERAL";

  // 1. Limpieza inicial: Mayúsculas, sin acentos y remover prefijos 'ZONA', 'Z.', 'ZN'
  let limpia = str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")           // Elimina diacríticos/acentos
    .replace(/^(ZONA|Z|ZN)[._\s-]*/i, "")       // Remueve prefijos ZONA, Z., ZN_, ZONA-
    .replace(/[^A-Z0-9\s_-]/g, "")             // Remueve símbolos no alfanuméricos
    .trim();

  if (!limpia) return "GENERAL";

  // 2. Reemplazar espacios y guiones bajos por un solo guion medio
  limpia = limpia.replace(/[\s_]+/g, "-");

  // 3. Formatear letras pegadas a números (ej. "NORTE2" -> "NORTE-2")
  limpia = limpia.replace(/([A-Z]+)[\s_]*(\d+)/g, "$1-$2");

  // 4. Limpiar guiones duplicados
  limpia = limpia.replace(/-+/g, "-");

  // 5. Verificación directa en el listado GeoJSON oficial
  const clavesOficiales = obtenerClavesOficialesGeoJSON();
  if (clavesOficiales.length > 0 && clavesOficiales.includes(limpia)) {
    return limpia;
  }

  // 6. Mapeo defensivo directo por diccionario
  if (MAPEO_DIRECTO_CANONICO[limpia]) {
    return MAPEO_DIRECTO_CANONICO[limpia];
  }

  // 7. Si no coincide con ninguna regla canónica pero la cadena es coherente, retornarla limpiada o GENERAL
  return limpia.length >= 3 ? limpia : "GENERAL";
}

/**
 * Inspecciona exhaustivamente el objeto Parada probando todas sus variantes de campo
 * para retornar una clave de zona canónica estandarizada.
 * 
 * @param {Object} parada - Objeto de parada a inspeccionar
 * @returns {string} Clave canónica ('NORTE-1', 'CENTRO', etc.) o 'GENERAL'
 */
export function obtenerZonaParadaCanonica(parada) {
  if (!parada || typeof parada !== "object") return "GENERAL";

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

// BINDINGS GLOBALES INMEDIATOS PARA COMPATIBILIDAD LOCAL-FIRST
if (typeof window !== "undefined") {
  window.estandarizarZonaCanonica = estandarizarZonaCanonica;
  window.obtenerZonaParadaCanonica = obtenerZonaParadaCanonica;
  console.log("⚡ [ESTANDAR_ZONAS]: Módulo de normalización de zonas cargado y enlazado a window.");
}