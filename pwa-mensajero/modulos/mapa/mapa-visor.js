/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL DEL MAPA (MODO RÁSTER ESTABLE 2D)
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-visor.js
 * Arquitectura: Google Maps SDK / Local-First / Orquestador PWA Resiliente
 */

import { desplegarZonaMensajeroEnMapa } from "./mapa-mensajero-zonas.js";
import { 
    registrarEventosClicMapa, 
    ejecutarBusquedaDireccion, 
    toggleBuscadorMapaUI, 
    activarModoSeleccionMapaUI, 
    mapaEventos 
} from "./mapa-eventos.js";
import { obtenerCoordenadasValidasParada } from "./utils/mapa-coordenadas.js";

// Subsistema de Sincronización Local-First
import { recargarMapaCompleto, actualizarPuntosEnMapa } from "./core/mapa-sincronizacion.js";

// Subsistema especializado del Lienzo (Render, Enfoques y Bounds)
import { 
    refrescarLienzoMapa, 
    enfocarZonaEnMapa, 
    enfocarParadaEnMapa, 
    enfocarYResaltarGrupoSCC 
} from "./core/mapa-lienzo.js";

// Subsistema de Geolocalización y Telemetría GPS
import { 
    inicializarSeguimientoGPS, 
    renderizarUbicacionGpsEnMapa, 
    simularMovimientoGPS, 
    renderizarBotonDevSimulacion 
} from "./gps/mapa-gps.js";

// Instancias y variables de estado global (Singleton Pattern)
if (typeof window !== "undefined") {
    window.mapaMensajero = window.mapaMensajero || null;
    window.mapaInstancia = window.mapaInstancia || null;
    window.renderRutasMensajero = window.renderRutasMensajero || null;
    window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];
    window.infoWindowMensajero = window.infoWindowMensajero || null;
    window.pendientesParaRenderizar = window.pendientesParaRenderizar || null;
}

let observadorResizeContenedor = null;
let temporizadorReintentoVisibilidad = null;

/**
 * Inicializa de forma resiliente la instancia de Google Maps sobre el contenedor HTML indicado.
 * @param {string} [idContenedor="mapa-mensajero"] - ID del elemento contenedor HTML
 * @returns {google.maps.Map|null}
 */
