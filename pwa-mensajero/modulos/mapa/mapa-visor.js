/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL DEL MAPA (MODO RÁSTER ESTABLE 2D)
 * Ubicación: modulos/mapa/mapa-visor.js
 */

import { desplegarZonaMensajeroEnMapa } from "./mapa-mensajero-zonas.js";
import { trazarPolilineaRuta } from "./mapa-rutas.js";
import { renderizarMarcadoresInteractivos } from "./mapa-marcadores.js";
import { 
    registrarEventosClicMapa, 
    ejecutarBusquedaDireccion, 
    toggleBuscadorMapaUI, 
    activarModoSeleccionMapaUI,
    mapaEventos 
} from "./mapa-eventos.js";

// Instancias y variables de estado global
window.mapaMensajero = window.mapaMensajero || null;
window.mapaInstancia = window.mapaInstancia || null; // Alias Singleton
window.renderRutasMensajero = window.renderRutasMensajero || null;
window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];
window.infoWindowMensajero = window.infoWindowMensajero || null;
window.pendientesParaRenderizar = window.pendientesParaRenderizar || null;

let observadorResizeContenedor = null;
let temporizadorDebounceResize = null;

/**
 * Redimensiona el lienzo del mapa de forma segura tras cambios en el DOM o conmutación de pestañas SPA.
 * Utiliza doble requestAnimationFrame (Post-Paint) para eliminar definitivamente las baldosas negras.
 */
export function refrescarLienzoMapa() {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) return;

    const contenedor = mapa.getDiv();
    if (!contenedor || contenedor.clientWidth === 0 || contenedor.clientHeight === 0) {
        return;
    }

    if (temporizadorDebounceResize) clearTimeout(temporizadorDebounceResize);

    temporizadorDebounceResize = setTimeout(() => {
        // Garantizar que el Reflow y Repaint del navegador se hayan ejecutado completamente
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (contenedor.clientWidth > 0 && contenedor.clientHeight > 0) {
                    const centroActual = mapa.getCenter();
                    google.maps.event.trigger(mapa, "resize");
                    
                    if (centroActual) {
                        mapa.setCenter(centroActual);
                    }
                    console.log("⚡ [MAPA_VISOR]: Re-renderizado Post-Paint de lienzo Ráster ejecutado con éxito.");
                }
            });
        });
    }, 80);
}

/**
 * Inicializa la instancia de Google Maps en modo 2D estable (Sin WebGL / Sin mapId disputado).
 * Soporta control Singleton y recupera waypoints pendientes tras la carga.
 * 
 * @param {string} [idContenedor="mapa-mensajero"] - ID del elemento contenedor en el DOM
 * @returns {google.maps.Map|null} Instancia del mapa
 */
