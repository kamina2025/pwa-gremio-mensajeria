/**
 * PROTOCOLO MACONDO - ORQUESTADOR PRINCIPAL DE MARCADORES
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-marcadores.js
 * Arquitectura: Modularizada / AdvancedMarkerElement (Direct SVG InnerHTML Wrapper) / Orbital UI
 */

import { crearIconoParadaCyberpunkSVG } from "./mapa-iconos.js";
import { obtenerClaseMenuRadialOverlay } from "./marcadores/mapa-overlay-orbital.js";
import { abrirModalGestionParada as abrirModalGestionParadaImpl } from "./marcadores/mapa-modal-parada.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "./zonificacion/estandar-zonas.js";

import { crearMarcadorEnPosicion, convertirAElementoNodoDOM, construirDataURISVG } from "./marcadores/mapa-marcadores-fabrica.js";
import { activarArrastreMarcador, eliminarParadaProceso, compararIdsParada } from "./marcadores/mapa-marcadores-acciones.js";

export const MACONDO_MAP_ID = "a43606b6027853016f1d7f2f";
const KEY_ULTIMA_PARADA = 'macondo_ultima_parada_id';

window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];
window.overlayMenuActivo = null;
let timerHoverInfoWindow = null;

export function cerrarOverlayActivo() {
    if (window.overlayMenuActivo && typeof window.overlayMenuActivo.cerrar === "function") window.overlayMenuActivo.cerrar();
}

function sanitizarDireccionContexto(direccion) {
    if (!direccion) return "Cali, Colombia";
    const dirLower = direccion.toLowerCase();
    if (dirLower.includes("cali") || dirLower.includes("jamundi") || dirLower.includes("yumbo")) return direccion;
    return `${direccion}, Cali, Colombia`;
}

function obtenerCoordenadasNavegacion(parada) {
    if (!parada) return null;
    let rawLat = parada.lat || parada.latitud;
    let rawLng = parada.lng || parada.longitud;
    if ((rawLat === undefined || rawLng === undefined) && parada.coordenadas) {
        rawLat = parada.coordenadas.lat || parada.coordenadas.latitud;
        rawLng = parada.coordenadas.lng || parada.coordenadas.longitud;
    }
    const lat = parseFloat(rawLat), lng = parseFloat(rawLng);
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
    return { lat, lng };
}

window.iniciarLlamadaAndroid = function (numeroTelefono) {
    if (!numeroTelefono || numeroTelefono === "N/A") return alert("⚠️ Sin número de teléfono válido.");
    window.location.href = `tel:${numeroTelefono.replace(/[^\d+]/g, "")}`;
};

export function iniciarViajeNavegacionGPS(parada) {
    if (!parada) return;
    if (typeof window.trazarRutaNavegacionInternaGPS === "function") {
        window.trazarRutaNavegacionInternaGPS(parada);
    } else {
        const coords = typeof window.obtenerCoordenadasValidasParada === "function" ? window.obtenerCoordenadasValidasParada(parada) : obtenerCoordenadasNavegacion(parada);
        if (coords) window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`, "_blank");
    }
}

export function manejarAccionOrbitalViajar(paradaSeleccionada) {
    iniciarViajeNavegacionGPS(paradaSeleccionada);
}

export function mutarMarcadorPorId(idParada, nuevoEstado, causal = "") {
    if (!window.marcadoresRutaMensajero) return;
    const marker = window.marcadoresRutaMensajero.find((m) => compararIdsParada(m.datosParada?.idParada, idParada) || compararIdsParada(m.datosParada?.sscParada, idParada));
    
    if (marker) {
        const sec = marker.datosParada?.consecutivoZona || 1;
        const nuevoIcono = crearIconoParadaCyberpunkSVG({ estado: nuevoEstado, secuencia: sec, causal });
        
        if (marker.esAvanzado) {
            marker.content = convertirAElementoNodoDOM(nuevoIcono);
        } else if (typeof marker.setIcon === "function") {
            marker.setIcon({ url: construirDataURISVG(nuevoIcono), scaledSize: new google.maps.Size(42, 52), anchor: new google.maps.Point(21, 52) });
        }
        console.log(`⚡ [MUTACION_PIN]: Marcador #${idParada} mutado a estado: ${nuevoEstado}`);
    }
}

