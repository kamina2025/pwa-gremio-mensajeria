/**
 * PROTOCOLO MACONDO - GESTOR DE MARCADORES E INTERACCIONES EN MAPA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-marcadores.js
 * Arquitectura: AdvancedMarkerElement (Map ID: a43606b6027853016f1d7f2f) / Image-Wrapper DOM / Local-First / Orbital UI
 */

import { crearIconoParadaCyberpunkSVG } from "./mapa-iconos.js";
import { IndexedStore } from "../db/indexed-store.js";
import { actualizarParadaEnPlanillaLocal } from "../procesamiento-datos/planillas-db.js";
import { guardarRutaZonificada } from "../mensajero-persistencia.js";
import { obtenerClaseMenuRadialOverlay } from "./marcadores/mapa-overlay-orbital.js";
import { abrirModalGestionParada as abrirModalGestionParadaImpl } from "./marcadores/mapa-modal-parada.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "./zonificacion/estandar-zonas.js";

export const MACONDO_MAP_ID = "a43606b6027853016f1d7f2f";

const dbStore = new IndexedStore();
const KEY_ULTIMA_PARADA = 'macondo_ultima_parada_id';
const KEY_COLA_OFFLINE = 'macondo_cola_offline_pwa';

window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];
window.overlayMenuActivo = null;
let timerHoverInfoWindow = null;

function esEntornoEstatico() {
    if (typeof window === "undefined") return false;
    return window.location.hostname.includes("github.io") || window.location.protocol === "file:";
}

async function registrarOperacionPendienteDefensivo(accion, payload) {
    try {
        if (typeof dbStore.registrarOperacionPendiente === "function") {
            await dbStore.registrarOperacionPendiente(accion, payload);
            console.log(`💾 [OFFLINE_QUEUE]: Operación '${accion}' guardada en IndexedDB.`);
        } else {
            const colaExistente = JSON.parse(localStorage.getItem(KEY_COLA_OFFLINE) || "[]");
            colaExistente.push({ accion, payload, timestamp: new Date().toISOString() });
            localStorage.setItem(KEY_COLA_OFFLINE, JSON.stringify(colaExistente));
            console.log(`💾 [OFFLINE_QUEUE_FALLBACK]: Operación '${accion}' guardada en localStorage.`);
        }
    } catch (err) {
        console.warn("⚠️ [OFFLINE_QUEUE]: No se pudo guardar la operación en la cola offline:", err);
    }
}

function obtenerEndpointAPI() {
    if (typeof window !== "undefined" && window.API_ENDPOINT) {
        return window.API_ENDPOINT;
    }
    const origin = window.location.origin;
    if (window.location.pathname.includes("/pwa-gremio-mensajeria/")) {
        return `${origin}/pwa-gremio-mensajeria/api.php`;
    }
    return `${origin}/api.php`;
}

