/**
 * PROTOCOLO MACONDO - MÓDULO DE AISLAMIENTO Y SECUENCIACIÓN DE RUTAS POR ZONA
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-aislamiento.js
 * Optimizado para PWA Local-First, prevención de re-renders redundantes y ordenamiento numérico estricto.
 */

import { normalizarClaveZona } from "./rutas-normalizador.js";
import { obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { trazarPolilineaRuta } from "../mapa/mapa-rutas.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

// Control de caché en memoria para evitar ciclos de re-renderizado duplicados sobre el Canvas
let ultimaZonaAislada = null;
let ultimoHashParadas = "";

/**
 * Parsea y extrae el valor numérico de la secuencia de una parada.
 * @param {Object} p - Objeto de parada
 * @returns {number}
 */
function obtenerNumeroSecuencia(p) {
  if (!p) return 0;
  const val = p.secuenciaZona ?? p.orden ?? p.secuencia ?? 0;
  const num = parseInt(val, 10);
  return isNaN(num) ? 999999 : num;
}

/**
 * Procesa y aísla las paradas de la zona activa asegurando su orden físico secuencial.
 * 
 * @param {string} zonaKeyInput - Clave o nombre crudo de la zona a aislar
 * @returns {Promise<Array<Object>>} Lista de paradas filtradas y secuenciadas
 */
export async function calcularRutaAisladaPorZona(zonaKeyInput) {
  if (!zonaKeyInput) {
    console.warn("⚠️ [ZONA_ISOLATION]: Se requiere una zonaKey válida para aislar la ruta.");
    return [];
  }

  const targetCanonico = estandarizarZonaCanonica(zonaKeyInput);
  const targetLimpio = normalizarClaveZona(targetCanonico);

  console.group(`⚡ [ZONA_ISOLATION]: Procesando secuencia exclusiva para zona: [${zonaKeyInput}] -> '${targetCanonico}'`);

  // 1. Prioridad de obtención de datos: RAM activa (Local-First) -> IndexedDB
  let todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];

  if (!todasLasParadas || todasLasParadas.length === 0) {
    try {
      todasLasParadas = (await obtenerParadasGuardadas()) || [];
    } catch (err) {
      console.warn("⚠️ [ZONA_ISOLATION]: Fallo al consultar IndexedDB local:", err);
    }
  }

  // 2. Filtrado canónico estricto de paradas pertenecientes a la zona objetivo
  let paradasDeZona = todasLasParadas.filter((p) => {
    if (!p) return false;
    return obtenerZonaParadaCanonica(p) === targetCanonico;
  });

  if (paradasDeZona.length === 0) {
    console.warn(`⚠️ [ZONA_ISOLATION]: No hay paradas registradas para la zona canónica: '${targetCanonico}'`);
    console.groupEnd();
    return [];
  }

  // 3. Ordenamiento numérico estricto por secuencia
  paradasDeZona.sort((a, b) => obtenerNumeroSecuencia(a) - obtenerNumeroSecuencia(b));

  // 4. Generación de Hash de Control para evitar re-renderizados duplicados
  const hashActual = `${targetCanonico}_${paradasDeZona.map(p => (p.id || p.ssc) + "_" + obtenerNumeroSecuencia(p)).join('|')}`;

  if (ultimaZonaAislada === targetCanonico && ultimoHashParadas === hashActual) {
    console.log(`ℹ️ [ZONA_ISOLATION]: Omitiendo re-renderizado duplicado para Zona: [${targetCanonico}] (Sin cambios detectados).`);
    console.groupEnd();
    return paradasDeZona;
  }

  // Actualizar estado de caché interna
  ultimaZonaAislada = targetCanonico;
  ultimoHashParadas = hashActual;

  console.log(`💾 [ZONA_ISOLATION]: ${paradasDeZona.length} parada(s) aisladas y ORDENADAS con éxito.`);

  // 5. Delegación del Renderizado Gráfico sobre el lienzo de mapa
  if (typeof window.actualizarPuntosEnMapa === "function") {
    console.log("🗺️ [ZONA_ISOLATION]: Delegando al renderizador principal del mapa...");
    window.actualizarPuntosEnMapa(paradasDeZona, 0);
  } else {
    // Fallback de dibujo para arquitecturas alternativas
    if (typeof trazarPolilineaRuta === "function") {
      trazarPolilineaRuta(paradasDeZona, targetLimpio);
    }
    if (typeof window.enfocarZonaEnMapa === "function") {
      window.enfocarZonaEnMapa(paradasDeZona);
    }
  }

  console.groupEnd();
  return paradasDeZona;
}

// BINDINGS GLOBALES EN WINDOW (Compatibilidad Legacy PWA)
window.calcularRutaAisladaPorZona = calcularRutaAisladaPorZona;
window.aislarParadasPorZona = calcularRutaAisladaPorZona;

console.log("🟢 [ZONA_ISOLATION]: Módulo de aislamiento de rutas por zona inicializado y listo.");