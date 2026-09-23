/**
 * Módulo de Optimización de Rutas mediante Google Maps Directions API
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-optimizacion.js
 */

import { normalizarClaveZona } from "./rutas-normalizador.js";
import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

function obtenerIdUnicoParada(p) {
  if (!p) return "";
  return String(p.id || p.ssc || p.idParada || p.id_parada || "").trim();
}

export async function optimizarRutaPorProximidadZona(zonaKeyInput, paradaInicioFix = null, paradaFinFix = null) {
  if (!zonaKeyInput) return [];

  const targetCanónico = estandarizarZonaCanonica(zonaKeyInput);
  const targetLimpio = normalizarClaveZona(targetCanónico);

  console.group(`⚡ [OPTIMIZADOR_GOOGLE]: Optimizando vía Google Directions API para: '${targetCanónico}'`);

  let todasLasParadas = await obtenerParadasGuardadas();
  if (!todasLasParadas || todasLasParadas.length === 0) {
    todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
  }

  let paradasZona = todasLasParadas.filter((p) => p && obtenerZonaParadaCanonica(p) === targetCanónico);

  if (paradasZona.length <= 1) {
    console.warn("ℹ️ [OPTIMIZADOR_GOOGLE]: Insuficientes paradas en la zona.");
    console.groupEnd();
    return paradasZona;
  }

  if (typeof google === "undefined" || !google.maps || !google.maps.DirectionsService) {
    console.error("❌ [OPTIMIZADOR_GOOGLE]: SDK de Google Maps no disponible.");
    console.groupEnd();
    return paradasZona;
  }

  // Configuración de Origen y Destino
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

  const waypointsGoogle = intermedias.map((p) => ({
    location: new google.maps.LatLng(parseFloat(p.lat || p.latitud), parseFloat(p.lng || p.longitud)),
    stopover: true
  }));

  const origenLatLng = new google.maps.LatLng(parseFloat(origen.lat || origen.latitud), parseFloat(origen.lng || origen.longitud));
  const destinoLatLng = new google.maps.LatLng(parseFloat(destino.lat || destino.latitud), parseFloat(destino.lng || destino.longitud));

  const directionsService = new google.maps.DirectionsService();
  const request = {
    origin: origenLatLng,
    destination: destinoLatLng,
    waypoints: waypointsGoogle,
    optimizeWaypoints: true,
    travelMode: google.maps.TravelMode.DRIVING
  };

  try {
    const response = await new Promise((resolve, reject) => {
      directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) resolve(result);
        else reject(status);
      });
    });

    const ordenOptimizadoIndices = response.routes[0].waypoint_order;
    console.log("🧩 [OPTIMIZADOR_GOOGLE]: Secuencia devuelta:", ordenOptimizadoIndices);

    const secuenciaOptimizada = [origen];
    ordenOptimizadoIndices.forEach((indexDevuelto) => secuenciaOptimizada.push(intermedias[indexDevuelto]));
    
    if (obtenerIdUnicoParada(origen) !== obtenerIdUnicoParada(destino)) {
      secuenciaOptimizada.push(destino);
    }

    // Actualizar atributos de secuencia
    const mapaNuevosOrdenes = new Map();
    secuenciaOptimizada.forEach((p, idx) => {
      const nuevoNumero = idx + 1;
      p.secuenciaZona = nuevoNumero;
      p.orden = nuevoNumero;
      p.secuencia = nuevoNumero;
      p.updated_at = new Date().toISOString();
      mapaNuevosOrdenes.set(obtenerIdUnicoParada(p), p);
      console.log(` 📍 [#${nuevoNumero}] -> ${p.destinatario || p.cliente}`);
    });

    // Ensamblar y ordenar físicamente la lista global
    let listaGlobalActualizada = todasLasParadas.map(p => {
      const idUnico = obtenerIdUnicoParada(p);
      return mapaNuevosOrdenes.has(idUnico) ? mapaNuevosOrdenes.get(idUnico) : p;
    });

    // ORDENAMIENTO GLOBAL OBLIGATORIO
    listaGlobalActualizada.sort((a, b) => {
      const seqA = parseInt(a.secuenciaZona || a.orden || a.secuencia || 0, 10);
      const seqB = parseInt(b.secuenciaZona || b.orden || b.secuencia || 0, 10);
      return seqA - seqB;
    });

    await guardarRutaZonificada(listaGlobalActualizada);
    window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
    window.paradasMemoriaLocal = [...listaGlobalActualizada];

    // Trazado vial de Google Maps (curvas y calles reales)
    const mapaInstancia = window.mapaInstanciaGlobal || window.__MAPA_INSTANCE__;
    if (mapaInstancia) {
      if (!window.__DIRECTIONS_RENDERER__) {
        window.__DIRECTIONS_RENDERER__ = new google.maps.DirectionsRenderer({
          map: mapaInstancia,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#00e5ff", strokeWeight: 4, strokeOpacity: 0.8 }
        });
      } else {
        window.__DIRECTIONS_RENDERER__.setMap(mapaInstancia);
      }
      window.__DIRECTIONS_RENDERER__.setDirections(response);
    }

    if (typeof window.actualizarPuntosEnMapa === "function") {
      window.actualizarPuntosEnMapa(listaGlobalActualizada, 0);
    }

    if (typeof window.renderizarParadasZonificadasUI === "function") {
      await window.renderizarParadasZonificadasUI(listaGlobalActualizada);
    }

    console.groupEnd();
    return secuenciaOptimizada;

  } catch (error) {
    console.error("❌ [OPTIMIZADOR_GOOGLE]: Error calculando ruta:", error);
    console.groupEnd();
    return paradasZona;
  }
}

window.optimizarRutaPorProximidadZona = optimizarRutaPorProximidadZona;