function compararIdsParada(idA, idB) {
    if (!idA || !idB) return false;
    const normA = String(idA).replace(/^[#PNT-]+/i, '').trim();
    const normB = String(idB).replace(/^[#PNT-]+/i, '').trim();
    return normA === normB || String(idA).trim() === String(idB).trim();
}

function obtenerCoordenadasNavegacion(parada) {
    if (!parada) return null;
    let rawLat = parada.lat || parada.latitud;
    let rawLng = parada.lng || parada.longitud;

    if ((rawLat === undefined || rawLng === undefined) && parada.coordenadas && typeof parada.coordenadas === 'object') {
        rawLat = parada.coordenadas.lat || parada.coordenadas.latitud;
        rawLng = parada.coordenadas.lng || parada.coordenadas.longitud;
    }

    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
    return { lat, lng };
}

function construirDataURISVG(svgString) {
    let limpio = String(svgString || "").trim();
    const matchSvg = limpio.match(/<svg[\s\S]*<\/svg>/i);
    if (matchSvg) limpio = matchSvg[0];

    if (!limpio.includes('xmlns=')) {
        limpio = limpio.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!limpio.includes('width=')) {
        limpio = limpio.replace('<svg', '<svg width="42"');
    }
    if (!limpio.includes('height=')) {
        limpio = limpio.replace('<svg', '<svg height="52"');
    }

    const encoded = encodeURIComponent(limpio).replace(/'/g, "%27").replace(/"/g, "%22");
    return `data:image/svg+xml;charset=UTF-8,${encoded}`;
}

/**
 * Convierte el vector SVG Cyberpunk en un HTMLElement Wrapper con un tag <img>.
 * Este es el enfoque más robusto y definitivo para AdvancedMarkerElement en WebGL, 
 * ya que garantiza dimensiones sólidas y evita fallos de parseo de namespace.
 * @param {HTMLElement|string} contenidoIcono 
 * @returns {HTMLElement}
 */
function convertirAElementoNodoDOM(contenidoIcono) {
    // 1. Contenedor HTML estricto
    const wrapper = document.createElement('div');
    wrapper.className = 'macondo-cyberpunk-pin-wrapper';
    wrapper.style.width = "42px";
    wrapper.style.height = "52px";
    wrapper.style.display = "block";
    wrapper.style.position = "relative";
    wrapper.style.cursor = "pointer";
    wrapper.style.pointerEvents = "auto"; 
    wrapper.style.filter = "drop-shadow(0px 4px 8px rgba(0, 229, 255, 0.6))";
    
    // 2. Extracción y sanitización del SVG
    let svgTexto = typeof contenidoIcono === 'string' ? contenidoIcono : (contenidoIcono?.outerHTML || "");
    const matchSvg = svgTexto.match(/<svg[\s\S]*<\/svg>/i);
    let limpio = "";
    
    if (matchSvg) {
        limpio = matchSvg[0];
        if (!limpio.includes('xmlns=')) {
            limpio = limpio.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        if (!limpio.includes('width=')) {
            limpio = limpio.replace('<svg', '<svg width="42"');
        }
        if (!limpio.includes('height=')) {
            limpio = limpio.replace('<svg', '<svg height="52"');
        }
    } else {
        limpio = '<svg width="42" height="52" xmlns="http://www.w3.org/2000/svg"><text x="10" y="30" font-size="24">📍</text></svg>';
    }

    // 3. Creación del nodo de imagen nativo
    const img = document.createElement('img');
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.display = "block";
    img.style.pointerEvents = "none"; // El div envuelve los eventos táctiles
    img.alt = "Pin Cyberpunk";
    
    const encoded = encodeURIComponent(limpio).replace(/'/g, "%27").replace(/"/g, "%22");
    img.src = `data:image/svg+xml;charset=UTF-8,${encoded}`;
    
    wrapper.appendChild(img);
    return wrapper;
}

function limpiarParadaDeBuffersRAM(idTarget) {
    const filtrarArray = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter(p => p && !compararIdsParada(p.id || p.ssc, idTarget));
    };

    const nuevoCache = filtrarArray(window.__CACHE_PARADAS_MACONDO__);
    window.__CACHE_PARADAS_MACONDO__ = nuevoCache;
    window.paradasMemoriaLocal = filtrarArray(window.paradasMemoriaLocal);
    window.paradasRutaActiva = filtrarArray(window.paradasRutaActiva);
    window.pedidosGlobales = filtrarArray(window.pedidosGlobales);

    if (typeof guardarRutaZonificada === "function") {
        guardarRutaZonificada(nuevoCache).catch(err => {
            console.warn("⚠️️ [MAPA_MARCADORES]: Snapshot en IndexedDB no actualizada:", err);
        });
    }

    return nuevoCache;
}

export function cerrarOverlayActivo() {
    if (window.overlayMenuActivo && typeof window.overlayMenuActivo.cerrar === "function") {
        window.overlayMenuActivo.cerrar();
    }
}

function sanitizarDireccionContexto(direccion) {
    if (!direccion) return "Cali, Colombia";
    const dirLower = direccion.toLowerCase();
    if (dirLower.includes("cali") || dirLower.includes("jamundi") || dirLower.includes("yumbo") || dirLower.includes("palmira")) {
        return direccion;
    }
    return `${direccion}, Cali, Colombia`;
}

window.iniciarLlamadaAndroid = function (numeroTelefono) {
    if (!numeroTelefono || numeroTelefono.trim() === "" || numeroTelefono === "N/A") {
        alert("⚠️ No hay un número de teléfono válido para esta parada.");
        return;
    }
    const numeroLimpio = numeroTelefono.replace(/[^\d+]/g, "");
    window.location.href = `tel:${numeroLimpio}`;
};

export function iniciarViajeNavegacionGPS(parada) {
    if (!parada) {
        console.warn("⚠️ [MAPA_NAVEGACION]: Parada inválida para iniciar viaje.");
        return;
    }

    const idDisplay = parada.id || parada.ssc || "PNT";
    console.log(`🚀 [MAPA_NAVEGACION]: Iniciando navegación interna para la parada: #${idDisplay}`);

    if (typeof window.trazarRutaNavegacionInternaGPS === "function") {
        window.trazarRutaNavegacionInternaGPS(parada);
    } else {
        console.warn("⚠️ [MAPA_NAVEGACION]: Módulo 'trazarRutaNavegacionInternaGPS' no encontrado. Ejecutando fallback externo.");
        
        const coordsDestino = typeof window.obtenerCoordenadasValidasParada === "function"
            ? window.obtenerCoordenadasValidasParada(parada)
            : obtenerCoordenadasNavegacion(parada);

        if (coordsDestino) {
            const { lat, lng } = coordsDestino;
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, "_blank");
        } else {
            console.warn("⚠️ [MAPA_NAVEGACION]: Coordenadas insuficientes para iniciar navegación GPS externa.");
        }
    }
}

export function manejarAccionOrbitalViajar(paradaSeleccionada) {
    console.log(`🚀 [MENU_ORBITAL]: Acción 'VIAJAR' activada para parada -> #${paradaSeleccionada.id || paradaSeleccionada.ssc}`);
    iniciarViajeNavegacionGPS(paradaSeleccionada);
}

export function abrirModalGestionParada(pedido, indice) {
    abrirModalGestionParadaImpl(pedido, indice, mutarMarcadorPorId);
}

export function crearMarcadorEnPosicion({ mapaInstancia, posicion, contenidoIcono, titulo }) {
    let marcador = null;
    const svgRawString = typeof contenidoIcono === 'string' 
        ? contenidoIcono 
        : (contenidoIcono?.outerHTML || "");

    const tieneMapId = mapaInstancia && (typeof mapaInstancia.get === "function" ? mapaInstancia.get("mapId") : mapaInstancia.mapId);

    const tieneAdvancedMarker = typeof google !== "undefined" && 
                                google.maps && 
                                google.maps.marker && 
                                typeof google.maps.marker.AdvancedMarkerElement === "function" &&
                                !!tieneMapId;

    if (tieneAdvancedMarker) {
        const elementoDOM = convertirAElementoNodoDOM(contenidoIcono);

        marcador = new google.maps.marker.AdvancedMarkerElement({
            map: mapaInstancia,
            position: posicion,
            content: elementoDOM,
            title: titulo,
            zIndex: 999999
        });
        marcador.esAvanzado = true;
        console.log(`📌 [MAPA_MARCADORES]: AdvancedMarkerElement instanciado vía Image-Wrapper -> "${titulo}"`);
    } else {
        const dataUrlBase64 = construirDataURISVG(svgRawString);

        marcador = new google.maps.Marker({
            position: posicion,
            map: mapaInstancia,
            icon: {
                url: dataUrlBase64,
                scaledSize: new google.maps.Size(42, 52),
                anchor: new google.maps.Point(21, 52)
            },
            title: titulo,
            optimized: false,
            zIndex: 999999
        });
        marcador.esAvanzado = false;
        console.warn(`⚠️ [MAPA_MARCADORES_FALLBACK]: google.maps.Marker legacy instanciado -> "${titulo}"`);
    }

    return marcador;
}

export async function renderizarMarcadoresInteractivos(listaPedidos, indiceActivo, callbackActualizacion) {
    if (Array.isArray(window.marcadoresRutaMensajero)) {
        window.marcadoresRutaMensajero.forEach((m) => {
            if (m) {
                if (typeof google !== "undefined" && google.maps && google.maps.event) {
                    google.maps.event.clearInstanceListeners(m);
                }
                if (m.esAvanzado) {
                    m.map = null;
                } else if (typeof m.setMap === "function") {
                    m.setMap(null);
                }
            }
        });
    }
    window.marcadoresRutaMensajero = [];

    if (!listaPedidos || listaPedidos.length === 0) return;

    const mapa = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) {
        console.warn("⚠️ [MAPA_MARCADORES]: Instancia de Google Maps no lista para renderizado.");
        return;
    }

    if (typeof google.maps.importLibrary === "function") {
        try {
            await google.maps.importLibrary("marker");
        } catch (err) {
            console.warn("⚠️ [MAPA_MARCADORES]: No se pudo importar dinámicamente la librería 'marker':", err);
        }
    }

    const bounds = new google.maps.LatLngBounds();
    const geocoder = new google.maps.Geocoder();

    const promesasMarcadores = listaPedidos.map((pedido, idx) => {
        return new Promise((resolve) => {
            let estadoCalculado = pedido.estado ? pedido.estado.toLowerCase() : "asignado";

            if (idx === indiceActivo && estadoCalculado !== "entregado" && estadoCalculado !== "no-entregado") {
                estadoCalculado = "en-camino";
            }

            const zonaCanonica = estandarizarZonaCanonica(obtenerZonaParadaCanonica(pedido));
            const consecutivo = pedido.consecutivoZona || pedido.secuenciaZona || (idx + 1);
            const idUnicoParada = String(pedido.id || pedido.ssc || `#PNT-${idx + 1}`).trim();
            const claveUnicaEmparejamiento = `${idUnicoParada}_${zonaCanonica}_${consecutivo}`;
            const nombreCliente = pedido.destinatario || pedido.cliente || pedido.nombre_cliente || "Cliente";

            const procesarCreacionMarcador = (latLngPos) => {
                bounds.extend(latLngPos);

                const iconoCyberpunk = crearIconoParadaCyberpunkSVG({
                    estado: estadoCalculado,
                    secuencia: consecutivo,
                    causal: pedido.causal || ""
                });

                const marker = crearMarcadorEnPosicion({
                    mapaInstancia: mapa,
                    posicion: latLngPos,
                    contenidoIcono: iconoCyberpunk,
                    titulo: `[${zonaCanonica} - STOP #${consecutivo}] ${nombreCliente}`
                });

                const grupoAsignado = String(pedido.grupoId || pedido.grupo || pedido.cluster || zonaCanonica).trim();
                
                marker.datosParada = {
                    idParada: idUnicoParada,
                    sscParada: pedido.ssc || idUnicoParada,
                    secuencia: consecutivo,
                    consecutivoZona: consecutivo,
                    zona: zonaCanonica,
                    claveUnica: claveUnicaEmparejamiento,
                    grupoId: grupoAsignado
                };

                if (typeof marker.set === "function") {
                    marker.set("idParada", idUnicoParada);
                    marker.set("sscParada", pedido.ssc || idUnicoParada);
                    marker.set("consecutivoZona", consecutivo);
                    marker.set("zona", zonaCanonica);
                }

                const templateInfo = `
                    <div style="background: #0d1117; color: #fff; padding: 10px; border: 1px solid #00e5ff; font-family: 'Fira Code', monospace; font-size: 0.78rem; border-radius: 6px; min-width: 180px; pointer-events: none;">
                        <div style="color: #00e5ff; font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #2d3748; padding-bottom: 2px;">
                            [<span style="color:#ff3366">${zonaCanonica}</span> - STOP #${consecutivo}] ${nombreCliente}
                        </div>
                        <div><span style="color: #8af7b3;">📍 DIR:</span> ${pedido.direccion || pedido.dir || "N/A"}</div>
                        <div><span style="color: #8af7b3;">📞 TEL:</span> ${pedido.telefono || pedido.tel || "N/A"}</div>
                        <div style="margin-top: 4px;">
                            <span style="color: #ffb300;">⚡ ESTADO:</span> 
                            <strong style="text-transform: uppercase;">${estadoCalculado}</strong>
                        </div>
                    </div>`;

                const registrarSeleccionDirecta = () => {
                    try {
                        localStorage.setItem(KEY_ULTIMA_PARADA, idUnicoParada);
                        console.log(`📌 [MAPA_MARCADORES]: Selección registrada -> ${claveUnicaEmparejamiento} (${nombreCliente})`);
                    } catch (err) {
                        console.warn("⚠️ Error guardando selección directa en localStorage:", err);
                    }
                };

                const ejecutarManejoClic = (e) => {
                    if (e && e.domEvent) e.domEvent.stopPropagation();
                    if (e && typeof e.stopPropagation === "function") e.stopPropagation();

                    if (window.infoWindowMensajero) {
                        window.infoWindowMensajero.close();
                    }

                    registrarSeleccionDirecta();
                    cerrarOverlayActivo();

                    const MenuClass = obtenerClaseMenuRadialOverlay();
                    if (!MenuClass) return;

                    const posTarget = marker.position || (typeof marker.getPosition === "function" ? marker.getPosition() : latLngPos);

                    window.overlayMenuActivo = new MenuClass(posTarget, {
                        onEdit: () => window.cargarEdicionDesdePin(pedido),
                        onSequence: () => {
                            if (typeof window.moverParadaManual === "function") {
                                window.moverParadaManual(idUnicoParada, -1, zonaCanonica);
                            }
                        },
                        onMove: () => activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion),
                        onCall: () => window.iniciarLlamadaAndroid(pedido.telefono || pedido.tel),
                        onDelete: () => eliminarParadaProceso(marker, idUnicoParada, callbackActualizacion),
                        onCopyGPS: () => {
                            const lat = pedido.lat || (posTarget.lat ? posTarget.lat() : posTarget.lat);
                            const lng = pedido.lng || (posTarget.lng ? posTarget.lng() : posTarget.lng);
                            navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => alert(`📋 Coordenadas copiadas: ${lat}, ${lng}`));
                        },
                        onReport: () => abrirModalGestionParada(pedido, consecutivo),
                        onExternalNav: () => iniciarViajeNavegacionGPS(pedido)
                    });

                    window.overlayMenuActivo.setMap(mapa);
                };

                const mostrarGloboDebounced = () => {
                    if (timerHoverInfoWindow) clearTimeout(timerHoverInfoWindow);
                    timerHoverInfoWindow = setTimeout(() => {
                        if (window.infoWindowMensajero) {
                            window.infoWindowMensajero.setContent(templateInfo);
                            if (marker.esAvanzado) {
                                window.infoWindowMensajero.open({ map: mapa, anchor: marker });
                            } else {
                                window.infoWindowMensajero.open(mapa, marker);
                            }
                        }
                    }, 120);
                };

                const ocultarGloboDebounced = () => {
                    if (timerHoverInfoWindow) clearTimeout(timerHoverInfoWindow);
                    timerHoverInfoWindow = setTimeout(() => {
                        if (window.infoWindowMensajero) {
                            window.infoWindowMensajero.close();
                        }
                    }, 150);
                };

                if (marker.esAvanzado && marker.content) {
                    marker.content.addEventListener("click", ejecutarManejoClic);
                    marker.content.addEventListener("pointerdown", (e) => e.stopPropagation());
                    marker.content.addEventListener("mouseenter", mostrarGloboDebounced);
                    marker.content.addEventListener("mouseleave", ocultarGloboDebounced);
                } else if (typeof marker.addListener === "function") {
                    marker.addListener("click", ejecutarManejoClic);
                    marker.addListener("mouseover", mostrarGloboDebounced);
                    marker.addListener("mouseout", ocultarGloboDebounced);
                }

                window.marcadoresRutaMensajero.push(marker);
                resolve(marker);
            };

            const coordsDirectas = obtenerCoordenadasNavegacion(pedido);
            if (coordsDirectas) {
                const pos = new google.maps.LatLng(coordsDirectas.lat, coordsDirectas.lng);
                procesarCreacionMarcador(pos);
            } else {
                const dirCompleta = sanitizarDireccionContexto(pedido.direccion || pedido.dir);
                geocoder.geocode({ address: dirCompleta }, (results, status) => {
                    if (status === "OK" && results && results[0]) {
                        const posGeocodificada = results[0].geometry.location;
                        pedido.lat = posGeocodificada.lat();
                        pedido.lng = posGeocodificada.lng();
                        pedido.latitud = posGeocodificada.lat();
                        pedido.longitud = posGeocodificada.lng();
                        procesarCreacionMarcador(posGeocodificada);
                    } else {
                        console.warn(`⚠️ [MAPA_MARCADORES]: Imposible geocodificar dirección "${dirCompleta}". Status: ${status}`);
                        resolve(null);
                    }
                });
            }
        });
    });

    await Promise.all(promesasMarcadores);

    if (window.marcadoresRutaMensajero.length > 0 && !bounds.isEmpty()) {
        mapa.fitBounds(bounds);
        console.log(`✅ [MAPA_MARCADORES]: ${window.marcadoresRutaMensajero.length} marcadores desplegados visualmente en el visor de mapa.`);
    }
}

function activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion) {
    if (marker.esAvanzado) {
        marker.gmpDraggable = true;
    } else if (typeof marker.setDraggable === "function") {
        marker.setDraggable(true);
    }

    const idParada = marker.datosParada?.idParada || (typeof marker.get === "function" ? marker.get("idParada") : pedido.id);
    console.log("📍 [MAPA_MARCADORES]: Arrastre activado para parada ID:", idParada);

    const handlerDragEnd = async (event) => {
        const latLngTarget = event.latLng || marker.position;
        const nuevaLat = typeof latLngTarget.lat === "function" ? latLngTarget.lat() : latLngTarget.lat;
        const nuevaLng = typeof latLngTarget.lng === "function" ? latLngTarget.lng() : latLngTarget.lng;

        pedido.lat = nuevaLat;
        pedido.lng = nuevaLng;
        pedido.latitud = nuevaLat;
        pedido.longitud = nuevaLng;
        if (pedido.coordenadas && typeof pedido.coordenadas === "object") {
            pedido.coordenadas.lat = nuevaLat;
            pedido.coordenadas.lng = nuevaLng;
        }
        pedido.updated_at = new Date().toISOString();

        const actualizarBufferRAM = (arr) => {
            if (!Array.isArray(arr)) return;
            const idx = arr.findIndex((p) => p && compararIdsParada(p.id || p.ssc, pedido.id || pedido.ssc || idParada));
            if (idx !== -1) {
                arr[idx] = { ...arr[idx], ...pedido };
            }
        };

        actualizarBufferRAM(window.__CACHE_PARADAS_MACONDO__);
        actualizarBufferRAM(window.paradasMemoriaLocal);
        actualizarBufferRAM(window.paradasRutaActiva);
        actualizarBufferRAM(window.pedidosGlobales);

        geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, async (results, status) => {
            if (status === "OK" && results[0]) {
                pedido.direccion = results[0].formatted_address;
                pedido.dir = results[0].formatted_address;
            }

            try {
                if (typeof dbStore.actualizarParada === "function") {
                    await dbStore.actualizarParada(pedido, "paradas_rutas");
                }
                await actualizarParadaEnPlanillaLocal(pedido);

                let listadoActual = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
                if (typeof window.procesarNumeracionConsecutivaPorZona === "function") {
                    listadoActual = await window.procesarNumeracionConsecutivaPorZona(listadoActual);
                } else if (typeof guardarRutaZonificada === "function") {
                    await guardarRutaZonificada(listadoActual);
                }

                console.log("💾 [MAPA_MARCADORES]: Reubicación persistida atómicamente en IndexedDB.");
            } catch (err) {
                console.error("❌ [MAPA_MARCADORES]: Error al guardar reubicación local:", err);
            }

            const payload = {
                action: "actualizar_parada",
                id: pedido.id || idParada,
                ssc: pedido.ssc || idParada,
                planilla_id: pedido.planilla_id || null,
                lat: nuevaLat,
                lng: nuevaLng,
                latitud: nuevaLat,
                longitud: nuevaLng,
                direccion: pedido.direccion,
                updated_at: pedido.updated_at
            };

            if (esEntornoEstatico()) {
                console.log("ℹ️ [MAPA_MARCADORES_GITPAGES]: Entorno estático detectado. Reubicación guardada en cola local.");
                await registrarOperacionPendienteDefensivo("actualizar_parada", payload);
            } else {
                const baseUrl = obtenerEndpointAPI();
                const urlApi = `${baseUrl}?action=actualizar_parada`;

                fetch(urlApi, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(payload)
                })
                    .then(async (res) => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const data = await res.json().catch(() => ({}));
                        console.log("🌐 [MAPA_MARCADORES_MOVE_SYNC]: Respuesta del servidor:", data);
                    })
                    .catch(async (err) => {
                        console.warn("⚠️️ [MAPA_MARCADORES_OFFLINE]: Sync diferido guardado en cola offline:", err);
                        await registrarOperacionPendienteDefensivo("actualizar_parada", payload);
                    });
            }

            if (typeof callbackActualizacion === "function") {
                callbackActualizacion(pedido);
            }
        });

        if (marker.esAvanzado) {
            marker.gmpDraggable = false;
        } else if (typeof marker.setDraggable === "function") {
            marker.setDraggable(false);
        }
    };

    if (marker.esAvanzado && typeof marker.addListener === "function") {
        marker.addListener("dragend", handlerDragEnd);
    } else if (typeof google !== "undefined" && google.maps && google.maps.event) {
        google.maps.event.addListenerOnce(marker, "dragend", handlerDragEnd);
    }
}

