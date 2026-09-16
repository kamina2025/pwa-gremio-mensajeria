/**
 * PROTOCOLO MACONDO - EVENTOS Y SELECCIÓN SOBRE EL MAPA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-eventos.js
 */

let modoCrearParadaActivo = false;

export function toggleBuscadorMapaUI() {
    const input = document.getElementById("input-mapa-buscar-dir");
    if (input) {
        input.style.display = input.style.display === "none" ? "block" : "none";
        if (input.style.display === "block") input.focus();
    }
}

export function activarModoSeleccionMapaUI() {
    modoCrearParadaActivo = !modoCrearParadaActivo;
    const btn = document.getElementById("btn-modo-crear-parada");
    if (btn) {
        btn.style.background = modoCrearParadaActivo ? "var(--neon-green, #00ff66)" : "";
        btn.style.color = modoCrearParadaActivo ? "#000" : "";
    }
}

export function registrarEventosClicMapa(callbackNuevaParada) {
    if (!window.mapaMensajero) return;

    window.mapaMensajero.addListener("click", (e) => {
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

window.toggleBuscadorMapaUI = toggleBuscadorMapaUI;
window.activarModoSeleccionMapaUI = activarModoSeleccionMapaUI;