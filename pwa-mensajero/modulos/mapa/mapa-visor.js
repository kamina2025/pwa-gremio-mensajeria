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

// Inicialización de variables globales en window para mantener compatibilidad
window.mapaMensajero = window.mapaMensajero || null;
window.mapaInstancia = window.mapaInstancia || null; // Alias de soporte Singleton
window.renderRutasMensajero = window.renderRutasMensajero || null;
window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];
window.infoWindowMensajero = window.infoWindowMensajero || null;
window.pendientesParaRenderizar = window.pendientesParaRenderizar || null;

/**
 * Inicializa el lienzo de Google Maps con la estética Cyberpunk y registra los escuchadores.
 * Implementa control Singleton para evitar reinicializaciones redundantes.
 * 
 * @param {string} [idContenedor="mapa-mensajero"] - ID del elemento contenedor en el DOM
 * @returns {google.maps.Map|null} Instancia del mapa
 */
export function inicializarMapaMensajero(idContenedor = "mapa-mensajero") {
    // 1. Control Singleton: Reutilizar instancia si ya existe en memoria
    if (window.mapaMensajero || window.mapaInstancia) {
        console.log("ℹ️ [MAPA_VISOR]: Reutilizando instancia existente del mapa Google Maps.");
        return window.mapaMensajero || window.mapaInstancia;
    }

    if (typeof google === "undefined" || !google.maps) {
        console.warn("⏳ [MAPA_MENSAJERO]: Esperando SDK de Google Maps...");
        return null;
    }

    // Probar selector primario o fallback al id genérico 'map'
    const contenedorMapa = document.getElementById(idContenedor) || document.getElementById("map");
    if (!contenedorMapa) {
        console.warn(`⚠️ [MAPA_MENSAJERO]: Contenedor HTML '#${idContenedor}' / '#map' no encontrado en el DOM.`);
        return null;
    }

    try {
        console.log("🗺️ [MAPA_MENSAJERO]: Inicializando mapa Cyberpunk...");
        
        // Crear InfoWindow única compartida
        if (!window.infoWindowMensajero && google.maps.InfoWindow) {
            window.infoWindowMensajero = new google.maps.InfoWindow();
        }

        // Instanciación con Paleta Neón / Dark Cyberpunk
        const instancia = new google.maps.Map(contenedorMapa, {
            center: { lat: 3.4516467, lng: -76.5319854 }, // Coordenadas Cali
            zoom: 13,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
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

        // Guardar referencias globales estandarizadas
        window.mapaMensajero = instancia;
        window.mapaInstancia = instancia;

        // Cierre automático de menús overlays táctiles al interactuar con el lienzo
        window.mapaMensajero.addListener("click", () => {
            if (window.overlayMenuActivo && typeof window.overlayMenuActivo.cerrar === "function") {
                window.overlayMenuActivo.cerrar();
            }
        });

        // Trigger de ajuste de renderizado post-carga del DOM
        setTimeout(() => {
            if (window.mapaMensajero && typeof google !== "undefined") {
                google.maps.event.trigger(window.mapaMensajero, "resize");
            }
        }, 300);

        // Desplegar capa vectorial de zonas (GeoJSON) inicial
        if (typeof desplegarZonaMensajeroEnMapa === "function") {
            desplegarZonaMensajeroEnMapa(window.mapaMensajero, "TODAS");
        }

        // Registrar escuchas de clic sobre el mapa para captura de coordenadas
        registrarEventosClicMapa((nuevaParada) => {
            if (typeof window.agregarParadaLocal === "function") {
                window.agregarParadaLocal(nuevaParada);
            }
        });

        // Procesar pendientes diferidos en cola si existieran
        if (window.pendientesParaRenderizar) {
            const { listaPedidos, indiceActivo } = window.pendientesParaRenderizar;
            window.pendientesParaRenderizar = null;
            actualizarPuntosEnMapa(listaPedidos, indiceActivo);
        }

        return window.mapaMensajero;

    } catch (e) {
        console.error("❌ [MAPA_ERROR]: Fallo crítico inicializando el visor del mapa:", e);
        return null;
    }
}

/**
 * Actualiza los marcadores, trayectos y polígonos sobre el lienzo del mapa.
 * 
 * @param {Array<Object>} listaPedidos - Paradas o puntos a renderizar
 * @param {number} [indiceActivo=0] - Índice de la parada activa
 */
export async function actualizarPuntosEnMapa(listaPedidos, indiceActivo = 0) {
    const mapa = window.mapaMensajero || window.mapaInstancia;

    if (!mapa || typeof google === "undefined" || !google.maps) {
        console.log("⏳ [MAPA_VISOR]: Mapa no listo. Encolando puntos pendientes para renderizar...");
        window.pendientesParaRenderizar = { listaPedidos, indiceActivo };
        return;
    }

    // Detectar zona predominante del payload
    const zonaDetectada = Array.isArray(listaPedidos) && listaPedidos.length > 0 
        ? (listaPedidos[0]?.zonaKey || listaPedidos[0]?.zona || "GENERAL") 
        : "TODAS";

    if (typeof desplegarZonaMensajeroEnMapa === "function") {
        desplegarZonaMensajeroEnMapa(mapa, zonaDetectada);
    }

    // Trazar polilíneas vectoriales estilo neón
    if (typeof trazarPolilineaRuta === "function") {
        trazarPolilineaRuta(listaPedidos, zonaDetectada);
    }

    // Renderizar marcadores interactivos
    if (typeof renderizarMarcadoresInteractivos === "function") {
        renderizarMarcadoresInteractivos(listaPedidos, indiceActivo, () => {
            if (typeof window.refrescarUI === "function") {
                window.refrescarUI();
            }
        });
    }
}

/**
 * Enfoca los límites geográficos (bounds) de las paradas pertenecientes a la zona.
 * 
 * @param {Array<Object>} paradasZona - Paradas de la zona a enfocar
 */
export function enfocarZonaEnMapa(paradasZona) {
    const mapa = window.mapaMensajero || window.mapaInstancia;

    if (!mapa || typeof google === "undefined" || !google.maps) {
        console.warn("⚠️ [MAPA_VISOR]: Instancia del mapa no disponible para fitBounds.");
        return;
    }

    if (!Array.isArray(paradasZona) || paradasZona.length === 0) return;

    console.log(`🎯 [MAPA_VISOR]: Enfocando zona con ${paradasZona.length} paradas...`);
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
            const centro = bounds.getCenter();
            mapa.setCenter(centro);
            mapa.setZoom(15);
        } else {
            mapa.fitBounds(bounds);
        }
        console.log(`✅ [MAPA_VISOR]: FitBounds completado con éxito para ${puntosValidos} puntos.`);
    }
}

// BINDINGS GLOBALES EN WINDOW (Asegura disponibilidad global e integración legacy)
window.inicializarMapaMensajero = inicializarMapaMensajero;
window.actualizarPuntosEnMapa = actualizarPuntosEnMapa;
window.enfocarZonaEnMapa = enfocarZonaEnMapa;

// Exportación ES6 de módulos
export { 
    ejecutarBusquedaDireccion, 
    toggleBuscadorMapaUI, 
    activarModoSeleccionMapaUI, 
    registrarEventosClicMapa 
};

// Autoejecución segura si el SDK de Google Maps y el contenedor ya están listos
if (typeof google !== "undefined" && google.maps && !window.mapaMensajero) {
    const el = document.getElementById("mapa-mensajero") || document.getElementById("map");
    if (el) {
        inicializarMapaMensajero();
    }
}