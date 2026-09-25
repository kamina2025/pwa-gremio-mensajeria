/**
 * PROTOCOLO MACONDO - COMPARTIENDO Y EXPORTANDO LOCAL-FIRST
 * Ubicación: pwa-mensajero/modulos/planilla/planillas-export.js
 */

/**
 * Genera un enlace nativo de WhatsApp con el resumen de la planilla activa y enlaces GPS.
 * @param {Object} planilla - Objeto de planilla extraído de IndexedDB
 */
export function compartirPlanillaWhatsApp(planilla) {
    if (!planilla || !Array.isArray(planilla.paradas) || planilla.paradas.length === 0) {
        alert("⚠️ No hay paradas registradas en esta planilla para compartir.");
        return;
    }

    const codigoPlanilla = planilla.codigo || planilla.id || `PLN-${Date.now().toString().slice(-4)}`;
    let textoMsg = `📋 *HOJA DE RUTA / PLANILLA #${codigoPlanilla}*\n`;
    textoMsg += `📅 *Fecha:* ${new Date().toLocaleDateString()}\n`;
    textoMsg += `📦 *Total Paradas:* ${planilla.paradas.length}\n`;
    textoMsg += `------------------------------------\n\n`;

    planilla.paradas.forEach((parada, i) => {
        const sec = parada.secuencia || (i + 1);
        const cliente = parada.destinatario || parada.cliente || "Cliente";
        const direccion = parada.direccion || parada.dir || "Sin dirección";
        const estado = (parada.estado || "ASIGNADO").toUpperCase();
        const lat = parada.lat || parada.latitud;
        const lng = parada.lng || parada.longitud;

        textoMsg += `*#STOP ${sec}* [${estado}]\n`;
        textoMsg += `👤 *Cliente:* ${cliente}\n`;
        textoMsg += `📍 *Dir:* ${direccion}\n`;
        
        if (parada.telefono || parada.tel) {
            textoMsg += `📞 *Tel:* ${parada.telefono || parada.tel}\n`;
        }

        if (lat && lng) {
            textoMsg += `🌐 *Ubicación GPS:* https://maps.google.com/?q=${lat},${lng}\n`;
        }
        textoMsg += `------------------------------------\n`;
    });

    const urlWA = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoMsg)}`;
    window.open(urlWA, '_blank');
}

/**
 * Descarga los datos de la planilla en formato JSON compatible con el importador de otros dispositivos.
 * @param {Object} planilla 
 */
export function exportarPlanillaJSON(planilla) {
    if (!planilla) {
        alert("⚠️ No se seleccionó ninguna planilla válida.");
        return;
    }

    const payloadExport = {
        version: "1.0-MACONDO",
        tipo: "PLANILLA_LOCAL_EXPORT",
        exportado_en: new Date().toISOString(),
        planilla: planilla
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payloadExport, null, 2));
    const filename = `Planilla_${planilla.codigo || planilla.id || Date.now()}.json`;

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute("href", dataStr);
    downloadLink.setAttribute("download", filename);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
}