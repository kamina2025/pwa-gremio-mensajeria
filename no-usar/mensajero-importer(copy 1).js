/**
 * PROTOCOLO MACONDO - IMPORTADOR Y PARSER DE MANIFIESTOS EXTERNOS
 * Ubicación: pwa-mensajero/modulos/mensajero-importer.js
 */

import { guardarRutaZonificada } from "./mensajero-persistencia.js";

export function parsearTextoPlanoWhatsApp(texto) {
    const lineas = texto.split(/\r?\n/);
    const paradas = [];
    const regexTel = /(?:(?:\+|00)57)?\s*3\d{2}[\s-]?\d{3}[\s-]?\d{4}/g;

    lineas.forEach(linea => {
        const l = linea.trim();
        if (!l || l.startsWith("🚚") || l.startsWith("*")) return;

        const matchTel = l.match(regexTel);
        const tel = matchTel ? matchTel[0] : "3000000000";
        const sinTel = l.replace(regexTel, "").replace(/^[•\-\*📍\s]+/, "").trim();

        if (sinTel.length > 3) {
            const partes = sinTel.split(/[,;-]/);
            paradas.push({
                destinatario: partes.length > 1 ? partes[0].trim() : "Cliente WhatsApp",
                direccion: partes.length > 1 ? partes.slice(1).join("-").trim() : sinTel,
                telefono: tel,
                carga: "Paquete WhatsApp"
            });
        }
    });

    return paradas.length > 0 ? paradas : [{
        destinatario: "Cliente General",
        direccion: texto.substring(0, 40),
        telefono: "3000000000",
        carga: "Carga General"
    }];
}

export function cargarRutaDesdeTextoOEnlace(textoEntrada, callbackRefresco) {
    if (!textoEntrada || !textoEntrada.trim()) {
        alert(">>> ALERTA MENSAJERO: Ingrese un enlace válido o texto de payload.");
        return false;
    }

    const entradaLimpia = textoEntrada.trim();
    let listaParadas = [];

    try {
        const matchPayload = entradaLimpia.match(/(?:payload=)([^&\s]+)/);

        if (matchPayload && matchPayload[1]) {
            const rawDecoded = decodeURIComponent(matchPayload[1]);
            listaParadas = JSON.parse(rawDecoded);
        } else if (entradaLimpia.startsWith("[") || entradaLimpia.startsWith("{")) {
            listaParadas = JSON.parse(entradaLimpia);
        } else {
            listaParadas = parsearTextoPlanoWhatsApp(entradaLimpia);
        }

        if (!Array.isArray(listaParadas)) listaParadas = [listaParadas];

        if (listaParadas.length === 0) {
            throw new Error("No se detectaron paradas o direcciones procesables.");
        }

        const paradasProcesadas = listaParadas.map((p, idx) => ({
            id: p.id || `#PNT-${Math.floor(1000 + Math.random() * 9000)}`,
            destinatario: p.destinatario || p.alias || `Cliente ${idx + 1}`,
            direccion: p.direccion || "Dirección no especificada",
            telefono: p.telefono || "3000000000",
            carga: p.carga || "Paquete Estándar (1.0 kg)",
            estado: p.estado || "ASIGNADO",
            registroOperaciones: p.registroOperaciones || {}
        }));

        guardarRutaZonificada(paradasProcesadas);

        alert(`>>> RUTA CARGADA EXITOSAMENTE:\n\nSe importaron ${paradasProcesadas.length} paradas.`);
        
        if (typeof callbackRefresco === "function") callbackRefresco(paradasProcesadas);
        return true;

    } catch (error) {
        console.error(">>> [CARGA_RUTA_FAIL]: Error al importar la ruta:", error);
        alert(`>>> ERROR DE IMPORTACIÓN:\n\n${error.message}`);
        return false;
    }
}

window.cargarRutaDesdeTextoOEnlace = cargarRutaDesdeTextoOEnlace;
window.parsearTextoPlanoWhatsApp = parsearTextoPlanoWhatsApp;