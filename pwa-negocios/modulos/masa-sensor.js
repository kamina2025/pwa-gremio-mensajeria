/**
 * PROTOCOLO MACONDO - HARDWARE SUBSYSTEM: DISCOVER 125 MASA SENSOR
 * Ubicación: modulos/masa-sensor.js
 */

function extraerPesoNumerico(textoCarga) {
    if (!textoCarga) return 1.5;
    const coincidencia = textoCarga.match(/(\d+(\.\d+)?)/);
    if (coincidencia) {
        return parseFloat(coincidencia[0]);
    }
    return 1.5;
}

function actualizarMonitorMasaUI() {
    const barra = document.getElementById("barra-peso-carga");
    const txtPeso = document.getElementById("txt-peso-acumulado");
    const txtAlerta = document.getElementById("txt-alerta-limite");

    if (!barra || !txtPeso) return;

    const pesoActual = window.pesoAcumuladoLote || 0;
    const limiteHardware = window.LIMITE_MASA_HARDWARE_MOTO || 15.0;

    const porcentajeBarra = (pesoActual / limiteHardware) * 100;
    txtPeso.innerText = pesoActual.toFixed(1);
    barra.style.width = `${Math.min(porcentajeBarra, 100)}%`;

    if (pesoActual >= limiteHardware - 0.5) {
        if (txtAlerta) txtAlerta.style.display = "block";
        barra.style.backgroundColor = "red";
    } else if (pesoActual >= limiteHardware * 0.85) {
        if (txtAlerta) txtAlerta.style.display = "none";
        barra.style.backgroundColor = "var(--neon-amber)";
    } else {
        if (txtAlerta) txtAlerta.style.display = "none";
        barra.style.backgroundColor = "var(--neon-green)";
    }
}

// Inyección al Scope Global
window.extraerPesoNumerico = extraerPesoNumerico;
window.actualizarMonitorMasaUI = actualizarMonitorMasaUI;