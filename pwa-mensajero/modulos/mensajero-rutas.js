/**
 * PROTOCOLO MACONDO - GESTOR DE RUTAS, ACCIONES DE ZONA Y DATOS DE PEDIDOS
 * Ubicación: pwa-mensajero/modulos/mensajero-rutas.js
 * Arquitectura: Async Local-First con Integración IndexedDB y UI Zonificada
 */

import { 
    guardarRutaZonificada, 
    obtenerRutaZonificada, 
    obtenerParadasGuardadas 
} from "./mensajero-persistencia.js";
import { trazarPolilineaRuta } from "./mapa/mapa-rutas.js";

let itemArrastrado = null;

/**
 * Normaliza y limpia una clave de zona de forma determinista a letras minúsculas sin prefijos.
 * Ejemplos: "ZONA ORIENTE" -> "oriente", "ZONA NORTE-2" -> "norte-2", "zona_oriente" -> "oriente"
 * 
 * @param {string} zonaRaw - Cadena cruda recibida de la UI o payload
 * @returns {string} Clave limpia estandarizada
 */
function normalizarClaveZona(zonaRaw) {
    if (!zonaRaw || typeof zonaRaw !== "string") return "";
    return zonaRaw
        .trim()
        .toLowerCase()
        .replace(/^zona[_\s-]*/i, "") // Sin espacios adicionales al final de la expresión
        .replace(/\s+/g, "-")
        .replace(/_/g, "-");
}

/**
 * Procesa la carga inicial de paradas desde la URL (payload=) o lee la persistencia local IndexedDB.
 */
export async function procesarPayloadOStorage() {
    console.log(">>> [RUTAS]: Evaluando origen de datos (URL Payload vs IndexedDB Local)...");
    let listaPedidos = [];
    const urlParams = new URLSearchParams(window.location.search);
    const payloadRaw = urlParams.get("payload");

    if (payloadRaw) {
        try {
            listaPedidos = JSON.parse(decodeURIComponent(payloadRaw)).map((pedido) => ({
                ...pedido,
                estado: pedido.estado || "ASIGNADO",
                registroOperaciones: pedido.registroOperaciones || {}
            }));
            await guardarRutaZonificada(listaPedidos);
            console.log(`>>> [RUTAS] Payload de URL procesado y guardado: ${listaPedidos.length} paradas.`);
        } catch (e) {
            console.error(">>> [PAYLOAD_ERROR]: Error procesando payload URL, recayendo a IndexedDB:", e);
            listaPedidos = (await obtenerParadasGuardadas()) || [];
        }
    } else {
        listaPedidos = (await obtenerParadasGuardadas()) || [];
    }

    return Array.isArray(listaPedidos) ? listaPedidos : [];
}

/**
 * Busca el índice del primer pedido activo o pendiente.
 */
export async function buscarIndiceActivo(listaPedidosRaw) {
    let listaPedidos = await Promise.resolve(listaPedidosRaw);

    if (!listaPedidos || typeof listaPedidos.then === "function") {
        listaPedidos = await obtenerParadasGuardadas();
    }

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        return 0;
    }

    const index = listaPedidos.findIndex(
        (p) => p && p.estado !== "FINALIZADO" && p.estado !== "NOVEDAD" && p.estado !== "ENTREGADO"
    );

    return index !== -1 ? index : listaPedidos.length - 1;
}

/**
 * Procesa y recalcula la secuencia de entrega aislando únicamente la zona seleccionada.
 */
