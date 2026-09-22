// pwa-mensajero/modulos/mapa/mapa-activa.js

let modoCrearParadaActivo = false;
let trazadoRutaPolyline = null;
let marcadoresMapa = [];

// 1. Mostrar/Ocultar el input de la Lupa
window.toggleBuscadorMapaUI = function () {
    const input = document.getElementById("input-mapa-buscar-dir");
    if (input) {
        input.style.display = input.style.display === "none" ? "block" : "none";
        if (input.style.display === "block") input.focus();
    }
    console.log("[MapaUI] Toggle buscador dirección:", input ? input.style.display : "no encontrado");
};

// 2. Activar modo selección en mapa para añadir paradas
window.activarModoSeleccionMapaUI = function () {
    modoCrearParadaActivo = !modoCrearParadaActivo;
    const btn = document.getElementById("btn-modo-crear-parada");
    if (btn) {
        btn.style.background = modoCrearParadaActivo ? "var(--neon-green, #00ff66)" : "";
        btn.style.color = modoCrearParadaActivo ? "#000" : "";
    }
    console.log("[MapaUI] Modo selección de parada activo:", modoCrearParadaActivo);
};

// 3. Listener de Clics sobre el lienzo de Google Maps
export function registrarEventosClicMapa() {
    if (!window.mapaMensajero) {
        console.warn("[Mapa] Instancia de Google Maps (window.mapaMensajero) no detectada.");
        return;
    }

    window.mapaMensajero.addListener("click", (e) => {
        if (!modoCrearParadaActivo) return;

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        console.log(`[Mapa] Clic detectado para crear parada en Lat: ${lat}, Lng: ${lng}`);

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
                const nuevaDireccion = results[0].formatted_address;

                // Prompt o modal para registrar destinatario rápido
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

                    console.log("[Mapa] Nueva parada creada desde clic:", nuevaParada);

                    // Guardar en la estructura local y refrescar marcadores
                    if (typeof window.agregarParadaLocal === "function") {
                        window.agregarParadaLocal(nuevaParada);
                    }
                }
            } else {
                console.error("[Mapa] Geocoder falló debido a:", status);
            }
        });

        // Desactivar modo creación tras seleccionar
        activarModoSeleccionMapaUI();
    });
}

/**
 * 4. Dibujar / Actualizar Trazado de Ruta y Marcadores por Zona o Secuencia Reordenada
 * @param {string} zonaFilter - Filtro de zona opcional
 * @param {Array} listaParadas - Arreglo de paradas ordenadas
 */
export function actualizarTrazadoMapa(zonaFilter = null, listaParadas = []) {
    if (!window.mapaMensajero) return;

    console.log(`[Mapa] Actualizando trazado. Zona: ${zonaFilter || 'GLOBAL'}, Total Paradas: ${listaParadas.length}`);

    // Limpiar marcadores existentes
    marcadoresMapa.forEach(marker => marker.setMap(null));
    marcadoresMapa = [];

    // Limpiar polyline previa
    if (trazadoRutaPolyline) {
        trazadoRutaPolyline.setMap(null);
    }

    const pathCoordinates = [];
    const bounds = new google.maps.LatLngBounds();

    listaParadas.forEach((parada, index) => {
        if (parada.lat && parada.lng) {
            const pos = { lat: parseFloat(parada.lat), lng: parseFloat(parada.lng) };
            pathCoordinates.push(pos);
            bounds.extend(pos);

            const marker = new google.maps.Marker({
                position: pos,
                map: window.mapaMensajero,
                title: `#${index + 1} - ${parada.destinatario || 'Parada'}`,
                label: {
                    text: `${index + 1}`,
                    color: "#0d1117",
                    fontWeight: "bold"
                }
            });

            marcadoresMapa.push(marker);
        }
    });

    // Dibujar línea conectora neón
    if (pathCoordinates.length > 0) {
        trazadoRutaPolyline = new google.maps.Polyline({
            path: pathCoordinates,
            geodesic: true,
            strokeColor: "#00e5ff",
            strokeOpacity: 0.8,
            strokeWeight: 4
        });

        trazadoRutaPolyline.setMap(window.mapaMensajero);
        window.mapaMensajero.fitBounds(bounds);
        console.log("[Mapa] Polyline y marcadores redibujados exitosamente.");
    }
}

// 5. Listener Global: Escuchar eventos de reordenamiento por Drag & Drop desde mensajero-rutas.js
window.addEventListener("rutasReordenadas", (event) => {
    const { zonaId, nuevaSecuencia } = event.detail || {};
    console.log(`[Mapa] Capturado evento 'rutasReordenadas' para Zona: ${zonaId}`, nuevaSecuencia);
    
    if (typeof window.obtenerParadasLocalesPorZona === "function") {
        const paradasActualizadas = window.obtenerParadasLocalesPorZona(zonaId);
        actualizarTrazadoMapa(zonaId, paradasActualizadas);
    }
});

// Inicialización de parámetros de navegación al cargar la vista de mapa
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const zonaParam = urlParams.get("zona");
    if (zonaParam) {
        console.log(`[Mapa] Inicializado mapa con foco en Zona: ${zonaParam}`);
    }
});