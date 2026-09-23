/**
 * Módulo de Renderizado de UI Acordeones y Drag & Drop
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-ui-acordeon.js
 */

import { obtenerParadasGuardadas } from "../mensajero-persistencia.js";

let itemArrastrado = null;

/**
 * Renderiza la UI de acordeones con botones de zona y tarjetas interactivas.
 * 
 * @param {Array<Object>|Promise<Array<Object>>} listaPedidosParam - Paradas pasadas como parámetro o resueltas desde storage.
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

    // Agrupar pedidos por clave o nombre de zona
    const zonasMap = {};
    listaPedidos.forEach((ped) => {
        const zonaKey = ped.zonaNombre || ped.zonaKey || ped.zona || "ZONA SIN ASIGNAR";
        if (!zonasMap[zonaKey]) zonasMap[zonaKey] = [];
        zonasMap[zonaKey].push(ped);
    });

    Object.entries(zonasMap).forEach(([nombreZona, paradasZona]) => {
        // Ordenar las paradas de la zona respetando secuenciaZona
        paradasZona.sort((a, b) => (a.secuenciaZona || 0) - (b.secuenciaZona || 0));

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

        // BARRA DE ACCIONES ZONIFICADA (Incluye Botón Interactivo [ ⚡ OPTIMIZAR ])
        const accionesBar = document.createElement("div");
        accionesBar.className = "zona-acciones-bar";
        accionesBar.style.cssText = "display: flex; gap: 6px; padding: 8px; background: #080b10; border-bottom: 1px solid #30363d; margin-bottom: 8px; overflow-x: auto;";
        accionesBar.innerHTML = `
            <button type="button" class="btn-zona-action btn-zona-iniciar" style="background: #0d1117; color: #00e5ff; border: 1px solid #00e5ff; font-weight: bold; cursor: pointer; padding: 4px 8px;" onclick="window.iniciarRutaZona('${nombreZona}')">
                ► _INICIAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-optimizar" style="background: #0d1117; color: #ffb300; border: 1px solid #ffb300; font-weight: bold; cursor: pointer; padding: 4px 8px;" onclick="window.optimizarProximidadZona('${nombreZona}')">
                ⚡ OPTIMIZAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-planillar" style="background: #0d1117; color: #8af7b3; border: 1px solid #8af7b3; cursor: pointer; padding: 4px 8px;" onclick="window.planillarRutaZona('${nombreZona}')">
                📝 _PLANILLAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-mapa" style="background: #0d1117; color: #ff3366; border: 1px solid #ff3366; cursor: pointer; padding: 4px 8px;" onclick="window.verMapaZona('${nombreZona}')">
                🗺️ VER MAPA
            </button>
        `;

        const listContainer = document.createElement("div");
        listContainer.className = "paradas-drag-list";
        listContainer.style.padding = "4px";

        paradasZona.forEach((parada, idx) => {
            const idLimpio = String(parada.id || parada.ssc || `p_${idx}`).replace(/'/g, "\\'");
            const numSecuencia = parada.secuenciaZona || (idx + 1);
            const card = document.createElement("div");
            
            card.className = "parada-card item-parada-lista";
            card.setAttribute("draggable", "true");
            card.setAttribute("data-id", idLimpio);
            card.setAttribute("data-zona", nombreZona);

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex:1; padding-right:8px;">
                        <strong style="color: var(--neon-green, #00ff66);">[#${numSecuencia}] ${parada.destinatario || parada.cliente || 'Cliente'}</strong> - ${parada.direccion || ''}
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

/**
 * Vincula los eventos nativos de Drag and Drop a cada tarjeta de parada.
 */
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

/**
 * Recalcula y notifica la nueva secuencia tras una reordenación manual vía Drag & Drop.
 */
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

    console.log(`>>> [LOCAL_FIRST] Secuencia manual actualizada para ${zonaNombre}:`, nuevaSecuencia);

    window.dispatchEvent(new CustomEvent("rutasReordenadas", {
        detail: { zonaId: zonaNombre, nuevaSecuencia }
    }));
}