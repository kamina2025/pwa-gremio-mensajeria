/**
 * PROTOCOLO MACONDO - MODAL TÁCTICO DE GESTIÓN DE PARADA Y EVIDENCIAS
 * Ubicación: pwa-mensajero/modulos/mapa/marcadores/mapa-modal-parada.js
 * Arquitectura: Modal Overlay / Local-First / Sync API PHP & GitHub Pages Compatible
 */

import { IndexedStore } from "../../db/indexed-store.js";
import { guardarRutaZonificada } from "../../mensajero-persistencia.js";

const dbStore = new IndexedStore();
const KEY_COLA_OFFLINE = 'macondo_cola_offline_pwa';

/**
 * Detecta si el entorno actual soporta API REST backend en PHP o es un hosting estático (GitHub Pages).
 * @returns {boolean}
 */
function esEntornoEstatico() {
    if (typeof window === "undefined") return false;
    return window.location.hostname.includes("github.io");
}

/**
 * Registra defensivamente operaciones pendientes en la cola offline (IndexedDB o localStorage fallback).
 * @param {string} accion 
 * @param {Object} payload 
 */
async function registrarOperacionPendienteDefensivo(accion, payload) {
    try {
        if (typeof dbStore.registrarOperacionPendiente === "function") {
            await dbStore.registrarOperacionPendiente(accion, payload);
            console.log(`💾 [OFFLINE_QUEUE]: Operación '${accion}' guardada en IndexedDB.`);
        } else {
            const colaExistente = JSON.parse(localStorage.getItem(KEY_COLA_OFFLINE) || "[]");
            colaExistente.push({ accion, payload, timestamp: new Date().toISOString() });
            localStorage.setItem(KEY_COLA_OFFLINE, JSON.stringify(colaExistente));
            console.log(`💾 [OFFLINE_QUEUE_FALLBACK]: Operación '${accion}' guardada en localStorage.`);
        }
    } catch (err) {
        console.warn("⚠️ [OFFLINE_QUEUE]: No se pudo guardar la operación en la cola offline:", err);
    }
}

/**
 * Obtiene la URL base válida para la API REST local o remota.
 * @returns {string}
 */
function obtenerEndpointAPI() {
    if (typeof window !== "undefined" && window.API_ENDPOINT) {
        return window.API_ENDPOINT;
    }
    const origin = window.location.origin;
    if (window.location.pathname.includes("/pwa-gremio-mensajeria/")) {
        return `${origin}/pwa-gremio-mensajeria/api.php`;
    }
    return `${origin}/api.php`;
}

/**
 * Sincroniza las modificaciones de una parada dentro de todas las colecciones de memoria RAM activa.
 * @param {Object} paradaActualizada 
 * @param {string} targetId 
 */
