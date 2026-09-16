/**
 * PROTOCOLO MACONDO - SUBSISTEMA RENDERIZADOR DE INTERFAZ OPERACIONAL (TIRILLAS)
 * Ubicación: pwa-mensajero/modulos/mensajero-ui.js
 */

import { actualizarPuntosEnMapa } from "./mapa/mapa-visor.js";

/**
 * Renderiza la consola de operaciones táctica desplegando los campos clave de la tirilla.
 * 
 * @param {Array<Object>} listaPedidos - Lista de paradas/tirillas cargadas.
 * @param {number} indiceActivo - Índice de la tirilla activa en foco.
 * @param {number} llamadasRealizadas - Contador de intentos de llamada al cliente.
 */
export function renderizarConsolaOperaciones(listaPedidos, indiceActivo, llamadasRealizadas) {
    console.group("🖥️ [MENSAJERO_UI]: Renderizando Consola de Operaciones");
    console.log(`📊 Paradas totales recibidas: ${listaPedidos ? listaPedidos.length : 0} | Ítem Activo: Índice ${indiceActivo}`);

    const contenedor = document.getElementById("contenedor-tarjeta-activa");
    const contenedorLista = document.getElementById("lista-paradas-zonificadas");
    const txtTotal = document.getElementById("txt-total-paradas");

    if (txtTotal) txtTotal.innerText = `${listaPedidos ? listaPedidos.length : 0} PARADAS`;

    console.log("🗺️ [MENSAJERO_UI]: Notificando al visor de mapa para actualizar waypoints...");
    actualizarPuntosEnMapa(listaPedidos, indiceActivo);

    if (!listaPedidos || listaPedidos.length === 0) {
        console.warn("⚠️ [MENSAJERO_UI]: La lista de pedidos está vacía. Mostrando estado [SIN_RUTA].");
        if (contenedor) {
            contenedor.innerHTML = `<div class="panel-maquina" style="text-align:center; color:var(--text-muted, #aaa);">[SIN_RUTA] No hay tirillas médicas cargadas. Escanee un documento o pegue un manifiesto.</div>`;
        }
        if (contenedorLista) contenedorLista.innerHTML = "";
        console.groupEnd();
        return;
    }

    const pedido = listaPedidos[indiceActivo] || listaPedidos[0];
    console.log("📍 [MENSAJERO_UI]: Pedido en foco actual:", pedido);

    // 1. TARJETA ACTIVA EN FOCO
    if (contenedor) {
        contenedor.innerHTML = `
            <div class="card-pedido-activa ${pedido.estado ? pedido.estado.toLowerCase() : 'asignado'}" style="background: #0f0914; border: 1px solid var(--neon-blue, #00e5ff); padding: 12px; border-radius: 4px;">
                <div class="card-header-flujo" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #291f33; padding-bottom:6px; margin-bottom:8px;">
                    <span class="badge-parada" style="background:var(--neon-blue, #00e5ff); color:#000; font-weight:bold; padding:2px 6px; font-size:0.75rem;">
                        PARADA ${String.fromCharCode(65 + indiceActivo)} | SSC: ${pedido.ssc || "N/A"}
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

    // 2. LISTA ZONIFICADA CON CONTROLES INDIVIDUALES DE EDICIÓN
    if (contenedorLista) {
        console.log("📋 [MENSAJERO_UI]: Construyendo HTML de la lista de paradas zonificadas...");
        contenedorLista.innerHTML = "";
        listaPedidos.forEach((p, idx) => {
            const item = document.createElement("div");
            item.className = `item-parada-lista ${idx === indiceActivo ? 'activa' : ''} ${p.estado ? p.estado.toLowerCase() : 'asignado'}`;
            item.style.cssText = `background:#0c080f; border:1px solid ${idx === indiceActivo ? 'var(--neon-blue, #00e5ff)' : '#291f33'}; padding:6px 8px; margin-bottom:6px; font-size:0.75rem; border-radius:3px;`;
            
            item.innerHTML = `
                <!-- MODO LECTURA DE PARADA -->
                <div id="vista-lectura-${idx}" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div><strong>[${String.fromCharCode(65 + idx)}]</strong> ${p.destinatario || "Cliente"} - ${p.direccion}</div>
                        <div style="color:#888; font-size:0.7rem;">
                            SSC: ${p.ssc || 'N/A'} | Tel: ${p.telefono || 'N/A'} | Cuota: <span style="color:var(--neon-amber, #ffaa00);">${p.cuotaModeradora || '$0'}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="color:var(--neon-amber, #ffaa00); font-weight:bold; margin-right:4px;">${p.estado || "ASIGNADO"}</span>
                        <button type="button" class="btn-terminal" style="border-color:#ffb703; color:#ffb703; padding:1px 4px; font-size:0.65rem;" onclick="activarEdicionParadaUI(event, ${idx})">✏️</button>
                        <button type="button" class="btn-terminal" style="border-color:#ff3366; color:#ff3366; padding:1px 4px; font-size:0.65rem;" onclick="eliminarParadaUI(event, ${idx})">🗑️</button>
                    </div>
                </div>

                <!-- MODO EDICIÓN FORMULARIO INDIVIDUAL -->
                <div id="vista-edicion-${idx}" style="display:none; flex-direction:column; gap:4px; margin-top:4px; background:#140e1a; padding:6px; border:1px dashed var(--neon-blue, #00e5ff);">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <input type="text" id="input-edit-destinatario-${idx}" value="${p.destinatario || ''}" placeholder="Destinatario" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                        <input type="text" id="input-edit-telefono-${idx}" value="${p.telefono || ''}" placeholder="Teléfono" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                    </div>
                    <input type="text" id="input-edit-direccion-${idx}" value="${p.direccion || ''}" placeholder="Dirección" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <input type="text" id="input-edit-ssc-${idx}" value="${p.ssc || ''}" placeholder="SSC" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                        <input type="text" id="input-edit-cuota-${idx}" value="${p.cuotaModeradora || ''}" placeholder="Cuota" style="background:#000; color:#fff; border:1px solid #333; padding:2px 4px; font-size:0.7rem;">
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:4px;">
                        <button type="button" class="btn-terminal" style="border-color:#888; color:#888; padding:2px 6px; font-size:0.65rem;" onclick="cancelarEdicionParadaUI(${idx})">[CANCELAR]</button>
                        <button type="button" class="btn-terminal" style="border-color:var(--neon-blue, #00e5ff); color:var(--neon-blue, #00e5ff); padding:2px 6px; font-size:0.65rem;" onclick="guardarEdicionParadaUI(${idx})">[GUARDAR]</button>
                    </div>
                </div>
            `;
            contenedorLista.appendChild(item);
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
// MANTENIMIENTO Y EDICIÓN INDIVIDUAL DE PARADAS
// ==========================================

window.activarEdicionParadaUI = function (e, idx) {
    if (e && e.preventDefault) e.preventDefault(); // Evita recarga si está dentro de un <form>
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

window.guardarEdicionParadaUI = function (e, idx) {
    if (e && e.preventDefault) e.preventDefault();
    console.group(`💾 [PARADA_EDIT_SAVE]: Guardando edición individual de parada #${idx}`);
    
    let rutaGuardada = JSON.parse(localStorage.getItem("ruta_zonificada") || "[]");

    if (rutaGuardada[idx]) {
        rutaGuardada[idx].destinatario = document.getElementById(`input-edit-destinatario-${idx}`).value;
        rutaGuardada[idx].telefono = document.getElementById(`input-edit-telefono-${idx}`).value;
        rutaGuardada[idx].direccion = document.getElementById(`input-edit-direccion-${idx}`).value;
        rutaGuardada[idx].ssc = document.getElementById(`input-edit-ssc-${idx}`).value;
        rutaGuardada[idx].cuotaModeradora = document.getElementById(`input-edit-cuota-${idx}`).value;

        localStorage.setItem("ruta_zonificada", JSON.stringify(rutaGuardada));
        console.log("💾 Datos guardados exitosamente en 'ruta_zonificada'.");

        if (typeof window.refrescarConsolaOperaciones === 'function') {
            console.log("🔄 Invocando window.refrescarConsolaOperaciones()...");
            window.refrescarConsolaOperaciones();
        } else if (typeof renderizarConsolaOperaciones === 'function') {
            renderizarConsolaOperaciones(rutaGuardada, 0, 0);
        }
    }
    console.groupEnd();
};

window.eliminarParadaUI = function (e, idx) {
    if (e && e.preventDefault) e.preventDefault(); // Previene la recarga/submit de la página
    console.group(`🗑️ [PARADA_DELETE]: Solicitando borrado de la parada en índice ${idx}`);

    if (!confirm("¿Desea eliminar esta parada de la ruta?")) {
        console.log("🚫 Borrado cancelado por el usuario.");
        console.groupEnd();
        return;
    }

    let rutaGuardada = JSON.parse(localStorage.getItem("ruta_zonificada") || "[]");
    const paradaEliminada = rutaGuardada.splice(idx, 1);

    console.log("🗑️ Parada removida del arreglo:", paradaEliminada);
    localStorage.setItem("ruta_zonificada", JSON.stringify(rutaGuardada));
    console.log(`💾 Arreglo actualizado guardado (${rutaGuardada.length} paradas restantes).`);

    // Actualiza la UI de forma dinámica sin recargar la página
    if (typeof window.refrescarConsolaOperaciones === 'function') {
        console.log("🔄 Invocando window.refrescarConsolaOperaciones()...");
        window.refrescarConsolaOperaciones();
    } else {
        renderizarConsolaOperaciones(rutaGuardada, 0, 0);
    }
    console.groupEnd();
};