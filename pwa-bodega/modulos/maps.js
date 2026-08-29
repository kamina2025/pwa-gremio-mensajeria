/**
 * PROTOCOLO MACONDO - MOTOR DE TELEMETRÍA Y MAPEO HÍBRIDO (BODEGA/PUNTOS)
 * Ubicación: pwa-bodega/modulos/maps.js
 */

// Array global unificado en memoria para limpiar marcadores viejos
window.marcadoresPersonalizadosRuta = [];

function inicializarMapaMacondo() {
  console.log(">>> [MAPA_INIT]: Evaluando entorno de hardware...");

  try {
    if (typeof google === "undefined" || !google.maps) {
      throw new Error("SDK_NOT_AVAILABLE");
    }

    window.geocodificador = new google.maps.Geocoder();
    
    // Configuración del renderizador de polígonos
    window.renderRutas = new google.maps.DirectionsRenderer({
      polylineOptions: { strokeColor: "#b359ff", strokeWeight: 4 }, 
      suppressMarkers: true 
    });

    window.mapa = new google.maps.Map(document.getElementById("mapa-telemetria"), {
      center: { lat: 3.4516, lng: -76.5320 }, // Centro operativo base (Cali)
      zoom: 14,
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

    window.mapa.addListener("tilesloaded", () => {
      console.log(">>> [MAPA_READY]: Telemetría en línea verificada. Modo ONLINE activado.");
      window.googleMapsOperativo = true;
    });
  } catch (e) {
    activarCapaContingenciaOffline();
  }
}

// Inyección de Contexto Geográfico para mitigar ambigüedades vectoriales
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
            title: `Punto: ${idInput.includes("origen") ? "Origen Bodega" : "Punto Acopio"}`
          });
          window.marcadoresPersonalizadosRuta.push(nuevoMarcadorBusqueda);
        } catch (markerError) {
          console.log(">>> [INFO]: Omitiendo marcador visual detallado.");
        }

        console.log(`>>> [GEOCODING_OK]: Enfoque de cámara en: ${direccionCompletaConContexto}`);

        const origenInput = document.getElementById("origen-cliente")?.value.trim();
        const destinoInput = document.getElementById("dir-cliente")?.value.trim();

        if (origenInput && destinoInput) {
          let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda") ? origenInput : origenInput + CONTEXTO_GEOGRAFICO;
          let destConContexto = destinoInput.toLowerCase().includes("cali") || destinoInput.toLowerCase().includes("miranda") ? destinoInput : destinoInput + CONTEXTO_GEOGRAFICO;

          console.log(">>> [TELEMETRÍA]: Trazando ruta con vectores sanitizados...");
          previsualizarRutaInmediata(origConContexto, destConContexto);
        }
      } else {
        console.warn(`>>> [ALERTA_GEOCODER]: Error en resolución de dirección. Status: ${status}`);
        ejecutarContingenciaTarifaria();
      }
    });
  } else {
    console.warn(">>> [OFFLINE_CONVERGENCE]: Operando ruteo local autónomo.");
    ejecutarContingenciaTarifaria();
  }
}

