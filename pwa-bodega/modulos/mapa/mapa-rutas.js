/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE ENRUTAMIENTO Y TRAZADO TELEMÁTICO
 * Ubicación: pwa-bodega/modulos/mapa/mapa-rutas.js
 */

import { crearIconoCajitaSVG, generarTemplateInfoWindow } from "./mapa-iconos.js";
import { ejecutarContingenciaTarifaria } from "./mapa-geocoder.js";

/**
 * Sanitiza y añade el contexto regional a las direcciones ingresadas.
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
 * Proyecta la ruta telemática y renderiza los marcadores personalizados en el mapa.
 */
export async function previsualizarRutaInmediata(origen, destinoProvisional) {
    if (!window.googleMapsOperativo || typeof google === "undefined" || !google.maps.DirectionsService) {
        ejecutarContingenciaTarifaria();
        return;
    }

    try {
        const servicioDirecciones = new google.maps.DirectionsService();
        const paradasWaypoints = [];

        if (window.loteActualPedidos && window.loteActualPedidos.length > 0) {
            window.loteActualPedidos.forEach((pedido) => {
                const dirParada = pedido.direccion || pedido.direccionDestino || "";
                if (dirParada) {
                    paradasWaypoints.push({
                        location: sanitizarDireccionContexto(dirParada),
                        stopover: true
                    });
                }
            });
        }

        const origenDefinido = sanitizarDireccionContexto(
            origen || document.getElementById("origen-cliente")?.value.trim() || "Cali, Colombia"
        );

        const destinoDefinido = destinoProvisional
            ? sanitizarDireccionContexto(destinoProvisional)
            : (paradasWaypoints.length > 0 ? paradasWaypoints[paradasWaypoints.length - 1].location : origenDefinido);

        const request = {
            origin: origenDefinido,
            destination: destinoDefinido,
            waypoints: paradasWaypoints.length > 1 ? paradasWaypoints.slice(0, -1) : [],
            optimizeWaypoints: false,
            travelMode: google.maps.TravelMode.DRIVING
        };

        const response = await new Promise((resolve, reject) => {
            servicioDirecciones.route(request, (res, status) => {
                if (status === google.maps.DirectionsStatus.OK) resolve(res);
                else reject(status);
            });
        });

        if (window.renderRutas) {
            window.renderRutas.setDirections(response);
        }

        limpiarMarcadoresPersonalizados();

        const rutaGoogle = response.routes[0];
        const bounds = new google.maps.LatLngBounds();

        rutaGoogle.legs.forEach((tramo, indice) => {
            bounds.extend(tramo.start_location);
            bounds.extend(tramo.end_location);

            const esMatrizOrigen = indice === 0;
            const datosPedido = (window.loteActualPedidos && window.loteActualPedidos[indice - 1])
                ? window.loteActualPedidos[indice - 1]
                : null;

            const infoPunto = {
                alias: esMatrizOrigen ? "MATRIZ ORIGEN BODEGA" : (datosPedido?.destinatario || datosPedido?.alias || `PUNTO ACOPIO [${indice}]`),
                direccion: tramo.start_address || (datosPedido?.direccion || "Dirección Registrada"),
                telefono: datosPedido?.telefono || "N/A",
                carga: datosPedido?.carga || "Carga Estándar",
                id: datosPedido?.id || datosPedido?.hash_id || (esMatrizOrigen ? "#ORIGEN-0" : `#PNT-${indice}`)
            };

            const colorBox = esMatrizOrigen ? "#b359ff" : "#ff3366";
            const marker = new google.maps.Marker({
                position: tramo.start_location,
                map: window.mapa,
                draggable: true,
                icon: crearIconoCajitaSVG(colorBox, "#ffffff"),
                title: infoPunto.alias
            });

            const contenidoInfoWindow = generarTemplateInfoWindow(infoPunto, colorBox);

            marker.addListener("mouseover", () => {
                if (window.infoWindowGlobal) {
                    window.infoWindowGlobal.setContent(contenidoInfoWindow);
                    window.infoWindowGlobal.open(window.mapa, marker);
                }
            });

            marker.addListener("mouseout", () => {
                if (window.infoWindowGlobal) window.infoWindowGlobal.close();
            });

            // Asignación de evento para manipular y ajustar la ubicación al arrastrar
            escucharAjusteManualMarcador(marker, esMatrizOrigen, datosPedido);
            window.marcadoresPersonalizadosRuta.push(marker);

            // Inyección del marcador para el destino final
            if (indice === rutaGoogle.legs.length - 1) {
                const datosUltimo = window.loteActualPedidos
                    ? window.loteActualPedidos[window.loteActualPedidos.length - 1]
                    : null;

                const infoFinal = {
                    alias: datosUltimo?.destinatario || datosUltimo?.alias || `PUNTO FINAL [${indice + 1}]`,
                    direccion: tramo.end_address || datosUltimo?.direccion || "Destino Final",
                    telefono: datosUltimo?.telefono || "N/A",
                    carga: datosUltimo?.carga || "Carga Estándar",
                    id: datosUltimo?.id || datosUltimo?.hash_id || `#PNT-${indice + 1}`
                };

                const markerFinal = new google.maps.Marker({
                    position: tramo.end_location,
                    map: window.mapa,
                    draggable: true,
                    icon: crearIconoCajitaSVG("#ff3366", "#ffffff"),
                    title: infoFinal.alias
                });

                const contenidoInfoFinal = generarTemplateInfoWindow(infoFinal, "#ff3366");

                markerFinal.addListener("mouseover", () => {
                    if (window.infoWindowGlobal) {
                        window.infoWindowGlobal.setContent(contenidoInfoFinal);
                        window.infoWindowGlobal.open(window.mapa, markerFinal);
                    }
                });

                markerFinal.addListener("mouseout", () => {
                    if (window.infoWindowGlobal) window.infoWindowGlobal.close();
                });

                escucharAjusteManualMarcador(markerFinal, false, datosUltimo);
                window.marcadoresPersonalizadosRuta.push(markerFinal);
            }
        });

        if (window.mapa) {
            window.mapa.fitBounds(bounds);
            google.maps.event.addListenerOnce(window.mapa, "idle", () => {
                if (window.mapa.getZoom() > 16) window.mapa.setZoom(16);
            });
        }

        let distanciaMetrosTotales = 0;
        let tiempoSegundosTotales = 0;

        rutaGoogle.legs.forEach((leg) => {
            distanciaMetrosTotales += leg.distance.value;
            tiempoSegundosTotales += leg.duration.value;
        });

        const kilometros = distanciaMetrosTotales / 1000;
        const minutos = tiempoSegundosTotales / 60;
        const totalPuntos = window.loteActualPedidos ? window.loteActualPedidos.length : 1;

        if (typeof window.actualizarTableroUI === "function") {
            window.actualizarTableroUI(kilometros, minutos, totalPuntos);
        }

    } catch (err) {
        console.warn(">>> [FALLO_MULTIPUNTO]: Error al proyectar ruta en Google Maps. Conmutando a contingencia...", err);
        ejecutarContingenciaTarifaria();
    }
}