function sincronizarBuffersRAM(paradaActualizada, targetId) {
    const actualizarLista = (buffer) => {
        if (!Array.isArray(buffer)) return;
        const idx = buffer.findIndex(p => p && String(p.id || p.ssc || "").replace(/^[#PNT-]+/i, '').trim() === String(targetId).replace(/^[#PNT-]+/i, '').trim());
        if (idx !== -1) {
            buffer[idx] = { ...buffer[idx], ...paradaActualizada };
        }
    };

    actualizarLista(window.__CACHE_PARADAS_MACONDO__);
    actualizarLista(window.paradasMemoriaLocal);
    actualizarLista(window.paradasRutaActiva);
    actualizarLista(window.pedidosGlobales);
}

export function abrirModalGestionParada(pedido, indice, mutarMarcadorCallback) {
    let modalExistente = document.getElementById("modal-gestion-parada-mapa");
    if (modalExistente) modalExistente.remove();

    const nombreCliente = pedido.destinatario || pedido.cliente || pedido.nombre_cliente || "Cliente";
    const estadoActual = (pedido.estado || pedido.status || "asignado").toLowerCase();

    const modalHTML = `
        <div id="modal-gestion-parada-mapa" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 7, 15, 0.88); backdrop-filter: blur(6px); z-index: 99999; display: flex; align-items: center; justify-content: center; font-family: 'Fira Code', monospace;">
            <div style="background: #0d1117; border: 2px solid #00e5ff; box-shadow: 0 0 25px rgba(0,229,255,0.35); border-radius: 10px; width: 92%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 20px; color: #e6edf3;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-bottom: 15px;">
                    <h3 style="color: #00e5ff; margin: 0; font-size: 1.05rem; text-transform: uppercase;">⚡ [PARADA #${indice}] GESTIÓN & EVIDENCIAS</h3>
                    <button type="button" id="btn-cerrar-modal-gestion" style="background: transparent; border: none; color: #ff3366; font-size: 1.6rem; cursor: pointer; font-weight: bold; min-width: 44px; min-height: 44px;">&times;</button>
                </div>

                <form id="form-gestion-pin-mapa" style="display: flex; flex-direction: column; gap: 14px;">
                    <input type="hidden" name="id" value="${pedido.id || ""}">

                    <div>
                        <label style="color: #8af7b3; font-size: 0.8rem; display: block; margin-bottom: 4px;">DESTINATARIO:</label>
                        <input type="text" id="modal-destinatario" value="${nombreCliente}" style="width: 100%; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;" />
                    </div>

                    <div>
                        <label style="color: #8af7b3; font-size: 0.8rem; display: block; margin-bottom: 4px;">DIRECCIÓN:</label>
                        <input type="text" id="modal-direccion" value="${pedido.direccion || pedido.dir || ""}" style="width: 100%; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;" />
                    </div>

                    <div>
                        <label style="color: #8af7b3; font-size: 0.8rem; display: block; margin-bottom: 4px;">TELÉFONO:</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="modal-telefono" value="${pedido.telefono || pedido.tel || ""}" style="flex: 1; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;" />
                            <button type="button" onclick="window.iniciarLlamadaAndroid(document.getElementById('modal-telefono').value)" title="Llamar a cliente" style="background: #238636; border: 1px solid #2ea043; color: #fff; padding: 0 14px; min-height: 44px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                                📞
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style="color: #ffb300; font-size: 0.8rem; display: block; margin-bottom: 4px;">ESTADO DE LA PARADA:</label>
                        <select id="modal-estado" style="width: 100%; background: #161b22; border: 1px solid #ffb300; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;">
                            <option value="en-camino" ${estadoActual === "en-camino" ? "selected" : ""}>EN CAMINO</option>
                            <option value="entregado" ${estadoActual === "entregado" ? "selected" : ""}>ENTREGADO</option>
                            <option value="no-entregado" ${estadoActual === "no-entregado" ? "selected" : ""}>NO ENTREGADO</option>
                        </select>
                    </div>

                    <fieldset style="border: 1px dashed #00e5ff; border-radius: 6px; padding: 12px; margin-top: 5px;">
                        <legend style="color: #00e5ff; font-size: 0.8rem; padding: 0 6px;">📸 CARGA DE EVIDENCIAS</legend>
                        <div style="margin-bottom: 10px;">
                            <label style="font-size: 0.75rem; color: #d2a8ff; display: block;">📞 Registro / Evidencia de Llamada:</label>
                            <input type="file" id="evidencia-llamada" accept="image/*,audio/*,.pdf" style="font-size: 0.78rem; color: #8b949e; margin-top: 4px;" />
                        </div>
                        <div style="margin-bottom: 10px;">
                            <label style="font-size: 0.75rem; color: #d2a8ff; display: block;">🏠 Foto de Fachada:</label>
                            <input type="file" id="evidencia-fachada" accept="image/*" capture="environment" style="font-size: 0.78rem; color: #8b949e; margin-top: 4px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; color: #d2a8ff; display: block;">🧾 Foto de Tirilla / Comprobante:</label>
                            <input type="file" id="evidencia-tirilla" accept="image/*" capture="environment" style="font-size: 0.78rem; color: #8b949e; margin-top: 4px;" />
                        </div>
                    </fieldset>

                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button type="button" id="btn-cancelar-modal-gestion" style="flex: 1; background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; min-height: 44px;">CANCELAR</button>
                        <button type="submit" style="flex: 1; background: #00e5ff; border: none; color: #05070f; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; min-height: 44px;">GUARDAR CAMBIOS</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const modalElem = document.getElementById("modal-gestion-parada-mapa");
    const cerrarModal = () => {
        if (modalElem) modalElem.remove();
    };

    document.getElementById("btn-cerrar-modal-gestion")?.addEventListener("click", cerrarModal);
    document.getElementById("btn-cancelar-modal-gestion")?.addEventListener("click", cerrarModal);

    document.getElementById("form-gestion-pin-mapa")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nuevoEstado = document.getElementById("modal-estado").value;
        const nuevoDest = document.getElementById("modal-destinatario").value;
        const nuevaDir = document.getElementById("modal-direccion").value;
        const nuevoTel = document.getElementById("modal-telefono").value;

        pedido.destinatario = nuevoDest;
        pedido.cliente = nuevoDest;
        pedido.direccion = nuevaDir;
        pedido.dir = nuevaDir;
        pedido.telefono = nuevoTel;
        pedido.tel = nuevoTel;
        pedido.estado = nuevoEstado;
        pedido.status = nuevoEstado; // Asignación dual para filtros de UI
        pedido.updated_at = new Date().toISOString();

        const idUnico = String(pedido.id || pedido.ssc || `#PNT-${indice}`).trim();

        try {
            // 1. Actualizar registros individuales en IndexedDB
            if (typeof dbStore.actualizarParada === "function") {
                await dbStore.actualizarParada(pedido, "paradas_rutas");
            } else if (typeof dbStore.guardarRegistro === "function") {
                await dbStore.guardarRegistro("paradas", pedido);
            }

            if (pedido.planilla_id && typeof dbStore.actualizarParadaEnPlanilla === "function") {
                await dbStore.actualizarParadaEnPlanilla(pedido.planilla_id, idUnico, {
                    destinatario: nuevoDest,
                    direccion: nuevaDir,
                    telefono: nuevoTel,
                    estado: nuevoEstado,
                    status: nuevoEstado
                });
            }

            // 2. Sincronizar memorias RAM globales
            sincronizarBuffersRAM(pedido, idUnico);

            // 3. Sobrescribir Snapshot contenedora en IndexedDB para asegurar persistencia tras F5
            const datasetMemoria = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
            if (datasetMemoria.length > 0 && typeof guardarRutaZonificada === "function") {
                await guardarRutaZonificada(datasetMemoria);
            }

            console.log("💾 [MAPA_MODAL]: Parada e IndexedDB Snapshot actualizadas desde Modal:", pedido);

            // 4. Mutar marcador en capa gráfica de Google Maps
            if (typeof mutarMarcadorCallback === "function") {
                mutarMarcadorCallback(idUnico, nuevoEstado);
            } else if (typeof window.mutarMarcadorPorId === "function") {
                window.mutarMarcadorPorId(idUnico, nuevoEstado);
            }

            cerrarModal();

            // 5. Refrescar Consola de Operaciones de forma reactiva
            if (typeof window.refrescarConsolaOperacionesUI === "function") {
                await window.refrescarConsolaOperacionesUI(datasetMemoria);
            }

            // 6. Sincronización Backend REST o Cola Offline
            const payload = {
                action: "actualizar_parada",
                id: pedido.id || idUnico,
                ssc: pedido.ssc || idUnico,
                planilla_id: pedido.planilla_id || null,
                estado: nuevoEstado,
                status: nuevoEstado,
                destinatario: nuevoDest,
                direccion: nuevaDir,
                telefono: nuevoTel,
                lat: pedido.lat,
                lng: pedido.lng,
                updated_at: pedido.updated_at
            };

            if (esEntornoEstatico()) {
                console.log("ℹ️ [MAPA_MODAL_GITPAGES]: Entorno estático detectado. Cambio de estado registrado en cola local.");
                await registrarOperacionPendienteDefensivo("actualizar_parada", payload);
            } else {
                const baseUrl = obtenerEndpointAPI();
                const urlApi = `${baseUrl}?action=actualizar_parada`;

                fetch(urlApi, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(payload)
                })
                    .then(async (res) => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const data = await res.json().catch(() => ({}));
                        console.log("🌐 [MAPA_MODAL_SYNC]: Sincronizado remotamente con el servidor:", data);
                    })
                    .catch(async (err) => {
                        console.warn("⚠️ [MAPA_MODAL_OFFLINE]: Sync guardado en cola offline:", err);
                        await registrarOperacionPendienteDefensivo("actualizar_parada", payload);
                    });
            }
        } catch (err) {
            console.error("❌ [MAPA_MODAL]: Error al guardar parada desde modal:", err);
        }
    });
}

if (typeof window !== "undefined") {
    window.abrirModalGestionParada = abrirModalGestionParada;
}