export async function calcularRutaAisladaPorZona(zonaKeyInput) {
    if (!zonaKeyInput) {
        console.warn("⚠️ [MENSAJERO_RUTAS]: Se requiere una zonaKey para aislar la ruta.");
        return [];
    }

    const targetLimpio = normalizarClaveZona(zonaKeyInput);
    console.group(`⚡ [ZONA_ISOLATION]: Procesando secuencia exclusiva para zona: [${zonaKeyInput}] (Clave limpia: '${targetLimpio}')`);

    let todasLasParadas = [];

    if (Array.isArray(window.__CACHE_PARADAS_MACONDO__) && window.__CACHE_PARADAS_MACONDO__.length > 0) {
        todasLasParadas = [...window.__CACHE_PARADAS_MACONDO__];
    } else if (Array.isArray(window.paradasMemoriaLocal) && window.paradasMemoriaLocal.length > 0) {
        todasLasParadas = [...window.paradasMemoriaLocal];
    } else {
        try {
            todasLasParadas = (await obtenerParadasGuardadas()) || [];
        } catch (err) {
            console.warn("⚠️ [ZONA_ISOLATION]: Fallo al leer IndexedDB, intentando fallback a localStorage...", err);
        }

        if (!todasLasParadas || todasLasParadas.length === 0) {
            todasLasParadas = JSON.parse(localStorage.getItem("ruta_zonificada") || "[]");
        }
    }

    const paradasDeZona = todasLasParadas.filter((p) => {
        if (!p) return false;
        
        const k1 = normalizarClaveZona(p.zonaKey || "");
        const k2 = normalizarClaveZona(p.nombreZona || "");
        const k3 = normalizarClaveZona(p.zona || "");
        const k4 = normalizarClaveZona(p.zonaNombre || "");

        const keys = [k1, k2, k3, k4].filter(val => val !== "");
        const busquedaDirecta = keys.some(val => val === targetLimpio);
        const busquedaSinGuiones = keys.some(val => val.replace(/-/g, "") === targetLimpio.replace(/-/g, ""));

        return busquedaDirecta || busquedaSinGuiones;
    });

    if (paradasDeZona.length === 0) {
        console.warn(`⚠️ [ZONA_ISOLATION]: No hay paradas registradas para la zona: ${zonaKeyInput}`);
        console.groupEnd();
        return [];
    }

    const paradasSecuenciadas = paradasDeZona.map((parada, index) => ({
        ...parada,
        secuenciaZona: index + 1,
        sincronizado: 0,
        updated_at: new Date().toISOString()
    }));

    console.log(`💾 [ZONA_ISOLATION]: ${paradasSecuenciadas.length} parada(s) aislada(s) con éxito para [${targetLimpio}].`);

    if (typeof trazarPolilineaRuta === "function") {
        trazarPolilineaRuta(paradasSecuenciadas, targetLimpio);
    }

    if (typeof window.enfocarZonaEnMapa === "function") {
        window.enfocarZonaEnMapa(paradasSecuenciadas);
    }

    console.groupEnd();
    return paradasSecuenciadas;
}

/**
 * RENDERIZADO DE ACORDEONES ZONIFICADOS
 */
