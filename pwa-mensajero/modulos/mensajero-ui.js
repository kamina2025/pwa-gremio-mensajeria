/**
 * PROTOCOLO MACONDO - SUBSISTEMA RENDERIZADOR DE INTERFAZ OPERACIONAL (TIRILLAS & ZONAS)
 * Ubicación: pwa-mensajero/modulos/mensajero-ui.js
 */

import { actualizarPuntosEnMapa, enfocarZonaEnMapa } from "./mapa/mapa-visor.js";
import { clasificarParadasPorZona, PALETA_ZONAS } from "./mapa/mensajero-zonificacion.js";
import { IndexedStore } from "./db/indexed-store.js";

const dbStore = new IndexedStore();
let paradasMemoriaLocal = [];

/**
 * Renderiza la consola de operaciones táctica desplegando los campos clave de la tirilla y acordeones zonificados.
 * 
 * @param {Array<Object>} listaPedidos - Lista de paradas/tirillas cargadas.
 * @param {number} indiceActivo - Índice de la tirilla activa en foco.
 * @param {number} llamadasRealizadas - Contador de intentos de llamada al cliente.
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
        if (contenedorActivo) {
            contenedorActivo.innerHTML = `<div class="panel-maquina" style="text-align:center; color:var(--text-muted, #aaa);">[SIN_RUTA] No hay tirillas médicas cargadas. Escanee un documento o pegue un manifiesto.</div>`;
        }
        if (contenedorAcordeones) contenedorAcordeones.innerHTML = "";
        console.groupEnd();
        return;
    }

    const pedido = paradasMemoriaLocal[indiceActivo] || paradasMemoriaLocal[0];

    // 1. TARJETA ACTIVA EN FOCO
    if (contenedorActivo) {
        contenedorActivo.innerHTML = `
            <div class="card-pedido-activa ${pedido.estado ? pedido.estado.toLowerCase() : 'asignado'}" style="background: #0f0914; border: 1px solid var(--neon-blue, #00e5ff); padding: 12px; border-radius: 4px;">
                <div class="card-header-flujo" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #291f33; padding-bottom:6px; margin-bottom:8px;">
                    <span class="badge-parada" style="background:var(--neon-blue, #00e5ff); color:#000; font-weight:bold; padding:2px 6px; font-size:0.75rem;">
                        PARADA #${pedido.secuencia || (indiceActivo + 1)} | SSC: ${pedido.ssc || "N/A"}
                    </span>
                    <span class="badge-estado" style="color:var(--neon-green, #00ff66); font-weight:bold; font-size:0.8rem;">
                        ${pedido.estado || "ASIGNADO"}
                    </span>
                </div>

                <div class="card-body-flujo" style="font-size:0.85rem; line-height:1.4;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h2 style="margin:2px 0; color:#fff; font-size:1.1rem;">${pedido.destinatario || "Cliente Tirilla"}</h2>
                        <span style="background:rgba(255,170,0,0.15); color:var(--neon-amber, #ffaa00); border:1px solid var(--neon-amber, #ffaa00); padding:2px 6px; border-radius:3px; font-weight:bold; font-size:0.8rem;">
                            💵 CUOTA: ${pedido.cuotaModeradora || "$0"}
                        </span>
                    </div>

                    <p style="margin:4px 0; color:#ddd;"><strong>📍 Dirección:</strong> ${pedido.direccion || "Dirección no especificada"}</p>
                    <p style="margin:2px 0; color:#aaa;"><strong>📞 Teléfono:</strong> ${pedido.telefono || "3000000000"}</p>
                    <p style="margin:2px 0; color:#aaa;"><strong>🏥 Origen:</strong> ${pedido.puntoOrigen || "Cafam Cali Tequendama"}</p>
                    <p style="margin:2px 0; color:#888; font-size:0.75rem;"><strong>📦 Carga:</strong> ${pedido.carga || "Medicamentos Dispensación"}</p>
                </div>

                <div class="card-acciones-flujo" style="margin-top:12px;">
                    ${obtenerBotonesFlujoHTML(pedido, llamadasRealizadas)}
                </div>
            </div>
        `;
    }

    // 2. CONSTRUCCIÓN DE ACORDEONES AGRUPADOS POR ZONA
    if (contenedorAcordeones) {
        console.log("📋 [MENSAJERO_UI]: Construyendo acordeones de paradas por zona...");
        contenedorAcordeones.innerHTML = "";

        const grupos = {};
        paradasMemoriaLocal.forEach((item, index) => {
            if (!item.secuencia) item.secuencia = index + 1;
            const zKey = item.zonaKey || "GENERAL";
            if (!grupos[zKey]) grupos[zKey] = [];
            grupos[zKey].push({ ...item, origIndex: index });
        });

        Object.keys(grupos).forEach(zonaKey => {
            const infoZona = PALETA_ZONAS[zonaKey] || { color: "#00e5ff", label: zonaKey };
            const itemsGrupo = grupos[zonaKey];

            const details = document.createElement("details");
            details.className = "cyber-accordion";
            details.style.cssText = `background:#0d1117; border:1px solid ${infoZona.color}; margin-bottom:8px; border-radius:4px; overflow:hidden;`;

            details.addEventListener("toggle", () => {
                if (details.open) {
                    if (typeof enfocarZonaEnMapa === "function") {
                        enfocarZonaEnMapa(itemsGrupo);
                    } else if (typeof window.enfocarZonaEnMapa === "function") {
                        window.enfocarZonaEnMapa(itemsGrupo);
                    }
                }
            });

            // Construcción modular limpia de las filas de cada parada
            const htmlFilas = itemsGrupo.map(p => {
                const idParadaLimpio = String(p.id || '').replace(/'/g, "\\'");
                return `
                    <div class="item-parada-lista ${p.origIndex === indiceActivo ? 'activa' : ''}" style="background:#0c080f; border:1px solid ${p.origIndex === indiceActivo ? 'var(--neon-blue, #00e5ff)' : '#291f33'}; padding:6px 8px; margin-bottom:6px; font-size:0.75rem; border-radius:3px;">
                        
                        <!-- MODO LECTURA DE PARADA -->
                        <div id="vista-lectura-${p.origIndex}" style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div><strong style="color:${infoZona.color}">[#${p.secuencia}]</strong> ${p.destinatario || "Cliente"} - ${p.direccion || ''}</div>
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

                        <!-- MODO EDICIÓN FORMULARIO INDIVIDUAL -->
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

                    </div>
                `;
            }).join('');

            details.innerHTML = `
                <summary style="padding:8px 12px; background:#161b22; color:${infoZona.color}; font-weight:bold; font-size:0.85rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <span>▼ ${infoZona.label} (${itemsGrupo.length})</span>
                    <span style="background:${infoZona.color}22; border:1px solid ${infoZona.color}; font-size:0.7rem; padding:1px 6px; border-radius:3px;">
                        ${infoZona.color}
                    </span>
                </summary>
                <div style="padding:6px; background:#05070f;">
                    ${htmlFilas}
                </div>
            `;

            contenedorAcordeones.appendChild(details);
        });
    }

    console.log("✅ [MENSAJERO_UI]: Consola de operaciones renderizada exitosamente.");
    console.groupEnd();
}

function obtenerBotonesFlujoHTML(pedido, llamadasRealizadas) {
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
                        [3] FINALIZAR Y COBRAR ✅
                    </button>
                </div>
            </div>`;
    }

    return `<div style="color:var(--crypto-secure, #00ff66); text-align:center; font-weight:bold; padding:8px;">✅ ENTREGADO / PROCESADO</div>`;
}

// ==========================================
// MANTENIMIENTO, ZONIFICACIÓN Y REORDENAMIENTO LOCAL-FIRST
// ==========================================

/**
 * Ejecuta el proceso global de Zonificación Automática por Colores y Polígonos GeoJSON.
 * Resuelve coordenadas faltantes vía Google Geocoder antes de clasificar por zona.
 */