export function inicializarMapaMensajero(idContenedor = "mapa-mensajero") {
    // 1. Control Singleton: Reutilizar si la instancia ya existe en memoria global
    if (window.mapaMensajero || window.mapaInstancia) {
        console.log("ℹ️ [MAPA_VISOR]: Reutilizando instancia existente del mapa Google Maps.");
        refrescarLienzoMapa();
        return window.mapaMensajero || window.mapaInstancia;
    }

    // 2. Esperar disponibilidad asíncrona del SDK
    if (typeof google === "undefined" || !google.maps || typeof google.maps.Map !== "function") {
        console.warn("⏳ [MAPA_VISOR]: SDK de Google Maps aún no está listo. Reintentando en 300ms...");
        setTimeout(() => inicializarMapaMensajero(idContenedor), 300);
        return null;
    }

    // 3. Fallbacks de contenedores DOM
    const contenedorMapa = document.getElementById(idContenedor) || 
                           document.getElementById("mapa-mensajero-view") || 
                           document.getElementById("map");

    if (!contenedorMapa) {
        console.warn(`⚠️ [MAPA_VISOR]: Contenedor HTML '#${idContenedor}' no encontrado en el DOM.`);
        return null;
    }

    try {
        console.log("🗺️ [MAPA_VISOR]: Inicializando mapa Ráster Cyberpunk de alta estabilidad...");

        if (!window.infoWindowMensajero && google.maps.InfoWindow) {
            window.infoWindowMensajero = new google.maps.InfoWindow();
        }

        // Configuración Ráster 2D Dark Cyberpunk
        const instancia = new google.maps.Map(contenedorMapa, {
            center: { lat: 3.4516467, lng: -76.5319854 }, // Coordenadas Base Cali
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: "greedy",
            styles: [
                { elementType: "geometry", stylers: [{ color: "#0c080f" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#0c080f" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#79578a" }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#191321" }] },
                { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#291f33" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#040205" }] },
                { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#504060" }] },
                { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#605070" }] }
            ]
        });

        window.mapaMensajero = instancia;
        window.mapaInstancia = instancia;

        // Cierre de overlay de menú radial activo al hacer clic sobre el mapa
        instancia.addListener("click", () => {
            if (window.overlayMenuActivo && typeof window.overlayMenuActivo.cerrar === "function") {
                window.overlayMenuActivo.cerrar();
            }
        });

        // Activar observador de cambios de tamaño sobre el contenedor para autoreparación visual
        if (window.ResizeObserver && !observadorResizeContenedor) {
            observadorResizeContenedor = new ResizeObserver(() => {
                refrescarLienzoMapa();
            });
            observadorResizeContenedor.observe(contenedorMapa);
        }

        // Vincular controles e interacciones del mapa
        if (mapaEventos && typeof mapaEventos.inicializarControles === "function") {
            mapaEventos.inicializarControles(instancia);
        }

        if (typeof registrarEventosClicMapa === "function") {
            registrarEventosClicMapa((nuevaParada) => {
                if (typeof window.agregarParadaLocal === "function") {
                    window.agregarParadaLocal(nuevaParada);
                }
            });
        }

        refrescarLienzoMapa();

        if (typeof desplegarZonaMensajeroEnMapa === "function") {
            desplegarZonaMensajeroEnMapa(instancia, "TODAS");
        }

        // Procesar cola diferida de waypoints si intentaron renderizarse antes de que el mapa estuviera listo
        if (window.pendientesParaRenderizar) {
            const { listaPedidos, indiceActivo } = window.pendientesParaRenderizar;
            window.pendientesParaRenderizar = null;
            actualizarPuntosEnMapa(listaPedidos, indiceActivo);
        }

        return instancia;

    } catch (e) {
        console.error("❌ [MAPA_VISOR]: Fallo crítico al inicializar mapa:", e);
        return null;
    }
}

/**
 * Actualiza los waypoints, polilínia y marcadores sobre el mapa.
 * @param {Array<Object>} listaPedidos 
 * @param {number} [indiceActivo=0] 
 */
export async function actualizarPuntosEnMapa(listaPedidos, indiceActivo = 0) {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) {
        window.pendientesParaRenderizar = { listaPedidos, indiceActivo };
        return;
    }

    const zonaDetectada = Array.isArray(listaPedidos) && listaPedidos.length > 0 
        ? (listaPedidos[0]?.zonaKey || listaPedidos[0]?.zona || "GENERAL") 
        : "TODAS";

    if (typeof desplegarZonaMensajeroEnMapa === "function") {
        desplegarZonaMensajeroEnMapa(mapa, zonaDetectada);
    }

    if (typeof trazarPolilineaRuta === "function") {
        trazarPolilineaRuta(listaPedidos, zonaDetectada);
    }

    if (typeof renderizarMarcadoresInteractivos === "function") {
        renderizarMarcadoresInteractivos(listaPedidos, indiceActivo);
    }
}

/**
 * Enfoca una zona ajustando sus límites geográficos (FitBounds).
 * @param {Array<Object>} paradasZona 
 */
export function enfocarZonaEnMapa(paradasZona) {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    if (!mapa || !Array.isArray(paradasZona) || paradasZona.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let puntosValidos = 0;

    paradasZona.forEach(p => {
        if (p) {
            const lat = parseFloat(p.lat || p.latitud);
            const lng = parseFloat(p.lng || p.longitud);
            if (!isNaN(lat) && !isNaN(lng)) {
                bounds.extend(new google.maps.LatLng(lat, lng));
                puntosValidos++;
            }
        }
    });

    if (puntosValidos > 0) {
        if (puntosValidos === 1) {
            mapa.setCenter(bounds.getCenter());
            mapa.setZoom(15);
        } else {
            mapa.fitBounds(bounds);
        }
        refrescarLienzoMapa();
    }
}

/**
 * Centra y acerca suavemente la cámara a una parada específica.
 * @param {Object} parada 
 */
export function enfocarParadaEnMapa(parada) {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    if (!mapa || !parada) return;

    const lat = parseFloat(parada.lat || parada.latitud);
    const lng = parseFloat(parada.lng || parada.longitud);
    if (isNaN(lat) || isNaN(lng)) return;

    mapa.panTo(new google.maps.LatLng(lat, lng));
    mapa.setZoom(17);
    refrescarLienzoMapa();
}

/**
 * Retorna la instancia global activa del mapa.
 * @returns {google.maps.Map|null}
 */
export function obtenerInstanciaMapa() {
    return window.mapaMensajero || window.mapaInstancia || null;
}

// BINDINGS GLOBALES PARA COMPATIBILIDAD CON HANDLERS INLINE Y DELEGACIÓN EN WINDOW
window.inicializarMapaMensajero = inicializarMapaMensajero;
window.actualizarPuntosEnMapa = actualizarPuntosEnMapa;
window.enfocarZonaEnMapa = enfocarZonaEnMapa;
window.enfocarParadaEnMapa = enfocarParadaEnMapa;
window.refrescarLienzoMapa = refrescarLienzoMapa;
window.obtenerInstanciaMapa = obtenerInstanciaMapa;

export { 
    ejecutarBusquedaDireccion, 
    toggleBuscadorMapaUI, 
    activarModoSeleccionMapaUI, 
    registrarEventosClicMapa 
};

// Autoejecución segura si el SDK y el contenedor ya se encuentran disponibles en el DOM
if (typeof google !== "undefined" && google.maps && typeof google.maps.Map === "function" && !window.mapaMensajero) {
    const contenedorExistente = document.getElementById("mapa-mensajero") || 
                                document.getElementById("mapa-mensajero-view") || 
                                document.getElementById("map");
    if (contenedorExistente) {
        inicializarMapaMensajero();
    }
}