export function inicializarMapaMensajero(idContenedor = "mapa-mensajero") {
    // 1. Ubicar el contenedor HTML en el DOM
    const contenedorMapa = document.getElementById(idContenedor) || 
                           document.getElementById("mapa-mensajero-view") || 
                           document.getElementById("map");

    if (!contenedorMapa) {
        // Retorno silencioso si los componentes HTML dinámicos aún no han terminado de inyectarse
        return null;
    }

    // 2. Si la instancia de Google Maps ya existe, refrescar dimensiones del lienzo y retornar
    if (window.mapaMensajero || window.mapaInstancia) {
        const mapaActivo = window.mapaMensajero || window.mapaInstancia;
        if (typeof google !== "undefined" && google.maps && mapaActivo) {
            google.maps.event.trigger(mapaActivo, "resize");
            refrescarLienzoMapa();
        }
        return mapaActivo;
    }

    // 3. Verificar disponibilidad del SDK de Google Maps
    if (typeof google === "undefined" || !google.maps || typeof google.maps.Map !== "function") {
        clearTimeout(temporizadorReintentoVisibilidad);
        temporizadorReintentoVisibilidad = setTimeout(() => inicializarMapaMensajero(idContenedor), 350);
        return null;
    }

    // 4. Configurar ResizeObserver reactivo sobre el contenedor antes de crear el mapa
    if (window.ResizeObserver && !observadorResizeContenedor) {
        observadorResizeContenedor = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    if (!window.mapaMensajero && !window.mapaInstancia) {
                        console.log("👁️ [MAPA_VISOR]: Contenedor visible detectado por ResizeObserver. Inicializando mapa...");
                        inicializarMapaMensajero(idContenedor);
                    } else {
                        refrescarLienzoMapa();
                    }
                }
            }
        });
        observadorResizeContenedor.observe(contenedorMapa);
    }

    // 5. Validar visibilidad física (dimensiones > 0x0)
    const rect = contenedorMapa.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || contenedorMapa.clientWidth === 0) {
        return null;
    }

    try {
        console.log("🗺️ [MAPA_VISOR]: Contenedor activo detectado. Creando lienzo Cyberpunk 2D...");

        // Inicializar ventana emergente unificada InfoWindow
        if (!window.infoWindowMensajero && google.maps.InfoWindow) {
            window.infoWindowMensajero = new google.maps.InfoWindow();
        }

        const opcionesMapa = {
            center: { lat: 3.4516467, lng: -76.5319854 }, // Coordenada base: Cali, Colombia
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
        };

        const instancia = new google.maps.Map(contenedorMapa, opcionesMapa);

        // Bindings globales del Singleton
        window.mapaMensajero = instancia;
        window.mapaInstancia = instancia;
        window.mapaVisorInstancia = instancia;

        // Cierre defensivo de menús flotantes al hacer clic directo en el mapa
        instancia.addListener("click", () => {
            if (window.overlayMenuActivo && typeof window.overlayMenuActivo.cerrar === "function") {
                window.overlayMenuActivo.cerrar();
            }
        });

        // Inicializar controles, eventos y clics tácticos
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

        // Forzar recalculo de dimensiones y centrado
        google.maps.event.trigger(instancia, "resize");
        refrescarLienzoMapa();

        // Cargar capas de zonificación
        if (typeof desplegarZonaMensajeroEnMapa === "function") {
            desplegarZonaMensajeroEnMapa(instancia, "TODAS");
        }

        // Renderizar waypoints diferidos en cola
        if (window.pendientesParaRenderizar) {
            const { listaPedidos, indiceActivo } = window.pendientesParaRenderizar;
            window.pendientesParaRenderizar = null;
            actualizarPuntosEnMapa(listaPedidos, indiceActivo);
        }

        // Iniciar telemetría GPS y botón de desarrollo
        inicializarSeguimientoGPS();
        renderizarBotonDevSimulacion();

        console.log("✅ [MAPA_VISOR]: Instancia de Google Maps desplegada exitosamente.");
        return instancia;

    } catch (e) {
        console.error("❌ [MAPA_VISOR]: Fallo crítico al instanciar Google Maps:", e);
        return null;
    }
}

/**
 * Retorna de forma resiliente la instancia global activa del mapa.
 * @returns {google.maps.Map|null}
 */
export function obtenerInstanciaMapa() {
    return window.mapaMensajero || window.mapaInstancia || window.mapaVisorInstancia || null;
}

// BINDINGS GLOBALES Y FACHADA
if (typeof window !== "undefined") {
    window.obtenerCoordenadasValidasParada = obtenerCoordenadasValidasParada;
    window.inicializarMapaMensajero = inicializarMapaMensajero;
    window.actualizarPuntosEnMapa = actualizarPuntosEnMapa;
    window.recargarMapaCompleto = recargarMapaCompleto;
    window.ejecutarRefrescoLocalMapa = recargarMapaCompleto;
    window.enfocarZonaEnMapa = enfocarZonaEnMapa;
    window.enfocarParadaEnMapa = enfocarParadaEnMapa;
    window.enfocarYResaltarGrupoSCC = enfocarYResaltarGrupoSCC;
    window.refrescarLienzoMapa = refrescarLienzoMapa;
    window.obtenerInstanciaMapa = obtenerInstanciaMapa;
}

export { 
    recargarMapaCompleto,
    actualizarPuntosEnMapa,
    obtenerCoordenadasValidasParada,
    refrescarLienzoMapa,
    enfocarZonaEnMapa,
    enfocarParadaEnMapa,
    enfocarYResaltarGrupoSCC,
    ejecutarBusquedaDireccion, 
    toggleBuscadorMapaUI, 
    activarModoSeleccionMapaUI, 
    registrarEventosClicMapa 
};

// Auto-inicialización coordinada con el evento 'modulosCargados' de app.js
if (typeof window !== "undefined") {
    const intentarInicializar = () => {
        if (!window.mapaMensajero) {
            inicializarMapaMensajero();
        }
    };

    document.addEventListener("modulosCargados", intentarInicializar);
}