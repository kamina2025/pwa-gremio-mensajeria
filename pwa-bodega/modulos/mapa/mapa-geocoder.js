/**
 * PROTOCOLO MACONDO - GEOCODIFICACIÓN Y RESOLUCIÓN DE VECTORES
 * Ubicación: pwa-bodega/modulos/mapa/mapa-geocoder.js
 */

import { crearIconoCajitaSVG, generarTemplateInfoWindow } from "./mapa-iconos.js";

/**
 * Geocodifica una dirección de texto ingresada en un input HTML y centra la cámara del mapa.
 */
export function localizarDireccionTexto(idInput) {
  const inputEl = typeof idInput === "string" ? document.getElementById(idInput) : idInput;
  let textoDireccion = inputEl ? inputEl.value.trim() : (typeof idInput === "string" ? idInput : "");

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
        if (window.mapa) {
          window.mapa.setCenter(results[0].geometry.location);
          window.mapa.setZoom(16);
        }

        try {
          const esOrigen = typeof idInput === "string" && idInput.includes("origen");
          const infoPuntoTemp = {
            id: esOrigen ? "#ORIGEN-TMP" : "#PNT-TMP",
            alias: esOrigen ? "Origen Bodega" : "Punto Buscado",
            direccion: results[0].formatted_address || direccionCompletaConContexto,
            telefono: "N/A",
            carga: "Ubicación Geocodificada"
          };

          const colorPin = esOrigen ? "#00f3ff" : "#ffaa00";
          const nuevoMarcadorBusqueda = new google.maps.Marker({
            map: window.mapa,
            position: results[0].geometry.location,
            draggable: true,
            icon: crearIconoCajitaSVG(colorPin, "#ffffff"),
            title: infoPuntoTemp.alias
          });

          const contenidoInfoWindow = generarTemplateInfoWindow(infoPuntoTemp, colorPin);

          nuevoMarcadorBusqueda.addListener("mouseover", () => {
            if (window.infoWindowGlobal) {
              window.infoWindowGlobal.setContent(contenidoInfoWindow);
              window.infoWindowGlobal.open(window.mapa, nuevoMarcadorBusqueda);
            }
          });

          nuevoMarcadorBusqueda.addListener("mouseout", () => {
            if (window.infoWindowGlobal) window.infoWindowGlobal.close();
          });

          if (!window.marcadoresPersonalizadosRuta) {
            window.marcadoresPersonalizadosRuta = [];
          }
          window.marcadoresPersonalizadosRuta.push(nuevoMarcadorBusqueda);
        } catch (markerError) {
          console.log(">>> [INFO]: Omitiendo marcador visual detallado en geocodificación.", markerError);
        }

        const origenInput = document.getElementById("origen-cliente")?.value.trim();
        const destinoInput = document.getElementById("dir-cliente")?.value.trim();

        if (origenInput && destinoInput && typeof window.previsualizarRutaInmediata === "function") {
          let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda")
            ? origenInput
            : origenInput + CONTEXTO_GEOGRAFICO;
          let destConContexto = destinoInput.toLowerCase().includes("cali") || destinoInput.toLowerCase().includes("miranda")
            ? destinoInput
            : destinoInput + CONTEXTO_GEOGRAFICO;

          window.previsualizarRutaInmediata(origConContexto, destConContexto);
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
 * Aplica el cálculo telemático por contingencia cuando el servicio de Google Maps no responde.
 */
export function ejecutarContingenciaTarifaria() {
  const totalPuntos = window.loteActualPedidos ? window.loteActualPedidos.length : 1;
  const kmEstimados = 2.5 * totalPuntos;
  const minEstimados = 8 * totalPuntos;

  if (typeof window.actualizarTableroUI === "function") {
    window.actualizarTableroUI(kmEstimados, minEstimados, totalPuntos);
  }
}

/**
 * Activa la interfaz de fallback offline visual cuando falla la inicialización de mapas.
 */
export function activarCapaContingenciaOffline() {
  window.googleMapsOperativo = false;
  const panelMapa = document.getElementById("mapa-telemetria");
  if (panelMapa) {
    panelMapa.innerHTML = `
      <div style="color: #b359ff; text-align: center; padding-top: 80px; font-size: 0.85rem; font-family: monospace; background: #0c080f; height: 100%; box-sizing: border-box;">
        [MODO_CONTINGENCIA_BODEGA_ACTIVO]<br/>
        <span style="font-size: 0.75rem; color: #79578a;">Telemetría por vectores locales activa</span>
      </div>`;
  }
  ejecutarContingenciaTarifaria();
}

// Registro global
window.localizarDireccionTexto = localizarDireccionTexto;
window.ejecutarContingenciaTarifaria = ejecutarContingenciaTarifaria;
window.activarCapaContingenciaOffline = activarCapaContingenciaOffline;