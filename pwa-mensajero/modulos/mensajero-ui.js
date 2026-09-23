/**
 * PROTOCOLO MACONDO - SUBSISTEMA RENDERIZADOR DE INTERFAZ OPERACIONAL (TIRILLAS & ZONAS)
 * Ubicación: pwa-mensajero/modulos/mensajero-ui.js
 * Fachada principal modularizada
 */

import { actualizarPuntosEnMapa, enfocarZonaEnMapa } from "./mapa/mapa-visor.js";
import { PALETA_ZONAS } from "./mapa/zonificacion/mensajero-zonificacion.js";
import { IndexedStore } from "./db/indexed-store.js";
import { renderizarTarjetaActivaUI, obtenerBotonesFlujoHTML } from "./ui/ui-tarjeta-activa.js";
import { vincularDragDropUI } from "./ui/ui-dnd-persistencia.js";
import { ejecutarZonificacionAutomaticaUI, moverParadaSecuenciaUI } from "./ui/ui-zonificacion-mantenimiento.js";

const dbStore = new IndexedStore();
let paradasMemoriaLocal = [];

/**
 * Renderiza la consola de operaciones táctica desplegando los campos clave de la tirilla y acordeones zonificados.
 */
export async function renderizarConsolaOperaciones(listaPedidos, indiceActivo = 0, llamadasRealizadas = 0) {
    console.group("🖥️ [MENSAJERO_UI]: Renderizando Consola de Operaciones y Acordeones");
    
    paradasMemoriaLocal = Array.isArray(listaPedidos) ? [...listaPedidos] : [];
    console.log(`📊 Paradas totales recibidas: ${paradasMemoriaLocal.length} | Ítem Activo: Índice ${indiceActivo}`);

    const contenedorActivo = document.getElementById("contenedor-tarjeta-activa");
    const contenedorAcordeones = document.getElementById("contenedor-acordeones-zonas") || document.getElementById("lista-paradas-zonificadas");
    const txtTotal = document.getElementById("txt-total-paradas");

    if (txtTotal) txtTotal.innerText = `${paradasMemoriaLocal.length} PARADAS`;

    console.log("🗺️ [MENSAJERO_UI]: Notificando al visor de mapa para actualizar waypoints...");
    if (typeof actualizarPuntosEnMapa === "function") {
        actualizarPuntosEnMapa(paradasMemoriaLocal, indiceActivo);
    }

    if (paradasMemoriaLocal.length === 0) {
        console.warn("⚠️ [MENSAJERO_UI]: La lista de pedidos está vacía. Mostrando estado [SIN_RUTA].");
        if (contenedorActivo) renderizarTarjetaActivaUI(contenedorActivo, null, 0, 0);
        if (contenedorAcordeones) contenedorAcordeones.innerHTML = "";
        console.groupEnd();
        return;
    }

    const pedido = paradasMemoriaLocal[indiceActivo] || paradasMemoriaLocal[0];

    // 1. TARJETA ACTIVA EN FOCO
    renderizarTarjetaActivaUI(contenedorActivo, pedido, indiceActivo, llamadasRealizadas);

    // 2. CONSTRUCCIÓN DE ACORDEONES AGRUPADOS POR ZONA
    if (contenedorAcordeones) {
        console.log("📋 [MENSAJERO_UI]: Construyendo acordeones de paradas por zona...");
        contenedorAcordeones.innerHTML = "";

        const grupos = {};
        paradasMemoriaLocal.forEach((item, index) => {
            if (!item.secuencia) item.secuencia = index + 1;
            const zKey = item.zonaKey || item.zona || "GENERAL";
            if (!grupos[zKey]) grupos[zKey] = [];
            grupos[zKey].push({ ...item, origIndex: index });
        });

        Object.keys(grupos).forEach(zonaKey => {
            const infoZona = PALETA_ZONAS[zonaKey] || { color: "#00e5ff", label: zonaKey };
            const itemsGrupo = grupos[zonaKey];

            itemsGrupo.sort((a, b) => (a.secuenciaZona || a.secuencia || 0) - (b.secuenciaZona || b.secuencia || 0));

            const details = document.createElement("details");
            details.className = "cyber-accordion";
            details.style.cssText = `background:#0d1117; border:1px solid ${infoZona.color}; margin-bottom:8px; border-radius:4px; overflow:hidden;`;
            details.open = true;

            details.addEventListener("toggle", () => {
                if (details.open) {
                    if (typeof enfocarZonaEnMapa === "function") {
                        enfocarZonaEnMapa(itemsGrupo);
                    } else if (typeof window.enfocarZonaEnMapa === "function") {
                        window.enfocarZonaEnMapa(itemsGrupo);
                    }
                }
            });

            // Cabecera Summary
            const summary = document.createElement("summary");
            summary.className = "cyber-summary";
            summary.style.cssText = `padding:8px 12px; background:#161b22; color:${infoZona.color}; font-weight:bold; font-size:0.85rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none;`;
            summary.innerHTML = `
                <span>▼ ${infoZona.label} (${itemsGrupo.length})</span>
                <span class="badge-zone" style="background:${infoZona.color}22; border:1px solid ${infoZona.color}; font-size:0.7rem; padding:1px 6px; border-radius:3px;">
                    ${infoZona.color}
                </span>
            `;

            // Barra de Botones
            const accionesBar = document.createElement("div");
            accionesBar.className = "zona-acciones-bar";
            accionesBar.style.cssText = "display: flex; gap: 6px; padding: 8px; background: #080b10; border-bottom: 1px solid #30363d; overflow-x: auto;";
            accionesBar.innerHTML = `
                <button type="button" class="btn-zona-action btn-zona-iniciar" style="background:#0d1117; color:#00e5ff; border:1px solid #00e5ff; font-weight:bold; cursor:pointer; padding:4px 8px;" onclick="window.iniciarRutaZona('${infoZona.label}')">
                    ► _INICIAR_RUTA
                </button>
                <button type="button" class="btn-zona-action btn-zona-optimizar" style="background:#0d1117; color:#ffb300; border:1px solid #ffb300; font-weight:bold; cursor:pointer; padding:4px 8px;" onclick="window.optimizarProximidadZona('${infoZona.label}')">
                    ⚡ OPTIMIZAR
                </button>
                <button type="button" class="btn-zona-action btn-zona-planillar" style="background:#0d1117; color:#8af7b3; border:1px solid #8af7b3; cursor:pointer; padding:4px 8px;" onclick="window.planillarRutaZona('${infoZona.label}')">
                    📝 _PLANILLAR
                </button>
                <button type="button" class="btn-zona-action btn-zona-mapa" style="background:#0d1117; color:#ff3366; border:1px solid #ff3366; cursor:pointer; padding:4px 8px;" onclick="window.verMapaZona('${infoZona.label}')">
                    🗺️ VER MAPA
                </button>
            `;

            // Lista con DnD
            const listContainer = document.createElement("div");
            listContainer.className = "paradas-drag-list";
            listContainer.style.cssText = "padding:6px; background:#05070f; display:flex; flex-direction:column; gap:6px;";

            itemsGrupo.forEach((p, idx) => {
                const idParadaLimpio = String(p.id || p.ssc || `p_${idx}`).replace(/'/g, "\\'");
                const numSecuencia = p.secuenciaZona || p.secuencia || (idx + 1);
                const card = document.createElement("div");
                card.className = `item-parada-lista parada-card ${p.origIndex === indiceActivo ? 'activa' : ''}`;
                card.setAttribute("draggable", "true");
                card.setAttribute("data-id", p.id || p.ssc);
                card.setAttribute("data-orig-index", p.origIndex);
                card.style.cssText = `background:#0c080f; border:1px solid ${p.origIndex === indiceActivo ? 'var(--neon-blue, #00e5ff)' : '#291f33'}; padding:6px 8px; font-size:0.75rem; border-radius:3px; cursor:grab;`;

                card.innerHTML = `
                    <div id="vista-lectura-${p.origIndex}" style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div><strong style="color:${infoZona.color}">[#${numSecuencia}]</strong> ${p.destinatario || "Cliente"} - ${p.direccion || ''}</div>
                            <div style="color:#888; font-size:0.7rem;">
                                SSC: ${p.ssc || 'N/A'} | Tel: ${p.telefono || 'N/A'} | Cuota: <span style="color:var(--neon-amber, #ffaa00);">${p.cuotaModeradora || '$0'}</span>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <button type="button" class="btn-terminal" style="border-color:#00e5ff; color:#00e5ff; padding:1px 4px; font-size:0.65rem;" onclick="window.moverParadaSecuencia('${idParadaLimpio}', -1)">▲</button>
                            <button type="button" class="btn-terminal" style="border-color:#00e5ff; color:#00e5ff; padding:1px 4px; font-size:0.65rem;" onclick="window.moverParadaSecuencia('${idParadaLimpio}', 1)">▼</button>
                            <button type="button" class="btn-terminal" style="border-color:#ffb703; color:#ffb703; padding:1px 4px; font-size:0.65rem;" onclick="activarEdicionParadaUI(event, ${p.origIndex})">✏️</button>
                            <button type="button" class="btn-terminal" style="border-color:#ff3366; color:#ff3366; padding:1px 4px; font-size:0.65rem;" onclick="eliminarParadaUI(event, ${p.origIndex})">🗑️</button>
                        </div>
                    </div>

                    <div id="vista-edicion-${p.origIndex}" style="display:none; flex-direction:column; gap:4px; margin-top:4px; background:#140e1a; padding:6px; border:1px dashed var(--neon-blue, #00e5ff);">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                            <input type="text" id="input-edit-destinatario-${p.origIndex}" value="${p.destinatario || ''}" placeholder="Destinatario" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                            <input type="text" id="input-edit-telefono-${p.origIndex}" value="${p.telefono || ''}" placeholder="Teléfono" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                        </div>
                        <input type="text" id="input-edit-direccion-${p.origIndex}" value="${p.direccion || ''}" placeholder="Dirección" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                            <input type="text" id="input-edit-ssc-${p.origIndex}" value="${p.ssc || ''}" placeholder="SSC" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                            <input type="text" id="input-edit-cuota-${p.origIndex}" value="${p.cuotaModeradora || ''}" placeholder="Cuota" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:4px;">
                            <button type="button" class="btn-terminal" style="border-color:#888; color:#888; padding:2px 6px; font-size:0.65rem;" onclick="cancelarEdicionParadaUI(event, ${p.origIndex})">[CANCELAR]</button>
                            <button type="button" class="btn-terminal" style="border-color:var(--neon-blue, #00e5ff); color:var(--neon-blue, #00e5ff); padding:2px 6px; font-size:0.65rem;" onclick="guardarEdicionParadaUI(event, ${p.origIndex})">[GUARDAR]</button>
                        </div>
                    </div>
                `;

                vincularDragDropUI(card, infoZona.label, paradasMemoriaLocal, () => renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0));
                listContainer.appendChild(card);
            });

            details.appendChild(summary);
            details.appendChild(accionesBar);
            details.appendChild(listContainer);
            contenedorAcordeones.appendChild(details);
        });
    }

    console.log("✅ [MENSAJERO_UI]: Consola de operaciones y acordeones renderizados exitosamente.");
    console.groupEnd();
}

