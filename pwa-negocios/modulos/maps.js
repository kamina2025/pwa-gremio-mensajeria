/**
 * PROTOCOLO MACONDO - MOTOR DE TELEMETRÍA Y MAPEO HÍBRIDO (VECTORES CORREGIDOS)
 * Ubicación: pwa-negocios/modulos/maps.js
 */

// Array global unificado en memoria para limpiar marcadores viejos y evitar duplicados
window.marcadoresPersonalizadosRuta = [];

function inicializarMapaMacondo() {
  console.log(">>> [MAPA_INIT]: Evaluando entorno de hardware...");

  try {
    if (typeof google === "undefined" || !google.maps) {
      throw new Error("SDK_NOT_AVAILABLE");
    }

    window.geocodificador = new google.maps.Geocoder();
    
    // --- BLINDAJE VISUAL CRÍTICO ---
    // Activamos suppressMarkers: true. Google traza la línea violeta, pero NO pinta letras locas (A, B, D...)
    window.renderRutas = new google.maps.DirectionsRenderer({
      polylineOptions: { strokeColor: "#b359ff", strokeWeight: 4 }, 
      suppressMarkers: true 
    });

    window.mapa = new google.maps.Map(document.getElementById("mapa-telemetria"), {
      center: { lat: 3.4516, lng: -76.5320 }, // Centro operativo Cali base
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
  let textoDireccion = document.getElementById(idInput).value.trim();
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
          // SE CORRIGE: Ahora guardamos este pin temporal en el array global para poder removerlo al compilar
          const nuevoMarcadorBusqueda = new google.maps.Marker({
            map: window.mapa,
            position: results[0].geometry.location,
            title: `Punto: ${idInput.includes("origen") ? "Origen" : "Destino"}`
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
        if (typeof evaluarTarifaModoLocalInmediata === "function") evaluarTarifaModoLocalInmediata();
      }
    });
  } else {
    console.warn(">>> [OFFLINE_CONVERGENCE]: Operando ruteo local autónomo.");
    if (typeof evaluarTarifaModoLocalInmediata === "function") evaluarTarifaModoLocalInmediata();
  }
}

// Logística Multi-Parada con Renderizado de Pines Propios y Sincronizados
async function previsualizarRutaInmediata(origen, destinoProvisional) {
  if (!window.googleMapsOperativo || typeof google === 'undefined' || !google.maps.DirectionsService) return;

  try {
    const servicioDirecciones = new google.maps.DirectionsService();
    const paradasWaypoints = [];
    
    if (window.loteActualPedidos && window.loteActualPedidos.length > 0) {
      for (let i = 0; i < window.loteActualPedidos.length; i++) {
        let dirParada = window.loteActualPedidos[i].direccion;
        if (!dirParada.toLowerCase().includes("cali") && !dirParada.toLowerCase().includes("miranda")) {
          dirParada += ", Cali, Colombia";
        }
        paradasWaypoints.push({ location: dirParada, stopover: true });
      }
    }

    const request = {
      origin: origen,
      destination: destinoProvisional,
      waypoints: paradasWaypoints,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(Date.now()),
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      }
    };

    const response = await new Promise((resolve, reject) => {
      servicioDirecciones.route(request, (res, status) => {
        if (status === google.maps.DirectionsStatus.OK) resolve(res);
        else reject(status);
      });
    });

    // 1. Pintar la línea violeta neón en el mapa
    if (window.renderRutas) {
      window.renderRutas.setDirections(response);
    }

    // 2. LIMPIEZA DE PINES ANTERIORES PRE-TRAZADO
    window.marcadoresPersonalizadosRuta.forEach(m => { if (m) m.setMap(null); });
    window.marcadoresPersonalizadosRuta = [];

    // 3. RENDERIZADO DE PINES PROPIOS SIN LETRAS CONFUSAS
    const rutaGoogle = response.routes[0];
    
    rutaGoogle.legs.forEach((tramo, indice) => {
      let pinTitulo = "";
      let pinColorUrl = "http://maps.google.com/mapfiles/ms/icons/red-dot.png"; // Marcador rojo estándar limpio

      if (indice === 0) {
        pinTitulo = "ORIGEN: Base del Comercio";
        pinColorUrl = "http://maps.google.com/mapfiles/ms/icons/purple-dot.png"; // Marcador violeta para el comercio
      } else {
        pinTitulo = `PARADA [${String.fromCharCode(64 + indice)}]: Destinatario Asignado`;
      }

      const nuevoMarker = new google.maps.Marker({
        position: tramo.start_location,
        map: window.mapa,
        title: pinTitulo,
        icon: pinColorUrl
      });

      window.marcadoresPersonalizadosRuta.push(nuevoMarker);

      if (indice === rutaGoogle.legs.length - 1) {
        const markerFinal = new google.maps.Marker({
          position: tramo.end_location,
          map: window.mapa,
          title: `PARADA [${String.fromCharCode(65 + indice)}]: Destino Final Provisional`,
          icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
        });
        window.marcadoresPersonalizadosRuta.push(markerFinal);
      }
    });

    // 4. Calcular métricas globales para el tablero financiero
    let distanciaMetrosTotales = 0;
    let tiempoSegundosTotales = 0;
    
    for (let i = 0; i < rutaGoogle.legs.length; i++) {
      distanciaMetrosTotales += rutaGoogle.legs[i].distance.value;
      tiempoSegundosTotales += rutaGoogle.legs[i].duration_in_traffic ? rutaGoogle.legs[i].duration_in_traffic.value : rutaGoogle.legs[i].duration.value;
    }

    const kilometros = distanciaMetrosTotales / 1000;
    const minutos = tiempoSegundosTotales / 60;
    const entregasTotales = (window.loteActualPedidos ? window.loteActualPedidos.length : 0) + 1;

    if (typeof actualizarTableroUI === "function") {
      actualizarTableroUI(kilometros, minutes, entregasTotales, response);
    }

    console.log(`>>> [TELEMETRÍA_MULTIPUNTO]: Pines propios sincronizados. Total tramos: ${rutaGoogle.legs.length}`);

  } catch (err) {
    console.warn(">>> [FALLO_MULTIPUNTO]: Conmutando a contingencia local.", err);
    if (typeof evaluarTarifaModoLocalInmediata === "function") evaluarTarifaModoLocalInmediata();
  }
}

