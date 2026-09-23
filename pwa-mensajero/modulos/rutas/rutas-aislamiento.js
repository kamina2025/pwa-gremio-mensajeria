/**
 * Módulo de Aislamiento y Secuenciación de Rutas por Zona
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-aislamiento.js
 */

import { normalizarClaveZona } from "./rutas-normalizador.js";
import { obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { trazarPolilineaRuta } from "../mapa/mapa-rutas.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

/**
 * Procesa y aísla las paradas de la zona activa asegurando su orden físico secuencial.
 * 
 * @param {string} zonaKeyInput - Clave o nombre crudo de la zona a aislar
 * @returns {Promise<Array<Object>>} Lista de paradas filtradas y secuenciadas
 */
export async function calcularRutaAisladaPorZona(zonaKeyInput) {
  if (!zonaKeyInput) {
    console.warn("⚠️ [MENSAJERO_RUTAS]: Se requiere una zonaKey para aislar la ruta.");
    return [];
  }

  const targetCanónico = estandarizarZonaCanonica(zonaKeyInput);
  const targetLimpio = normalizarClaveZona(targetCanónico);

  console.group(`⚡ [ZONA_ISOLATION]: Procesando secuencia exclusiva para zona: [${zonaKeyInput}] -> '${targetCanónico}'`);

  let todasLasParadas = [];

  try {
    todasLasParadas = (await obtenerParadasGuardadas()) || [];
  } catch (err) {
    console.warn("⚠️ [ZONA_ISOLATION]: Fallo al leer IndexedDB, recurriendo a memoria RAM...", err);
  }

  if (!todasLasParadas || todasLasParadas.length === 0) {
    todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
  }

  // 1. Filtrado canónico estricto
  let paradasDeZona = todasLasParadas.filter((p) => {
    if (!p) return false;
    return obtenerZonaParadaCanonica(p) === targetCanónico;
  });

  if (paradasDeZona.length === 0) {
    console.warn(`⚠️ [ZONA_ISOLATION]: No hay paradas registradas para la zona canónica: '${targetCanónico}'`);
    console.groupEnd();
    return [];
  }

  // 2. ORDENAMIENTO FÍSICO (Crucial para que las líneas no se crucen y los marcadores coincidan)
  // Reemplazamos la reescritura destructiva que ocurría aquí por un simple ordenamiento matemático.
  paradasDeZona.sort((a, b) => {
    const seqA = parseInt(a.secuenciaZona || a.orden || a.secuencia || 0, 10);
    const seqB = parseInt(b.secuenciaZona || b.orden || b.secuencia || 0, 10);
    return seqA - seqB;
  });

  console.log(`💾 [ZONA_ISOLATION]: ${paradasDeZona.length} parada(s) aisladas y ORDENADAS con éxito.`);

  // 3. Renderizado Gráfico
  if (typeof window.actualizarPuntosEnMapa === "function") {
    console.log("🗺️ [ZONA_ISOLATION]: Delegando al renderizador principal del mapa...");
    window.actualizarPuntosEnMapa(paradasDeZona, 0);
  } else {
    // Fallback de dibujo
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

window.calcularRutaAisladaPorZona = calcularRutaAisladaPorZona;
window.aislarParadasPorZona = calcularRutaAisladaPorZona;