window.ejecutarZonificacionAutomatica = async function() {
    console.group("🎨 [ZONIFICAR]: Iniciando clasificación espacial táctica...");
    
    const txtTotal = document.getElementById("txt-total-paradas");
    if (txtTotal) txtTotal.innerText = "ZONIFICANDO...";

    if (!Array.isArray(paradasMemoriaLocal) || paradasMemoriaLocal.length === 0) {
        console.warn("⚠️ [ZONIFICAR]: No hay paradas en memoria para zonificar.");
        console.groupEnd();
        return;
    }

    // Instancia de Geocoder de Google Maps para resolver coordenadas si faltan
    const geocoder = (typeof google !== "undefined" && google.maps) ? new google.maps.Geocoder() : null;

    for (let i = 0; i < paradasMemoriaLocal.length; i++) {
        const p = paradasMemoriaLocal[i];
        
        // 1. Si no tiene coordenadas lat/lng, geocodificar la dirección antes de clasificar
        if ((!p.lat || !p.lng) && geocoder && p.direccion) {
            const dirCompleta = p.direccion.toLowerCase().includes("cali") 
                ? p.direccion 
                : `${p.direccion}, Cali, Valle del Cauca, Colombia`;
            
            try {
                const res = await new Promise((resolve) => {
                    geocoder.geocode({ address: dirCompleta }, (results, status) => {
                        if (status === "OK" && results && results[0]) {
                            resolve(results[0].geometry.location);
                        } else {
                            resolve(null);
                        }
                    });
                });

                if (res) {
                    p.lat = res.lat();
                    p.lng = res.lng();
                    console.log(`📍 Geocodificada parada #${i + 1} (${p.destinatario}): [${p.lat}, ${p.lng}]`);
                }
            } catch (err) {
                console.warn(`⚠️ Error geocodificando dirección de parada #${i + 1}:`, err);
            }
        }
    }

    // 2. Clasificar mediante polígonos GeoJSON exactos de Cali
    paradasMemoriaLocal = clasificarParadasPorZona(paradasMemoriaLocal);

    // 3. Guardar cambios en IndexedDB y localStorage (Local-First)
    for (const p of paradasMemoriaLocal) {
        await dbStore.actualizarParada(p);
    }
    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
    console.log("💾 [ZONIFICAR]: Paradas actualizadas en IndexedDB y localStorage.");

    // 4. Refrescar UI de acordeones y notificar al mapa para re-renderizar marcadores con sus respectivos colores
    renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
    console.groupEnd();
};
window.moverParadaSecuencia = async function(idParada, delta) {
    console.group(`⚡ [REORDENAMIENTO]: Moviendo parada ${idParada} con delta ${delta}`);
    const index = paradasMemoriaLocal.findIndex(p => String(p.id) === String(idParada));
    if (index === -1) {
        console.warn("⚠️ [REORDENAMIENTO]: Parada no encontrada para ID:", idParada);
        console.groupEnd();
        return;
    }

    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= paradasMemoriaLocal.length) {
        console.warn("⚠️ [REORDENAMIENTO]: Índice fuera de límites.");
        console.groupEnd();
        return;
    }

    // Intercambiar posiciones
    const temp = paradasMemoriaLocal[index];
    paradasMemoriaLocal[index] = paradasMemoriaLocal[newIndex];
    paradasMemoriaLocal[newIndex] = temp;

    // Actualizar secuencias y guardar en IndexedDB
    for (let i = 0; i < paradasMemoriaLocal.length; i++) {
        paradasMemoriaLocal[i].secuencia = i + 1;
        await dbStore.actualizarParada(paradasMemoriaLocal[i]);
    }

    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
    renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
    console.groupEnd();
};

