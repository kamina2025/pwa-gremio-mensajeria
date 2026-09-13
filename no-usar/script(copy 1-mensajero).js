/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL Y ORQUESTADOR TÁCTICO
 * Ubicación: pwa-mensajero/script.js
 */

import { 
    guardarRutaZonificada, 
    obtenerRutaZonificada, 
    actualizarEstadoPedido, 
    capturarCoordenadasGPS,
    convertirArchivoBase64,
    sincronizarYRenderizarPool,
    sincronizarYRenderizarTransito,
    procesarCustodiaEnServidor
} from "./modulos/mensajero-persistencia.js";
import { desplegarZonaMensajeroEnMapa } from "./modulos/mapa-mensajero-zonas.js";
// --- ESTADOS DE HARDWARE Y LEDGER GLOBAL ---
window.estaOnline = window.estaOnline !== undefined ? window.estaOnline : true;
window.contratoActivoActual = "#NINGUNO";
window.loteActualPedidos = [];
window.pesoAcumuladoLote = 0;

let listaPedidosGlobal = [];
let indicePedidoActivo = 0;
let llamadasRealizadas = 0;

// Inicialización del Ledger en LocalStorage si está vacío
if (!localStorage.getItem("MACONDO_LEDGER")) {
    const historialBase = [
        { timestamp: "03-06 14:22", id: "#LOTE-8819", tarifa: 15000, rodamiento: 6000, mutual: 1000, neto: 8000 },
        { timestamp: "03-06 15:40", id: "#LOTE-8820", tarifa: 22000, rodamiento: 9000, mutual: 1000, neto: 12000 }
    ];
    localStorage.setItem("MACONDO_LEDGER", JSON.stringify(historialBase));
}

// =============================================================================
// CICLO DE INICIALIZACIÓN ATÓMICA DE LA TERMINAL
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log(">>> [MENSAJERO_INIT]: Inicializando consola operacional...");
    
    inicializarRutaPayload();
    configurarEventosFormulario();

    if (typeof sincronizarYRenderizarPool === "function") sincronizarYRenderizarPool();
    if (typeof sincronizarYRenderizarTransito === "function") sincronizarYRenderizarTransito();
});

function inicializarRutaPayload() {
    const urlParams = new URLSearchParams(window.location.search);
    const payloadRaw = urlParams.get("payload");

    if (payloadRaw) {
        try {
            listaPedidosGlobal = JSON.parse(decodeURIComponent(payloadRaw)).map(pedido => ({
                ...pedido,
                estado: pedido.estado || "ASIGNADO",
                registroOperaciones: pedido.registroOperaciones || {}
            }));
            guardarRutaZonificada(listaPedidosGlobal);
        } catch (e) {
            console.error(">>> Error al deserializar el payload de la ruta:", e);
            listaPedidosGlobal = obtenerRutaZonificada();
        }
    } else {
        listaPedidosGlobal = obtenerRutaZonificada();
    }

    determinarSiguientePedidoActivo();
    renderizarConsolaOperaciones();
}

function determinarSiguientePedidoActivo() {
    const index = listaPedidosGlobal.findIndex(p => p.estado !== "FINALIZADO" && p.estado !== "NOVEDAD");
    indicePedidoActivo = index !== -1 ? index : (listaPedidosGlobal.length > 0 ? listaPedidosGlobal.length - 1 : 0);
}

// =============================================================================
// IMPORTACIÓN TOLERANTE A ERRORES DESDE ENLACES / TEXTO WHATSAPP
// =============================================================================

