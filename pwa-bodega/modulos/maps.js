/**
 * PROTOCOLO MACONDO - MOTOR DE TELEMETRÍA Y MAPEO HÍBRIDO (BODEGA/PUNTOS)
 * Ubicación: pwa-bodega/modulos/maps.js
 */

window.googleMapsOperativo = false;
window.marcadoresPersonalizadosRuta = window.marcadoresPersonalizadosRuta || [];
window.mapa = null;
window.renderRutas = null;
window.geocodificador = null;
window.infoWindowGlobal = null;
window.origenBodegaCoords = null; // Instancia nativa google.maps.LatLng para el origen

/**
 * Utilidades de Iconografía Vectorial SVG e InfoWindows
 */
function crearIconoCajitaSVG(colorFill = "#b359ff", colorStroke = "#ffffff") {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="14" rx="2" fill="${colorFill}" stroke="${colorStroke}" stroke-width="1.5" />
      <path d="M3 10H21" stroke="${colorStroke}" stroke-width="1.5" stroke-dasharray="2 2" />
      <path d="M12 7V21" stroke="${colorStroke}" stroke-width="1.5" />
      <path d="M7 7L12 10L17 7" stroke="${colorStroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="14" r="1.5" fill="${colorStroke}" />
    </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16)
  };
}

function generarTemplateInfoWindow(infoPunto, colorBox) {
  return `
    <div style="background: #0c080f; color: #fff; padding: 8px 12px; border: 1px solid ${colorBox}; font-family: monospace; font-size: 0.78rem; border-radius: 4px;">
      <strong style="color: ${colorBox}; font-size: 0.85rem;">${infoPunto.id} | ${infoPunto.alias}</strong><br/>
      <span style="color: #aaa;">📍 Dir:</span> ${infoPunto.direccion}<br/>
      <span style="color: #aaa;">📞 Tel:</span> ${infoPunto.telefono}<br/>
      <span style="color: #00ff66;">📦 Detalle:</span> ${infoPunto.carga}
    </div>`;
}

function inicializarMapaMacondo() {
  console.log(">>> [MAPA_INIT]: Evaluando entorno de hardware...");
  const contenedorMapa = document.getElementById("mapa-telemetria");

  if (!contenedorMapa || typeof google === "undefined" || !google.maps) {
    console.warn(">>> [MAPA_WARN]: Entorno de mapas o contenedor #mapa-telemetria no disponible en el DOM.");
    return;
  }

  try {
    window.geocodificador = new google.maps.Geocoder();
    window.infoWindowGlobal = new google.maps.InfoWindow();

    const centroCali = { lat: 3.4516, lng: -76.5320 };

    window.mapa = new google.maps.Map(contenedorMapa, {
      zoom: 13,
      center: centroCali,
      disableDefaultUI: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0c080f" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0c080f" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#79578a" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#191321" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#291f33" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#040205" }] }
      ]
    });

    window.renderRutas = new google.maps.DirectionsRenderer({
      map: window.mapa,
      suppressMarkers: true,
      polylineOptions: { strokeColor: "#b359ff", strokeOpacity: 0.8, strokeWeight: 4 }
    });

    window.googleMapsOperativo = true;
    console.log(">>> [MAPA_READY]: Telemetría en línea verificada. Modo ONLINE activado.");

    desplegarCapasZonificacion();

  } catch (e) {
    console.error(">>> [MAPA_ERROR]: Falló la inicialización del lienzo de mapas.", e);
  }
}

function desplegarCapasZonificacion() {
  if (!window.mapa || !window.googleMapsOperativo) return;

  const fnRender = window.renderizarZonasEnMapa || window.cargarZonasEnMapa;

  if (typeof fnRender === "function") {
    try {
      fnRender(window.mapa);
      console.log(">>> [ZONAS_SUCCESS]: Capas de zonificación GeoJSON inyectadas correctamente en la instancia.");
    } catch (err) {
      console.error(">>> [ZONAS_FAIL]: Error al dibujar capas GeoJSON en el mapa:", err);
    }
  } else {
    import('./mapa-zonas.js')
      .then((moduloZonas) => {
        if (moduloZonas && (moduloZonas.renderizarZonasEnMapa || moduloZonas.cargarZonasEnMapa)) {
          const renderFn = moduloZonas.renderizarZonasEnMapa || moduloZonas.cargarZonasEnMapa;
          renderFn(window.mapa);
          console.log(">>> [ZONAS_DYNAMIC_SUCCESS]: Módulo cargado dinámicamente e inyectado.");
        }
      })
      .catch(() => {
        console.warn(">>> [ZONAS_RETRY]: Esperando exposición global de mapa-zonas.js...");
        setTimeout(desplegarCapasZonificacion, 500);
      });
  }
}

