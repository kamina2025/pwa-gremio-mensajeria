/**
 * PROTOCOLO MACONDO - MOTOR DE TELEMETRÍA, ZONIFICACIÓN Y MAPEO HÍBRIDO
 * Ubicación: pwa-bodega/modulos/maps.js
 */

// Estado global de infraestructura telemática
window.marcadoresPersonalizadosRuta = [];
window.poligonosZonasMapa = [];
window.googleMapsOperativo = false;
window.mapa = null;
window.renderRutas = null;
window.geocodificador = null;
window.infoWindowGlobal = null;

// Configuración de Zonas Geográficas (Coordenadas base Cali y alrededores)
const ZONAS_MACONDO = [
  {
    nombre: "ZONA NORTE",
    color: "#00f3ff",
    path: [
      { lat: 3.465, lng: -76.545 },
      { lat: 3.500, lng: -76.515 },
      { lat: 3.475, lng: -76.490 },
      { lat: 3.450, lng: -76.520 }
    ]
  },
  {
    nombre: "ZONA SUR",
    color: "#00ff66",
    path: [
      { lat: 3.410, lng: -76.550 },
      { lat: 3.435, lng: -76.525 },
      { lat: 3.390, lng: -76.510 },
      { lat: 3.360, lng: -76.540 }
    ]
  },
  {
    nombre: "ZONA ORIENTE",
    color: "#ffb700",
    path: [
      { lat: 3.450, lng: -76.515 },
      { lat: 3.465, lng: -76.480 },
      { lat: 3.415, lng: -76.490 },
      { lat: 3.425, lng: -76.515 }
    ]
  },
  {
    nombre: "ZONA OESTE / CENTRO",
    color: "#b359ff",
    path: [
      { lat: 3.440, lng: -76.560 },
      { lat: 3.460, lng: -76.535 },
      { lat: 3.435, lng: -76.530 },
      { lat: 3.420, lng: -76.550 }
    ]
  }
];

/**
 * Genera un ícono SVG de Cajita Cerrada (Drop-Off / Paquete) codificado en URL
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

/**
 * Inicialización principal del Canvas telemático
 */
