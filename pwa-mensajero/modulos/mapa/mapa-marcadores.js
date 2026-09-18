/**
 * PROTOCOLO MACONDO - GESTOR DE MARCADORES E INFOWINDOWS CYBERPUNK
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-marcadores.js
 */

import { crearIconoParadaCyberpunkSVG } from "./mapa-iconos.js";

// Asegurar arreglo global para referencia
window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];

/**
 * Normaliza y añade contexto a las direcciones si no vienen con ciudad
 */
function sanitizarDireccionContexto(direccion) {
    if (!direccion) return "Cali, Colombia";
    const dirLower = direccion.toLowerCase();
    if (dirLower.includes("cali") || dirLower.includes("jamundi") || dirLower.includes("yumbo")) {
        return direccion;
    }
    return `${direccion}, Cali, Colombia`;
}

/**
 * Asigna o actualiza la colección de marcadores interactivos en Google Maps
 * @param {Array} listaPedidos - Arreglo de objetos de tipo parada/pedido
 * @param {number} indiceActivo - Índice de la parada en curso
 * @param {Function} callbackActualizacion - Evento ejecutado tras Drag & Drop
 */
export function renderizarMarcadoresInteractivos(listaPedidos, indiceActivo, callbackActualizacion) {
    // 1. Limpiar marcadores previos del mapa
    if (Array.isArray(window.marcadoresRutaMensajero)) {
        window.marcadoresRutaMensajero.forEach((m) => m.setMap(null));
    }
    window.marcadoresRutaMensajero = [];

    if (!listaPedidos || listaPedidos.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    const geocoder = new google.maps.Geocoder();

    listaPedidos.forEach((pedido, idx) => {
        // Mapeo automático del estado según reglas de negocio
        let estadoCalculado = pedido.estado ? pedido.estado.toLowerCase() : 'asignado';
        
        if (idx === indiceActivo && estadoCalculado !== 'entregado' && estadoCalculado !== 'no-entregado') {
            estadoCalculado = 'en-camino';
        }

        // Configurar icono dinámico Cyberpunk según estado mutado
        const iconoCyberpunk = crearIconoParadaCyberpunkSVG({
            estado: estadoCalculado,
            secuencia: idx + 1,
            causal: pedido.causal || ''
        });

        // Función interna para instanciar el marcador
        const crearMarcadorEnPosicion = (latLngPos) => {
            bounds.extend(latLngPos);

            const marker = new google.maps.Marker({
                position: latLngPos,
                map: window.mapaMensajero,
                draggable: true,
                icon: iconoCyberpunk,
                title: `[STOP #${idx + 1}] ${pedido.destinatario || "Cliente"}`
            });

            // Almacenar metadatos en la instancia
            marker.set('idParada', pedido.id || `#PNT-${idx + 1}`);
            marker.set('secuencia', idx + 1);

            // Plantilla Infowindow Cyberpunk
            const templateInfo = `
                <div style="background: #0d1117; color: #fff; padding: 10px; border: 1px solid #00e5ff; font-family: 'Fira Code', monospace; font-size: 0.78rem; border-radius: 4px; min-width: 180px;">
                    <div style="color: #00e5ff; font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #2d3748; padding-bottom: 2px;">
                        [STOP #${idx + 1}] ${pedido.destinatario || "CLIENTE"}
                    </div>
                    <div><span style="color: #8af7b3;">📍 DIR:</span> ${pedido.direccion}</div>
                    <div><span style="color: #8af7b3;">📞 TEL:</span> ${pedido.telefono || "N/A"}</div>
                    <div style="margin-top: 4px;">
                        <span style="color: #ffb300;">⚡ ESTADO:</span> 
                        <strong style="text-transform: uppercase;">${estadoCalculado}</strong>
                        ${pedido.causal ? `<br/><span style="color: #ff3333;">⚠️ CAUSAL: ${pedido.causal}</span>` : ''}
                    </div>
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

            // Evento Drag & Drop para geocodificación inversa al mover el pin
            marker.addListener("dragend", (event) => {
                const nuevaLat = event.latLng.lat();
                const nuevaLng = event.latLng.lng();

                pedido.lat = nuevaLat;
                pedido.lng = nuevaLng;

                geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, (revResults, revStatus) => {
                    if (revStatus === "OK" && revResults[0]) {
                        pedido.direccion = revResults[0].formatted_address;
                        if (typeof callbackActualizacion === "function") {
                            callbackActualizacion(pedido);
                        }
                    }
                });
            });

            window.marcadoresRutaMensajero.push(marker);
            window.mapaMensajero.fitBounds(bounds);
        };

        // 2. Evaluar si la parada ya posee coordenadas o requiere Geocoding
        if (pedido.lat && pedido.lng) {
            const pos = new google.maps.LatLng(parseFloat(pedido.lat), parseFloat(pedido.lng));
            crearMarcadorEnPosicion(pos);
        } else {
            const dirCompleta = sanitizarDireccionContexto(pedido.direccion);
            geocoder.geocode({ address: dirCompleta }, (results, status) => {
                if (status === "OK" && results[0]) {
                    crearMarcadorEnPosicion(results[0].geometry.location);
                }
            });
        }
    });
}

/**
 * Mutar el marcador en tiempo real cuando el usuario cambia el estado en la lista
 */
export function mutarMarcadorPorId(idParada, nuevoEstado, causal = '') {
    if (!window.marcadoresRutaMensajero) return;

    const marker = window.marcadoresRutaMensajero.find(m => m.get('idParada') === idParada);
    if (marker) {
        const sec = marker.get('secuencia') || 1;
        const nuevoIcono = crearIconoParadaCyberpunkSVG({
            estado: nuevoEstado,
            secuencia: sec,
            causal: causal
        });
        marker.setIcon(nuevoIcono);
    }
}