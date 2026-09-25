/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL DEL MAPA (MODO RÁSTER ESTABLE 2D)
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-visor.js
 * Arquitectura: Google Maps SDK / Local-First / Orden Persistente
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
import { guardarRutaZonificada, obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "./zonificacion/estandar-zonas.js";

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
 * Extrae y valida coordenadas numéricas de un objeto parada soportando múltiples esquemas de datos.
 * @param {Object} parada 
 * @returns {{lat: number, lng: number}|null}
 */
export function obtenerCoordenadasValidasParada(parada) {
    if (!parada || typeof parada !== "object") return null;

    let rawLat = parada.lat ?? parada.latitud ?? parada.latitud_num ?? parada.y ?? parada.lat_num;
    if ((rawLat === undefined || rawLat === null) && parada.coordenadas) {
        rawLat = parada.coordenadas.lat ?? parada.coordenadas.latitud;
    }

    let rawLng = parada.lng ?? parada.longitud ?? parada.longitud_num ?? parada.x ?? parada.lng_num;
    if ((rawLng === undefined || rawLng === null) && parada.coordenadas) {
        rawLng = parada.coordenadas.lng ?? parada.coordenadas.longitud;
    }

    if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) {
        return null;
    }

    const latStr = String(rawLat).trim().replace(',', '.');
    const lngStr = String(rawLng).trim().replace(',', '.');

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        return null;
    }

    return { lat, lng };
}

/**
 * Redimensiona el lienzo del mapa de forma segura tras cambios en el DOM.
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
    }, 80);
}

/**
 * Consulta IndexedDB, resincroniza la RAM global y fuerza la actualización del canvas,
 * respetando de forma SAGRADA la secuenciaZona guardada por el usuario.
 * @returns {Promise<boolean>}
 */
export async function recargarMapaCompleto() {
    console.group("🔄 [MAPA_VISOR]: Ejecutando sincronización y refresco Local-First del mapa...");

    try {
        let paradasFrescas = [];
        if (typeof obtenerParadasGuardadas === "function") {
            paradasFrescas = await obtenerParadasGuardadas();
        }

        if (!Array.isArray(paradasFrescas) || paradasFrescas.length === 0) {
            paradasFrescas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
        }

        console.log(`📦 [MAPA_VISOR]: Total de paradas recuperadas para refresco: ${paradasFrescas.length}`);

        // ORDENACIÓN ESTRICTA: Respetar la secuencia exacta guardada por el usuario
        paradasFrescas.sort((a, b) => {
            const seqA = parseInt(a.secuenciaZona || a.secuencia || a.orden || 0, 10);
            const seqB = parseInt(b.secuenciaZona || b.secuencia || b.orden || 0, 10);
            return seqA - seqB;
        });

        // Sincronizar memorias RAM
        window.__CACHE_PARADAS_MACONDO__ = [...paradasFrescas];
        window.paradasMemoriaLocal = [...paradasFrescas];
        window.paradasRutaActiva = [...paradasFrescas];
        window.pedidosGlobales = [...paradasFrescas];

        const mapa = window.mapaMensajero || window.mapaInstancia;
        const zonaActiva = localStorage.getItem("zona_activa_operacion") || "ORIENTE";
        const targetCanonico = estandarizarZonaCanonica(zonaActiva);

        if (mapa && typeof google !== "undefined" && google.maps) {
            // Forzar disparo del evento resize sobre la instancia
            google.maps.event.trigger(mapa, "resize");
            console.log("📐 [MAPA_VISOR]: Disparado 'resize' sobre Google Maps.");

            // Actualizar Marcadores y Minirutas por Clúster
            await actualizarPuntosEnMapa(paradasFrescas, 0);

            // Filtrar paradas de la zona activa para fitBounds enfocado
            const paradasDeZona = paradasFrescas.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico);
            const listaParaBounds = paradasDeZona.length > 0 ? paradasDeZona : paradasFrescas;

            // Ajustar los límites (fitBounds)
            const bounds = new google.maps.LatLngBounds();
            let puntosValidos = 0;

            listaParaBounds.forEach((p) => {
                const coords = obtenerCoordenadasValidasParada(p);
                if (coords) {
                    bounds.extend(new google.maps.LatLng(coords.lat, coords.lng));
                    puntosValidos++;
                }
            });

            if (puntosValidos > 0) {
                mapa.fitBounds(bounds);
                console.log(`🔍 [MAPA_VISOR]: Bounds re-ajustados para ${puntosValidos} coordenadas de la zona [${targetCanonico}].`);
            }
        } else {
            console.warn("⚠️ [MAPA_VISOR]: Instancia del mapa no disponible durante el refresco.");
        }

        // Refrescar acordeones de la UI si la función existe
        if (typeof window.renderizarParadasZonificadasUI === "function") {
            await window.renderizarParadasZonificadasUI(paradasFrescas);
        }

        refrescarLienzoMapa();
        console.groupEnd();
        return true;

    } catch (error) {
        console.error("❌ [MAPA_VISOR]: Error crítico ejecutando recargarMapaCompleto:", error);
        console.groupEnd();
        throw error;
    }
}

