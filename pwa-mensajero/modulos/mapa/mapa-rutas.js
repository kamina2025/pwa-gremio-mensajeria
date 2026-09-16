/**
 * PROTOCOLO MACONDO - SERVICIO DE TRAZADO Y RUTAS
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-rutas.js
 */

function sanitizarDireccionContexto(direccion) {
    if (!direccion) return "Cali, Colombia";
    const dirLower = direccion.toLowerCase();
    if (dirLower.includes("cali") || dirLower.includes("miranda")) {
        return direccion;
    }
    return `${direccion}, Cali, Colombia`;
}

export function trazarPolilineaRuta(listaPedidos) {
    if (!google.maps.DirectionsService || !listaPedidos || listaPedidos.length < 1) {
        if (window.renderRutasMensajero) {
            window.renderRutasMensajero.setDirections({ routes: [] });
        }
        return;
    }

    try {
        const servicioDirecciones = new google.maps.DirectionsService();
        const paradasWaypoints = listaPedidos.map((p) => ({
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