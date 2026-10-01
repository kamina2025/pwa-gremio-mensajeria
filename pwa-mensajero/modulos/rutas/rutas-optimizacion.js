/**
 * PROTOCOLO MACONDO - OPTIMIZADOR DE RUTAS POR PROXIMIDAD Y REORDENAMIENTO
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-optimizacion.js
 * Arquitectura: Local-First / CASCADA DE OPTIMIZACIÓN EN 3 NIVELES:
 *   Nivel 1: OSRM (Open Source Routing Machine) API [Gratis / Red Vial $0 USD]
 *   Nivel 2: Haversine Local (Nearest Neighbor / Geodésico Offline $0 USD]
 *   Nivel 3: Google Maps Directions API [Última Opción de Respaldo Comercial]
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
    if (actual) resultado.push(actual);
  }

  // 4. Agregar el punto final fijado al cierre del recorrido
  if (fin) {
    resultado.push(fin);
  }

  return resultado;
}

/**
 * Sincroniza y persiste el nuevo orden numérico en las colecciones locales y en las 4 memorias RAM.
 * @param {Array<Object>} paradasZonaOrdenadas - Paradas de la zona en su nuevo orden
 * @param {Array<Object>} todasLasParadas - Lista global completa de paradas
 */
async function aplicarYPersistirNuevoOrden(paradasZonaOrdenadas, todasLasParadas) {
  const TAMANO_CLUSTER = 4;
  paradasZonaOrdenadas.forEach((parada, idx) => {
    const nuevaSecuencia = idx + 1;
    const numGrupo = Math.ceil(nuevaSecuencia / TAMANO_CLUSTER);
    parada.consecutivoZona = nuevaSecuencia;
    parada.secuenciaZona = nuevaSecuencia;
    parada.orden = nuevaSecuencia;
    parada.secuencia = nuevaSecuencia;
    parada.grupoId = `GRUPO-${numGrupo.toString().padStart(2, "0")}`;
    parada.updated_at = new Date().toISOString();
  });

  const mapaNuevosOrdenes = new Map(paradasZonaOrdenadas.map(p => [obtenerIdUnicoParada(p), p]));
  let listaGlobalActualizada = todasLasParadas.map(p => {
    const idUnico = obtenerIdUnicoParada(p);
    return mapaNuevosOrdenes.has(idUnico) ? mapaNuevosOrdenes.get(idUnico) : p;
  });

  // Guardar en almacenamiento local IndexedDB y sincronizar atómicamente las 4 memorias RAM
  await guardarRutaZonificada(listaGlobalActualizada);
  window.__CACHE_PARADAS_MACONDO__ = structuredClone(listaGlobalActualizada);
  window.paradasMemoriaLocal = structuredClone(listaGlobalActualizada);
  window.paradasRutaActiva = structuredClone(listaGlobalActualizada);
  window.pedidosGlobales = structuredClone(listaGlobalActualizada);

  if (typeof window.actualizarPuntosEnMapa === "function") {
    window.actualizarPuntosEnMapa(listaGlobalActualizada, 0);
  }

  if (typeof window.renderizarParadasZonificadasUI === "function") {
    await window.renderizarParadasZonificadasUI(listaGlobalActualizada);
  }

  return paradasZonaOrdenadas;
}

/**
 * NIVEL 1: Intenta la optimización utilizando la API libre OSRM ($0 USD).
 */
async function optimizarConOSRM(paradasZona, paradaInicioFix, paradaFinFix) {
  console.log("🌐 [NIVEL_1_OSRM]: Intentando optimización de ruta vía OSRM ($0 USD)...");

  const paradasConCoords = paradasZona.filter(p => obtenerCoordenadasValidas(p) !== null);
  if (paradasConCoords.length < 2) {
    throw new Error("Puntos con coordenadas válidas insuficientes para OSRM.");
  }

  // Prepara puntos respetando inicio/fin fijados
  let intermedias = [...paradasConCoords];
  let origen = paradaInicioFix;
  let destino = paradaFinFix;

  if (origen) {
    intermedias = intermedias.filter(p => obtenerIdUnicoParada(p) !== obtenerIdUnicoParada(origen));
  } else {
    origen = intermedias.shift();
  }

  if (destino) {
    intermedias = intermedias.filter(p => obtenerIdUnicoParada(p) !== obtenerIdUnicoParada(destino));
  } else if (intermedias.length > 0) {
    destino = intermedias.pop();
  } else {
    destino = origen;
  }

  const secuenciaMapeo = [origen, ...intermedias];
  if (obtenerIdUnicoParada(origen) !== obtenerIdUnicoParada(destino)) {
    secuenciaMapeo.push(destino);
  }

  const coordsString = secuenciaMapeo
    .map(p => {
      const c = obtenerCoordenadasValidas(p);
      return `${c.lng},${c.lat}`;
    })
    .join(";");

  const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordsString}?source=first&destination=${obtenerIdUnicoParada(origen) !== obtenerIdUnicoParada(destino) ? "last" : "any"}&roundtrip=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // Timeout 4 segundos

  const resp = await fetch(osrmUrl, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!resp.ok) throw new Error(`OSRM HTTP error status ${resp.status}`);
  const data = await resp.json();

  if (data.code === "Ok" && data.waypoints && data.waypoints.length > 0) {
    // CORRECCIÓN: Ordenar y mapear correctamente por waypoint_index
    const waypointsOrdenados = [...data.waypoints].sort((a, b) => a.waypoint_index - b.waypoint_index);
    const resultado = waypointsOrdenados
      .map(wp => secuenciaMapeo[wp.waypoint_index])
      .filter(Boolean);

    console.log("✅ [NIVEL_1_OSRM]: Ruta optimizada con éxito vía OSRM.");
    return resultado;
  }

  throw new Error("Respuesta OSRM no válida.");
}

