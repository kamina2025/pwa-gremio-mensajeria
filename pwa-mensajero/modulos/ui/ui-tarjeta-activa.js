/**
 * Módulo de Renderizado de Tarjeta Activa y Flujo Operativo
 * Ubicación: pwa-mensajero/modulos/ui/ui-tarjeta-activa.js
 */

/**
 * Renderiza la tarjeta principal activa en foco dentro de la consola operativa.
 * @param {HTMLElement} contenedorActivo - Elemento DOM contenedor
 * @param {Object} pedido - Objeto con datos de la parada activa
 * @param {number} indiceActivo - Índice numérico de la parada
 * @param {number} [llamadasRealizadas=0] - Contador de intentos de contacto
 */
export function renderizarTarjetaActivaUI(contenedorActivo, pedido, indiceActivo, llamadasRealizadas = 0) {
    if (!contenedorActivo) return;

    if (!pedido) {
        contenedorActivo.innerHTML = `
            <div class="panel-maquina" style="text-align:center; padding: 16px; color: var(--text-muted, #aaa);">
                [SIN_RUTA_ACTIVA] No hay tirillas cargadas. Escanee un documento o cargue un manifiesto.
            </div>`;
        return;
    }

    console.log(`🖥️ [UI_TARJETA]: Renderizando tarjeta activa SSC: ${pedido.ssc || "N/A"}`);

    const estadoUpper = String(pedido.estado || 'ASIGNADO').toUpperCase();

    contenedorActivo.innerHTML = `
        <div class="card-pedido-activa state-${estadoUpper.toLowerCase()}" style="background: #0f0914; border: 1px solid var(--neon-cyan, #00e5ff); padding: 12px; border-radius: 6px; box-shadow: 0 0 12px rgba(0, 229, 255, 0.2);">
            <div class="card-header-flujo" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #291f33; padding-bottom:6px; margin-bottom:8px;">
                <span class="badge-parada" style="background:var(--neon-cyan, #00e5ff); color:#000; font-weight:bold; padding:2px 8px; font-size:0.75rem; border-radius:3px;">
                    PARADA #${pedido.secuencia || (indiceActivo + 1)} | SSC: ${pedido.ssc || "N/A"}
                </span>
                <span class="badge-estado" style="color:var(--neon-green, #00ff66); font-weight:bold; font-size:0.8rem;">
                    ${estadoUpper}
                </span>
            </div>

            <div class="card-body-flujo" style="font-size:0.85rem; line-height:1.4;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
                    <h2 style="margin:0; color:#fff; font-size:1.05rem;">${pedido.destinatario || pedido.cliente || "Cliente Tirilla"}</h2>
                    <span style="background:rgba(255,179,0,0.15); color:var(--neon-yellow, #ffaa00); border:1px solid var(--neon-yellow, #ffaa00); padding:2px 6px; border-radius:3px; font-weight:bold; font-size:0.75rem;">
                        💵 CUOTA: ${pedido.cuotaModeradora || "$0"}
                    </span>
                </div>

                <p style="margin:4px 0; color:#ddd;"><strong>📍 Dirección:</strong> ${pedido.direccion || "Dirección no especificada"}</p>
                <p style="margin:2px 0; color:#aaa;"><strong>📞 Teléfono:</strong> ${pedido.telefono || "3000000000"}</p>
                <p style="margin:2px 0; color:#aaa;"><strong>🏥 Origen:</strong> ${pedido.puntoOrigen || "Cafam Tequendama"}</p>
                <p style="margin:2px 0; color:#888; font-size:0.75rem;"><strong>📦 Carga:</strong> ${pedido.carga || "Dispensación Medicamentos"}</p>
            </div>

            <div class="card-acciones-flujo" style="margin-top:12px;">
                ${obtenerBotonesFlujoHTML(pedido, llamadasRealizadas)}
            </div>
        </div>
    `;
}

/**
 * Genera el HTML de la botonera operativa según el estado actual del pedido.
 * @param {Object} pedido 
 * @param {number} llamadasRealizadas 
 * @returns {string} HTML markup
 */
export function obtenerBotonesFlujoHTML(pedido, llamadasRealizadas) {
    const estado = String(pedido.estado || 'ASIGNADO').toUpperCase();
    const idPedido = pedido.id || pedido.ssc;

    if (estado === "ASIGNADO") {
        return `
            <button class="btn-terminal" style="border-color: var(--neon-cyan, #00e5ff); color: var(--neon-cyan, #00e5ff); width:100%; font-weight:bold; min-height:44px;" onclick="ejecutarPasoAceptarPedido('${idPedido}')">
                [1] ACEPTAR Y EN CAMINO ➔
            </button>`;
    }

    if (estado === "EN_CAMINO") {
        return `
            <button class="btn-terminal" style="border-color: var(--amber-alert, #ffaa00); color: var(--amber-alert, #ffaa00); width:100%; font-weight:bold; min-height:44px;" onclick="ejecutarPasoNotificarLlegada('${idPedido}')">
                [2] REGISTRAR LLEGADA AL PUNTO 📍
            </button>`;
    }

    if (estado === "LLEGADO" || estado === "EN_PUNTO") {
        return `
            <div class="bloque-llegado-acciones">
                <a href="tel:${pedido.telefono || ''}" class="btn-terminal" style="border-color: var(--neon-green, #00ff66); color: var(--neon-green, #00ff66); display:block; text-align:center; text-decoration:none; margin-bottom:6px; font-weight:bold; padding:10px;" onclick="if(typeof registrarIntentoLlamada==='function') registrarIntentoLlamada('${idPedido}')">
                    [📞] LLAMAR AL CLIENTE (${llamadasRealizadas} Intentos)
                </a>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <button class="btn-terminal" style="border-color: var(--neon-magenta, #ff3366); color: var(--neon-magenta, #ff3366); min-height:44px;" onclick="if(typeof abrirModalNovedad==='function') abrirModalNovedad('${idPedido}')">
                        [⚠️] NOVEDAD
                    </button>
                    <button class="btn-terminal" style="border-color: var(--neon-green, #00ff66); background: var(--neon-green, #00ff66); color:#000; font-weight:bold; min-height:44px;" onclick="ejecutarPasoFinalizarPedido('${idPedido}')">
                        [3] FINALIZAR ✅
                    </button>
                </div>
            </div>`;
    }

    return `<div style="color:var(--neon-green, #00ff66); text-align:center; font-weight:bold; padding:8px; border:1px stroke var(--neon-green);">✅ ENTREGADO / COMPLETADO</div>`;
}

// Bindings globales
if (typeof window !== "undefined") {
    window.renderizarTarjetaActivaUI = renderizarTarjetaActivaUI;
    window.obtenerBotonesFlujoHTML = obtenerBotonesFlujoHTML;
}