function normalizarUbicacion(param, defectoTexto = "Cali, Colombia") {
  if (!param) return defectoTexto;
  if (typeof param === "object" && typeof param.lat === "number" && typeof param.lng === "number") {
    return new google.maps.LatLng(param.lat, param.lng);
  }
  if (typeof param === "object" && typeof param.lat === "function" && typeof param.lng === "function") {
    return param;
  }
  if (typeof param === "string") {
    const pLower = param.toLowerCase();
    if (pLower.includes("cali") || pLower.includes("miranda")) return param;
    return param + ", Cali, Colombia";
  }
  return defectoTexto;
}

function localizarDireccionTexto(idInput) {
  const inputEl = document.getElementById(idInput);
  let textoDireccion = inputEl ? inputEl.value.trim() : "";

  if (!textoDireccion) {
    alert(">>> ERROR: Campo vacío. Ingrese una dirección para proyectar.");
    return;
  }

  const direccionCompleta = normalizarUbicacion(textoDireccion);

  if (window.googleMapsOperativo && window.geocodificador) {
    window.geocodificador.geocode({ address: direccionCompleta }, (results, status) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        window.mapa.setCenter(loc);
        window.mapa.setZoom(16);

        const esOrigen = idInput.includes("origen");
        if (esOrigen) {
          window.origenBodegaCoords = loc;
        }

        const origenInput = document.getElementById("origen-cliente")?.value.trim();
        const destinoInput = document.getElementById("dir-cliente")?.value.trim();

        if (origenInput && destinoInput && typeof window.previsualizarRutaInmediata === "function") {
          window.previsualizarRutaInmediata(origenInput, destinoInput);
        }
      } else {
        alert(">>> ALERTA TELEMETRÍA: No se pudo geolocalizar la dirección ingresada.");
      }
    });
  }
}

