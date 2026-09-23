/**
 * Módulo de Renderizado de Tarjeta Activa y Flujo Operativo
 * Ubicación: pwa-mensajero/modulos/ui/ui-tarjeta-activa.js
 */

/**
 * Renderiza la tarjeta principal activa en foco dentro de la consola
 * @param {HTMLElement} contenedorActivo - Elemento DOM del contenedor
 * @param {Object} pedido - Objeto con los datos de la parada activa
 * @param {number} indiceActivo - Índice de la parada activa
 * @param {number} llamadasRealizadas - Número de llamadas efectuadas
 */
export function renderizarTarjetaActivaUI(contenedorActivo, pedido, indiceActivo, llamadasRealizadas = 0) {
    if (!contenedorActivo) return;

    if (!pedido) {
        contenedorActivo.innerHTML = `<div class="panel-maquina" style="text-align:center; color:var(--text-muted, #aaa);">[SIN_RUTA] No hay tirillas médicas cargadas. Escanee un documento o pegue un manifiesto.</div>`;
        return;
    }

    console.log(`🖥️ [UI_TARJETA]: Renderizando tarjeta activa para SSC: ${pedido.ssc || "N/A"}`);

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

/**
 * Genera el HTML de la botonera de flujo según el estado del pedido
 */
export function obtenerBotonesFlujoHTML(pedido, llamadasRealizadas) {
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