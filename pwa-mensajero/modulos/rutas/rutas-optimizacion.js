/**
 * PROTOCOLO MACONDO - OPTIMIZADOR DE RUTAS Y PROXIMIDAD GOOGLE MAPS
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-optimizacion.js
 * Arquitectura: Local-First / Fallback Geodésico Offline
 */

import { normalizarClaveZona } from "./rutas-normalizador.js";
import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";
import { calcularDistanciaHaversine } from "../mapa/zonificacion/mensajero-zonificacion.js";

/**
 * Extrae o construye un identificador único para una parada dada.
 * @param {Object} p 
 * @returns {string}
 */
function obtenerIdUnicoParada(p) {
  if (!p) return "";
  return String(p.id || p.ssc || p.idParada || p.id_parada || "").trim();
}

/**
 * Garantiza la extracción de coordenadas numéricas válidas.
 * @param {Object} p 
 * @returns {{lat: number, lng: number}|null}
 */
function obtenerCoordenadasValidas(p) {
  if (!p) return null;
  const lat = parseFloat(p.lat || p.latitud);
  const lng = parseFloat(p.lng || p.longitud);
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
  return { lat, lng };
}

/**
 * Optimiza la secuencia de visitas de paradas dentro de una zona específica
 * utilizando la API clásica DirectionsService de Google Maps con fallback geodésico Haversine.
 * 
 * @param {string} zonaKeyInput - Clave o nombre de la zona a optimizar
 * @param {Object|null} [paradaInicioFix=null] - Parada fijada como origen
 * @param {Object|null} [paradaFinFix=null] - Parada fijada como destino
 * @returns {Promise<Array<Object>>} Lista de paradas en el nuevo orden optimizado
 */