async function eliminarParadaProceso(marker, idParada, callbackActualizacion) {
    if (!confirm(`¿Eliminar la parada ${idParada} del mapa y registro local?`)) return;

    try {
        console.log(`🗑️ [MAPA_MARCADORES]: Iniciando eliminación atómica para parada: ${idParada}`);

        if (marker) {
            if (typeof google !== "undefined" && google.maps && google.maps.event) {
                google.maps.event.clearInstanceListeners(marker);
            }
            if (marker.esAvanzado) {
                marker.map = null;
            } else if (typeof marker.setMap === "function") {
                marker.setMap(null);
            }
        }
        if (Array.isArray(window.marcadoresRutaMensajero)) {
            window.marcadoresRutaMensajero = window.marcadoresRutaMensajero.filter((m) => m !== marker);
        }

        let paradasActualizadas = limpiarParadaDeBuffersRAM(idParada);

        if (typeof window.procesarNumeracionConsecutivaPorZona === "function") {
            paradasActualizadas = await window.procesarNumeracionConsecutivaPorZona(paradasActualizadas);
        }

        if (typeof dbStore.eliminarParada === "function") {
            await dbStore.eliminarParada(idParada, "paradas_rutas");
            await dbStore.eliminarParada(idParada, "rutas_zonificadas").catch(() => {});
        }
        console.log("💾 [MAPA_MARCADORES]: Parada eliminada de IndexedDB:", idParada);

        const payload = {
            action: "eliminar_parada",
            id: idParada
        };

        if (esEntornoEstatico()) {
            console.log("ℹ️ [MAPA_MARCADORES_GITPAGES]: Entorno estático detectado. Eliminación registrada en cola local.");
            await registrarOperacionPendienteDefensivo("eliminar_parada", payload);
        } else {
            const baseUrl = obtenerEndpointAPI();
            const urlApi = `${baseUrl}?action=eliminar_parada&id=${encodeURIComponent(idParada)}`;

            fetch(urlApi, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload)
            })
                .then(async (res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json().catch(() => ({}));
                    console.log("🌐 [MAPA_MARCADORES_DEL_SYNC]: Parada eliminada del servidor remoto:", data);
                })
                .catch(async (err) => {
                    console.warn("⚠️ [MAPA_MARCADORES_OFFLINE]: Operación guardada en cola offline:", err);
                    await registrarOperacionPendienteDefensivo("eliminar_parada", payload);
                });
        }

        if (typeof window.refrescarConsolaOperacionesUI === "function") {
            await window.refrescarConsolaOperacionesUI(paradasActualizadas);
        }

        if (typeof callbackActualizacion === "function") {
            callbackActualizacion(paradasActualizadas);
        }
    } catch (err) {
        console.error("❌ [MAPA_MARCADORES]: Fallo al eliminar parada:", err);
    }
}

