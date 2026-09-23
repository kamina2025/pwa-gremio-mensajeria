/**
 * Módulo de Optimización de Secuencia por Proximidad (Nearest Neighbor)
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-optimizacion.js
 */

import { normalizarClaveZona } from "./rutas-normalizador.js";
import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { buscarParadaMasCercana } from "../mapa/zonificacion/geo-utils.js";
import { trazarPolilineaRuta } from "../mapa/mapa-rutas.js";

/**
 * Recalcula la secuencia óptima de paradas dentro de una zona usando el algoritmo de Vecino Más Cercano.
 * 
 * @param {string} zonaKeyInput - Clave o nombre de la zona a optimizar
 * @returns {Promise<Array<Object>>} Lista de paradas reordenadas de la zona
 */
export async function optimizarRutaPorProximidadZona(zonaKeyInput) {
  if (!zonaKeyInput) {
    console.warn("⚠️ [OPTIMIZADOR_PROXIMIDAD]: Se requiere una zonaKey válida.");
    return [];
  }

  const targetLimpio = normalizarClaveZona(zonaKeyInput);
  console.group(`⚡ [OPTIMIZAR_PROXIMIDAD]: Calculando secuencia óptima (Nearest Neighbor) para la zona: [${zonaKeyInput}] (Target: '${targetLimpio}')`);

  let todasLasParadas = (await obtenerParadasGuardadas()) || [];
  if (!todasLasParadas.length) {
    todasLasParadas = JSON.parse(localStorage.getItem("ruta_zonificada") || "[]");
  }

  // Filtrar paradas pertenecientes exclusivamente a esta zona
  const paradasZona = todasLasParadas.filter((p) => {
    if (!p) return false;
    const k1 = normalizarClaveZona(p.zonaKey || "");
    const k2 = normalizarClaveZona(p.nombreZona || "");
    const k3 = normalizarClaveZona(p.zona || "");
    const k4 = normalizarClaveZona(p.zonaNombre || "");
    const keys = [k1, k2, k3, k4].filter(Boolean);
    return keys.some(k => k === targetLimpio || k.replace(/-/g, "") === targetLimpio.replace(/-/g, ""));
  });

  if (paradasZona.length <= 1) {
    console.log("ℹ️ [OPTIMIZAR_PROXIMIDAD]: Insuficientes paradas en zona (<= 1) para reordenar.");
    console.groupEnd();
    return paradasZona;
  }

  // Algoritmo Vecino Más Cercano (Nearest Neighbor)
  const copiaPendientes = [...paradasZona];
  const secuenciaOptimizada = [];

  let puntoActual = copiaPendientes.shift();
  secuenciaOptimizada.push(puntoActual);

  while (copiaPendientes.length > 0) {
    const res = buscarParadaMasCercana(puntoActual, copiaPendientes);
    if (res.parada && res.indice !== -1) {
      puntoActual = copiaPendientes.splice(res.indice, 1)[0];
      secuenciaOptimizada.push(puntoActual);
      console.log(` 📍 -> Siguiente parada óptima: ${puntoActual.destinatario || 'Cliente'} (a ${res.distanciaKm.toFixed(2)} km)`);
    } else {
      secuenciaOptimizada.push(...copiaPendientes);
      break;
    }
  }

  // Mapear los nuevos índices de secuencia en la zona (1, 2, 3...)
  const mapaNuevosOrdenes = new Map();
  secuenciaOptimizada.forEach((p, idx) => {
    const idUnico = p.id || p.ssc;
    p.secuenciaZona = idx + 1;
    p.updated_at = new Date().toISOString();
    mapaNuevosOrdenes.set(idUnico, idx + 1);
  });

  // Re-ensamblar la lista global respetando las paradas de otras zonas
  const listaGlobalActualizada = todasLasParadas.map((parada) => {
    const idUnico = parada.id || parada.ssc;
    if (mapaNuevosOrdenes.has(idUnico)) {
      return {
        ...parada,
        secuenciaZona: mapaNuevosOrdenes.get(idUnico),
        updated_at: new Date().toISOString()
      };
    }
    return parada;
  });

  // Persistir en IndexedDB / localStorage y actualizar cachés globales
  await guardarRutaZonificada(listaGlobalActualizada);
  window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
  window.paradasMemoriaLocal = [...listaGlobalActualizada];

  console.log(`💾 [OPTIMIZAR_PROXIMIDAD]: Secuencia optimizada y persistida para ${secuenciaOptimizada.length} paradas.`);

  // Refrescar mapa y la interfaz de la PWA
  if (typeof trazarPolilineaRuta === "function") {
    trazarPolilineaRuta(secuenciaOptimizada, targetLimpio);
  }

  if (typeof window.renderizarParadasZonificadasUI === "function") {
    await window.renderizarParadasZonificadasUI(listaGlobalActualizada);
  }

  console.groupEnd();
  return secuenciaOptimizada;
}