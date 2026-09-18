/**
 * PROTOCOLO MACONDO - EVENTOS Y SELECCIÓN SOBRE EL MAPA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-eventos.js
 */

import { crearIconoParadaRadarSVG } from "./mapa-iconos.js";

let modoCrearParadaActivo = false;
let listenerClicMapa = null;
let marcadorBusquedaTemp = null; // Guardará el marcador generado por la búsqueda

/**
 * Alterna la visibilidad del campo de búsqueda e interactúa con la lupa.
 */
export function toggleBuscadorMapaUI() {
    const input = document.getElementById("input-mapa-buscar-dir");
    if (!input) return;

    const texto = input.value.trim();

    // Si ya está visible y contiene texto, al presionar la lupa ejecuta la búsqueda
    if (input.style.display === "block" && texto.length > 0) {
        ejecutarBusquedaDireccion(texto);
        return;
    }

    const estaOculto = input.style.display === "none" || input.style.display === "";
    input.style.display = estaOculto ? "block" : "none";

    if (estaOculto) {
        input.focus();
        vincularEventoEnterBusqueda(input);
    }
}

/**
 * Registra la pulsación de la tecla Enter dentro del input de búsqueda.
 */
function vincularEventoEnterBusqueda(inputElement) {
    if (inputElement.dataset.listenerCargado) return;
    inputElement.dataset.listenerCargado = "true";

    inputElement.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            ejecutarBusquedaDireccion(inputElement.value.trim());
        }
    });
}

/**
 * Geocodifica la dirección con Google Maps Geocoder, centra el visor,
 * coloca un PIN interactivo REUBICABLE (draggable) y permite ajustar su ubicación exacta.
 */
export function ejecutarBusquedaDireccion(direccion) {
    if (!direccion) return;
    if (typeof google === "undefined" || !google.maps || !window.mapaMensajero) {
        console.warn("[BUSQUEDA_MAPA_WARN]: El visor de Google Maps no está inicializado.");
        return;
    }

    const geocoder = new google.maps.Geocoder();
    const query = direccion.toLowerCase().includes("cali") ? direccion : `${direccion}, Cali, Colombia`;

    geocoder.geocode({ address: query }, (results, status) => {
        if (status === "OK" && results[0]) {
            let ubicacionActual = results[0].geometry.location;
            let dirFormateada = results[0].formatted_address;

            // Centrar el mapa en las coordenadas encontradas
            window.mapaMensajero.setCenter(ubicacionActual);
            window.mapaMensajero.setZoom(16);

            // Limpiar marcador de búsqueda anterior si existe
            if (marcadorBusquedaTemp) {
                marcadorBusquedaTemp.setMap(null);
            }

            // Crear el marcador (PIN) con propiedad Draggable activada
            marcadorBusquedaTemp = new google.maps.Marker({
                position: ubicacionActual,
                map: window.mapaMensajero,
                draggable: true, // 👈 PERMITE REUBICAR EL PIN SI NO CORRESPONDE
                icon: crearIconoParadaRadarSVG("#ff007f", "#ffffff"), // Magenta neón
                title: `📍 ${dirFormateada} (Arrastra para corregir ubicación)`
            });

            // Función auxiliar para renderizar el contenido del Popup InfoWindow
            const actualizarInfoWindow = (direccionTexto) => {
                if (window.infoWindowMensajero) {
                    const infoContent = `
                        <div style="background: #0c080f; color: #fff; padding: 6px 10px; border: 1px solid #ff007f; font-family: monospace; font-size: 0.78rem; border-radius: 4px; text-align: center;">
                            <strong style="color: #ff007f;">[📍 UBICACIÓN SELECCIONADA]</strong><br/>
                            <span style="display:inline-block; margin: 3px 0; color: #e0e0e0;">${direccionTexto}</span><br/>
                            <small style="color: #00ff66;">👉 Clic en el PIN o en el botón para agregar</small><br/>
                            <small style="color: #aaa; font-size: 0.68rem;">🖐️ Puedes arrastrar el PIN si no es exacto</small><br/>
                            <button type="button" onclick="window.confirmarParadaDesdePinBusqueda()" style="margin-top: 6px; background: #ff007f; color: #fff; border: none; padding: 4px 8px; font-weight: bold; font-size: 0.72rem; cursor: pointer; border-radius: 3px; width: 100%;">
                                ➕ DESPLEGAR FORMULARIO
                            </button>
                        </div>`;
                    window.infoWindowMensajero.setContent(infoContent);
                    window.infoWindowMensajero.open(window.mapaMensajero, marcadorBusquedaTemp);
                }
            };

            actualizarInfoWindow(dirFormateada);

            // BINDING GLOBAL PARA EL BOTÓN DENTRO DEL POPUP
            window.confirmarParadaDesdePinBusqueda = function() {
                const pos = marcadorBusquedaTemp.getPosition();
                desplegarFormularioConDireccion(dirFormateada, pos.lat(), pos.lng());
            };

            // 1. EVENTO REUBICACIÓN (DRAGEND): Actualiza coordenadas y dirección al soltar el pin
            marcadorBusquedaTemp.addListener("dragend", (event) => {
                const nuevaLat = event.latLng.lat();
                const nuevaLng = event.latLng.lng();

                // Reverse Geocoding para actualizar el texto de la dirección al mover el pin
                geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, (revResults, revStatus) => {
                    if (revStatus === "OK" && revResults[0]) {
                        dirFormateada = revResults[0].formatted_address;
                        actualizarInfoWindow(dirFormateada);
                        console.log(`>>> [PIN_REUBICADO]: Nueva dirección: ${dirFormateada} [${nuevaLat}, ${nuevaLng}]`);
                    } else {
                        dirFormateada = `Coordenadas: ${nuevaLat.toFixed(5)}, ${nuevaLng.toFixed(5)}`;
                        actualizarInfoWindow(dirFormateada);
                    }
                });
            });

            // 2. EVENTO CLIC EN EL PIN: Despliega el formulario inmediatamente
            marcadorBusquedaTemp.addListener("click", () => {
                const pos = marcadorBusquedaTemp.getPosition();
                desplegarFormularioConDireccion(dirFormateada, pos.lat(), pos.lng());
            });

            console.log(`>>> [BUSQUEDA_MAPA_OK]: PIN interactivo visualizado en ${dirFormateada}`);
        } else {
            alert(">>> [ALERTA]: No se logró ubicar la dirección ingresada en el mapa.");
        }
    });
}