function activarCapaContingenciaOffline() {
  window.googleMapsOperativo = false;
  const panelMapa = document.getElementById("mapa-telemetria");
  if (panelMapa) {
    panelMapa.innerHTML = `<div style="color: #b359ff; text-align: center; padding-top: 100px; font-size: 0.8rem; font-family: monospace;">[MODO_OFFLINE_SOBERANO_ACTIVO]</div>`;
  }
}

/**
 * PROTOCOLO MACONDO - PURGADOR ABSOLUTO DE INFRAESTRUCTURA VISUAL
 * Sincronizado exactamente con las variables activas del hardware de Google Maps
 */
function limpiarGraficosDelMapa() {
    console.log(">>> [MAPA_PURGE]: Removiendo trazos de telemetría y pines del lote anterior...");

    // 1. Limpiar líneas poligonales de ruta (usando la variable real: window.renderRutas)
    if (window.renderRutas) {
        window.renderRutas.setDirections({ routes: [] });
        window.renderRutas.setMap(null); // Cortar render
        window.renderRutas.setMap(window.mapa); // Re-asentar vacío
    }

    // 2. Remover físicamente todos los marcadores del chasis del mapa
    if (window.marcadoresPersonalizadosRuta && Array.isArray(window.marcadoresPersonalizadosRuta)) {
        window.marcadoresPersonalizadosRuta.forEach(marcador => {
            if (marcador && typeof marcador.setMap === "function") {
                marcador.setMap(null); // Quitar de la pantalla
            }
        });
        window.marcadoresPersonalizadosRuta = []; // Vaciar memoria
    }

    // 3. Devolver la cámara a la base operativa principal de Cali
    if (window.mapa) {
        window.mapa.setCenter({ lat: 3.4516, lng: -76.5320 });
        window.mapa.setZoom(14);
    }
}

// Vinculación definitiva al scope global
window.limpiarGraficosDelMapa = limpiarGraficosDelMapa;

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof google === "undefined") {
      inicializarMapaMacondo();
    }
  }, 1000);
});