/**
 * NIVEL 2: Optimizador Geodésico Local Offline (Haversine + Nearest Neighbor $0 USD).
 */
function optimizarConHaversineLocal(paradasZona, paradaInicioFix, paradaFinFix) {
  console.log("📐 [NIVEL_2_HAVERSINE]: Ejecutando reordenamiento local geodésico...");
  const resultado = reordenarPorProximidadNearestNeighbor(paradasZona, paradaInicioFix, paradaFinFix);
  console.log("✅ [NIVEL_2_HAVERSINE]: Ruta optimizada localmente por Haversine.");
  return resultado;
}

/**
 * NIVEL 3: Optimizador comercial de respaldo vía Google Maps Directions API.
 */
async function optimizarConGoogleMaps(paradasZona, paradaInicioFix, paradaFinFix) {
  console.log("💳 [NIVEL_3_GOOGLE]: Solicitando optimización vía Google Maps Directions API...");

  const gMapsListo = typeof google !== "undefined" && google && google.maps && google.maps.DirectionsService;
  if (!gMapsListo) {
    throw new Error("SDK de Google Maps no cargado en el navegador.");
  }

  let origen = paradaInicioFix;
  let destino = paradaFinFix;
  let intermedias = [...paradasZona];

  if (origen) {
    intermedias = intermedias.filter(p => obtenerIdUnicoParada(p) !== obtenerIdUnicoParada(origen));
  } else {
    origen = intermedias.shift();
  }

  if (destino) {
    intermedias = intermedias.filter(p => obtenerIdUnicoParada(p) !== obtenerIdUnicoParada(destino));
  } else if (intermedias.length > 0) {
    destino = intermedias.pop();
  } else {
    destino = origen;
  }

  const coordsOrigen = obtenerCoordenadasValidas(origen);
  const coordsDestino = obtenerCoordenadasValidas(destino);

  if (!coordsOrigen || !coordsDestino) {
    throw new Error("Coordenadas inválidas en Origen o Destino para Google Maps.");
  }

  const waypointsGoogle = intermedias
    .map(p => {
      const coords = obtenerCoordenadasValidas(p);
      if (!coords) return null;
      return {
        location: new google.maps.LatLng(coords.lat, coords.lng),
        stopover: true
      };
    })
    .filter(Boolean);

  const directionsService = new google.maps.DirectionsService();
  const request = {
    origin: new google.maps.LatLng(coordsOrigen.lat, coordsOrigen.lng),
    destination: new google.maps.LatLng(coordsDestino.lat, coordsDestino.lng),
    waypoints: waypointsGoogle,
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode.DRIVING
  };

  const directionsResult = await new Promise((resolve, reject) => {
    directionsService.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK || status === "OK") resolve(result);
      else reject(status);
    });
  });

  if (directionsResult && directionsResult.routes && directionsResult.routes[0]) {
    const ordenIndices = directionsResult.routes[0].waypoint_order || [];
    const secuenciaOptimizada = [origen];

    ordenIndices.forEach(idx => {
      if (intermedias[idx]) secuenciaOptimizada.push(intermedias[idx]);
    });

    if (obtenerIdUnicoParada(origen) !== obtenerIdUnicoParada(destino)) {
      secuenciaOptimizada.push(destino);
    }

    console.log("✅ [NIVEL_3_GOOGLE]: Ruta optimizada con éxito vía Google Maps.");
    return secuenciaOptimizada;
  }

  throw new Error("Google Maps no devolvió rutas válidas.");
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
    console.warn("⚠ [INVERSOR_RUTA]: No se encontraron paradas en la base local.");
    console.groupEnd();
    return [];
  }

  let paradasZona = todasLasParadas.filter((p) => p && obtenerZonaParadaCanonica(p) === targetCanonico);

  if (paradasZona.length <= 1) {
    console.warn("ℹ [INVERSOR_RUTA]: Insuficientes paradas en la zona para realizar inversión.");
    console.groupEnd();
    return todasLasParadas;
  }

  // Ordenar por secuencia actual e invertir
  paradasZona.sort((a, b) => (parseInt(a.secuenciaZona || a.secuencia || 0, 10)) - (parseInt(b.secuenciaZona || b.secuencia || 0, 10)));
  paradasZona.reverse();

  const resultadoInvertido = await aplicarYPersistirNuevoOrden(paradasZona, todasLasParadas);

  console.log(`✅ [INVERSOR_RUTA]: Secuencia invertida para ${paradasZona.length} paradas.`);
  console.groupEnd();
  return resultadoInvertido;
}