async function previsualizarRutaInmediata(origen, destinoProvisional) {
  if (!window.mapa || !window.googleMapsOperativo || typeof google === "undefined" || !google.maps.DirectionsService) {
    return;
  }

  // Pre-procesamiento de puntos en memoria
  const paradasWaypoints = [];
  const listaPedidos = window.loteActualPedidos || [];

  for (let i = 0; i < listaPedidos.length; i++) {
    let p = listaPedidos[i];
    let loc = null;

    if (p.lat && p.lng) {
      loc = new google.maps.LatLng(Number(p.lat), Number(p.lng));
    } else if (p.direccion || p.direccionDestino) {
      loc = normalizarUbicacion(p.direccion || p.direccionDestino);
    }

    if (loc) {
      paradasWaypoints.push({ location: loc, stopover: true, datosPedido: p });
    }
  }

  let origenCalculado = window.origenBodegaCoords || normalizarUbicacion(origen, "Cali, Colombia");
  let destinoCalculado = normalizarUbicacion(destinoProvisional, null);

  if (!destinoCalculado) {
    if (paradasWaypoints.length > 0) {
      destinoCalculado = paradasWaypoints[paradasWaypoints.length - 1].location;
    } else {
      destinoCalculado = origenCalculado;
    }
  }

  const servicioDirecciones = new google.maps.DirectionsService();
  const requestWaypoints = paradasWaypoints.length > 1 ? paradasWaypoints.slice(0, -1).map(w => ({ location: w.location, stopover: true })) : [];

  const request = {
    origin: origenCalculado,
    destination: destinoCalculado,
    waypoints: requestWaypoints,
    optimizeWaypoints: false,
    travelMode: google.maps.TravelMode.DRIVING
  };

  let responseRuta = null;
  try {
    responseRuta = await new Promise((resolve, reject) => {
      servicioDirecciones.route(request, (res, status) => {
        if (status === google.maps.DirectionsStatus.OK) resolve(res);
        else reject(status);
      });
    });
  } catch (err) {
    console.warn(">>> [ROUTE_WARN]: No se pudo trazar la polílinea vial en Google Maps. Renderizando marcadores directos...", err);
  }

  // Limpieza de marcadores anteriores
  limpiarGraficosDelMapa();

  const bounds = new google.maps.LatLngBounds();

  // SI GOOGLE MAPS RESOLVIÓ LA RUTA VIAL
  if (responseRuta && responseRuta.routes && responseRuta.routes[0]) {
    if (window.renderRutas) {
      window.renderRutas.setDirections(responseRuta);
    }

    const rutaGoogle = responseRuta.routes[0];

    rutaGoogle.legs.forEach((tramo, indice) => {
      bounds.extend(tramo.start_location);
      bounds.extend(tramo.end_location);

      const esMatrizOrigen = indice === 0;
      const datosPedido = (listaPedidos && listaPedidos[indice - 1]) ? listaPedidos[indice - 1] : null;

      const infoPunto = {
        alias: esMatrizOrigen ? "MATRIZ ORIGEN BODEGA" : (datosPedido?.destinatario || `PUNTO ACOPIO [${indice}]`),
        direccion: tramo.start_address || (datosPedido?.direccion || "Dirección Registrada"),
        telefono: datosPedido?.telefono || "N/A",
        carga: datosPedido?.carga || "Carga Estándar",
        id: datosPedido?.id || (esMatrizOrigen ? "#ORIGEN-0" : `#PNT-${indice}`)
      };

      const colorBox = esMatrizOrigen ? "#b359ff" : "#ff3366";
      const marker = crearMarcadorInteractivos(tramo.start_location, colorBox, infoPunto, esMatrizOrigen, datosPedido);
      window.marcadoresPersonalizadosRuta.push(marker);

      if (indice === rutaGoogle.legs.length - 1) {
        const datosUltimo = listaPedidos ? listaPedidos[listaPedidos.length - 1] : null;
        const infoFinal = {
          alias: datosUltimo?.destinatario || `PUNTO FINAL [${indice + 1}]`,
          direccion: tramo.end_address || (datosUltimo?.direccion || "Destino Final"),
          telefono: datosUltimo?.telefono || "N/A",
          carga: datosUltimo?.carga || "Carga Estándar",
          id: datosUltimo?.id || `#PNT-${indice + 1}`
        };

        const markerFinal = crearMarcadorInteractivos(tramo.end_location, "#ff3366", infoFinal, false, datosUltimo);
        window.marcadoresPersonalizadosRuta.push(markerFinal);
      }
    });

    let distanciaMetrosTotales = 0;
    let tiempoSegundosTotales = 0;
    rutaGoogle.legs.forEach((leg) => {
      distanciaMetrosTotales += leg.distance.value;
      tiempoSegundosTotales += leg.duration.value;
    });

    if (typeof window.actualizarTableroUI === "function") {
      window.actualizarTableroUI(distanciaMetrosTotales / 1000, tiempoSegundosTotales / 60, listaPedidos.length || 1);
    }

  } else {
    // FALLBACK DIRECTO: Dibuja los puntos directamente en sus coordenadas sin trazo de línea si DirectionsService falla
    const posOrigen = (typeof origenCalculado === "object") ? origenCalculado : new google.maps.LatLng(3.4516, -76.5320);
    bounds.extend(posOrigen);

    const markerOrigen = crearMarcadorInteractivos(posOrigen, "#b359ff", {
      alias: "MATRIZ ORIGEN BODEGA",
      direccion: "Origen Bodega",
      telefono: "N/A",
      carga: "Matriz Origen",
      id: "#ORIGEN-0"
    }, true, null);
    window.marcadoresPersonalizadosRuta.push(markerOrigen);

    paradasWaypoints.forEach((wp, idx) => {
      const pos = wp.location;
      bounds.extend(pos);
      const datosP = wp.datosPedido;

      const markerPunto = crearMarcadorInteractivos(pos, "#ff3366", {
        alias: datosP?.destinatario || `PUNTO ACOPIO [${idx + 1}]`,
        direccion: datosP?.direccion || "Punto de Acopio",
        telefono: datosP?.telefono || "N/A",
        carga: datosP?.carga || "Carga Estándar",
        id: datosP?.id || `#PNT-${idx + 1}`
      }, false, datosP);
      window.marcadoresPersonalizadosRuta.push(markerPunto);
    });
  }

  if (window.mapa) {
    window.mapa.fitBounds(bounds);
    google.maps.event.addListenerOnce(window.mapa, "idle", () => {
      if (window.mapa.getZoom() > 16) window.mapa.setZoom(16);
    });
  }
}

