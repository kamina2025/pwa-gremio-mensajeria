/**
 * PROTOCOLO MACONDO - HARDWARE SUBSYSTEM: DISCOVER 125 MASA SENSOR
 * Ubicación: modulos/masa-sensor.js
 */

/**
 * Extrae el valor numérico en kg desde una cadena de texto descriptiva.
 * @param {string} textoCarga - Descripción del paquete (ej: "Paquete repuestos 4.2 kg")
 * @returns {number} Peso interpretado en kg
 */
function extraerPesoNumerico(textoCarga) {
    if (!textoCarga || typeof textoCarga !== "string") return 1.5;
    
    // Normalizar comas por puntos antes de evaluar el regex (ej: "3,5" -> "3.5")
    const textoSanitizado = textoCarga.replace(',', '.');
    const coincidencia = textoSanitizado.match(/(\d+(\.\d+)?)/);
    
    if (coincidencia) {
        const peso = parseFloat(coincidencia[0]);
        return isNaN(peso) ? 1.5 : peso;
    }
    return 1.5;
}

/**
 * Recalcula y actualiza la barra telemática de estabilidad de carga en la UI.
 */
function actualizarMonitorMasaUI() {
    const barra = document.getElementById("barra-peso-carga");
    const txtPeso = document.getElementById("txt-peso-acumulado");
    const txtAlerta = document.getElementById("txt-alerta-limite");

    if (!barra || !txtPeso) return;

    const pesoActual = typeof window.pesoAcumuladoLote === "number" && !isNaN(window.pesoAcumuladoLote)
        ? window.pesoAcumuladoLote 
        : 0;
        
    const limiteHardware = typeof window.LIMITE_MASA_HARDWARE_MOTO === "number" && window.LIMITE_MASA_HARDWARE_MOTO > 0
        ? window.LIMITE_MASA_HARDWARE_MOTO 
        : 15.0;

    const porcentajeBarra = (pesoActual / limiteHardware) * 100;
    txtPeso.innerText = pesoActual.toFixed(1);
    barra.style.width = `${Math.min(Math.max(porcentajeBarra, 0), 100)}%`;

    // Evaluación de Semáforo de Seguridad Mecánica
    if (pesoActual >= limiteHardware - 0.5) {
        if (txtAlerta) txtAlerta.style.display = "block";
        barra.style.backgroundColor = "#ff3366"; // Neon Red
    } else if (pesoActual >= limiteHardware * 0.85) {
        if (txtAlerta) txtAlerta.style.display = "none";
        barra.style.backgroundColor = "var(--neon-amber, #ffaa00)";
    } else {
        if (txtAlerta) txtAlerta.style.display = "none";
        barra.style.backgroundColor = "var(--neon-green, #00ff66)";
    }
}

// Inyección limpia al Scope Global
window.extraerPesoNumerico = extraerPesoNumerico;
window.actualizarMonitorMasaUI = actualizarMonitorMasaUI;