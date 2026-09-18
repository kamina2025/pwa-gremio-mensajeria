/**
 * PROTOCOLO MACONDO - EVENTOS Y SELECCIÓN SOBRE EL MAPA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-eventos.js
 */

let modoCrearParadaActivo = false;
let listenerClicMapa = null;

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
 * Geocodifica la dirección con Google Maps Geocoder y centra el visor.
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
            const ubicacion = results[0].geometry.location;
            window.mapaMensajero.setCenter(ubicacion);
            window.mapaMensajero.setZoom(16);
            console.log(`>>> [BUSQUEDA_MAPA_OK]: Centrado en ${results[0].formatted_address}`);
        } else {
            alert(">>> [ALERTA]: No se logró ubicar la dirección ingresada en el mapa.");
        }
    });
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
                const destinatario = prompt("Nombre del Destinatario para esta parada:", "Cliente Nuevo");
                if (destinatario) {
                    const nuevaParada = {
                        id: "PARADA_" + Date.now(),
                        destinatario: destinatario,
                        direccion: results[0].formatted_address,
                        lat: lat,
                        lng: lng,
                        estado: "PENDIENTE"
                    };
                    if (typeof callbackNuevaParada === "function") {
                        callbackNuevaParada(nuevaParada);
                    }
                }
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