export async function optimizarRutaPorProximidadZona(zonaKeyInput, paradaInicioFix = null, paradaFinFix = null) {
  if (!zonaKeyInput) return [];

  const targetCanonico = estandarizarZonaCanonica(zonaKeyInput);
  const targetLimpio = normalizarClaveZona(targetCanonico);

  console.group(`⚡ [OPTIMIZADOR_GOOGLE]: Optimizando vía Google Maps API para: '${targetCanonico}'`);

  // 1. Obtener la colección global de paradas (Memoria / Persistencia)
  let todasLasParadas = await obtenerParadasGuardadas();
  if (!todasLasParadas || todasLasParadas.length === 0) {
    todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
  }

  // 2. Filtrar las paradas correspondientes a la zona solicitada
  let paradasZona = todasLasParadas.filter((p) => p && obtenerZonaParadaCanonica(p) === targetCanonico);

  if (paradasZona.length <= 1) {
    console.warn("ℹ️ [OPTIMIZADOR_GOOGLE]: Insuficientes paradas en la zona para realizar optimización.");
    console.groupEnd();
    return paradasZona;
  }

  // 3. Comprobar disponibilidad del SDK clásico de Google Maps
  const gMapsListo = typeof google !== "undefined" && google && google.maps && google.maps.DirectionsService;
  if (!gMapsListo) {
    console.warn("⚠️ [OPTIMIZADOR_GOOGLE]: SDK de Google Maps no disponible. Ejecutando fallback Haversine offline...");
    const resultadoFallback = await optimizarFallbackHaversine(paradasZona, paradaInicioFix, todasLasParadas);
    console.groupEnd();
    return resultadoFallback;
  }

  // 4. Configurar Origen, Destino e Intermedias
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
    console.warn("⚠️ [OPTIMIZADOR_GOOGLE]: Coordenadas inválidas en Origen o Destino. Recayendo a Fallback Haversine...");
    const resultadoFallback = await optimizarFallbackHaversine(paradasZona, paradaInicioFix, todasLasParadas);
    console.groupEnd();
    return resultadoFallback;
  }

  // Construcción de Waypoints mapeados y filtrados
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

  const origenLatLng = new google.maps.LatLng(coordsOrigen.lat, coordsOrigen.lng);
  const destinoLatLng = new google.maps.LatLng(coordsDestino.lat, coordsDestino.lng);

  try {
    let ordenOptimizadoIndices = [];
    let directionsResult = null;

    // Ejecutar servicio DirectionsService clásico
    const directionsService = new google.maps.DirectionsService();
    const request = {
      origin: origenLatLng,
      destination: destinoLatLng,
      waypoints: waypointsGoogle,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING
    };

    directionsResult = await new Promise((resolve, reject) => {
      directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK || status === "OK") resolve(result);
        else reject(status);
      });
    });

    if (directionsResult && directionsResult.routes && directionsResult.routes[0]) {
      ordenOptimizadoIndices = directionsResult.routes[0].waypoint_order || [];
    }

    console.log("🧩 [OPTIMIZADOR_GOOGLE]: Secuencia de waypoints devuelta por Google:", ordenOptimizadoIndices);

    // 5. Reconstruir la secuencia ordenada de la zona
    const secuenciaOptimizada = [origen];
    ordenOptimizadoIndices.forEach((indexDevuelto) => {
      if (intermedias[indexDevuelto]) {
        secuenciaOptimizada.push(intermedias[indexDevuelto]);
      }
    });

    if (obtenerIdUnicoParada(origen) !== obtenerIdUnicoParada(destino)) {
      secuenciaOptimizada.push(destino);
    }

    // 6. Actualizar atributos numéricos de secuencia de forma atómica
    const mapaNuevosOrdenes = new Map();
    secuenciaOptimizada.forEach((p, idx) => {
      const nuevoNumero = idx + 1;
      p.secuenciaZona = nuevoNumero;
      p.orden = nuevoNumero;
      p.secuencia = nuevoNumero;
      p.updated_at = new Date().toISOString();
      mapaNuevosOrdenes.set(obtenerIdUnicoParada(p), p);
      console.log(` 📍 [#${nuevoNumero}] -> ${p.destinatario || p.cliente || p.nombre_cliente}`);
    });

    // 7. Ensamblar y ordenar físicamente la lista global de paradas
    let listaGlobalActualizada = todasLasParadas.map(p => {
      const idUnico = obtenerIdUnicoParada(p);
      return mapaNuevosOrdenes.has(idUnico) ? mapaNuevosOrdenes.get(idUnico) : p;
    });

    // Ordenamiento global obligatorio
    listaGlobalActualizada.sort((a, b) => {
      const seqA = parseInt(a.secuenciaZona || a.orden || a.secuencia || 0, 10);
      const seqB = parseInt(b.secuenciaZona || b.orden || b.secuencia || 0, 10);
      return seqA - seqB;
    });

    // 8. Persistir cambios localmente y sincronizar todas las memorias RAM
    await guardarRutaZonificada(listaGlobalActualizada);
    window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
    window.paradasMemoriaLocal = [...listaGlobalActualizada];
    window.paradasRutaActiva = [...listaGlobalActualizada];
    window.pedidosGlobales = [...listaGlobalActualizada];

    // 9. Trazado vial oficial sobre el visor con DirectionsRenderer
    const mapaInstancia = window.mapaInstanciaGlobal || window.mapaMensajero || window.mapaInstancia;
    if (mapaInstancia && directionsResult) {
      if (!window.__DIRECTIONS_RENDERER__) {
        window.__DIRECTIONS_RENDERER__ = new google.maps.DirectionsRenderer({
          map: mapaInstancia,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#00e5ff", strokeWeight: 5, strokeOpacity: 0.9 }
        });
      } else {
        window.__DIRECTIONS_RENDERER__.setMap(mapaInstancia);
      }
      window.__DIRECTIONS_RENDERER__.setDirections(directionsResult);
    }

    // 10. Refrescar marcadores interactivos y UI de acordeones
    if (typeof window.actualizarPuntosEnMapa === "function") {
      window.actualizarPuntosEnMapa(listaGlobalActualizada, 0);
    }

    if (typeof window.renderizarParadasZonificadasUI === "function") {
      await window.renderizarParadasZonificadasUI(listaGlobalActualizada);
    }

    console.groupEnd();
    return secuenciaOptimizada;

  } catch (error) {
    console.error("❌ [OPTIMIZADOR_GOOGLE]: Error calculando ruta con Google. Ejecutando fallback Haversine...", error);
    const resultadoFallback = await optimizarFallbackHaversine(paradasZona, paradaInicioFix, todasLasParadas);
    console.groupEnd();
    return resultadoFallback;
  }
}

