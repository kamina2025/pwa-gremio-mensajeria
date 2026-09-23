/**
 * PROTOCOLO MACONDO - SUBSISTEMA RENDERIZADOR DE INTERFAZ OPERACIONAL (TIRILLAS & ZONAS)
 * Ubicación: pwa-mensajero/modulos/mensajero-ui.js
 * Fachada principal modularizada con acordeones exclusivos y scroll por zona
 */

let actualizarPuntosEnMapaFn = null;
let enfocarZonaEnMapaFn = null;
let PALETA_ZONAS_REF = { GENERAL: { color: "#00e5ff", label: "GENERAL" } };
let dbStore = null;
let renderizarTarjetaActivaUIFn = null;
let vincularDragDropUIFn = null;
let ejecutarZonificacionAutomaticaUIFn = null;
let moverParadaSecuenciaUIFn = null;

let paradasMemoriaLocal = [];

/**
 * Carga dinámica de módulos para compatibilidad con scripts tradicionales y módulos ES6.
 */
async function cargarModulosDependientes() {
    try {
        const mapaVisor = await import("./mapa/mapa-visor.js").catch(() => ({}));
        actualizarPuntosEnMapaFn = mapaVisor.actualizarPuntosEnMapa || window.actualizarPuntosEnMapa;
        enfocarZonaEnMapaFn = mapaVisor.enfocarZonaEnMapa || window.enfocarZonaEnMapa;

        const zonif = await import("./mapa/zonificacion/mensajero-zonificacion.js").catch(() => ({}));
        PALETA_ZONAS_REF = zonif.PALETA_ZONAS || window.PALETA_ZONAS || PALETA_ZONAS_REF;

        const storeMod = await import("./db/indexed-store.js").catch(() => ({}));
        if (storeMod.IndexedStore) {
            dbStore = new storeMod.IndexedStore();
        }

        const uiTarjeta = await import("./ui/ui-tarjeta-activa.js").catch(() => ({}));
        renderizarTarjetaActivaUIFn = uiTarjeta.renderizarTarjetaActivaUI || window.renderizarTarjetaActivaUI;

        const dndMod = await import("./ui/ui-dnd-persistencia.js").catch(() => ({}));
        vincularDragDropUIFn = dndMod.vincularDragDropUI || window.vincularDragDropUI;

        const zonifMaint = await import("./ui/ui-zonificacion-mantenimiento.js").catch(() => ({}));
        ejecutarZonificacionAutomaticaUIFn = zonifMaint.ejecutarZonificacionAutomaticaUI || window.ejecutarZonificacionAutomaticaUI;
        moverParadaSecuenciaUIFn = zonifMaint.moverParadaSecuenciaUI || window.moverParadaSecuenciaUI;

        console.log("✅ [MENSAJERO_UI]: Módulos dependientes cargados correctamente.");
    } catch (e) {
        console.warn("⚠️ [MENSAJERO_UI]: Carga diferida de módulos requerida:", e);
    }
}

// Inicializar carga de dependencias
cargarModulosDependientes();

/**
 * Emitir vibración háptica rápida en Android
 */
