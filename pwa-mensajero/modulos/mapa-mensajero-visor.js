/**
 * PROTOCOLO MACONDO - VISOR, MARCADORES Y ENRUTAMIENTO TELEMÁTICO (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa-mensajero-visor.js
 */

import { desplegarZonaMensajeroEnMapa } from "./mapa-mensajero-zonas.js";

window.mapaMensajero = null;
window.renderRutasMensajero = null;
window.marcadoresRutaMensajero = [];
window.infoWindowMensajero = null;
window.pendientesParaRenderizar = null;

/**
 * Genera un icono vectorial dinámico SVG estilo "cajita" con colores de estado.
 */
export function crearIconoCajitaSVG(colorFill = "#00e5ff", colorStroke = "#ffffff") {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="7" width="18" height="14" rx="2" fill="${colorFill}" stroke="${colorStroke}" stroke-width="1.5" />
        <path d="M3 10H21" stroke="${colorStroke}" stroke-width="1.5" stroke-dasharray="2 2" />
        <path d="M12 7V21" stroke="${colorStroke}" stroke-width="1.5" />
        <path d="M7 7L12 10L17 7" stroke="${colorStroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="14" r="1.5" fill="${colorStroke}" />
    </svg>`;
    return {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
    };
}

/**
 * Sanitiza la dirección adjuntando el contexto urbano predeterminado.
 */
function sanitizarDireccionContexto(direccion) {
    if (!direccion) return "Cali, Colombia";
    const dirLower = direccion.toLowerCase();
    if (dirLower.includes("cali") || dirLower.includes("miranda")) {
        return direccion;
    }
    return `${direccion}, Cali, Colombia`;
}

/**
 * Inicializa el lienzo del mapa de Google Maps con la estética Cyberpunk y controles telemáticos.
 */
export function inicializarMapaMensajero() {
    console.log(">>> [MAPA_MENSAJERO_INIT]: Evaluando entorno de hardware...");
    
    const contenedorMapa = document.getElementById("mapa-mensajero");

    if (!contenedorMapa) {
        setTimeout(inicializarMapaMensajero, 300);
        return;
    }

    if (typeof google === "undefined" || !google.maps) {
        return;
    }

    try {
        window.infoWindowMensajero = new google.maps.InfoWindow();
        window.mapaMensajero = new google.maps.Map(contenedorMapa, {
            center: { lat: 3.4516, lng: -76.5320 },
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

        // Instanciar el renderizador de polígonos telemáticos entre paradas
        window.renderRutasMensajero = new google.maps.DirectionsRenderer({
            map: window.mapaMensajero,
            suppressMarkers: true,
            polylineOptions: { strokeColor: "#00e5ff", strokeOpacity: 0.8, strokeWeight: 4 }
        });

        console.log(">>> [MAPA_MENSAJERO_READY]: Canvas telemático y motor de trayectos listos.");

        if (window.pendientesParaRenderizar) {
            const { listaPedidos, indiceActivo } = window.pendientesParaRenderizar;
            window.pendientesParaRenderizar = null;
            actualizarPuntosEnMapa(listaPedidos, indiceActivo);
        }

    } catch (e) {
        console.error(">>> [MAPA_MENSAJERO_ERROR]: Fallo instanciando el mapa:", e);
    }
}

/**
 * Actualiza los puntos en el mapa, procesa polígonos de zona, dibuja marcadores y recalcula trayectos.
 * Soporta borrado reactivo cuando listaPedidos está vacía.
 * 
 * @param {Array<Object>} listaPedidos - Lista completa de pedidos/paradas.
 * @param {number} indiceActivo - Índice de la parada en curso.
 */
export async function actualizarPuntosEnMapa(listaPedidos, indiceActivo) {
    if (!window.mapaMensajero || typeof google === "undefined" || !google.maps) {
        window.pendientesParaRenderizar = { listaPedidos, indiceActivo };
        return;
    }

    // 1. Purgar marcadores anteriores del lienzo
    window.marcadoresRutaMensajero.forEach(m => m.setMap(null));
    window.marcadoresRutaMensajero = [];

    // 2. Si la lista de paradas se vacía (por borrado manual o purga local), limpiar trazado y salir
    if (!listaPedidos || listaPedidos.length === 0) {
        console.log(">>> [MAPA_MENSAJERO_CLEAN]: No hay paradas activas. Limpiando trazado telemático.");
        if (window.renderRutasMensajero) {
            window.renderRutasMensajero.setDirections({ routes: [] });
        }
        return;
    }

    // 3. Desplegar zonas geográficas coloreadas
    const zonaDetectada = listaPedidos[0]?.zonaKey || "NORTE";
    if (typeof desplegarZonaMensajeroEnMapa === "function") {
        desplegarZonaMensajeroEnMapa(window.mapaMensajero, zonaDetectada);
    }

    // 4. Preparar el trazado continuo entre los puntos (DirectionsService)
    if (google.maps.DirectionsService && listaPedidos.length >= 1) {
        try {
            const servicioDirecciones = new google.maps.DirectionsService();
            const paradasWaypoints = listaPedidos.map(p => ({
                location: sanitizarDireccionContexto(p.direccion),
                stopover: true
            }));

            const origenRuta = paradasWaypoints[0].location;
            const destinoRuta = paradasWaypoints[paradasWaypoints.length - 1].location;
            const intermediarios = paradasWaypoints.length > 2 ? paradasWaypoints.slice(1, -1) : [];

            const request = {
                origin: origenRuta,
                destination: destinoRuta,
                waypoints: intermediarios,
                optimizeWaypoints: false,
                travelMode: google.maps.TravelMode.DRIVING
            };

            servicioDirecciones.route(request, (response, status) => {
                if (status === google.maps.DirectionsStatus.OK && window.renderRutasMensajero) {
                    window.renderRutasMensajero.setDirections(response);
                }
            });
        } catch (e) {
            console.warn(">>> [ENRUTAMIENTO_MENSAJERO_WARN]: No se pudo trazar polilínea:", e);
        }
    }

    // 5. Dibujar marcadores interactivos con soporte de Drag & Drop y edición
    const bounds = new google.maps.LatLngBounds();
    const geocoder = new google.maps.Geocoder();

    listaPedidos.forEach((pedido, idx) => {
        const dirCompleta = sanitizarDireccionContexto(pedido.direccion);

        geocoder.geocode({ address: dirCompleta }, (results, status) => {
            if (status === "OK" && results[0]) {
                const pos = results[0].geometry.location;
                bounds.extend(pos);

                const esActivo = idx === indiceActivo;
                const colorCajita = esActivo ? "#00ff66" : (pedido.estado === "FINALIZADO" ? "#555555" : "#00e5ff");

                const marker = new google.maps.Marker({
                    position: pos,
                    map: window.mapaMensajero,
                    draggable: true, // Permitir reubicación interactiva
                    icon: crearIconoCajitaSVG(colorCajita, "#ffffff"),
                    title: `[${String.fromCharCode(65 + idx)}] ${pedido.destinatario || 'Cliente'}`
                });

                const templateInfo = `
                    <div style="background: #0c080f; color: #fff; padding: 8px 12px; border: 1px solid ${colorCajita}; font-family: monospace; font-size: 0.78rem; border-radius: 4px;">
                        <strong style="color: ${colorCajita}; font-size: 0.85rem;">[${String.fromCharCode(65 + idx)}] ${pedido.destinatario || 'Cliente'}</strong><br/>
                        <span style="color: #aaa;">📍 Dir:</span> ${pedido.direccion}<br/>
                        <span style="color: #aaa;">📞 Tel:</span> ${pedido.telefono || 'N/A'}<br/>
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

                // Re-trazado telemático dinámico al arrastrar el pin
                marker.addListener("dragend", (event) => {
                    const nuevaLat = event.latLng.lat();
                    const nuevaLng = event.latLng.lng();
                    console.log(`>>> [MENSAJERO_PUNTO_MOVIDO]: Nueva ubicación Lat: ${nuevaLat}, Lng: ${nuevaLng}`);

                    geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, (revResults, revStatus) => {
                        if (revStatus === "OK" && revResults[0]) {
                            const nuevaDirString = revResults[0].formatted_address;
                            pedido.direccion = nuevaDirString;
                            
                            // Refrescar traza telemática y UI
                            if (typeof window.refrescarUI === "function") {
                                window.refrescarUI();
                            } else {
                                actualizarPuntosEnMapa(listaPedidos, indiceActivo);
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

window.inicializarMapaMensajero = inicializarMapaMensajero;
window.actualizarPuntosEnMapa = actualizarPuntosEnMapa;