/**
 * Escucha la interacción manual sobre el marcador (dragend) y actualiza la ubicación y la ruta.
 */
function escucharAjusteManualMarcador(marker, esMatrizOrigen, datosPedido) {
    marker.addListener("dragend", (event) => {
        const nuevaLat = event.latLng.lat();
        const nuevaLng = event.latLng.lng();
        console.log(`>>> [PUNTO_AJUSTADO]: Nueva posición manual: ${nuevaLat}, ${nuevaLng}`);

        if (window.geocodificador) {
            window.geocodificador.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, (results, status) => {
                if (status === "OK" && results[0]) {
                    const nuevaDirString = results[0].formatted_address;

                    if (esMatrizOrigen) {
                        const origenEl = document.getElementById("origen-cliente");
                        if (origenEl) origenEl.value = nuevaDirString;
                    } else if (datosPedido) {
                        datosPedido.direccion = nuevaDirString;
                        if (typeof window.actualizarTablaCola === "function") {
                            window.actualizarTablaCola();
                        }
                    }

                    const origenInput = document.getElementById("origen-cliente")?.value.trim() || "Cali, Colombia";
                    const ultimaDireccionLote = window.loteActualPedidos && window.loteActualPedidos.length > 0
                        ? window.loteActualPedidos[window.loteActualPedidos.length - 1].direccion
                        : origenInput;

                    previsualizarRutaInmediata(
                        sanitizarDireccionContexto(origenInput),
                        sanitizarDireccionContexto(ultimaDireccionLote)
                    );
                }
            });
        }
    });
}

/**
 * Limpia los marcadores personalizados del mapa.
 */
export function limpiarMarcadoresPersonalizados() {
    if (window.marcadoresPersonalizadosRuta && Array.isArray(window.marcadoresPersonalizadosRuta)) {
        window.marcadoresPersonalizadosRuta.forEach((m) => {
            if (m && typeof m.setMap === "function") m.setMap(null);
        });
        window.marcadoresPersonalizadosRuta = [];
    }
}

/**
 * Limpia la trazabilidad gráfica de polígonos y marcadores.
 */
export function limpiarGraficosDelMapa() {
    if (window.renderRutas) {
        window.renderRutas.setDirections({ routes: [] });
    }
    limpiarMarcadoresPersonalizados();

    if (window.mapa) {
        window.mapa.setCenter({ lat: 3.4516, lng: -76.532 });
        window.mapa.setZoom(13);
    }
}

// Registro global
window.previsualizarRutaInmediata = previsualizarRutaInmediata;
window.limpiarGraficosDelMapa = limpiarGraficosDelMapa;
window.limpiarMarcadoresPersonalizados = limpiarMarcadoresPersonalizados;