export async function renderizarParadasZonificadasUI(listaPedidosParam = []) {
    console.log(">>> [RUTAS_UI] Ejecutando renderizarParadasZonificadasUI...");

    const contenedor = document.getElementById("lista-paradas-zonificadas") || document.getElementById("contenedor-acordeones-zonas");
    if (!contenedor) {
        console.warn(">>> [RUTAS_WARN]: Contenedor de acordeones no hallado en el DOM.");
        return;
    }

    let listaPedidos = await Promise.resolve(listaPedidosParam);

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        listaPedidos = (await obtenerParadasGuardadas()) || [];
    }

    window.__CACHE_PARADAS_MACONDO__ = [...listaPedidos];
    window.paradasMemoriaLocal = [...listaPedidos];

    contenedor.innerHTML = "";

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        contenedor.innerHTML = `<p style="text-align:center; color:#aaa; font-family:monospace; padding:10px;">[SISTEMA]: No hay paradas en la ruta activa.</p>`;
        return;
    }

    const zonasMap = {};
    listaPedidos.forEach((ped) => {
        const zonaKey = ped.zonaNombre || ped.zonaKey || ped.zona || "ZONA SIN ASIGNAR";
        if (!zonasMap[zonaKey]) zonasMap[zonaKey] = [];
        zonasMap[zonaKey].push(ped);
    });

    Object.entries(zonasMap).forEach(([nombreZona, paradasZona]) => {
        const totalParadas = paradasZona.length;
        const colorHex = paradasZona[0]?.colorZona || "#39ff14";

        const details = document.createElement("details");
        details.className = "cyber-accordion";
        details.style.borderColor = colorHex;
        details.style.marginBottom = "10px";
        details.open = true;

        const summary = document.createElement("summary");
        summary.className = "cyber-summary";
        summary.style.borderLeft = `4px solid ${colorHex}`;
        summary.innerHTML = `
            <span>▼ ${nombreZona} (${totalParadas})</span>
            <span class="badge-zone" style="background-color: ${colorHex}; color: #0d1117;">${colorHex}</span>
        `;

        const accionesBar = document.createElement("div");
        accionesBar.className = "zona-acciones-bar";
        accionesBar.style.cssText = "display: flex; gap: 8px; padding: 8px; background: #080b10; border-bottom: 1px solid #30363d; margin-bottom: 8px;";
        accionesBar.innerHTML = `
            <button type="button" class="btn-zona-action btn-zona-iniciar" onclick="window.iniciarRutaZona('${nombreZona}')">
                ► _INICIAR_RUTA
            </button>
            <button type="button" class="btn-zona-action btn-zona-planillar" onclick="window.planillarRutaZona('${nombreZona}')">
                📝 _PLANILLAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-mapa" onclick="window.verMapaZona('${nombreZona}')">
                🗺️ VER MAPA
            </button>
        `;

        const listContainer = document.createElement("div");
        listContainer.className = "paradas-drag-list";
        listContainer.style.padding = "4px";

        paradasZona.forEach((parada, idx) => {
            const idLimpio = String(parada.id || parada.ssc || `p_${idx}`).replace(/'/g, "\\'");
            const card = document.createElement("div");
            
            card.className = "parada-card item-parada-lista";
            card.setAttribute("draggable", "true");
            card.setAttribute("data-id", idLimpio);
            card.setAttribute("data-zona", nombreZona);

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex:1; padding-right:8px;">
                        <strong style="color: var(--neon-green, #00ff66);">[#${idx + 1}] ${parada.destinatario || parada.cliente || 'Cliente'}</strong> - ${parada.direccion || ''}
                        <div style="font-size: 0.72rem; color: #aaa; margin-top: 2px;">
                            SSC: ${parada.ssc || 'N/A'} | Tel: ${parada.telefono || 'N/A'} | Cuota: ${parada.cuotaModeradora || '$0'}
                        </div>
                    </div>
                    <div class="btn-group-reorder">
                        <button type="button" class="btn-reorder" onclick="window.moverParadaManual('${idLimpio}', -1, '${nombreZona}')">▲</button>
                        <button type="button" class="btn-reorder" onclick="window.moverParadaManual('${idLimpio}', 1, '${nombreZona}')">▼</button>
                        <button type="button" class="btn-reorder" style="border-color: #ffb300; color: #ffb300;" onclick="window.editarParadaUI('${idLimpio}')">✏️</button>
                        <button type="button" class="btn-reorder" style="border-color: #ff3366; color: #ff3366;" onclick="window.eliminarParadaUI('${idLimpio}')">🗑️</button>
                    </div>
                </div>
            `;

            vincularEventosDragDrop(card, nombreZona);
            listContainer.appendChild(card);
        });

        details.appendChild(summary);
        details.appendChild(accionesBar);
        details.appendChild(listContainer);
        contenedor.appendChild(details);
    });

    console.log(">>> [RUTAS_UI] Renderizado dinámico de acordeones completado con éxito.");
}

function vincularEventosDragDrop(cardElement, zonaNombre) {
    cardElement.addEventListener("dragstart", (e) => {
        itemArrastrado = cardElement;
        cardElement.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", cardElement.getAttribute("data-id"));
    });

    cardElement.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (cardElement !== itemArrastrado) {
            cardElement.classList.add("drag-over");
        }
    });

    cardElement.addEventListener("dragleave", () => {
        cardElement.classList.remove("drag-over");
    });

    cardElement.addEventListener("drop", async (e) => {
        e.preventDefault();
        cardElement.classList.remove("drag-over");

        if (itemArrastrado && itemArrastrado !== cardElement) {
            const contenedorPadre = cardElement.parentNode;
            const tarjetas = Array.from(contenedorPadre.querySelectorAll(".parada-card"));
            const origenIndex = tarjetas.indexOf(itemArrastrado);
            const destinoIndex = tarjetas.indexOf(cardElement);

            if (origenIndex < destinoIndex) {
                contenedorPadre.insertBefore(itemArrastrado, cardElement.nextSibling);
            } else {
                contenedorPadre.insertBefore(itemArrastrado, cardElement);
            }

            await guardarNuevaSecuenciaZona(contenedorPadre, zonaNombre);
        }
    });

    cardElement.addEventListener("dragend", () => {
        cardElement.classList.remove("dragging");
        itemArrastrado = null;
        document.querySelectorAll(".parada-card").forEach((c) => c.classList.remove("drag-over"));
    });
}

async function guardarNuevaSecuenciaZona(contenedorPadre, zonaNombre) {
    const cards = contenedorPadre.querySelectorAll(".parada-card");
    const nuevaSecuencia = [];

    cards.forEach((card, index) => {
        const id = card.getAttribute("data-id");
        const strongEl = card.querySelector("strong");
        if (strongEl) {
            strongEl.textContent = strongEl.textContent.replace(/\[#\d+\]/, `[#${index + 1}]`);
        }
        nuevaSecuencia.push({ id, secuencia: index + 1 });
    });

    console.log(`>>> [LOCAL_FIRST] Secuencia actualizada para ${zonaNombre}:`, nuevaSecuencia);

    window.dispatchEvent(new CustomEvent("rutasReordenadas", {
        detail: { zonaId: zonaNombre, nuevaSecuencia }
    }));
}

// BINDINGS GLOBALES Y NAVEGACIÓN
window.renderizarParadasZonificadasUI = renderizarParadasZonificadasUI;
window.renderizarAcordeonesZonasUI = renderizarParadasZonificadasUI;
window.renderizarTablaZonificadaUI = renderizarParadasZonificadasUI;
window.buscarIndiceActivo = buscarIndiceActivo;
window.procesarPayloadOStorage = procesarPayloadOStorage;
window.calcularRutaAisladaPorZona = calcularRutaAisladaPorZona;

window.iniciarRutaZona = function (zona) {
    console.log(`► [MENSAJERO_RUTAS]: Iniciar Ruta ejecutado para Zona: ${zona}`);
    localStorage.setItem("zona_activa_operacion", zona);

    if (typeof window.navegarA === "function") {
        window.navegarA("vistas/ruta/mapa-activa.html", { zona: zona });
        setTimeout(() => calcularRutaAisladaPorZona(zona), 350);
    } else {
        window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(zona)}`;
    }
};

window.planillarRutaZona = function (zona) {
    console.log(`📝 [MENSAJERO_RUTAS]: Generando planilla para Zona: ${zona}`);
    localStorage.setItem("zona_planillar_activa", zona);

    if (typeof window.navegarA === "function") {
        window.navegarA("vistas/notificaciones/planillas.html", { zona: zona });
    } else if (typeof window.renderizarModuloPlanillas === "function") {
        window.renderizarModuloPlanillas(zona);
    } else {
        window.location.href = `vistas/notificaciones/planillas.html?zona=${encodeURIComponent(zona)}`;
    }
};

window.verMapaZona = function (zona) {
    console.log(`🗺️ [MENSAJERO_RUTAS]: Abrir Mapa Zona: ${zona}`);
    localStorage.setItem("zona_activa_operacion", zona);

    if (typeof window.navegarA === "function") {
        window.navegarA("vistas/ruta/mapa-activa.html", { zona: zona });
        setTimeout(() => calcularRutaAisladaPorZona(zona), 350);
    } else {
        window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(zona)}`;
    }
};

window.moverParadaManual = function (paradaId, direccion, zonaNombre) {
    console.log(`>>> [REORDER_MANUAL]: Mover parada ${paradaId} dirección: ${direccion} en zona: ${zonaNombre}`);
};