function emitirHaptico(ms = 30) {
    if ('vibrate' in navigator) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

/**
 * Renderiza la consola de operaciones táctica desplegando los campos clave de la tirilla y acordeones zonificados.
 */
export async function renderizarConsolaOperaciones(listaPedidos, indiceActivo = 0, llamadasRealizadas = 0) {
    console.group("🖥️ [MENSAJERO_UI]: Renderizando Consola de Operaciones y Acordeones Independientes");
    
    paradasMemoriaLocal = Array.isArray(listaPedidos) ? [...listaPedidos] : [];
    console.log(`📊 Paradas totales recibidas: ${paradasMemoriaLocal.length} | Ítem Activo: Índice ${indiceActivo}`);

    const contenedorActivo = document.getElementById("contenedor-tarjeta-activa");
    const contenedorAcordeones = document.getElementById("contenedor-acordeones-zonas") || document.getElementById("lista-paradas-zonificadas");
    const txtTotal = document.getElementById("txt-total-paradas");

    if (txtTotal) txtTotal.innerText = `${paradasMemoriaLocal.length} PARADAS`;

    console.log("🗺️ [MENSAJERO_UI]: Notificando al visor de mapa para actualizar waypoints...");
    if (typeof actualizarPuntosEnMapaFn === "function") {
        actualizarPuntosEnMapaFn(paradasMemoriaLocal, indiceActivo);
    } else if (typeof window.actualizarPuntosEnMapa === "function") {
        window.actualizarPuntosEnMapa(paradasMemoriaLocal, indiceActivo);
    }

    if (paradasMemoriaLocal.length === 0) {
        console.warn("⚠️ [MENSAJERO_UI]: La lista de pedidos está vacía. Mostrando estado [SIN_RUTA].");
        if (contenedorActivo && typeof renderizarTarjetaActivaUIFn === "function") {
            renderizarTarjetaActivaUIFn(contenedorActivo, null, 0, 0);
        }
        if (contenedorAcordeones) contenedorAcordeones.innerHTML = "";
        console.groupEnd();
        return;
    }

    const pedido = paradasMemoriaLocal[indiceActivo] || paradasMemoriaLocal[0];

    // 1. TARJETA ACTIVA EN FOCO
    if (contenedorActivo && typeof renderizarTarjetaActivaUIFn === "function") {
        renderizarTarjetaActivaUIFn(contenedorActivo, pedido, indiceActivo, llamadasRealizadas);
    }

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

        const keysZona = Object.keys(grupos);

        keysZona.forEach((zonaKey, indexZona) => {
            const infoZona = PALETA_ZONAS_REF[zonaKey] || { color: "#00e5ff", label: zonaKey };
            const itemsGrupo = grupos[zonaKey];

            itemsGrupo.sort((a, b) => (a.secuenciaZona || a.secuencia || 0) - (b.secuenciaZona || b.secuencia || 0));

            const details = document.createElement("details");
            details.className = "cyber-accordion acordeon-zona-item";
            details.style.cssText = `background:#0d1117; border:1px solid ${infoZona.color}; margin-bottom:10px; border-radius:6px; overflow:hidden; position:relative;`;
            
            // Abrir únicamente la primera zona por defecto
            details.open = (indexZona === 0);

            // Cierre automático exclusivo de otros acordeones al abrir uno nuevo
            details.addEventListener("toggle", () => {
                if (details.open) {
                    console.log(`📂 [MENSAJERO_UI]: Enfocando zona exclusiva -> ${infoZona.label}`);
                    
                    if (typeof enfocarZonaEnMapaFn === "function") {
                        enfocarZonaEnMapaFn(itemsGrupo);
                    } else if (typeof window.enfocarZonaEnMapa === "function") {
                        window.enfocarZonaEnMapa(itemsGrupo);
                    }

                    // Cerrar automáticamente todos los demás acordeones del contenedor
                    const todosLosAcordeones = contenedorAcordeones.querySelectorAll(".acordeon-zona-item");
                    todosLosAcordeones.forEach((otroAcc) => {
                        if (otroAcc !== details && otroAcc.open) {
                            otroAcc.open = false;
                        }
                    });
                }
            });

            // Cabecera Summary
            const summary = document.createElement("summary");
            summary.className = "cyber-summary";
            summary.style.cssText = `padding:10px 14px; background:#161b22; color:${infoZona.color}; font-weight:bold; font-size:0.85rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none; border-bottom:1px solid rgba(255,255,255,0.05);`;
            summary.innerHTML = `
                <span>▼ ${infoZona.label} (${itemsGrupo.length} Envíos)</span>
                <span class="badge-zone" style="background:${infoZona.color}22; border:1px solid ${infoZona.color}; font-size:0.7rem; padding:2px 8px; border-radius:3px; color:${infoZona.color}; font-family:monospace;">
                    ${infoZona.color}
                </span>
            `;

            // Barra de Botones
            const accionesBar = document.createElement("div");
            accionesBar.className = "zona-acciones-bar";
            accionesBar.style.cssText = "display: flex; gap: 6px; padding: 8px; background: #080b10; border-bottom: 1px solid #30363d; overflow-x: auto;";
            accionesBar.innerHTML = `
                <button type="button" class="btn-zona-action cyber-btn-touch" style="color:#00e5ff; border-color:#00e5ff;" onclick="window.iniciarRutaZona('${infoZona.label}')">
                    ► _INICIAR_RUTA
                </button>
                <button type="button" class="btn-zona-action cyber-btn-touch" style="color:#ffb300; border-color:#ffb300;" onclick="window.optimizarProximidadZona('${infoZona.label}')">
                    ⚡ OPTIMIZAR
                </button>
                <button type="button" class="btn-zona-action cyber-btn-touch" style="color:#39ff14; border-color:#39ff14;" onclick="window.planillarRutaZona('${infoZona.label}')">
                    📝 _PLANILLAR
                </button>
                <button type="button" class="btn-zona-action cyber-btn-touch danger" onclick="window.verMapaZona('${infoZona.label}')">
                    🗺️ VER MAPA
                </button>
            `;

            // Lista con Drag & Drop y barra deslizante independiente propia
            const listContainer = document.createElement("div");
            listContainer.className = "paradas-drag-list zona-scroll-dedicado";
            listContainer.style.cssText = `
                max-height: clamp(200px, 38dvh, 400px);
                overflow-y: auto !important;
                touch-action: pan-y !important;
                -webkit-overflow-scrolling: touch;
                padding: 8px 6px 30px 6px;
                background: #05070f;
                display: flex;
                flex-direction: column;
                gap: 6px;
                position: relative;
            `;

            itemsGrupo.forEach((p, idx) => {
                const idParadaLimpio = String(p.id || p.ssc || `p_${idx}`).replace(/'/g, "\\'");
                const numSecuencia = p.secuenciaZona || p.secuencia || (idx + 1);
                const card = document.createElement("div");
                card.className = `item-parada-lista parada-card ${p.origIndex === indiceActivo ? 'activa' : ''}`;
                card.setAttribute("draggable", "true");
                card.setAttribute("data-id", p.id || p.ssc);
                card.setAttribute("data-orig-index", p.origIndex);
                card.style.cssText = `background:#0c080f; border:1px solid ${p.origIndex === indiceActivo ? 'var(--neon-cyan, #00e5ff)' : '#291f33'}; padding:8px 10px; font-size:0.75rem; border-radius:4px; cursor:grab; margin-bottom:2px;`;

                card.innerHTML = `
                    <div id="vista-lectura-${p.origIndex}" style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div><strong style="color:${infoZona.color}">[#${numSecuencia}]</strong> ${p.destinatario || "Cliente"} - ${p.direccion || ''}</div>
                            <div style="color:#888; font-size:0.7rem;">
                                SSC: ${p.ssc || 'N/A'} | Tel: ${p.telefono || 'N/A'} | Cuota: <span style="color:var(--neon-yellow, #ffb300);">${p.cuotaModeradora || '$0'}</span>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <button type="button" class="cyber-btn-touch" style="min-height:30px; min-width:30px; padding:2px;" onclick="window.moverParadaSecuencia('${idParadaLimpio}', -1)">▲</button>
                            <button type="button" class="cyber-btn-touch" style="min-height:30px; min-width:30px; padding:2px;" onclick="window.moverParadaSecuencia('${idParadaLimpio}', 1)">▼</button>
                            <button type="button" class="cyber-btn-touch" style="min-height:30px; min-width:30px; padding:2px; color:#ffb300; border-color:#ffb300;" onclick="activarEdicionParadaUI(event, ${p.origIndex})">✏️</button>
                            <button type="button" class="cyber-btn-touch danger" style="min-height:30px; min-width:30px; padding:2px;" onclick="eliminarParadaUI(event, ${p.origIndex})">🗑️</button>
                        </div>
                    </div>

                    <div id="vista-edicion-${p.origIndex}" style="display:none; flex-direction:column; gap:4px; margin-top:4px; background:#140e1a; padding:6px; border:1px dashed var(--neon-cyan, #00e5ff);">
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
                            <button type="button" class="cyber-btn-touch" style="min-height:32px; border-color:#888; color:#888;" onclick="cancelarEdicionParadaUI(event, ${p.origIndex})">[CANCELAR]</button>
                            <button type="button" class="cyber-btn-touch" style="min-height:32px;" onclick="guardarEdicionParadaUI(event, ${p.origIndex})">[GUARDAR]</button>
                        </div>
                    </div>
                `;

                if (typeof vincularDragDropUIFn === "function") {
                    vincularDragDropUIFn(card, infoZona.label, paradasMemoriaLocal, () => renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0));
                }
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

// Escuchas del Bus de Eventos de Sincronización Local-First
window.addEventListener('sincronizacion:inicio', (e) => {
    const { taskId, totalItems } = e.detail || { taskId: 'sync-queue', totalItems: 1 };
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: taskId,
            titulo: 'Sincronizando Offline',
            mensaje: `Sincronizando 0 de ${totalItems} registros pendientes...`,
            estado: 'procesando',
            progreso: 0,
            acciones: [
                {
                    texto: 'Cancelar',
                    clase: 'danger',
                    accion: (id) => {
                        console.log(`[MensajeroUI] Cancelado por usuario: ${id}`);
                        if (typeof window.cerrarAvisoProceso === 'function') window.cerrarAvisoProceso(id);
                    }
                }
            ]
        });
    }
});

window.addEventListener('sincronizacion:progreso', (e) => {
    const { taskId, completados, totalItems } = e.detail || {};
    const porcentaje = totalItems > 0 ? (completados / totalItems) * 100 : 0;
    if (typeof window.actualizarProgresoProceso === 'function') {
        window.actualizarProgresoProceso(taskId, porcentaje, `Sincronizando ${completados} de ${totalItems} registros...`);
    }
});

window.addEventListener('sincronizacion:completado', (e) => {
    const { taskId } = e.detail || {};
    if (typeof window.actualizarProgresoProceso === 'function') {
        window.actualizarProgresoProceso(taskId, 100, '¡Sincronización completada con éxito!', 'exito');
    }
    if (typeof window.cerrarAvisoProceso === 'function') {
        window.cerrarAvisoProceso(taskId, 2000);
    }
});

window.addEventListener('sincronizacion:error', (e) => {
    const { taskId, errorMsg } = e.detail || {};
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: taskId,
            titulo: 'Error de Sincronización',
            mensaje: errorMsg || 'Error al conectar con la API REST.',
            estado: 'error',
            progreso: 100,
            acciones: [
                {
                    texto: 'Cerrar',
                    clase: 'danger',
                    accion: (id) => {
                        if (typeof window.cerrarAvisoProceso === 'function') window.cerrarAvisoProceso(id);
                    }
                }
            ]
        });
    }
});