// Logística Multi-Punto con Renderizado de Pines Propios y Sincronizados
async function previsualizarRutaInmediata(origen, destinoProvisional) {
  if (!window.googleMapsOperativo || typeof google === 'undefined' || !google.maps.DirectionsService) {
    ejecutarContingenciaTarifaria();
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
      origin: origen,
      destination: destinoProvisional || origen,
      waypoints: paradasWaypoints,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING
    };

    const response = await new Promise((resolve, reject) => {
      servicioDirecciones.route(request, (res, status) => {
        if (status === google.maps.DirectionsStatus.OK) resolve(res);
        else reject(status);
      });
    });

    // 1. Renderizar la traza en el mapa
    if (window.renderRutas) {
      window.renderRutas.setDirections(response);
    }

    // 2. Limpieza de marcadores previos
    window.marcadoresPersonalizadosRuta.forEach(m => { if (m) m.setMap(null); });
    window.marcadoresPersonalizadosRuta = [];

    // 3. Renderizado de pines personalizados
    const rutaGoogle = response.routes[0];
    
    rutaGoogle.legs.forEach((tramo, indice) => {
      let pinTitulo = indice === 0 ? "MATRIZ: Bodega Principal" : `PUNTO ACOPIO [${indice}]`;
      let pinIcono = indice === 0 
        ? "http://maps.google.com/mapfiles/ms/icons/purple-dot.png" 
        : "http://maps.google.com/mapfiles/ms/icons/red-dot.png";

      const nuevoMarker = new google.maps.Marker({
        position: tramo.start_location,
        map: window.mapa,
        title: pinTitulo,
        icon: pinIcono
      });

      window.marcadoresPersonalizadosRuta.push(nuevoMarker);

      if (indice === rutaGoogle.legs.length - 1) {
        const markerFinal = new google.maps.Marker({
          position: tramo.end_location,
          map: window.mapa,
          title: `PUNTO FINAL [${indice + 1}]`,
          icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
        });
        window.marcadoresPersonalizadosRuta.push(markerFinal);
      }
    });

    // 4. Calcular métricas telemáticas y ejecutar actualización de UI de Bodega
    let distanciaMetrosTotales = 0;
    let tiempoSegundosTotales = 0;
    
    for (let i = 0; i < rutaGoogle.legs.length; i++) {
      distanciaMetrosTotales += rutaGoogle.legs[i].distance.value;
      tiempoSegundosTotales += rutaGoogle.legs[i].duration.value;
    }

    const kilometros = distanciaMetrosTotales / 1000;
    const minutos = tiempoSegundosTotales / 60; // Variable corregida (evita ReferenceError)
    const totalPuntos = window.loteActualPedidos ? window.loteActualPedidos.length : 1;

    if (typeof window.actualizarTableroUI === "function") {
      window.actualizarTableroUI(kilometros, minutos, totalPuntos);
    }

    console.log(`>>> [TELEMETRÍA_MULTIPUNTO]: Puntos renderizados. Tramos totales: ${rutaGoogle.legs.length}`);

  } catch (err) {
    console.warn(">>> [FALLO_MULTIPUNTO]: Conmutando a contingencia local.", err);
    ejecutarContingenciaTarifaria();
  }
}

// Ejecuta la actualización de interfaz de respaldo sin colapsar el pipeline financiero
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
    panelMapa.innerHTML = `<div style="color: #b359ff; text-align: center; padding-top: 100px; font-size: 0.8rem; font-family: monospace;">[MODO_OFFLINE_BODEGA_ACTIVO]</div>`;
  }
}

function limpiarGraficosDelMapa() {
  console.log(">>> [MAPA_PURGE]: Removiendo trazos de telemetría y pines del lote anterior...");

  if (window.renderRutas) {
    window.renderRutas.setDirections({ routes: [] });
    window.renderRutas.setMap(null);
    window.renderRutas.setMap(window.mapa);
  }

  if (window.marcadoresPersonalizadosRuta && Array.isArray(window.marcadoresPersonalizadosRuta)) {
    window.marcadoresPersonalizadosRuta.forEach(marcador => {
      if (marcador && typeof marcador.setMap === "function") {
        marcador.setMap(null);
      }
    });
    window.marcadoresPersonalizadosRuta = [];
  }

  if (window.mapa) {
    window.mapa.setCenter({ lat: 3.4516, lng: -76.5320 });
    window.mapa.setZoom(14);
  }
}

// Vinculación al scope global
window.localizarDireccionTexto = localizarDireccionTexto;
window.previsualizarRutaInmediata = previsualizarRutaInmediata;
window.limpiarGraficosDelMapa = limpiarGraficosDelMapa;

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof google === "undefined") {
      inicializarMapaMacondo();
    }
  }, 1000);
});