export function mutarMarcadorPorId(idParada, nuevoEstado, causal = "") {
    if (!window.marcadoresRutaMensajero) return;

    const marker = window.marcadoresRutaMensajero.find((m) => {
        const idParadaMarker = m.datosParada?.idParada || (typeof m.get === "function" ? m.get("idParada") : null);
        const sscParadaMarker = m.datosParada?.sscParada || (typeof m.get === "function" ? m.get("sscParada") : null);
        return compararIdsParada(idParadaMarker, idParada) || compararIdsParada(sscParadaMarker, idParada);
    });

    if (marker) {
        const sec = marker.datosParada?.consecutivoZona || (typeof marker.get === "function" ? marker.get("consecutivoZona") : 1);
        const nuevoIcono = crearIconoParadaCyberpunkSVG({
            estado: nuevoEstado,
            secuencia: sec,
            causal: causal
        });

        if (marker.esAvanzado) {
            marker.content = convertirAElementoNodoDOM(nuevoIcono);
        } else if (typeof marker.setIcon === "function") {
            const dataUrlBase64 = construirDataURISVG(nuevoIcono);
            marker.setIcon({
                url: dataUrlBase64,
                scaledSize: new google.maps.Size(42, 52),
                anchor: new google.maps.Point(21, 52)
            });
        }
        console.log(`⚡ [MUTACION_PIN]: Icono del marcador #${idParada} mutado exitosamente a estado: ${nuevoEstado}`);
    }
}