/**
 * Inicializa la instancia de Google Maps en modo 2D estable.
 * @param {string} [idContenedor="mapa-mensajero"] - ID del elemento contenedor
 * @returns {google.maps.Map|null}
 */
export function inicializarMapaMensajero(idContenedor = "mapa-mensajero") {
    if (window.mapaMensajero || window.mapaInstancia) {
        console.log("ℹ️ [MAPA_VISOR]: Reutilizando instancia existente del mapa Google Maps.");
        refrescarLienzoMapa();
        return window.mapaMensajero || window.mapaInstancia;
    }

    if (typeof google === "undefined" || !google.maps || typeof google.maps.Map !== "function") {
        console.warn("⏳ [MAPA_VISOR]: SDK de Google Maps aún no está listo. Reintentando en 300ms...");
        setTimeout(() => inicializarMapaMensajero(idContenedor), 300);
        return null;
    }

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

        const instancia = new google.maps.Map(contenedorMapa, {
            center: { lat: 3.4516467, lng: -76.5319854 }, // Base Cali
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

        instancia.addListener("click", () => {
            if (window.overlayMenuActivo && typeof window.overlayMenuActivo.cerrar === "function") {
                window.overlayMenuActivo.cerrar();
            }
        });

        if (window.ResizeObserver && !observadorResizeContenedor) {
            observadorResizeContenedor = new ResizeObserver(() => {
                refrescarLienzoMapa();
            });
            observadorResizeContenedor.observe(contenedorMapa);
        }

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
 * Actualiza waypoints, minirutas por clúster y marcadores sobre el mapa.
 * @param {Array<Object>} listaPedidos 
 * @param {number} [indiceActivo=0] 
 */
export async function actualizarPuntosEnMapa(listaPedidos, indiceActivo = 0) {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) {
        window.pendientesParaRenderizar = { listaPedidos, indiceActivo };
        return;
    }

    const zonaDetectada = localStorage.getItem("zona_activa_operacion") || (Array.isArray(listaPedidos) && listaPedidos.length > 0 
        ? (listaPedidos[0]?.zonaKey || listaPedidos[0]?.zona || "GENERAL") 
        : "TODAS");

    const targetCanonico = estandarizarZonaCanonica(zonaDetectada);

    if (typeof desplegarZonaMensajeroEnMapa === "function") {
        desplegarZonaMensajeroEnMapa(mapa, targetCanonico);
    }

    if (typeof trazarPolilineaRuta === "function") {
        trazarPolilineaRuta(listaPedidos, targetCanonico);
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
            const coords = obtenerCoordenadasValidasParada(p);
            if (coords) {
                bounds.extend(new google.maps.LatLng(coords.lat, coords.lng));
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
 * Incluye fallback por dirección de texto con auto-guardado en IndexedDB.
 * @param {Object} parada - Objeto de la parada a enfocar
 */
export function enfocarParadaEnMapa(parada) {
    const mapa = window.mapaMensajero || window.mapaInstancia;
    
    if (!mapa) {
        console.warn("⚠️ [MAPA_VISOR]: Instancia del mapa no disponible para enfocar la parada.", parada);
        return;
    }

    const coords = obtenerCoordenadasValidasParada(parada);

    if (coords) {
        console.log(`🎯 [MAPA_VISOR]: Enfocando posición en mapa -> [Lat: ${coords.lat}, Lng: ${coords.lng}]`);
        const centroObjetivo = new google.maps.LatLng(coords.lat, coords.lng);
        mapa.panTo(centroObjetivo);
        mapa.setZoom(17);
        refrescarLienzoMapa();
        return;
    }

    const direccionTexto = parada?.direccion || parada?.dir;
    if (direccionTexto && typeof google !== "undefined" && google.maps && google.maps.Geocoder) {
        console.warn(`⚠️ [MAPA_VISOR]: Parada sin coordenadas directas. Geocodificando dirección en vivo: "${direccionTexto}"`);
        const geocoder = new google.maps.Geocoder();
        const query = direccionTexto.toLowerCase().includes("cali") ? direccionTexto : `${direccionTexto}, Cali, Colombia`;

        geocoder.geocode({ address: query }, async (results, status) => {
            if (status === "OK" && results[0]) {
                const loc = results[0].geometry.location;
                const latNum = loc.lat();
                const lngNum = loc.lng();

                console.log(`✅ [MAPA_VISOR]: Dirección geocodificada con éxito -> [Lat: ${latNum}, Lng: ${lngNum}]`);

                parada.lat = latNum;
                parada.lng = lngNum;
                parada.latitud = latNum;
                parada.longitud = lngNum;

                let coleccionActual = window.paradasRutaActiva || window.__CACHE_PARADAS_MACONDO__ || [];
                if (Array.isArray(coleccionActual) && coleccionActual.length > 0) {
                    try {
                        await guardarRutaZonificada(coleccionActual);
                        
                        // Sincronizar todas las memorias RAM
                        window.__CACHE_PARADAS_MACONDO__ = [...coleccionActual];
                        window.paradasMemoriaLocal = [...coleccionActual];
                        window.paradasRutaActiva = [...coleccionActual];
                        window.pedidosGlobales = [...coleccionActual];

                        console.log(`💾 [MAPA_VISOR]: Coordenadas de la parada ${parada.id || parada.ssc} persistidas en IndexedDB y RAM.`);
                    } catch (err) {
                        console.warn("⚠️ [MAPA_VISOR]: No se pudo auto-guardar la coordenada en IndexedDB:", err);
                    }
                }

                mapa.panTo(loc);
                mapa.setZoom(17);
                refrescarLienzoMapa();
            } else {
                console.error(`❌ [MAPA_VISOR]: No se pudo geocodificar la dirección "${query}". Status: ${status}`);
            }
        });
        return;
    }

    console.error("❌ [MAPA_VISOR]: Parada con coordenadas e información de dirección completamente inválidas:", parada);
}

/**
 * Retorna la instancia global activa del mapa.
 * @returns {google.maps.Map|null}
 */
export function obtenerInstanciaMapa() {
    return window.mapaMensajero || window.mapaInstancia || null;
}

// BINDINGS GLOBALES EN WINDOW
window.obtenerCoordenadasValidasParada = obtenerCoordenadasValidasParada;
window.inicializarMapaMensajero = inicializarMapaMensajero;
window.actualizarPuntosEnMapa = actualizarPuntosEnMapa;
window.enfocarZonaEnMapa = enfocarZonaEnMapa;
window.enfocarParadaEnMapa = enfocarParadaEnMapa;
window.refrescarLienzoMapa = refrescarLienzoMapa;
window.obtenerInstanciaMapa = obtenerInstanciaMapa;
window.recargarMapaCompleto = recargarMapaCompleto;
window.ejecutarRefrescoLocalMapa = recargarMapaCompleto;

export { 
    ejecutarBusquedaDireccion, 
    toggleBuscadorMapaUI, 
    activarModoSeleccionMapaUI, 
    registrarEventosClicMapa 
};

if (typeof google !== "undefined" && google.maps && typeof google.maps.Map === "function" && !window.mapaMensajero) {
    const contenedorExistente = document.getElementById("mapa-mensajero") || 
                                document.getElementById("mapa-mensajero-view") || 
                                document.getElementById("map");
    if (contenedorExistente) {
        inicializarMapaMensajero();
    }
}