/**
 * Algoritmo de reserva por proximidad (Vecino más cercano / Haversine) para uso Offline local-first.
 * 
 * @param {Array<Object>} paradasZona - Paradas de la zona a ordenar
 * @param {Object|null} puntoInicio - Parada inicial fijada
 * @param {Array<Object>} todasLasParadas - Colección global completa
 * @returns {Promise<Array<Object>>}
 */
async function optimizarFallbackHaversine(paradasZona, puntoInicio, todasLasParadas) {
  console.log("📐 [FALLBACK_HAVERSINE]: Ejecutando reordenamiento geométrico por proximidad...");
  
  let pendientes = [...paradasZona];
  let actual = puntoInicio || pendientes.shift();
  let resultado = [actual];

  pendientes = pendientes.filter(p => obtenerIdUnicoParada(p) !== obtenerIdUnicoParada(actual));

  while (pendientes.length > 0) {
    const coordsA = obtenerCoordenadasValidas(actual);
    if (!coordsA) {
      actual = pendientes.shift();
      if (actual) resultado.push(actual);
      continue;
    }

    let idxMasCercano = 0;
    let distMinima = Infinity;

    pendientes.forEach((p, idx) => {
      const coordsB = obtenerCoordenadasValidas(p);
      if (coordsB) {
        const d = calcularDistanciaHaversine(coordsA.lat, coordsA.lng, coordsB.lat, coordsB.lng);
        if (d < distMinima) {
          distMinima = d;
          idxMasCercano = idx;
        }
      }
    });

    actual = pendientes.splice(idxMasCercano, 1)[0];
    if (actual) resultado.push(actual);
  }

  // Actualizar atributo de secuencia numérico
  const mapaNuevosOrdenes = new Map();
  resultado.forEach((p, idx) => {
    const nuevoNumero = idx + 1;
    p.secuenciaZona = nuevoNumero;
    p.orden = nuevoNumero;
    p.secuencia = nuevoNumero;
    p.updated_at = new Date().toISOString();
    mapaNuevosOrdenes.set(obtenerIdUnicoParada(p), p);
  });

  // Re-ensamblar globalmente
  let listaGlobalActualizada = todasLasParadas.map(p => {
    const idUnico = obtenerIdUnicoParada(p);
    return mapaNuevosOrdenes.has(idUnico) ? mapaNuevosOrdenes.get(idUnico) : p;
  });

  listaGlobalActualizada.sort((a, b) => {
    const seqA = parseInt(a.secuenciaZona || a.orden || a.secuencia || 0, 10);
    const seqB = parseInt(b.secuenciaZona || b.orden || b.secuencia || 0, 10);
    return seqA - seqB;
  });

  // Guardar en persistencia y memoria RAM
  await guardarRutaZonificada(listaGlobalActualizada);
  window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
  window.paradasMemoriaLocal = [...listaGlobalActualizada];
  window.paradasRutaActiva = [...listaGlobalActualizada];
  window.pedidosGlobales = [...listaGlobalActualizada];

  if (typeof window.actualizarPuntosEnMapa === "function") {
    window.actualizarPuntosEnMapa(listaGlobalActualizada, 0);
  }

  if (typeof window.renderizarParadasZonificadasUI === "function") {
    await window.renderizarParadasZonificadasUI(listaGlobalActualizada);
  }

  console.log("✅ [FALLBACK_HAVERSINE]: Secuencia offline reordenada y persistida.");
  return resultado;
}

// BINDINGS GLOBALES LEGACY
window.optimizarRutaPorProximidadZona = optimizarRutaPorProximidadZona;
window.optimizarRutaPorProximidad = optimizarRutaPorProximidadZona;