/**
 * PROTOCOLO MACONDO - GESTOR DE MARCADORES E INFOWINDOWS
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-marcadores.js
 */

import { crearIconoParadaRadarSVG } from "./mapa-iconos.js";

function sanitizarDireccionContexto(direccion) {
    if (!direccion) return "Cali, Colombia";
    const dirLower = direccion.toLowerCase();
    if (dirLower.includes("cali") || dirLower.includes("miranda")) {
        return direccion;
    }
    return `${direccion}, Cali, Colombia`;
}

export function renderizarMarcadoresInteractivos(listaPedidos, indiceActivo, callbackActualizacion) {
    // 1. Limpiar marcadores previos
    window.marcadoresRutaMensajero.forEach((m) => m.setMap(null));
    window.marcadoresRutaMensajero = [];

    if (!listaPedidos || listaPedidos.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    const geocoder = new google.maps.Geocoder();

    listaPedidos.forEach((pedido, idx) => {
        const dirCompleta = sanitizarDireccionContexto(pedido.direccion);

        geocoder.geocode({ address: dirCompleta }, (results, status) => {
            if (status === "OK" && results[0]) {
                const pos = results[0].geometry.location;
                bounds.extend(pos);

                const esActivo = idx === indiceActivo;
                const colorFill = esActivo ? "#00ff66" : pedido.estado === "FINALIZADO" ? "#555555" : "#00e5ff";

                const marker = new google.maps.Marker({
                    position: pos,
                    map: window.mapaMensajero,
                    draggable: true,
                    icon: crearIconoParadaRadarSVG(colorFill, "#ffffff"),
                    title: `[${String.fromCharCode(65 + idx)}] ${pedido.destinatario || "Cliente"}`
                });

                const templateInfo = `
                    <div style="background: #0c080f; color: #fff; padding: 8px 12px; border: 1px solid ${colorFill}; font-family: monospace; font-size: 0.78rem; border-radius: 4px;">
                        <strong style="color: ${colorFill}; font-size: 0.85rem;">[${String.fromCharCode(65 + idx)}] ${pedido.destinatario || "Cliente"}</strong><br/>
                        <span style="color: #aaa;">📍 Dir:</span> ${pedido.direccion}<br/>
                        <span style="color: #aaa;">📞 Tel:</span> ${pedido.telefono || "N/A"}<br/>
                        <span style="color: #00ff66;">📦 Estado:</span> ${pedido.estado}
                    </div>`;

                marker.addListener("mouseover", () => {
                    if (window.infoWindowMensajero) {
                        window.infoWindowMensajero.setContent(templateInfo);
                        window.infoWindowMensajero.open(window.mapaMensajero, marker);
                    }
                });

                marker.addListener("mouseout", () => {
                    if (window.infoWindowMensajero) window.infoWindowMensajero.close();
                });

                // Soporte Drag & Drop
                marker.addListener("dragend", (event) => {
                    const nuevaLat = event.latLng.lat();
                    const nuevaLng = event.latLng.lng();

                    geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, (revResults, revStatus) => {
                        if (revStatus === "OK" && revResults[0]) {
                            pedido.direccion = revResults[0].formatted_address;
                            if (typeof callbackActualizacion === "function") {
                                callbackActualizacion();
                            }
                        }
                    });
                });

                window.marcadoresRutaMensajero.push(marker);
                window.mapaMensajero.fitBounds(bounds);
            }
        });
    });
}