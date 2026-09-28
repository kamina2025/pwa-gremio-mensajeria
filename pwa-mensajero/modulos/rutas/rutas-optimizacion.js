/**
 * PROTOCOLO MACONDO - OPTIMIZADOR DE RUTAS POR PROXIMIDAD Y REORDENAMIENTO
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-optimizacion.js
 * Arquitectura: Local-First / Nearest Neighbor con Punto Inicial y Final Fijados / Sincronización en RAM e IndexedDB
 */

import { normalizarClaveZona } from "./rutas-normalizador.js";
import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";
import { calcularDistanciaHaversine } from "../mapa/zonificacion/geo-utils.js";

/**
 * Extrae o construye un identificador único para una parada dada.
 * @param {Object} p 
 * @returns {string}
 */
function obtenerIdUnicoParada(p) {
  if (!p) return "";
  return String(p.id || p.scc || p.ssc || p.idParada || p.id_parada || "").trim();
}

/**
 * Garantiza la extracción de coordenadas numéricas válidas de forma flexible.
 * @param {Object} p 
 * @returns {{lat: number, lng: number}|null}
 */
function obtenerCoordenadasValidas(p) {
  if (!p) return null;
  
  const latVal = p.lat !== undefined ? p.lat : (p.latitud !== undefined ? p.latitud : (p.coordenadas?.lat || p.centroide?.lat));
  const lngVal = p.lng !== undefined ? p.lng : (p.longitud !== undefined ? p.longitud : (p.coordenadas?.lng || p.centroide?.lng));

  const lat = parseFloat(latVal);
  const lng = parseFloat(lngVal);

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
  return { lat, lng };
}

/**
 * Reordena las paradas mediante Vecino Más Cercano (Nearest Neighbor),
 * respetando estrictamente la parada de Inicio y Fin fijadas si existen.
 * 
 * @param {Array<Object>} paradas - Lista de paradas de la zona
 * @param {Object|null} inicioFix - Parada fijada como origen
 * @param {Object|null} finFix - Parada fijada como destino
 * @returns {Array<Object>} Paradas reordenadas
 */
function reordenarPorProximidadNearestNeighbor(paradas, inicioFix = null, finFix = null) {
  if (!paradas || paradas.length <= 1) return paradas;

  let pend = [...paradas];
  let resultado = [];

  // 1. Extraer punto inicial si fue fijado por el usuario
  let inicio = null;
  if (inicioFix) {
    const idIni = obtenerIdUnicoParada(inicioFix);
    const idx = pend.findIndex(p => obtenerIdUnicoParada(p) === idIni);
    if (idx !== -1) {
      inicio = pend.splice(idx, 1)[0];
    }
  }

  // 2. Extraer punto final si fue fijado por el usuario
  let fin = null;
  if (finFix) {
    const idFin = obtenerIdUnicoParada(finFix);
    const idx = pend.findIndex(p => obtenerIdUnicoParada(p) === idFin);
    if (idx !== -1) {
      fin = pend.splice(idx, 1)[0];
    }
  }

  // Si no hay inicio fijado, tomar el primer ítem disponible como origen
  if (!inicio && pend.length > 0) {
    inicio = pend.shift();
  }

  if (inicio) resultado.push(inicio);

  // 3. Iterar por proximidad (Nearest Neighbor) para los puntos intermedios
  let actual = inicio;
  while (pend.length > 0) {
    const coordsActual = obtenerCoordenadasValidas(actual);
    let mejorIdx = 0;

    if (coordsActual) {
      let menorDistancia = Infinity;
      for (let i = 0; i < pend.length; i++) {
        const coordsCand = obtenerCoordenadasValidas(pend[i]);
        if (coordsCand) {
          const dist = calcularDistanciaHaversine(coordsActual.lat, coordsActual.lng, coordsCand.lat, coordsCand.lng);
          if (dist < menorDistancia) {
            menorDistancia = dist;
            mejorIdx = i;
          }
        }
      }
    }

    actual = pend.splice(mejorIdx, 1)[0];
    resultado.push(actual);
  }

  // 4. Agregar el punto final fijado al cierre del recorrido
  if (fin) {
    resultado.push(fin);
  }

  return resultado;
}

/**
 * Invierte el orden secuencial de enrutamiento para una zona.
 * @param {string} zonaKeyInput - Clave o nombre de la zona a invertir
 * @returns {Promise<Array<Object>>} Lista global de paradas actualizada
 */