function inicializarMapaMacondo() {
  console.log(">>> [MAPA_INIT]: Evaluando entorno de hardware...");

  const contenedorMapa = document.getElementById("mapa-telemetria");
  if (!contenedorMapa) {
    console.warn(">>> [MAPA_WAIT]: Contenedor #mapa-telemetria no detectado en el DOM. Posponiendo inicialización.");
    return;
  }

  try {
    if (typeof google === "undefined" || !google.maps) {
      throw new Error("SDK_NOT_AVAILABLE");
    }

    window.geocodificador = new google.maps.Geocoder();
    window.infoWindowGlobal = new google.maps.InfoWindow();

    window.renderRutas = new google.maps.DirectionsRenderer({
      polylineOptions: { strokeColor: "#b359ff", strokeWeight: 4 },
      suppressMarkers: true
    });

    window.mapa = new google.maps.Map(contenedorMapa, {
      center: { lat: 3.4516, lng: -76.532 },
      zoom: 13,
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

    window.renderRutas.setMap(window.mapa);
    window.googleMapsOperativo = true;

    // Renderizar capas vectoriales de zonas
    renderizarZonasEnMapa();

    console.log(">>> [MAPA_READY]: Telemetría y Capas Zonales en línea. Modo ONLINE activado.");

  } catch (e) {
    console.warn(">>> [MAPA_FAIL]: Error al instanciar SDK de Google Maps.", e);
    activarCapaContingenciaOffline();
  }
}

/**
 * Renderiza polígonos estilizados para delimitación de sectores
 */
function renderizarZonasEnMapa() {
  if (!window.mapa) return;

  limpiarZonasDelMapa();

  ZONAS_MACONDO.forEach((zona) => {
    const poligono = new google.maps.Polygon({
      paths: zona.path,
      strokeColor: zona.color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: zona.color,
      fillOpacity: 0.12,
      clickable: false,
      map: window.mapa
    });

    window.poligonosZonasMapa.push(poligono);
  });
}

function limpiarZonasDelMapa() {
  if (window.poligonosZonasMapa && Array.isArray(window.poligonosZonasMapa)) {
    window.poligonosZonasMapa.forEach((p) => p.setMap(null));
    window.poligonosZonasMapa = [];
  }
}

/**
 * Geocodificación por texto de dirección
 */
function localizarDireccionTexto(idInput) {
  const inputEl = document.getElementById(idInput);
  let textoDireccion = inputEl ? inputEl.value.trim() : "";

  if (!textoDireccion) {
    alert(">>> ERROR: Campo vacío. Ingrese una dirección para proyectar.");
    return;
  }

  const CONTEXTO_GEOGRAFICO = ", Cali, Colombia";
  let direccionCompletaConContexto = textoDireccion;
  if (!textoDireccion.toLowerCase().includes("cali") && !textoDireccion.toLowerCase().includes("miranda")) {
    direccionCompletaConContexto = textoDireccion + CONTEXTO_GEOGRAFICO;
  }

  if (window.googleMapsOperativo && window.geocodificador) {
    window.geocodificador.geocode({ address: direccionCompletaConContexto }, (results, status) => {
      if (status === "OK" && results[0]) {
        window.mapa.setCenter(results[0].geometry.location);
        window.mapa.setZoom(16);

        try {
          const nuevoMarcadorBusqueda = new google.maps.Marker({
            map: window.mapa,
            position: results[0].geometry.location,
            draggable: true,
            icon: crearIconoCajitaSVG("#00f3ff", "#ffffff"),
            title: `Punto: ${idInput.includes("origen") ? "Origen Bodega" : "Punto Acopio"}`
          });
          window.marcadoresPersonalizadosRuta.push(nuevoMarcadorBusqueda);
        } catch (markerError) {
          console.log(">>> [INFO]: Omitiendo marcador visual detallado.");
        }

        const origenInput = document.getElementById("origen-cliente")?.value.trim();
        const destinoInput = document.getElementById("dir-cliente")?.value.trim();

        if (origenInput && destinoInput) {
          let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda")
            ? origenInput
            : origenInput + CONTEXTO_GEOGRAFICO;
          let destConContexto = destinoInput.toLowerCase().includes("cali") || destinoInput.toLowerCase().includes("miranda")
            ? destinoInput
            : destinoInput + CONTEXTO_GEOGRAFICO;

          previsualizarRutaInmediata(origConContexto, destConContexto);
        }
      } else {
        console.warn(`>>> [ALERTA_GEOCODER]: Error en resolución de dirección. Status: ${status}`);
        ejecutarContingenciaTarifaria();
      }
    });
  } else {
    ejecutarContingenciaTarifaria();
  }
}

/**
 * Enrutamiento Multi-Punto, Marcadores SVG en Cajita, Ajuste Manual y Tooltips Hover
 */
async function previsualizarRutaInmediata(origen, destinoProvisional) {
  if (!window.googleMapsOperativo || typeof google === "undefined" || !google.maps.DirectionsService) {
    if (typeof ejecutarContingenciaTarifaria === "function") ejecutarContingenciaTarifaria();
    return;
  }

  try {
    const servicioDirecciones = new google.maps.DirectionsService();
    const paradasWaypoints = [];

    if (window.loteActualPedidos && window.loteActualPedidos.length > 0) {
      for (let i = 0; i < window.loteActualPedidos.length; i++) {
        let dirParada = window.loteActualPedidos[i].direccion || window.loteActualPedidos[i].direccionDestino || "";
        if (dirParada && !dirParada.toLowerCase().includes("cali") && !dirParada.toLowerCase().includes("miranda")) {
          dirParada += ", Cali, Colombia";
        }
        if (dirParada) {
          paradasWaypoints.push({ location: dirParada, stopover: true });
        }
      }
    }

    const request = {
      origin: origen || "Cali, Colombia",
      destination: destinoProvisional || (paradasWaypoints.length > 0 ? paradasWaypoints[paradasWaypoints.length - 1].location : origen),
      waypoints: paradasWaypoints.length > 1 ? paradasWaypoints.slice(0, -1) : paradasWaypoints,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING
    };

    const response = await new Promise((resolve, reject) => {
      servicioDirecciones.route(request, (res, status) => {
        if (status === google.maps.DirectionsStatus.OK) resolve(res);
        else reject(status);
      });
    });

    if (window.renderRutas) {
      window.renderRutas.setDirections(response);
    }

    limpiarMarcadoresPersonalizados();

    const rutaGoogle = response.routes[0];
    const bounds = new google.maps.LatLngBounds();

    rutaGoogle.legs.forEach((tramo, indice) => {
      bounds.extend(tramo.start_location);
      bounds.extend(tramo.end_location);

      const esMatrizOrigen = indice === 0;
      const datosPedido = (window.loteActualPedidos && window.loteActualPedidos[indice - 1])
        ? window.loteActualPedidos[indice - 1]
        : null;

      const infoPunto = {
        alias: esMatrizOrigen ? "MATRIZ ORIGEN BODEGA" : (datosPedido?.destinatario || `PUNTO ACOPIO [${indice}]`),
        direccion: tramo.start_address || (datosPedido?.direccion || "Dirección Registrada"),
        telefono: datosPedido?.telefono || "N/A",
        carga: datosPedido?.carga || "Carga Estándar",
        id: datosPedido?.id || (esMatrizOrigen ? "#ORIGEN-0" : `#PNT-${indice}`)
      };

      const colorBox = esMatrizOrigen ? "#b359ff" : "#ff3366";
      const marker = new google.maps.Marker({
        position: tramo.start_location,
        map: window.mapa,
        draggable: true, // Habilita modificación manual de ubicación
        icon: crearIconoCajitaSVG(colorBox, "#ffffff"),
        title: infoPunto.alias
      });

      // HTML del Tooltip / Infowindow Retrofuturista
      const contenidoInfoWindow = `
        <div style="background: #0c080f; color: #fff; padding: 8px 12px; border: 1px solid ${colorBox}; font-family: monospace; font-size: 0.78rem; border-radius: 4px;">
          <strong style="color: ${colorBox}; font-size: 0.85rem;">${infoPunto.id} | ${infoPunto.alias}</strong><br/>
          <span style="color: #aaa;">📍 Dir:</span> ${infoPunto.direccion}<br/>
          <span style="color: #aaa;">📞 Tel:</span> ${infoPunto.telefono}<br/>
          <span style="color: #00ff66;">📦 Detalle:</span> ${infoPunto.carga}
        </div>`;

      // Eventos Hover & Click
      marker.addListener("mouseover", () => {
        if (window.infoWindowGlobal) {
          window.infoWindowGlobal.setContent(contenidoInfoWindow);
          window.infoWindowGlobal.open(window.mapa, marker);
        }
      });

      marker.addListener("mouseout", () => {
        if (window.infoWindowGlobal) window.infoWindowGlobal.close();
      });

      // Evento DragEnd para actualización manual de coordenadas y re-trazado
      marker.addListener("dragend", (event) => {
        const nuevaLat = event.latLng.lat();
        const nuevaLng = event.latLng.lng();
        console.log(`>>> [PUNTO_AJUSTADO]: Nueva posición manual para ${infoPunto.id}:`, nuevaLat, nuevaLng);

        if (window.geocodificador) {
          window.geocodificador.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, (results, status) => {
            if (status === "OK" && results[0]) {
              const nuevaDirString = results[0].formatted_address;
              console.log(`>>> [GEOCODING_INVERSO_OK]: Nueva Dirección: ${nuevaDirString}`);

              if (datosPedido) {
                datosPedido.direccion = nuevaDirString;
                if (typeof window.actualizarTablaCola === "function") window.actualizarTablaCola();
              }
            }
          });
        }
      });

      window.marcadoresPersonalizadosRuta.push(marker);

      // Renderizar punto final de la última pierna
      if (indice === rutaGoogle.legs.length - 1) {
        const datosUltimo = window.loteActualPedidos ? window.loteActualPedidos[window.loteActualPedidos.length - 1] : null;
        const infoFinal = {
          alias: datosUltimo?.destinatario || `PUNTO FINAL [${indice + 1}]`,
          direccion: tramo.end_address || datosUltimo?.direccion || "Destino Final",
          telefono: datosUltimo?.telefono || "N/A",
          carga: datosUltimo?.carga || "Carga Estándar",
          id: datosUltimo?.id || `#PNT-${indice + 1}`
        };

        const markerFinal = new google.maps.Marker({
          position: tramo.end_location,
          map: window.mapa,
          draggable: true,
          icon: crearIconoCajitaSVG("#ff3366", "#ffffff"),
          title: infoFinal.alias
        });

        const contenidoInfoFinal = `
          <div style="background: #0c080f; color: #fff; padding: 8px 12px; border: 1px solid #ff3366; font-family: monospace; font-size: 0.78rem; border-radius: 4px;">
            <strong style="color: #ff3366; font-size: 0.85rem;">${infoFinal.id} | ${infoFinal.alias}</strong><br/>
            <span style="color: #aaa;">📍 Dir:</span> ${infoFinal.direccion}<br/>
            <span style="color: #aaa;">📞 Tel:</span> ${infoFinal.telefono}<br/>
            <span style="color: #00ff66;">📦 Detalle:</span> ${infoFinal.carga}
          </div>`;

        markerFinal.addListener("mouseover", () => {
          if (window.infoWindowGlobal) {
            window.infoWindowGlobal.setContent(contenidoInfoFinal);
            window.infoWindowGlobal.open(window.mapa, markerFinal);
          }
        });

        markerFinal.addListener("mouseout", () => {
          if (window.infoWindowGlobal) window.infoWindowGlobal.close();
        });

        window.marcadoresPersonalizadosRuta.push(markerFinal);
      }
    });

    if (window.mapa) {
      window.mapa.fitBounds(bounds);
      google.maps.event.addListenerOnce(window.mapa, "idle", () => {
        if (window.mapa.getZoom() > 16) window.mapa.setZoom(16);
      });
    }

    let distanciaMetrosTotales = 0;
    let tiempoSegundosTotales = 0;

    for (let i = 0; i < rutaGoogle.legs.length; i++) {
      distanciaMetrosTotales += rutaGoogle.legs[i].distance.value;
      tiempoSegundosTotales += rutaGoogle.legs[i].duration.value;
    }

    const kilometros = distanciaMetrosTotales / 1000;
    const minutos = tiempoSegundosTotales / 60;
    const totalPuntos = window.loteActualPedidos ? window.loteActualPedidos.length : 1;

    if (typeof window.actualizarTableroUI === "function") {
      window.actualizarTableroUI(kilometros, minutos, totalPuntos);
    }

    console.log(`>>> [TELEMETRÍA_MULTIPUNTO]: ${rutaGoogle.legs.length} tramos renderizados con cajitas SVG y ajuste dinámico activado.`);
  } catch (err) {
    console.warn(">>> [FALLO_MULTIPUNTO]: Conmutando a contingencia local de trazado.", err);
    if (typeof ejecutarContingenciaTarifaria === "function") ejecutarContingenciaTarifaria();
  }
}

function limpiarMarcadoresPersonalizados() {
  if (window.marcadoresPersonalizadosRuta && Array.isArray(window.marcadoresPersonalizadosRuta)) {
    window.marcadoresPersonalizadosRuta.forEach((m) => {
      if (m && typeof m.setMap === "function") m.setMap(null);
    });
    window.marcadoresPersonalizadosRuta = [];
  }
}

function limpiarGraficosDelMapa() {
  console.log(">>> [MAPA_PURGE]: Removiendo trazos de telemetría y pines del lote anterior...");

  if (window.renderRutas) {
    window.renderRutas.setDirections({ routes: [] });
  }

  limpiarMarcadoresPersonalizados();

  if (window.mapa) {
    window.mapa.setCenter({ lat: 3.4516, lng: -76.532 });
    window.mapa.setZoom(13);
  }
}

function ejecutarContingenciaTarifaria() {
  const totalPuntos = window.loteActualPedidos ? window.loteActualPedidos.length : 1;
  const kmEstimados = 2.5 * totalPuntos;
  const minEstimados = 8 * totalPuntos;

  if (typeof window.actualizarTableroUI === "function") {
    window.actualizarTableroUI(kmEstimados, minEstimados, totalPuntos);
  }
}

function activarCapaContingenciaOffline() {
  window.googleMapsOperativo = false;
  const panelMapa = document.getElementById("mapa-telemetria");
  if (panelMapa) {
    panelMapa.innerHTML = `
      <div style="color: #b359ff; text-align: center; padding-top: 80px; font-size: 0.85rem; font-family: monospace; background: #0c080f; height: 100%; box-sizing: border-box;">
        [MODO_CONTINGENCIA_BODEGA_ACTIVO]<br/>
        <span style="font-size: 0.75rem; color: #79578a;">Telemetría por vectores locales activa</span>
      </div>`;
  }
  if (typeof ejecutarContingenciaTarifaria === "function") {
    ejecutarContingenciaTarifaria();
  }
}

window.gm_authFailure = function () {
  console.error(">>> [MAPS_AUTH_ERROR]: La API Key de Google Maps fue rechazada.");
  activarCapaContingenciaOffline();
};

// Exposición en el Scope Global
window.inicializarMapaMacondo = inicializarMapaMacondo;
window.localizarDireccionTexto = localizarDireccionTexto;
window.previsualizarRutaInmediata = previsualizarRutaInmediata;
window.limpiarGraficosDelMapa = limpiarGraficosDelMapa;
window.activarCapaContingenciaOffline = activarCapaContingenciaOffline;