export function abrirModalGestionParada(pedido, indice) {
    abrirModalGestionParadaImpl(pedido, indice, mutarMarcadorPorId);
}

export async function renderizarMarcadoresInteractivos(listaPedidos, indiceActivo, callbackActualizacion) {
    if (Array.isArray(window.marcadoresRutaMensajero)) {
        window.marcadoresRutaMensajero.forEach((m) => {
            if (m) {
                if (typeof google !== "undefined" && google.maps?.event) google.maps.event.clearInstanceListeners(m);
                if (m.esAvanzado) m.map = null; else if (typeof m.setMap === "function") m.setMap(null);
            }
        });
    }
    window.marcadoresRutaMensajero = [];

    if (!listaPedidos || listaPedidos.length === 0) return;
    const mapa = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;
    if (!mapa || !google?.maps) return console.warn("⚠️ Instancia de Google Maps no lista.");

    if (typeof google.maps.importLibrary === "function") await google.maps.importLibrary("marker").catch(()=>{});

    const bounds = new google.maps.LatLngBounds();
    const geocoder = new google.maps.Geocoder();

    const promesas = listaPedidos.map((pedido, idx) => {
        return new Promise((resolve) => {
            let estado = pedido.estado ? pedido.estado.toLowerCase() : "asignado";
            if (idx === indiceActivo && estado !== "entregado" && estado !== "no-entregado") estado = "en-camino";

            const zona = estandarizarZonaCanonica(obtenerZonaParadaCanonica(pedido));
            const sec = pedido.consecutivoZona || pedido.secuenciaZona || (idx + 1);
            const idParada = String(pedido.id || pedido.ssc || `#PNT-${idx + 1}`).trim();
            const nombre = pedido.destinatario || pedido.cliente || "Cliente";

            const desplegar = (latLngPos) => {
                bounds.extend(latLngPos);
                const marker = crearMarcadorEnPosicion({
                    mapaInstancia: mapa,
                    posicion: latLngPos,
                    contenidoIcono: crearIconoParadaCyberpunkSVG({ estado, secuencia: sec, causal: pedido.causal || "" }),
                    titulo: `[${zona} - STOP #${sec}] ${nombre}`
                });

                marker.datosParada = { idParada, sscParada: pedido.ssc || idParada, secuencia: sec, consecutivoZona: sec, zona };

                const templateInfo = `
                    <div style="background: #0d1117; color: #fff; padding: 10px; border: 1px solid #00e5ff; font-family: 'Fira Code', monospace; font-size: 0.78rem; border-radius: 6px; pointer-events: none;">
                        <div style="color: #00e5ff; font-weight: bold; border-bottom: 1px solid #2d3748; padding-bottom: 2px;">[<span style="color:#ff3366">${zona}</span> - STOP #${sec}] ${nombre}</div>
                        <div><span style="color: #8af7b3;">📍 DIR:</span> ${pedido.direccion || pedido.dir || "N/A"}</div>
                        <div><span style="color: #8af7b3;">📞 TEL:</span> ${pedido.telefono || pedido.tel || "N/A"}</div>
                        <div><span style="color: #ffb300;">⚡ ESTADO:</span> <strong style="text-transform: uppercase;">${estado}</strong></div>
                    </div>`;

                const clickHandler = (e) => {
                    if (e?.domEvent) e.domEvent.stopPropagation();
                    if (e?.stopPropagation) e.stopPropagation();
                    if (window.infoWindowMensajero) window.infoWindowMensajero.close();
                    
                    localStorage.setItem(KEY_ULTIMA_PARADA, idParada);
                    cerrarOverlayActivo();

                    const MenuClass = obtenerClaseMenuRadialOverlay();
                    if (MenuClass) {
                        const pos = marker.position || (marker.getPosition ? marker.getPosition() : latLngPos);
                        window.overlayMenuActivo = new MenuClass(pos, {
                            onEdit: () => window.cargarEdicionDesdePin(pedido),
                            onSequence: () => window.moverParadaManual?.(idParada, -1, zona),
                            onMove: () => activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion),
                            onCall: () => window.iniciarLlamadaAndroid(pedido.telefono || pedido.tel),
                            onDelete: () => eliminarParadaProceso(marker, idParada, callbackActualizacion),
                            onCopyGPS: () => navigator.clipboard.writeText(`${pos.lat}, ${pos.lng}`).then(() => alert("📋 Copiado")),
                            onReport: () => abrirModalGestionParada(pedido, sec),
                            onExternalNav: () => iniciarViajeNavegacionGPS(pedido)
                        });
                        window.overlayMenuActivo.setMap(mapa);
                    }
                };

                const showInfo = () => {
                    clearTimeout(timerHoverInfoWindow);
                    timerHoverInfoWindow = setTimeout(() => {
                        if (window.infoWindowMensajero) {
                            window.infoWindowMensajero.setContent(templateInfo);
                            if (marker.esAvanzado) window.infoWindowMensajero.open({ map: mapa, anchor: marker });
                            else window.infoWindowMensajero.open(mapa, marker);
                        }
                    }, 120);
                };

                const hideInfo = () => {
                    clearTimeout(timerHoverInfoWindow);
                    timerHoverInfoWindow = setTimeout(() => window.infoWindowMensajero?.close(), 150);
                };

                if (marker.esAvanzado && marker.content) {
                    marker.content.addEventListener("click", clickHandler);
                    marker.content.addEventListener("pointerdown", e => e.stopPropagation());
                    marker.content.addEventListener("mouseenter", showInfo);
                    marker.content.addEventListener("mouseleave", hideInfo);
                } else if (marker.addListener) {
                    marker.addListener("click", clickHandler);
                    marker.addListener("mouseover", showInfo);
                    marker.addListener("mouseout", hideInfo);
                }

                window.marcadoresRutaMensajero.push(marker);
                resolve(marker);
            };

            const coords = obtenerCoordenadasNavegacion(pedido);
            if (coords) return desplegar(new google.maps.LatLng(coords.lat, coords.lng));

            geocoder.geocode({ address: sanitizarDireccionContexto(pedido.direccion || pedido.dir) }, (res, status) => {
                if (status === "OK" && res[0]) {
                    pedido.lat = pedido.latitud = res[0].geometry.location.lat();
                    pedido.lng = pedido.longitud = res[0].geometry.location.lng();
                    desplegar(res[0].geometry.location);
                } else resolve(null);
            });
        });
    });

    await Promise.all(promesas);
    if (window.marcadoresRutaMensajero.length > 0 && !bounds.isEmpty()) mapa.fitBounds(bounds);
}