// Bindings globales en Window
window.renderizarConsolaOperaciones = renderizarConsolaOperaciones;
window.refrescarConsolaOperaciones = function() { renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0); };

window.ejecutarZonificacionAutomatica = async function() {
    emitirHaptico(30);
    if (typeof ejecutarZonificacionAutomaticaUIFn === "function") {
        paradasMemoriaLocal = await ejecutarZonificacionAutomaticaUIFn(paradasMemoriaLocal, (p) => renderizarConsolaOperaciones(p, 0, 0));
    }
};

window.moverParadaSecuencia = async function(idParada, delta) {
    emitirHaptico(20);
    if (typeof moverParadaSecuenciaUIFn === "function") {
        await moverParadaSecuenciaUIFn(paradasMemoriaLocal, idParada, delta, (p) => renderizarConsolaOperaciones(p, 0, 0));
    }
};

window.activarEdicionParadaUI = function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    emitirHaptico(20);
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'none';
    if (edicion) edicion.style.display = 'flex';
};

window.cancelarEdicionParadaUI = function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    emitirHaptico(20);
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'flex';
    if (edicion) edicion.style.display = 'none';
};

window.guardarEdicionParadaUI = async function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    emitirHaptico(40);
    if (paradasMemoriaLocal[idx]) {
        paradasMemoriaLocal[idx].destinatario = document.getElementById(`input-edit-destinatario-${idx}`).value;
        paradasMemoriaLocal[idx].telefono = document.getElementById(`input-edit-telefono-${idx}`).value;
        paradasMemoriaLocal[idx].direccion = document.getElementById(`input-edit-direccion-${idx}`).value;
        paradasMemoriaLocal[idx].ssc = document.getElementById(`input-edit-ssc-${idx}`).value;
        paradasMemoriaLocal[idx].cuotaModeradora = document.getElementById(`input-edit-cuota-${idx}`).value;

        if (dbStore && typeof dbStore.actualizarParada === "function") {
            await dbStore.actualizarParada(paradasMemoriaLocal[idx]);
        }
        localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
        renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
    }
};

window.eliminarParadaUI = async function (e, idx) {
    if (e?.preventDefault) e.preventDefault();
    emitirHaptico([50, 30, 50]);
    if (!confirm("¿Desea eliminar esta parada de la ruta?")) return;

    const paradaEliminada = paradasMemoriaLocal.splice(idx, 1);
    if (paradaEliminada[0]?.id && dbStore && typeof dbStore.eliminarParada === "function") {
        await dbStore.eliminarParada(paradaEliminada[0].id);
    }

    for (let i = 0; i < paradasMemoriaLocal.length; i++) {
        paradasMemoriaLocal[i].secuencia = i + 1;
        paradasMemoriaLocal[i].secuenciaZona = i + 1;
        if (dbStore && typeof dbStore.actualizarParada === "function") {
            await dbStore.actualizarParada(paradasMemoriaLocal[i]);
        }
    }

    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
    renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
};