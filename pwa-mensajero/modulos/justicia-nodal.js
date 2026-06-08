/**
 * PROTOCOLO MACONDO - MESSENGER SUBSYSTEM: MÓDULO DE JUSTICIA Y DESCARGOS
 * Ubicación: pwa-mensajero/modulos/justicia-nodal.js
 */

function cargarModuloJusticia() {
    const txtContrato = document.getElementById("auditoria-id-contrato");
    if (txtContrato) txtContrato.innerText = `ID_CONTRATO: ${window.contratoActivoActual || "#NINGUNO"}`;

    const telemetriaBox = document.getElementById("contenedor-logs-telemetria");
    if (!telemetriaBox) return;

    telemetriaBox.innerHTML = `
        <div class="log-line"><span class="timestamp">[18:10:00]</span> <span class="action">EXEC_ASIGNATION</span> por Custodio: <span class="hash">0x8a2f...3c91</span></div>
        <div class="log-line"><span class="timestamp">[18:20:00]</span> <span class="action">ETA_LIMIT_REACHED</span> (Mapeo inicial de ruta: 10 min máx.)</div>
        <div class="log-line warning"><span class="timestamp">[18:35:00]</span> <span class="action alert">[DESVIACION_DETECTADA]</span> +15 minutos de retraso en Punto_A.</div>
    `;
}

function broadcastDescargo() {
    const descargo = document.getElementById("txt-descargo").value;
    if (!descargo.trim()) {
        alert(">>> ERROR: CARGA_DE_TEXTO_VACÍA. INGRESE ATENUANTE.");
        return;
    }

    alert(`>>> BROADCAST EMITIDO DESDE EL HARDWARE:\n\nContrato: ${window.contratoActivoActual}\nJustificación: "${descargo}"\nMetatags: [PGP_SIGNED_BY_LOCAL_KEY]`);
    document.getElementById("txt-descargo").value = "";
}

// Inyección limpia al Scope Global
window.cargarModuloJusticia = cargarModuloJusticia;
window.broadcastDescargo = broadcastDescargo;