export function cargarRutaDesdeTextoOEnlace(textoEntrada) {
    if (!textoEntrada || !textoEntrada.trim()) {
        alert(">>> ALERTA MENSAJERO: Ingrese un enlace válido o texto de payload.");
        return false;
    }

    const entradaLimpia = textoEntrada.trim();
    let listaParadas = [];

    try {
        // CASO 1: Extraer parámetro ?payload= de URL mediante Regex segura
        const matchPayload = entradaLimpia.match(/(?:payload=)([^&\s]+)/);

        if (matchPayload && matchPayload[1]) {
            const rawDecoded = decodeURIComponent(matchPayload[1]);
            listaParadas = JSON.parse(rawDecoded);
        } else if (entradaLimpia.startsWith("[") || entradaLimpia.startsWith("{")) {
            // CASO 2: JSON crudo pegado directamente
            listaParadas = JSON.parse(entradaLimpia);
        } else {
            // CASO 3: Texto plano formateado de WhatsApp/Telegram
            listaParadas = parsearTextoPlanoWhatsApp(entradaLimpia);
        }

        // Formatear array final
        if (!Array.isArray(listaParadas)) {
            listaParadas = [listaParadas];
        }

        if (listaParadas.length === 0) {
            throw new Error("No se detectaron paradas o direcciones procesables en la entrada.");
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
        listaPedidosGlobal = paradasProcesadas;
        indicePedidoActivo = 0;
        renderizarConsolaOperaciones();

        alert(`>>> RUTA CARGADA EXITOSAMENTE:\n\nSe importaron ${paradasProcesadas.length} paradas a su terminal.`);
        return true;

    } catch (error) {
        console.error(">>> [CARGA_RUTA_FAIL]: Error al importar la ruta:", error);
        alert(`>>> ERROR DE IMPORTACIÓN:\n\n${error.message}`);
        return false;
    }
}

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

export function procesarCargaManualEnlace() {
    const inputTxt = document.getElementById("txt-payload-manual");
    if (inputTxt) {
        cargarRutaDesdeTextoOEnlace(inputTxt.value);
    }
}

// =============================================================================
// RENDERIZADO DE CONSOLA OPERACIONAL Y TARJETAS
// =============================================================================

function renderizarConsolaOperaciones() {
    const contenedor = document.getElementById("contenedor-tarjeta-activa");
    const contenedorLista = document.getElementById("lista-paradas-zonificadas");
    const txtTotal = document.getElementById("txt-total-paradas");

    if (txtTotal) txtTotal.innerText = `${listaPedidosGlobal.length} PARADAS`;

    if (!listaPedidosGlobal || listaPedidosGlobal.length === 0) {
        if (contenedor) {
            contenedor.innerHTML = `<div class="panel-maquina" style="text-align:center; color:var(--text-muted, #aaa);">[SIN_RUTA] No hay una ruta cargada en memoria. Escanee un manifiesto o pegue el enlace de WhatsApp.</div>`;
        }
        if (contenedorLista) contenedorLista.innerHTML = "";
        return;
    }

    const pedido = listaPedidosGlobal[indicePedidoActivo];

    if (contenedor) {
        contenedor.innerHTML = `
            <div class="card-pedido-activa ${pedido.estado.toLowerCase()}">
                <div class="card-header-flujo" style="display:flex; justify-content:space-between; border-bottom:1px dashed #291f33; padding-bottom:6px; margin-bottom:10px;">
                    <span class="badge-parada" style="background:var(--neon-blue, #00e5ff); color:#000; font-weight:bold; padding:2px 6px;">PARADA ${String.fromCharCode(65 + indicePedidoActivo)}</span>
                    <span class="badge-estado" style="color:var(--neon-green, #00ff66); font-weight:bold;">${pedido.estado}</span>
                </div>

                <div class="card-body-flujo" style="font-size:0.85rem; line-height:1.4;">
                    <h2 style="margin:4px 0; color:#fff;">${pedido.destinatario || "Cliente"}</h2>
                    <p style="margin:2px 0;"><strong>📍 Dirección:</strong> ${pedido.direccion}</p>
                    <p style="margin:2px 0;"><strong>📦 Carga:</strong> ${pedido.carga || "Paquete Estándar"}</p>
                    <p style="margin:2px 0;"><strong>📞 Teléfono:</strong> ${pedido.telefono || "N/A"}</p>
                </div>

                <div class="card-acciones-flujo" style="margin-top:12px;">
                    ${obtenerBotonesFlujoHTML(pedido)}
                </div>
            </div>
        `;
    }

    if (contenedorLista) {
        contenedorLista.innerHTML = "";
        listaPedidosGlobal.forEach((p, idx) => {
            const item = document.createElement("div");
            item.className = `item-parada-lista ${idx === indicePedidoActivo ? 'activa' : ''} ${p.estado.toLowerCase()}`;
            item.style.cssText = `background:#0c080f; border:1px solid ${idx === indicePedidoActivo ? 'var(--neon-blue, #00e5ff)' : '#291f33'}; padding:6px; margin-bottom:4px; font-size:0.75rem; display:flex; justify-content:space-between;`;
            item.innerHTML = `
                <span><strong>[${String.fromCharCode(65 + idx)}]</strong> ${p.direccion}</span>
                <span style="color:var(--neon-amber, #ffaa00); font-weight:bold;">${p.estado}</span>
            `;
            contenedorLista.appendChild(item);
        });
    }
}

function obtenerBotonesFlujoHTML(pedido) {
    if (pedido.estado === "ASIGNADO") {
        return `
            <button class="btn-terminal" style="border-color: var(--neon-blue, #00e5ff); color: var(--neon-blue, #00e5ff); width:100%; font-weight:bold;" onclick="ejecutarPasoAceptarPedido('${pedido.id}')">
                [1] ACEPTAR Y EN CAMINO ➔
            </button>`;
    }

    if (pedido.estado === "EN_CAMINO") {
        return `
            <button class="btn-terminal" style="border-color: var(--amber-alert, #ffaa00); color: var(--amber-alert, #ffaa00); width:100%; font-weight:bold;" onclick="ejecutarPasoNotificarLlegada('${pedido.id}')">
                [2] REGISTRAR LLEGADA AL PUNTO 📍
            </button>`;
    }

    if (pedido.estado === "LLEGADO") {
        return `
            <div class="bloque-llegado-acciones">
                <a href="tel:${pedido.telefono}" class="btn-terminal" style="border-color: var(--crypto-secure, #00ff66); color: var(--crypto-secure, #00ff66); display:block; text-align:center; text-decoration:none; margin-bottom:6px; font-weight:bold;" onclick="registrarIntentoLlamada()">
                    [📞] LLAMAR AL CLIENTE (${llamadasRealizadas} Intentos)
                </a>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <button class="btn-terminal" style="border-color: #ff3366; color: #ff3366;" onclick="abrirModalNovedad()">
                        [⚠️] NOVEDAD
                    </button>
                    <button class="btn-terminal" style="border-color: var(--crypto-secure, #00ff66); background: var(--crypto-secure, #00ff66); color:#000; font-weight:bold;" onclick="ejecutarPasoFinalizarPedido('${pedido.id}')">
                        [3] FINALIZAR ✅
                    </button>
                </div>
            </div>`;
    }

    return `<div style="color:var(--crypto-secure, #00ff66); text-align:center; font-weight:bold; padding:8px;">✅ ENTREGADO / PROCESADO</div>`;
}

// =============================================================================
// EJECUCIÓN DE PASOS Y EVENTOS
// =============================================================================

export async function ejecutarPasoAceptarPedido(idPedido) {
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "EN_CAMINO");
    renderizarConsolaOperaciones();
}

