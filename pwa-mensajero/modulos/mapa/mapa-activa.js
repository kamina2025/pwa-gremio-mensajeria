let modoCrearParadaActivo = false;

// 1. Mostrar/Ocultar el input de la Lupa
window.toggleBuscadorMapaUI = function() {
    const input = document.getElementById("input-mapa-buscar-dir");
    if (input) {
        input.style.display = input.style.display === "none" ? "block" : "none";
        if (input.style.display === "block") input.focus();
    }
};

// 2. Activar modo selección en mapa para añadir paradas
window.activarModoSeleccionMapaUI = function() {
    modoCrearParadaActivo = !modoCrearParadaActivo;
    const btn = document.getElementById("btn-modo-crear-parada");
    if (btn) {
        btn.style.background = modoCrearParadaActivo ? "var(--neon-green, #00ff66)" : "";
        btn.style.color = modoCrearParadaActivo ? "#000" : "";
    }
};

// 3. Listener de Clics sobre el lienzo de Google Maps
export function registrarEventosClicMapa() {
    if (!window.mapaMensajero) return;

    window.mapaMensajero.addListener("click", (e) => {
        if (!modoCrearParadaActivo) return;

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
                const nuevaDireccion = results[0].formatted_address;
                
                // Prompt o modal para registrar destinatario rápida
                const destinatario = prompt("Nombre del Destinatario para esta parada:", "Cliente Nuevo");
                if (destinatario) {
                    const nuevaParada = {
                        id: "PARADA_" + Date.now(),
                        destinatario: destinatario,
                        direccion: nuevaDireccion,
                        lat: lat,
                        lng: lng,
                        estado: "PENDIENTE"
                    };
                    
                    // Guardar en la estructura local y refrescar marcadores
                    if (typeof window.agregarParadaLocal === "function") {
                        window.agregarParadaLocal(nuevaParada);
                    }
                }
            }
        });

        // Desactivar modo creación tras seleccionar
        activarModoSeleccionMapaUI();
    });
}