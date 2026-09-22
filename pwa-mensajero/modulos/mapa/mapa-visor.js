/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL DEL MAPA (ORQUESTADOR)
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-visor.js
 */

import { desplegarZonaMensajeroEnMapa } from "./mapa-mensajero-zonas.js";
import { trazarPolilineaRuta } from "./mapa-rutas.js";
import { renderizarMarcadoresInteractivos } from "./mapa-marcadores.js";
import { 
    registrarEventosClicMapa, 
    ejecutarBusquedaDireccion, 
    toggleBuscadorMapaUI, 
    activarModoSeleccionMapaUI 
} from "./mapa-eventos.js";

window.mapaMensajero = null;
window.renderRutasMensajero = null;
window.marcadoresRutaMensajero = [];
window.infoWindowMensajero = null;
window.pendientesParaRenderizar = null;

// Re-exportar funciones telemáticas y de eventos para compatibilidad de módulos
export { 
    ejecutarBusquedaDireccion, 
    toggleBuscadorMapaUI, 
    activarModoSeleccionMapaUI, 
    registrarEventosClicMapa 
};

/**
 * Inicializa el lienzo de Google Maps con la estética Cyberpunk y registra los escuchadores.
 */
export function inicializarMapaMensajero() {
    if (typeof google === "undefined" || !google.maps || !google.maps.InfoWindow) {
        console.warn("⚠️ [MAPA_MENSAJERO]: Esperando a que cargue el SDK de Google Maps...");
        return;
    }

    const contenedorMapa = document.getElementById("mapa-mensajero");
    if (!contenedorMapa) {
        setTimeout(inicializarMapaMensajero, 300);
        return;
    }

    try {
        console.log("🗺️ [MAPA_MENSAJERO]: Inicializando mapa Cyberpunk...");
        window.infoWindowMensajero = new google.maps.InfoWindow();
        window.mapaMensajero = new google.maps.Map(contenedorMapa, {
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

        // Ocultar menú radial activo al hacer clic sobre el mapa neutral
        window.mapaMensajero.addListener("click", () => {
            if (window.overlayMenuActivo) {
                window.overlayMenuActivo.cerrar();
            }
        });

        // Evento para asegurar ajuste correcto del lienzo al cargar
        setTimeout(() => {
            if (window.mapaMensajero && typeof google !== "undefined") {
                google.maps.event.trigger(window.mapaMensajero, "resize");
                window.mapaMensajero.setCenter({ lat: 3.4516, lng: -76.532 });
            }
        }, 200);

        window.renderRutasMensajero = new google.maps.DirectionsRenderer({
            map: window.mapaMensajero,
            suppressMarkers: true,
            polylineOptions: { strokeColor: "#00e5ff", strokeOpacity: 0.8, strokeWeight: 4 }
        });

        if (typeof desplegarZonaMensajeroEnMapa === "function") {
            desplegarZonaMensajeroEnMapa(window.mapaMensajero);
        }

        // Suscripción al listener para capturar clics en el mapa
        registrarEventosClicMapa((nuevaParada) => {
            if (typeof window.agregarParadaLocal === "function") {
                window.agregarParadaLocal(nuevaParada);
            }
        });

        if (window.pendientesParaRenderizar) {
            const { listaPedidos, indiceActivo } = window.pendientesParaRenderizar;
            window.pendientesParaRenderizar = null;
            actualizarPuntosEnMapa(listaPedidos, indiceActivo);
        }
    } catch (e) {
        console.error(">>> [MAPA_ERROR]: Fallo inicializando el visor:", e);
    }
}

/**
 * Actualiza los marcadores, trayectos y polígonos sobre el lienzo del mapa.
 * 
 * @param {Array} listaPedidos - Arreglo de paradas a proyectar.
 * @param {number} indiceActivo - Íntem activo en foco.
 */
export async function actualizarPuntosEnMapa(listaPedidos, indiceActivo) {
    if (!window.mapaMensajero || typeof google === "undefined" || !google.maps) {
        window.pendientesParaRenderizar = { listaPedidos, indiceActivo };
        return;
    }

    const zonaDetectada = listaPedidos && listaPedidos.length > 0 ? listaPedidos[0]?.zonaKey || "NORTE" : null;
    if (typeof desplegarZonaMensajeroEnMapa === "function") {
        desplegarZonaMensajeroEnMapa(window.mapaMensajero, zonaDetectada);
    }

    // Trazar línea de ruta en polilínea
    trazarPolilineaRuta(listaPedidos);

    // Renderizar marcadores interactivos con overlay en cruz
    renderizarMarcadoresInteractivos(listaPedidos, indiceActivo, () => {
        if (typeof window.refrescarUI === "function") {
            window.refrescarUI();
        } else {
            actualizarPuntosEnMapa(listaPedidos, indiceActivo);
        }
    });
}

/**
 * Encuadra dinámicamente el lienzo del mapa para enfocar las paradas de una zona desplegada (fitBounds).
 * 
 * @param {Array<Object>} paradasZona - Subconjunto de paradas pertenecientes al acordeón.
 */
export function enfocarZonaEnMapa(paradasZona) {
    if (!window.mapaMensajero || typeof google === "undefined" || !google.maps) {
        console.warn("⚠️ [MAPA_VISOR]: Instancia del mapa no disponible para fitBounds.");
        return;
    }

    if (!Array.isArray(paradasZona) || paradasZona.length === 0) return;

    console.log(`🎯 [MAPA_VISOR]: Enfocando zona con ${paradasZona.length} paradas...`);
    const bounds = new google.maps.LatLngBounds();
    let puntosValidos = 0;

    paradasZona.forEach(p => {
        if (p.lat && p.lng) {
            const lat = parseFloat(p.lat);
            const lng = parseFloat(p.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                bounds.extend(new google.maps.LatLng(lat, lng));
                puntosValidos++;
            }
        }
    });

    if (puntosValidos > 0) {
        if (puntosValidos === 1) {
            const centro = bounds.getCenter();
            window.mapaMensajero.setCenter(centro);
            window.mapaMensajero.setZoom(15);
        } else {
            window.mapaMensajero.fitBounds(bounds);
        }
        console.log(`✅ [MAPA_VISOR]: FitBounds completado con éxito para ${puntosValidos} puntos.`);
    }
}

// Vinculación explícita a window para soporte y compatibilidad global
window.inicializarMapaMensajero = inicializarMapaMensajero;
window.actualizarPuntosEnMapa = actualizarPuntosEnMapa;
window.enfocarZonaEnMapa = enfocarZonaEnMapa;