window.cargarEdicionDesdePin = function (paradaOrId) {
    const targetId = typeof paradaOrId === "object" ? String(paradaOrId.id || paradaOrId.ssc || "").trim() : String(paradaOrId).trim();
    if (window.alternarVistaPestaña) window.alternarVistaPestaña("pestana-ruta-activa");
    else if (window.navegarA) window.navegarA("vistas/ruta/ruta-activa.html");
    setTimeout(() => {
        if (window.mostrarModalGestionParadaUI) window.mostrarModalGestionParadaUI(paradaOrId);
        else if (window.abrirModalEditarParada) window.abrirModalEditarParada(paradaOrId);
        else if (window.prepararEdicionParadaUI) window.prepararEdicionParadaUI(targetId);
    }, 150);
};

if (typeof window !== "undefined") {
    window.MACONDO_MAP_ID = MACONDO_MAP_ID;
    window.renderizarMarcadoresInteractivos = renderizarMarcadoresInteractivos;
    window.mutarMarcadorPorId = mutarMarcadorPorId;
    window.abrirModalGestionParada = abrirModalGestionParada;
    window.cerrarOverlayActivo = cerrarOverlayActivo;
    window.iniciarViajeNavegacionGPS = iniciarViajeNavegacionGPS;
    window.manejarAccionOrbitalViajar = manejarAccionOrbitalViajar;
}