/**
 * Función Principal de Optimización por Zona con Jerarquía de Respaldo en 3 Niveles:
 * 1. OSRM API (Pública Gratis $0 USD)
 * 2. Haversine Local (Offline Gratis $0 USD)
 * 3. Google Maps Directions API (Respaldo Comercial)
 * 
 * @param {string} zonaKeyInput - Nombre o clave de la zona
 * @param {Object|null} [paradaInicioFix=null] - Parada fijada como origen
 * @param {Object|null} [paradaFinFix=null] - Parada fijada como destino
 * @returns {Promise<Array<Object>>} Lista de paradas enrutadas
 */
export async function optimizarRutaPorProximidadZona(zonaKeyInput, paradaInicioFix = null, paradaFinFix = null) {
  if (!zonaKeyInput) return [];

  const targetCanonico = estandarizarZonaCanonica(zonaKeyInput);
  console.group(`⚡ [OPTIMIZADOR_EN_CASCADA]: Ejecutando para Zona '${targetCanonico}'`);

  let todasLasParadas = await obtenerParadasGuardadas();
  if (!todasLasParadas || todasLasParadas.length === 0) {
    todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
  }

  let paradasZona = todasLasParadas.filter((p) => p && obtenerZonaParadaCanonica(p) === targetCanonico);

  if (paradasZona.length <= 1) {
    console.warn("ℹ️ [OPTIMIZADOR_EN_CASCADA]: Insuficientes paradas en la zona para optimizar.");
    console.groupEnd();
    return paradasZona;
  }

  let paradasZonaEnrutadas = null;

  // CASCADA DE INTENTOS
  // 1. INTENTO NIVEL 1: OSRM
  try {
    paradasZonaEnrutadas = await optimizarConOSRM(paradasZona, paradaInicioFix, paradaFinFix);
  } catch (errorOSRM) {
    console.warn("⚠️ [OPTIMIZADOR_EN_CASCADA]: Falló Nivel 1 (OSRM):", errorOSRM.message);

    // 2. INTENTO NIVEL 2: HAVERSINE LOCAL (OFFLINE)
    try {
      paradasZonaEnrutadas = optimizarConHaversineLocal(paradasZona, paradaInicioFix, paradaFinFix);
    } catch (errorHaversine) {
      console.warn("⚠️ [OPTIMIZADOR_EN_CASCADA]: Falló Nivel 2 (Haversine Local):", errorHaversine.message);

      // 3. INTENTO NIVEL 3: GOOGLE MAPS API (RESPALDO COMERCIAL)
      try {
        paradasZonaEnrutadas = await optimizarConGoogleMaps(paradasZona, paradaInicioFix, paradaFinFix);
      } catch (errorGoogle) {
        console.error("❌ [OPTIMIZADOR_EN_CASCADA]: Fallaron los 3 niveles de optimización. Se conserva orden actual:", errorGoogle.message);
        paradasZonaEnrutadas = paradasZona;
      }
    }
  }

  // Persistir y sincronizar la secuencia final resuelta por cualquiera de los métodos
  const resultadoFinal = await aplicarYPersistirNuevoOrden(paradasZonaEnrutadas, todasLasParadas);

  console.log("✅ [OPTIMIZADOR_EN_CASCADA]: Ruta optimizada, agrupada y sincronizada exitosamente.");
  console.groupEnd();

  return resultadoFinal;
}

// INYECCIÓN DIRECTA INMEDIATA EN WINDOW
if (typeof window !== "undefined") {
  window.optimizarRutaPorProximidadZona = optimizarRutaPorProximidadZona;
  window.optimizarProximidadZona = optimizarRutaPorProximidadZona;
  window.optimizarRutaPorProximidad = optimizarRutaPorProximidadZona;
  window.invertirSecuenciaRutaZona = invertirSecuenciaRutaZona;
}