window.activarEdicionParadaUI = function (e, idx) {
    if (e && e.preventDefault) e.preventDefault();
    console.log(`✏️ [PARADA_EDIT_INIT]: Solicitando edición para parada en índice ${idx}`);
    
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'none';
    if (edicion) edicion.style.display = 'flex';
};

window.cancelarEdicionParadaUI = function (e, idx) {
    if (e && e.preventDefault) e.preventDefault();
    console.log(`❌ [PARADA_EDIT_CANCEL]: Cancelando edición para parada en índice ${idx}`);
    
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'flex';
    if (edicion) edicion.style.display = 'none';
};

window.guardarEdicionParadaUI = async function (e, idx) {
    if (e && e.preventDefault) e.preventDefault();
    console.group(`💾 [PARADA_EDIT_SAVE]: Guardando edición individual de parada #${idx}`);
    
    if (paradasMemoriaLocal[idx]) {
        paradasMemoriaLocal[idx].destinatario = document.getElementById(`input-edit-destinatario-${idx}`).value;
        paradasMemoriaLocal[idx].telefono = document.getElementById(`input-edit-telefono-${idx}`).value;
        paradasMemoriaLocal[idx].direccion = document.getElementById(`input-edit-direccion-${idx}`).value;
        paradasMemoriaLocal[idx].ssc = document.getElementById(`input-edit-ssc-${idx}`).value;
        paradasMemoriaLocal[idx].cuotaModeradora = document.getElementById(`input-edit-cuota-${idx}`).value;

        await dbStore.actualizarParada(paradasMemoriaLocal[idx]);
        localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));

        console.log("💾 Parada guardada exitosamente en IndexedDB y localStorage.");
        renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
    }
    console.groupEnd();
};

window.eliminarParadaUI = async function (e, idx) {
    if (e && e.preventDefault) e.preventDefault();
    console.group(`🗑️ [PARADA_DELETE]: Solicitando borrado de la parada en índice ${idx}`);

    if (!confirm("¿Desea eliminar esta parada de la ruta?")) {
        console.log("🚫 Borrado cancelado por el usuario.");
        console.groupEnd();
        return;
    }

    const paradaEliminada = paradasMemoriaLocal.splice(idx, 1);
    if (paradaEliminada[0] && paradaEliminada[0].id) {
        await dbStore.eliminarParada(paradaEliminada[0].id);
    }

    // Recalcular secuencias restantes
    for (let i = 0; i < paradasMemoriaLocal.length; i++) {
        paradasMemoriaLocal[i].secuencia = i + 1;
        await dbStore.actualizarParada(paradasMemoriaLocal[i]);
    }

    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
    console.log(`💾 Registro actualizado guardado (${paradasMemoriaLocal.length} paradas restantes).`);

    renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
    console.groupEnd();
};

window.refrescarConsolaOperaciones = function() {
    renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
};