window.cargarEdicionDesdePin = function (paradaOrId) {
    const targetId = typeof paradaOrId === "object" && paradaOrId !== null
        ? String(paradaOrId.id || paradaOrId.ssc || "").trim()
        : String(paradaOrId || "").trim();

    console.log("🎯 [MAPA_MARCADORES]: Redirigiendo a edición para parada:", targetId || paradaOrId);

    if (typeof window.alternarVistaPestaña === "function") {
        window.alternarVistaPestaña("pestana-ruta-activa");
    } else if (typeof window.navegarA === "function") {
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
        if (typeof window.mostrarModalGestionParadaUI === "function") {
            window.mostrarModalGestionParadaUI(paradaOrId);
        } else if (typeof window.abrirModalEditarParada === "function") {
            window.abrirModalEditarParada(paradaOrId);
        } else if (typeof window.prepararEdicionParadaUI === "function") {
            window.prepararEdicionParadaUI(targetId || paradaOrId);
        } else {
            console.warn("⚠️ [MAPA_MARCADORES]: No se encontró un handler global válido para desplegar el modal de edición.");
        }
    }, 150);
};

if (typeof window !== "undefined") {
    window.MACONDO_MAP_ID = MACONDO_MAP_ID;
    window.crearMarcadorEnPosicion = crearMarcadorEnPosicion;
    window.renderizarMarcadoresInteractivos = renderizarMarcadoresInteractivos;
    window.mutarMarcadorPorId = mutarMarcadorPorId;
    window.abrirModalGestionParada = abrirModalGestionParada;
    window.cerrarOverlayActivo = cerrarOverlayActivo;
    window.iniciarViajeNavegacionGPS = iniciarViajeNavegacionGPS;
    window.manejarAccionOrbitalViajar = manejarAccionOrbitalViajar;
}