function crearMarcadorInteractivos(position, colorBox, infoPunto, esMatrizOrigen, datosPedido) {
  const marker = new google.maps.Marker({
    position: position,
    map: window.mapa,
    draggable: true,
    icon: crearIconoCajitaSVG(colorBox, "#ffffff"),
    title: infoPunto.alias
  });

  const contenidoInfoWindow = generarTemplateInfoWindow(infoPunto, colorBox);

  marker.addListener("mouseover", () => {
    if (window.infoWindowGlobal) {
      window.infoWindowGlobal.setContent(contenidoInfoWindow);
      window.infoWindowGlobal.open(window.mapa, marker);
    }
  });

  marker.addListener("mouseout", () => {
    if (window.infoWindowGlobal) window.infoWindowGlobal.close();
  });

  // Re-ubicación inmediata al soltar el marcador (dragend)
  marker.addListener("dragend", (event) => {
    const nuevaLat = event.latLng.lat();
    const nuevaLng = event.latLng.lng();
    const nuevaPosicionLatLng = new google.maps.LatLng(nuevaLat, nuevaLng);

    if (esMatrizOrigen) {
      window.origenBodegaCoords = nuevaPosicionLatLng;
    } else if (datosPedido) {
      datosPedido.lat = nuevaLat;
      datosPedido.lng = nuevaLng;
    }

    if (window.geocodificador) {
      window.geocodificador.geocode({ location: nuevaPosicionLatLng }, (results, status) => {
        if (status === "OK" && results[0]) {
          const nuevaDirString = results[0].formatted_address;
          if (esMatrizOrigen) {
            const origenEl = document.getElementById("origen-cliente");
            if (origenEl) origenEl.value = nuevaDirString;
          } else if (datosPedido) {
            datosPedido.direccion = nuevaDirString;
            if (typeof window.actualizarTablaCola === "function") window.actualizarTablaCola();
          }
        }

        const origenAct = window.origenBodegaCoords || document.getElementById("origen-cliente")?.value.trim() || "Cali, Colombia";
        let destinoAct = origenAct;

        if (window.loteActualPedidos && window.loteActualPedidos.length > 0) {
          const uPed = window.loteActualPedidos[window.loteActualPedidos.length - 1];
          destinoAct = (uPed.lat && uPed.lng) ? new google.maps.LatLng(Number(uPed.lat), Number(uPed.lng)) : uPed.direccion;
        }

        previsualizarRutaInmediata(origenAct, destinoAct);
      });
    } else {
      previsualizarRutaInmediata(window.origenBodegaCoords || "Cali, Colombia", nuevaPosicionLatLng);
    }
  });

  return marker;
}

function limpiarGraficosDelMapa() {
  if (window.renderRutas) {
    window.renderRutas.setDirections({ routes: [] });
  }
  if (window.marcadoresPersonalizadosRuta && Array.isArray(window.marcadoresPersonalizadosRuta)) {
    window.marcadoresPersonalizadosRuta.forEach(m => {
      if (m && typeof m.setMap === "function") m.setMap(null);
    });
    window.marcadoresPersonalizadosRuta = [];
  }
}

// Inyección explícita global
window.inicializarMapaMacondo = inicializarMapaMacondo;
window.desplegarCapasZonificacion = desplegarCapasZonificacion;
window.localizarDireccionTexto = localizarDireccionTexto;
window.previsualizarRutaInmediata = previsualizarRutaInmediata;
window.limpiarGraficosDelMapa = limpiarGraficosDelMapa;