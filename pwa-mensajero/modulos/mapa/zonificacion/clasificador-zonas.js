/**
 * PROTOCOLO MACONDO - SERVICIOS DE CLASIFICACIÓN Y AGRUPACIÓN POR ZONAS
 * Ubicación: modulos/mapa/zonificacion/clasificador-zonas.js
 */

import { PALETA_ZONAS } from './paleta-zonas.js';
import { obtenerZonaPorCoordenadas } from './geo-utils.js';
import { estandarizarZonaCanonica } from './estandar-zonas.js';

/**
 * Sanitiza y extrae coordenadas flotantes válidas de una parada.
 * @param {Object} parada 
 * @returns {{lat: number, lng: number}|null}
 */
function obtenerCoordenadasNumericas(parada) {
  if (!parada) return null;
  const lat = parseFloat(parada.lat || parada.latitud);
  const lng = parseFloat(parada.lng || parada.longitud);
  if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

/**
 * Clasifica un listado de paradas asignándoles propiedades de zonificación
 * basadas en polígonos GeoJSON de Cali o cuadrantes geodésicos de fallback.
 * 
 * @param {Array<Object>} listaParadas - Lista de paradas a procesar
 * @returns {Array<Object>} Lista de paradas con atributos de zona enriquecidos y consecutivos
 */
export function clasificarParadasPorZona(listaParadas) {
  if (!Array.isArray(listaParadas) || listaParadas.length === 0) {
    console.warn("⚠️ [CLASIFICADOR]: Lista de paradas vacía o inválida.");
    return [];
  }

  console.group("🎨 [CLASIFICADOR]: Evaluando paradas por polígonos GeoJSON y cuadrantes...");

  // Contadores por zona para calcular consecutivoZona
  const contadoresZona = {};

  const paradasClasificadas = listaParadas.map((parada, idx) => {
    const coords = obtenerCoordenadasNumericas(parada);
    let zonaDetectada = null;

    if (coords) {
      zonaDetectada = obtenerZonaPorCoordenadas(coords.lat, coords.lng);
    }

    let zonaKeyRaw = "GENERAL";

    if (zonaDetectada && zonaDetectada.properties && zonaDetectada.properties.key) {
      zonaKeyRaw = zonaDetectada.properties.key;
    } else if (coords) {
      const { lat: pLat, lng: pLng } = coords;
      if (pLat >= 3.4500 && pLng >= -76.5320) zonaKeyRaw = "NORTE-1";
      else if (pLat < 3.4200 && pLng >= -76.5320) zonaKeyRaw = "SUR-1";
      else if (pLat >= 3.4200 && pLat < 3.4500 && pLng >= -76.5320) zonaKeyRaw = "CENTRO";
      else if (pLng < -76.5320) zonaKeyRaw = "OESTE";
      else zonaKeyRaw = "ORIENTE";
    } else {
      zonaKeyRaw = parada.zona || parada.zonaKey || "GENERAL";
    }

    // Normalizar clave canónica
    const zonaKey = estandarizarZonaCanonica(zonaKeyRaw);
    const infoPalette = PALETA_ZONAS[zonaKey] || PALETA_ZONAS[zonaKeyRaw] || PALETA_ZONAS["GENERAL"];
    const nombreZona = `zona_${zonaKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    // Incrementar consecutivo correlativo por grupo
    contadoresZona[zonaKey] = (contadoresZona[zonaKey] || 0) + 1;
    const consecutivo = contadoresZona[zonaKey];

    const idParadaUnico = String(parada.id || parada.ssc || parada.idParada || `parada_${idx}`).trim();

    console.log(`📍 [${zonaKey}] Stop #${consecutivo} -> ID: ${idParadaUnico} | ${parada.destinatario || parada.cliente || 'Cliente'}`);

    return {
      ...parada,
      id: idParadaUnico,
      idParada: idParadaUnico,
      zonaKey: zonaKey,
      zona: zonaKey,
      nombreZona: nombreZona,
      zonaNombre: infoPalette.label || zonaKey,
      colorZona: infoPalette.color || "#00e5ff",
      consecutivoZona: consecutivo,
      secuenciaZona: consecutivo,
      orden: consecutivo
    };
  });

  console.log("✅ [CLASIFICADOR]: Clasificación finalizada con éxito.");
  console.groupEnd();

  return paradasClasificadas;
}

/**
 * Valida y agrupa paradas estrictamente en contenedores aislados organizados por clave de zona,
 * re-indexando de forma atómica su numeración consecutivoZona (1..N).
 * 
 * @param {Array<Object>} paradas - Lista de paradas a agrupar
 * @returns {Object} Mapa de grupos con las zonas como propiedades y arrays de paradas como valores
 */
export function validarYAgruparParadasPorZonaEstricta(paradas) {
  if (!Array.isArray(paradas) || paradas.length === 0) return {};

  console.group("📌 [ZONIFICACION_ESTRICTA]: Clasificando y agrupando en contenedores aislados...");

  // Primero clasificamos y normalizamos
  const paradasClasificadas = clasificarParadasPorZona(paradas);
  const mapaGrupos = {};

  // Agrupar en contenedores
  paradasClasificadas.forEach((parada) => {
    const zonaKey = parada.zonaKey;
    if (!mapaGrupos[zonaKey]) {
      mapaGrupos[zonaKey] = [];
    }
    mapaGrupos[zonaKey].push(parada);
  });

  // Re-indexar iterativamente cada grupo contenedor para garantizar consecutivoZona estricto (1..N)
  Object.keys(mapaGrupos).forEach((zona) => {
    mapaGrupos[zona].forEach((p, idx) => {
      const numConsecutivo = idx + 1;
      p.consecutivoZona = numConsecutivo;
      p.secuenciaZona = numConsecutivo;
      p.orden = numConsecutivo;
    });
    console.log(`📦 Zona [${zona}]: ${mapaGrupos[zona].length} paradas agrupadas y re-secuenciadas.`);
  });

  console.groupEnd();
  return mapaGrupos;
}

// BINDINGS GLOBALES LOCAL-FIRST
if (typeof window !== "undefined") {
  window.clasificarParadasPorZona = clasificarParadasPorZona;
  window.validarYAgruparParadasPorZonaEstricta = validarYAgruparParadasPorZonaEstricta;
}