/**
 * PROTOCOLO MACONDO - SUBSISTEMA RENDERIZADOR DE INTERFAZ OPERACIONAL (TIRILLAS)
 * Ubicación: pwa-mensajero/modulos/mensajero-ui.js
 */

import { actualizarPuntosEnMapa } from "./mapa-mensajero-visor.js";

/**
 * Renderiza la consola de operaciones táctica desplegando los 6 campos clave de la tirilla.
 * 
 * @param {Array<Object>} listaPedidos - Lista de paradas/tirillas cargadas.
 * @param {number} indiceActivo - Índice de la tirilla activa en foco.
 * @param {number} llamadasRealizadas - Contador de intentos de llamada al cliente.
 */
export function renderizarConsolaOperaciones(listaPedidos, indiceActivo, llamadasRealizadas) {
    const contenedor = document.getElementById("contenedor-tarjeta-activa");
    const contenedorLista = document.getElementById("lista-paradas-zonificadas");
    const txtTotal = document.getElementById("txt-total-paradas");

    if (txtTotal) txtTotal.innerText = `${listaPedidos.length} PARADAS`;

    actualizarPuntosEnMapa(listaPedidos, indiceActivo);

    if (!listaPedidos || listaPedidos.length === 0) {
        if (contenedor) {
            contenedor.innerHTML = `<div class="panel-maquina" style="text-align:center; color:var(--text-muted, #aaa);">[SIN_RUTA] No hay tirillas médicas cargadas. Escanee un documento o pegue un manifiesto.</div>`;
        }
        if (contenedorLista) contenedorLista.innerHTML = "";
        return;
    }

    const pedido = listaPedidos[indiceActivo] || listaPedidos[0];

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

    if (contenedorLista) {
        contenedorLista.innerHTML = "";
        listaPedidos.forEach((p, idx) => {
            const item = document.createElement("div");
            item.className = `item-parada-lista ${idx === indiceActivo ? 'activa' : ''} ${p.estado ? p.estado.toLowerCase() : 'asignado'}`;
            item.style.cssText = `background:#0c080f; border:1px solid ${idx === indiceActivo ? 'var(--neon-blue, #00e5ff)' : '#291f33'}; padding:6px 8px; margin-bottom:4px; font-size:0.75rem; display:flex; justify-content:space-between; align-items:center;`;
            item.innerHTML = `
                <div>
                    <div><strong>[${String.fromCharCode(65 + idx)}]</strong> ${p.destinatario || "Cliente"} - ${p.direccion}</div>
                    <div style="color:#888; font-size:0.7rem;">SSC: ${p.ssc || 'N/A'} | Cuota: <span style="color:var(--neon-amber, #ffaa00);">${p.cuotaModeradora || '$0'}</span></div>
                </div>
                <span style="color:var(--neon-amber, #ffaa00); font-weight:bold;">${p.estado || "ASIGNADO"}</span>
            `;
            contenedorLista.appendChild(item);
        });
    }
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