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

let itemArrastrado = null;

/**
 * Procesa la carga inicial de paradas desde la URL (payload=) o lee la persistencia local IndexedDB.
 * 
 * @returns {Promise<Array<Object>>} Lista de pedidos normalizados.
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
 * 
 * @param {Array<Object>|Promise<Array<Object>>} listaPedidosRaw 
 * @returns {Promise<number>} Índice del ítem activo.
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
 * FUNCIÓN CLAVE DE RENDERIZADO DE ACORDEONES ZONIFICADOS
 * Inyecta la barra de botones [.zona-acciones-bar] y registra Handlers.
 * 
 * @param {Array<Object>|Promise<Array<Object>>} listaPedidosParam 
 */
export async function renderizarParadasZonificadasUI(listaPedidosParam = []) {
    console.log(">>> [RUTAS_UI] Ejecutando renderizarParadasZonificadasUI...");

    const contenedor = document.getElementById("lista-paradas-zonificadas") || document.getElementById("contenedor-acordeones-zonas");
    if (!contenedor) {
        console.warn(">>> [RUTAS_WARN]: Contenedor 'lista-paradas-zonificadas' no hallado en el DOM.");
        return;
    }

    let listaPedidos = await Promise.resolve(listaPedidosParam);

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        listaPedidos = (await obtenerParadasGuardadas()) || [];
    }

    contenedor.innerHTML = "";

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        contenedor.innerHTML = `<p style="text-align:center; color:#aaa; font-family:monospace; padding:10px;">[SISTEMA]: No hay paradas en la ruta activa.</p>`;
        return;
    }

    // Agrupar por zona geográfica
    const zonasMap = {};
    listaPedidos.forEach((ped) => {
        const zonaKey = ped.zona || ped.zonaNombre || "ZONA SIN ASIGNAR";
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
            const card = document.createElement("div");
            card.className = "parada-card item-parada-lista";
            card.setAttribute("draggable", "true");
            card.setAttribute("data-id", parada.id || parada.ssc || `p_${idx}`);
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
                        <button type="button" class="btn-reorder" onclick="window.moverParadaManual('${parada.id}', -1, '${nombreZona}')">▲</button>
                        <button type="button" class="btn-reorder" onclick="window.moverParadaManual('${parada.id}', 1, '${nombreZona}')">▼</button>
                        <button type="button" class="btn-reorder" style="border-color: #ffb300; color: #ffb300;" onclick="window.editarParadaUI('${parada.id}')">✏️</button>
                        <button type="button" class="btn-reorder" style="border-color: #ff3366; color: #ff3366;" onclick="window.eliminarParadaUI('${parada.id}')">🗑️</button>
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

// ==========================================================================
// CONTROLADORES REALES DE NAVEGACIÓN Y PLANILLADOR EN EL SCOPE GLOBAL
// ==========================================================================

window.renderizarParadasZonificadasUI = renderizarParadasZonificadasUI;
window.renderizarAcordeonesZonasUI = renderizarParadasZonificadasUI;
window.renderizarTablaZonificadaUI = renderizarParadasZonificadasUI;
window.buscarIndiceActivo = buscarIndiceActivo;
window.procesarPayloadOStorage = procesarPayloadOStorage;

/**
 * Inicia la operación táctica de la zona seleccionada y redirige al mapa activo.
 */
window.iniciarRutaZona = function (zona) {
    console.log(`► [MENSAJERO_RUTAS]: Iniciar Ruta ejecutado para Zona: ${zona}`);
    localStorage.setItem("zona_activa_operacion", zona);

    if (typeof window.navegarA === "function") {
        window.navegarA("vistas/ruta/mapa-activa.html", { zona: zona });
    } else {
        window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(zona)}`;
    }
};

/**
 * Redirige al subsistema de planillas e invoca la UI de planillador.
 */
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

/**
 * Transición al visor de mapa activo.
 */
window.verMapaZona = function (zona) {
    console.log(`🗺️ [MENSAJERO_RUTAS]: Abrir Mapa Zona: ${zona}`);
    localStorage.setItem("zona_activa_operacion", zona);

    if (typeof window.navegarA === "function") {
        window.navegarA("vistas/ruta/mapa-activa.html", { zona: zona });
    } else {
        window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(zona)}`;
    }
};

window.moverParadaManual = function (paradaId, direccion, zonaNombre) {
    console.log(`>>> [REORDER_MANUAL]: Mover parada ${paradaId} dirección: ${direccion}`);
};