// Bindings globales en Window
window.renderizarConsolaOperaciones = renderizarConsolaOperaciones;
window.refrescarConsolaOperaciones = function() { renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0); };

window.ejecutarZonificacionAutomatica = async function() {
    paradasMemoriaLocal = await ejecutarZonificacionAutomaticaUI(paradasMemoriaLocal, (p) => renderizarConsolaOperaciones(p, 0, 0));
};

window.moverParadaSecuencia = async function(idParada, delta) {
    await moverParadaSecuenciaUI(paradasMemoriaLocal, idParada, delta, (p) => renderizarConsolaOperaciones(p, 0, 0));
};

window.activarEdicionParadaUI = function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'none';
    if (edicion) edicion.style.display = 'flex';
};

window.cancelarEdicionParadaUI = function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'flex';
    if (edicion) edicion.style.display = 'none';
};

window.guardarEdicionParadaUI = async function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    if (paradasMemoriaLocal[idx]) {
        paradasMemoriaLocal[idx].destinatario = document.getElementById(`input-edit-destinatario-${idx}`).value;
        paradasMemoriaLocal[idx].telefono = document.getElementById(`input-edit-telefono-${idx}`).value;
        paradasMemoriaLocal[idx].direccion = document.getElementById(`input-edit-direccion-${idx}`).value;
        paradasMemoriaLocal[idx].ssc = document.getElementById(`input-edit-ssc-${idx}`).value;
        paradasMemoriaLocal[idx].cuotaModeradora = document.getElementById(`input-edit-cuota-${idx}`).value;

        await dbStore.actualizarParada(paradasMemoriaLocal[idx]);
        localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
        renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
    }
};

window.eliminarParadaUI = async function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    if (!confirm("¿Desea eliminar esta parada de la ruta?")) return;

    const paradaEliminada = paradasMemoriaLocal.splice(idx, 1);
    if (paradaEliminada[0]?.id) {
        await dbStore.eliminarParada(paradaEliminada[0].id);
    }

    for (let i = 0; i < paradasMemoriaLocal.length; i++) {
        paradasMemoriaLocal[i].secuencia = i + 1;
        paradasMemoriaLocal[i].secuenciaZona = i + 1;
        await dbStore.actualizarParada(paradasMemoriaLocal[i]);
    }

    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
    renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
};