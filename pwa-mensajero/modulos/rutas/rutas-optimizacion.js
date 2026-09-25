/**
 * PROTOCOLO MACONDO - OPTIMIZADOR DE RUTAS Y PROXIMIDAD
 * Ubicación: modulos/rutas/rutas-optimizacion.js
 * Arquitectura: Local-First / Clustering (Min 2 / Max 4) / SCC & Subgrupos por Dirección
 */

import { normalizarClaveZona } from "./rutas-normalizador.js";
import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";
import { calcularDistanciaHaversine, calcularCentroide } from "../mapa/zonificacion/geo-utils.js";

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
 * Normaliza cadenas de dirección física para asegurar comparaciones exactas.
 * @param {string} dir 
 * @returns {string}
 */
function normalizarDireccion(dir) {
  if (!dir) return "";
  return String(dir)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
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
 * PASO 1: Tratamiento de SCCs e Identificación de Subgrupos por Dirección Física.
 * @param {Array<Object>} paradasZona - Arreglo de paradas de la zona
 * @returns {Array<Object>} Lista de Nodos Subgrupo estructurados
 */
function procesarSubgruposYDirecciones(paradasZona) {
  console.log("🔍 [OPTIMIZADOR]: Paso 1 - Fusión SCC y Subagrupamiento por Dirección...");

  // 1A. Regla SCC Identificador (Fusionar registros con el mismo SCC)
  const mapaSCC = new Map();
  const paradasIndependientes = [];

  paradasZona.forEach(p => {
    const sccVal = String(p.scc || p.ssc || p.id_scc || "").trim();
    if (sccVal && sccVal !== "0" && sccVal !== "null" && sccVal !== "undefined") {
      if (!mapaSCC.has(sccVal)) {
        mapaSCC.set(sccVal, { ...p });
      } else {
        const existente = mapaSCC.get(sccVal);
        existente.observaciones = `${existente.observaciones || ''} | ${p.observaciones || ''}`.trim();
        existente.paquetes_consolidados = (existente.paquetes_consolidados || 1) + 1;
      }
    } else {
      paradasIndependientes.push({ ...p });
    }
  });

  const listaUnificadaSCC = [...mapaSCC.values(), ...paradasIndependientes];

  // 1B. Subagrupamiento por Dirección Identica (Distinto SCC)
  const mapaDirecciones = new Map();

  listaUnificadaSCC.forEach(p => {
    const dirClave = normalizarDireccion(p.direccion || p.direccion_entrega || p.dir);
    if (!dirClave) {
      const keyUnica = `sin_dir_${obtenerIdUnicoParada(p) || Math.random()}`;
      mapaDirecciones.set(keyUnica, [p]);
    } else {
      if (!mapaDirecciones.has(dirClave)) {
        mapaDirecciones.set(dirClave, []);
      }
      mapaDirecciones.get(dirClave).push(p);
    }
  });

  // 1C. Generar Nodos Subgrupo con Centroide Geográfico
  const subgruposResultantes = [];
  let subgrupoCounter = 1;

  mapaDirecciones.forEach((items, dirKey) => {
    const centroide = calcularCentroide(items);
    const subgrupoId = `SUB-${subgrupoCounter.toString().padStart(3, "0")}`;
    subgrupoCounter++;

    subgruposResultantes.push({
      subgrupoId,
      direccionNormalizada: dirKey,
      esSubgrupoMultiples: items.length > 1,
      centroide,
      paradas: items.map((p, idx) => ({
        ...p,
        subgrupoId,
        ordenEnSubgrupo: idx + 1
      }))
    });
  });

  console.log(`✅ [OPTIMIZADOR]: ${subgruposResultantes.length} subgrupos creados a partir de ${paradasZona.length} registros.`);
  return subgruposResultantes;
}

/**
 * PASO 2: Clustering por Proximidad (Mínimo 2 / Máximo 4 paradas/subgrupos por clúster).
 * @param {Array<Object>} subgrupos - Lista de subgrupos estructurados
 * @returns {Array<Array<Object>>} Colección de clústeres agrupados
 */
function crearClustersProximidad(subgrupos) {
  console.log("🧩 [OPTIMIZADOR]: Paso 2 - Clustering por proximidad (Min 2 / Max 4)...");
  let pendientes = [...subgrupos];
  const clusters = [];

  while (pendientes.length > 0) {
    if (pendientes.length === 1) {
      // Balancear sobrante de 1 elemento ajustando el clúster anterior
      if (clusters.length > 0 && clusters[clusters.length - 1].length < 4) {
        clusters[clusters.length - 1].push(pendientes.pop());
      } else if (clusters.length > 0) {
        const ultimoCluster = clusters.pop();
        pendientes.push(...ultimoCluster);
        const c1 = pendientes.splice(0, 3);
        clusters.push(c1);
        clusters.push(pendientes);
        pendientes = [];
      } else {
        clusters.push([pendientes.pop()]);
      }
      break;
    }

    const pivote = pendientes.shift();
    const coordsPivote = pivote.centroide;
    const clusterActual = [pivote];

    // Ordenar pendientes restantes por proximidad Haversine al pivote
    pendientes.sort((a, b) => {
      const dA = calcularDistanciaHaversine(coordsPivote.lat, coordsPivote.lng, a.centroide.lat, a.centroide.lng);
      const dB = calcularDistanciaHaversine(coordsPivote.lat, coordsPivote.lng, b.centroide.lat, b.centroide.lng);
      return dA - dB;
    });

    const tamanoDeseado = Math.min(3, pendientes.length); // Pivote (1) + hasta 3 cercanos = Max 4
    const cercanos = pendientes.splice(0, tamanoDeseado);
    clusterActual.push(...cercanos);

    clusters.push(clusterActual);
  }

  console.log(`✅ [OPTIMIZADOR]: ${clusters.length} clusters generados exitosamente.`);
  return clusters;
}

/**
 * PASO 3 & 4: Enrutamiento Nearest Neighbor e Indexación de Secuencias Finales.
 * @param {Array<Array<Object>>} clusters - Clústeres formados
 * @returns {Array<Object>} Lista plana ordenada de paradas con secuencias actualizadas
 */
function enrotrarSecuenciaFinal(clusters) {
  console.log("🚀 [OPTIMIZADOR]: Paso 3 - Enrutando secuencia óptima (Nearest Neighbor)...");
  
  const clustersPendientes = [...clusters];
  let clusterActual = clustersPendientes.shift();
  const clustersOrdenados = [clusterActual];

  while (clustersPendientes.length > 0) {
    const centroideActual = calcularCentroide(clusterActual.map(sub => sub.centroide));
    let idxCercano = 0;
    let distMinima = Infinity;

    clustersPendientes.forEach((cl, idx) => {
      const centroideTarget = calcularCentroide(cl.map(sub => sub.centroide));
      const d = calcularDistanciaHaversine(centroideActual.lat, centroideActual.lng, centroideTarget.lat, centroideTarget.lng);
      if (d < distMinima) {
        distMinima = d;
        idxCercano = idx;
      }
    });

    clusterActual = clustersPendientes.splice(idxCercano, 1)[0];
    clustersOrdenados.push(clusterActual);
  }

  const listaFinalEnrutada = [];
  let secuenciaGlobal = 1;

  clustersOrdenados.forEach((cluster, idxCluster) => {
    const grupoId = `GRUPO-${(idxCluster + 1).toString().padStart(2, "0")}`;

    cluster.forEach(subgrupo => {
      subgrupo.paradas.forEach(parada => {
        const paradaEnrutada = {
          ...parada,
          grupoId,
          subgrupoId: subgrupo.subgrupoId,
          secuenciaZona: secuenciaGlobal,
          secuencia: secuenciaGlobal,
          orden: secuenciaGlobal,
          updated_at: new Date().toISOString()
        };
        listaFinalEnrutada.push(paradaEnrutada);
        console.log(` 📍 [#${secuenciaGlobal}] [${grupoId}] [${subgrupo.subgrupoId}] -> ${paradaEnrutada.destinatario || paradaEnrutada.cliente || 'Parada'}`);
        secuenciaGlobal++;
      });
    });
  });

  return listaFinalEnrutada;
}

/**
 * Función Principal Executable de Optimización por Zona.
 * @param {string} zonaKeyInput - Nombre o clave de la zona
 * @param {Object|null} [paradaInicioFix=null] - Parada inicial fijada
 * @param {Object|null} [paradaFinFix=null] - Parada final fijada
 * @returns {Promise<Array<Object>>} Lista de paradas de la zona enrutadas
 */
export async function optimizarRutaPorProximidadZona(zonaKeyInput, paradaInicioFix = null, paradaFinFix = null) {
  if (!zonaKeyInput) return [];

  const targetCanonico = estandarizarZonaCanonica(zonaKeyInput);
  const targetLimpio = normalizarClaveZona(targetCanonico);

  console.group(`⚡ [OPTIMIZADOR_PROXIMIDAD]: Ejecutando para Zona '${targetCanonico}'`);

  // 1. Obtener la colección global de paradas (Memoria / Persistencia)
  let todasLasParadas = await obtenerParadasGuardadas();
  if (!todasLasParadas || todasLasParadas.length === 0) {
    todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
  }

  // 2. Filtrar las paradas correspondientes a la zona solicitada
  let paradasZona = todasLasParadas.filter((p) => p && obtenerZonaParadaCanonica(p) === targetCanonico);

  if (paradasZona.length === 0) {
    console.warn("ℹ️ [OPTIMIZADOR_PROXIMIDAD]: Insuficientes paradas en la zona para realizar optimización.");
    console.groupEnd();
    return paradasZona;
  }

  // 3. Ejecutar Pipeline Jerárquico de Optimización
  const subgrupos = procesarSubgruposYDirecciones(paradasZona);
  const clusters = crearClustersProximidad(subgrupos);
  const paradasZonaEnrutadas = enrotrarSecuenciaFinal(clusters);

  // 4. Mapear y Reemplazar dentro de la Lista Global
  const mapaNuevosOrdenes = new Map();
  paradasZonaEnrutadas.forEach(p => {
    mapaNuevosOrdenes.set(obtenerIdUnicoParada(p), p);
  });

  let listaGlobalActualizada = todasLasParadas.map(p => {
    const idUnico = obtenerIdUnicoParada(p);
    return mapaNuevosOrdenes.has(idUnico) ? mapaNuevosOrdenes.get(idUnico) : p;
  });

  // Ordenamiento global por secuencia
  listaGlobalActualizada.sort((a, b) => {
    const seqA = parseInt(a.secuenciaZona || a.orden || a.secuencia || 0, 10);
    const seqB = parseInt(b.secuenciaZona || b.orden || b.secuencia || 0, 10);
    return seqA - seqB;
  });

  // 5. Persistencia Local-First y Sincronización en RAM
  await guardarRutaZonificada(listaGlobalActualizada);
  window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
  window.paradasMemoriaLocal = [...listaGlobalActualizada];
  window.paradasRutaActiva = [...listaGlobalActualizada];
  window.pedidosGlobales = [...listaGlobalActualizada];

  // 6. Refrescar Mapa y UI de Acordeones
  if (typeof window.trazarPolilineaRuta === "function") {
    window.trazarPolilineaRuta(paradasZonaEnrutadas, targetCanonico);
  } else if (typeof window.actualizarPuntosEnMapa === "function") {
    window.actualizarPuntosEnMapa(listaGlobalActualizada, 0);
  }

  if (typeof window.renderizarParadasZonificadasUI === "function") {
    await window.renderizarParadasZonificadasUI(listaGlobalActualizada);
  }

  console.log("✅ [OPTIMIZADOR_PROXIMIDAD]: Secuencia ordenada, agrupada y persistida exitosamente.");
  console.groupEnd();

  return paradasZonaEnrutadas;
}

// BINDINGS GLOBALES DE LEGACY / WINDOW
window.optimizarRutaPorProximidadZona = optimizarRutaPorProximidadZona;
window.optimizarRutaPorProximidad = optimizarRutaPorProximidadZona;