/**
 * Carga la dirección capturada en el formulario, conmuta la pestaña a la vista de edición y despliega el acordeón.
 */
function desplegarFormularioConDireccion(direccion, lat, lng) {
    if (typeof window.navegarA === "function") {
        window.navegarA("vistas/ruta/ruta-activa.html");
    } else {
        const pestanaRuta = document.getElementById("pestana-ruta-activa");
        if (pestanaRuta) {
            document.querySelectorAll(".contenedor-pestana").forEach((p) => p.classList.remove("activa"));
            document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));
            pestanaRuta.classList.add("activa");
        }
    }

    setTimeout(() => {
        const inputDir = document.getElementById("edit-parada-direccion");
        const detailsForm = document.getElementById("details-formulario-parada");

        if (inputDir) {
            inputDir.value = direccion;
        }

        if (detailsForm) {
            detailsForm.open = true;
            detailsForm.scrollIntoView({ behavior: "smooth" });
        }

        // Enfocar el campo del destinatario para agilizar la escritura
        const inputDestinatario = document.getElementById("edit-parada-destinatario");
        if (inputDestinatario) {
            inputDestinatario.focus();
        }
    }, 120);
}

/**
 * Alterna el modo para añadir paradas haciendo clic sobre el mapa.
 */
export function activarModoSeleccionMapaUI() {
    modoCrearParadaActivo = !modoCrearParadaActivo;
    const btn = document.getElementById("btn-modo-crear-parada");

    if (btn) {
        btn.style.background = modoCrearParadaActivo ? "var(--neon-green, #00ff66)" : "";
        btn.style.color = modoCrearParadaActivo ? "#000" : "";
        btn.innerText = modoCrearParadaActivo ? "[🎯 SELECCIONE EN MAPA]" : "➕ CREAR PARADA";
    }
}

/**
 * Registra el evento de clic sobre el mapa (export requerido por mapa-visor.js).
 */
export function registrarEventosClicMapa(callbackNuevaParada) {
    if (!window.mapaMensajero) return;

    if (listenerClicMapa) {
        google.maps.event.removeListener(listenerClicMapa);
        listenerClicMapa = null;
    }

    listenerClicMapa = window.mapaMensajero.addListener("click", (e) => {
        if (!modoCrearParadaActivo) return;

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
                desplegarFormularioConDireccion(results[0].formatted_address, lat, lng);
            }
        });

        activarModoSeleccionMapaUI();
    });
}

// Registro explícito en el objeto global window para handlers HTML inline
window.toggleBuscadorMapaUI = toggleBuscadorMapaUI;
window.activarModoSeleccionMapaUI = activarModoSeleccionMapaUI;
window.ejecutarBusquedaDireccion = ejecutarBusquedaDireccion;
window.registrarEventosClicMapa = registrarEventosClicMapa;