export async function ejecutarPasoNotificarLlegada(idPedido) {
    llamadasRealizadas = 0;
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "LLEGADO");
    renderizarConsolaOperaciones();
}

export function registrarIntentoLlamada() {
    llamadasRealizadas++;
    renderizarConsolaOperaciones();
}

export function abrirModalNovedad() {
    const modal = document.getElementById("modal-novedad");
    if (modal) modal.style.display = "flex";
}

export function cerrarModalNovedad() {
    const modal = document.getElementById("modal-novedad");
    if (modal) modal.style.display = "none";
}

function configurarEventosFormulario() {
    const formNovedad = document.getElementById("form-novedad-coordinador");
    if (formNovedad) {
        formNovedad.addEventListener("submit", async (e) => {
            e.preventDefault();
            const pedidoActual = listaPedidosGlobal[indicePedidoActivo];
            
            const fileTirilla = document.getElementById("foto-tirilla").files[0];
            const fileFachada = document.getElementById("foto-fachada").files[0];
            const motivo = document.getElementById("txt-motivo-novedad").value.trim();

            const base64Tirilla = await convertirArchivoBase64(fileTirilla);
            const base64Fachada = await convertirArchivoBase64(fileFachada);
            const coords = await capturarCoordenadasGPS();

            const reporteNovedadPayload = {
                idPedido: pedidoActual.id,
                coordinadorNotificado: true,
                motivo: motivo,
                intentosLlamadas: llamadasRealizadas,
                coordenadasGPS: coords,
                fotoTirilla: base64Tirilla,
                fotoFachada: base64Fachada,
                fechaReporte: new Date().toISOString()
            };

            listaPedidosGlobal = actualizarEstadoPedido(pedidoActual.id, "NOVEDAD", { novedad: reporteNovedadPayload });
            cerrarModalNovedad();
            determinarSiguientePedidoActivo();
            renderizarConsolaOperaciones();
        });
    }
}

export async function ejecutarPasoFinalizarPedido(idPedido) {
    const coords = await capturarCoordenadasGPS();
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "FINALIZADO", { coordenadasGPS: coords });

    determinarSiguientePedidoActivo();
    renderizarConsolaOperaciones();
}

export async function ejecutarCustodia(idPedido) {
    let poolCached = JSON.parse(localStorage.getItem("MACONDO_POOL")) || {};
    if (poolCached[idPedido]) {
        await procesarCustodiaEnServidor(idPedido, poolCached[idPedido]);
        sincronizarYRenderizarPool();
    }
}

// BINDINGS AL SCOPE GLOBAL (WINDOW)
window.cargarRutaDesdeTextoOEnlace = cargarRutaDesdeTextoOEnlace;
window.parsearTextoPlanoWhatsApp = parsearTextoPlanoWhatsApp;
window.procesarCargaManualEnlace = procesarCargaManualEnlace;
window.ejecutarPasoAceptarPedido = ejecutarPasoAceptarPedido;
window.ejecutarPasoNotificarLlegada = ejecutarPasoNotificarLlegada;
window.ejecutarPasoFinalizarPedido = ejecutarPasoFinalizarPedido;
window.registrarIntentoLlamada = registrarIntentoLlamada;
window.abrirModalNovedad = abrirModalNovedad;
window.cerrarModalNovedad = cerrarModalNovedad;
window.ejecutarCustodia = ejecutarCustodia;