export async function invertirSecuenciaRutaZona(zonaKeyInput) {
  if (!zonaKeyInput) return [];

  const targetCanonico = estandarizarZonaCanonica(zonaKeyInput);
  console.group(`🔄 [INVERSOR_RUTA]: Invirtiendo sentido de ruta para Zona '${targetCanonico}'`);

  let todasLasParadas = (await obtenerParadasGuardadas()) || window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];

  if (!todasLasParadas || todasLasParadas.length === 0) {
    console.warn("⚠️ [INVERSOR_RUTA]: No se encontraron paradas en la base local.");
    console.groupEnd();
    return [];
  }

  let paradasZona = todasLasParadas.filter((p) => p && obtenerZonaParadaCanonica(p) === targetCanonico);

  if (paradasZona.length <= 1) {
    console.warn("ℹ️ [INVERSOR_RUTA]: Insuficientes paradas en la zona para realizar inversión.");
    console.groupEnd();
    return todasLasParadas;
  }

  // Ordenar por secuencia actual e invertir
  paradasZona.sort((a, b) => (parseInt(a.secuenciaZona || a.secuencia || 0, 10)) - (parseInt(b.secuenciaZona || b.secuencia || 0, 10)));
  paradasZona.reverse();

  // Reasignar secuencias numéricas y clústeres
  const TAMANO_CLUSTER = 4;
  paradasZona.forEach((p, idx) => {
    const nuevoNumero = idx + 1;
    const numGrupo = Math.ceil(nuevoNumero / TAMANO_CLUSTER);
    p.secuenciaZona = nuevoNumero;
    p.orden = nuevoNumero;
    p.secuencia = nuevoNumero;
    p.grupoId = `GRUPO-${numGrupo.toString().padStart(2, "0")}`;
    p.updated_at = new Date().toISOString();
  });

  const mapaNuevosOrdenes = new Map();
  paradasZona.forEach((p) => {
    mapaNuevosOrdenes.set(obtenerIdUnicoParada(p), p);
  });

  let listaGlobalActualizada = todasLasParadas.map((p) => {
    const idUnico = obtenerIdUnicoParada(p);
    return mapaNuevosOrdenes.has(idUnico) ? mapaNuevosOrdenes.get(idUnico) : p;
  });

  // Persistencia e integración Local-First
  await guardarRutaZonificada(listaGlobalActualizada);
  window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
  window.paradasMemoriaLocal = [...listaGlobalActualizada];
  window.paradasRutaActiva = [...listaGlobalActualizada];
  window.pedidosGlobales = [...listaGlobalActualizada];

  console.log(`✅ [INVERSOR_RUTA]: Secuencia invertida para ${paradasZona.length} paradas.`);
  console.groupEnd();
  return listaGlobalActualizada;
}

/**
 * Función Principal de Optimización por Zona con Soporte para Inicio y Fin Fijados.
 * 
 * @param {string} zonaKeyInput - Nombre o clave de la zona
 * @param {Object|null} [paradaInicioFix=null] - Parada fijada como origen
 * @param {Object|null} [paradaFinFix=null] - Parada fijada como destino
 * @returns {Promise<Array<Object>>} Lista de paradas enrutadas
 */
export async function optimizarRutaPorProximidadZona(zonaKeyInput, paradaInicioFix = null, paradaFinFix = null) {
  if (!zonaKeyInput) return [];

  const targetCanonico = estandarizarZonaCanonica(zonaKeyInput);
  console.group(`⚡ [OPTIMIZADOR_PROXIMIDAD]: Ejecutando para Zona '${targetCanonico}'`);

  let todasLasParadas = await obtenerParadasGuardadas();
  if (!todasLasParadas || todasLasParadas.length === 0) {
    todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
  }

  let paradasZona = todasLasParadas.filter((p) => p && obtenerZonaParadaCanonica(p) === targetCanonico);

  if (paradasZona.length <= 1) {
    console.warn("ℹ️ [OPTIMIZADOR_PROXIMIDAD]: Insuficientes paradas en la zona para optimizar.");
    console.groupEnd();
    return paradasZona;
  }

  // 1. Ejecutar algoritmo Nearest Neighbor respetando Inicio/Fin fijados
  const paradasZonaEnrutadas = reordenarPorProximidadNearestNeighbor(paradasZona, paradaInicioFix, paradaFinFix);

  // 2. Reasignar números de secuencia numéricos estrictos (1, 2, 3...) y grupos por bloque de 4
  const TAMANO_CLUSTER = 4;
  paradasZonaEnrutadas.forEach((parada, idx) => {
    const nuevaSecuencia = idx + 1;
    const numGrupo = Math.ceil(nuevaSecuencia / TAMANO_CLUSTER);
    parada.secuenciaZona = nuevaSecuencia;
    parada.orden = nuevaSecuencia;
    parada.secuencia = nuevaSecuencia;
    parada.grupoId = `GRUPO-${numGrupo.toString().padStart(2, "0")}`;
    parada.updated_at = new Date().toISOString();
  });

  // 3. Reemplazar y actualizar en la colección global completa
  const mapaNuevosOrdenes = new Map(paradasZonaEnrutadas.map(p => [obtenerIdUnicoParada(p), p]));
  let listaGlobalActualizada = todasLasParadas.map(p => {
    const idUnico = obtenerIdUnicoParada(p);
    return mapaNuevosOrdenes.has(idUnico) ? mapaNuevosOrdenes.get(idUnico) : p;
  });

  // 4. Guardar en almacenamiento local y sincronizar memorias RAM
  await guardarRutaZonificada(listaGlobalActualizada);
  window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
  window.paradasMemoriaLocal = [...listaGlobalActualizada];
  window.paradasRutaActiva = [...listaGlobalActualizada];
  window.pedidosGlobales = [...listaGlobalActualizada];

  console.log("✅ [OPTIMIZADOR_PROXIMIDAD]: Secuencia ordenada, agrupada y persistida exitosamente.");
  console.groupEnd();

  return paradasZonaEnrutadas;
}

// BINDINGS GLOBALES DE LEGACY / WINDOW
window.optimizarRutaPorProximidadZona = optimizarRutaPorProximidadZona;
window.optimizarRutaPorProximidad = optimizarRutaPorProximidadZona;
window.invertirSecuenciaRutaZona = invertirSecuenciaRutaZona;