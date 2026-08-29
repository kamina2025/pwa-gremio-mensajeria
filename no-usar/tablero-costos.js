/**
 * PROTOCOLO MACONDO - TELEMETRY SUBSYSTEM: BALANCEADOR TELEMÁTICO Y TARIFARIO COOPERATIVO
 * Ubicación: modulos/tablero-costos.js
 */
const TIEMPO_ESPERA_POR_NODO_MIN = 5;

function actualizarTableroUI(kilometros, minutosRutaGoogle, cantidadEntregas, responseGoogle = null) {
    const minutosTotalesConEspera = minutosRutaGoogle + cantidadEntregas * TIEMPO_ESPERA_POR_NODO_MIN;

    const costoRodamiento = kilometros * (window.COSTO_POR_KILOMETRO || 1200);
    const costoTiempoCaretas = minutosTotalesConEspera * (window.COSTO_POR_MINUTO || 150);
    const totalMutualAcumulado = cantidadEntregas * (window.APORTE_MUTUAL_FIJO || 1500);

    const pagoNetoCustodio = Math.round(costoRodamiento + costoTiempoCaretas);
    const tarifaTotalCobradaAlComercio = pagoNetoCustodio + totalMutualAcumulado;

    let ahorroTotalLote = 0;

    if (responseGoogle && responseGoogle.routes && responseGoogle.routes[0]) {
        const legs = responseGoogle.routes[0].legs;

        window.loteActualPedidos.forEach((ped, idx) => {
            if (legs[idx]) {
                const distKm = legs[idx].distance.value / 1000;
                const tiempoMinTramo = legs[idx].duration.value / 60 + TIEMPO_ESPERA_POR_NODO_MIN;

                ped.kmEspecifico = distKm;
                ped.tiempoSpecificoMin = tiempoMinTramo;
                ped.precioEspecifico =
                    distKm * (window.COSTO_POR_KILOMETRO || 1200) +
                    tiempoMinTramo * (window.COSTO_POR_MINUTO || 150) +
                    (window.APORTE_MUTUAL_FIJO || 1500);

                const tarifaSimuladaMonopolio = Math.round(ped.precioEspecifico * 1.42);
                ahorroTotalLote += tarifaSimuladaMonopolio - ped.precioEspecifico;
            }
        });

        if (!window.bloqueoRefrescoTabla) {
            window.bloqueoRefrescoTabla = true;
            window.actualizarTablaCola();
            window.bloqueoRefrescoTabla = false;
        }
    }

    document.getElementById("meta-distancia").innerText = kilometros.toFixed(1) + " km";
    document.getElementById("meta-tiempo").innerText = Math.round(minutosTotalesConEspera) + " min"; 
    document.getElementById("meta-mutual").innerText = "$" + totalMutualAcumulado.toLocaleString();
    document.getElementById("meta-neto").innerText = "$" + tarifaTotalCobradaAlComercio.toLocaleString() + " COP";
    document.getElementById("meta-ahorro").innerText = "$" + Math.round(ahorroTotalLote).toLocaleString() + " COP";

    window.valoresCalculadosLote = {
        tarifa: tarifaTotalCobradaAlComercio,
        rodamiento: Math.round(costoRodamiento),
        mutual: totalMutualAcumulado,
        neto: pagoNetoCustodio,
        ahorroRetenido: Math.round(ahorroTotalLote),
        minutosTotales: Math.round(minutosTotalesConEspera)
    };
}

function evaluarTarifaModoLocalInmediata() {
    const simNumPedidos = window.loteActualPedidos ? window.loteActualPedidos.length : 0;
    if (simNumPedidos === 0) return;
    const kilometros = 2.5 * simNumPedidos + Math.random() * 0.8;
    const minutos = 8 * simNumPedidos + Math.random() * 3;
    actualizarTableroUI(kilometros, minutos, simNumPedidos);
}

// Inyección al Scope Global
window.actualizarTableroUI = actualizarTableroUI;
window.evaluarTarifaModoLocalInmediata = evaluarTarifaModoLocalInmediata;