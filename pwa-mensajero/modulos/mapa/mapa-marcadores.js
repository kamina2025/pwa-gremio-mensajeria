/**
 * PROTOCOLO MACONDO - GESTOR DE MARCADORES, INFOWINDOWS Y MENÚ RADIAL CYBERPUNK
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-marcadores.js
 */

import { crearIconoParadaCyberpunkSVG } from "./mapa-iconos.js";
import { IndexedStore } from "../db/indexed-store.js";

// Instancia de persistencia Local-First para operaciones de IndexedDB
const dbStore = new IndexedStore();

// Garantizar arreglos globales y estado overlay
window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];
window.overlayMenuActivo = null;

/**
 * Obtiene dinámicamente la URL base de la API backend PHP.
 * @returns {string} URL Endpoint de la API
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
 * Cierra de manera segura cualquier overlay activo de menú radial en pantalla.
 */
export function cerrarOverlayActivo() {
    if (window.overlayMenuActivo && typeof window.overlayMenuActivo.cerrar === "function") {
        window.overlayMenuActivo.cerrar();
    }
}

/**
 * Normaliza y añade contexto a las direcciones si no incluyen la ciudad base.
 * @param {string} direccion 
 * @returns {string}
 */
function sanitizarDireccionContexto(direccion) {
    if (!direccion) return "Cali, Colombia";
    const dirLower = direccion.toLowerCase();
    if (dirLower.includes("cali") || dirLower.includes("jamundi") || dirLower.includes("yumbo")) {
        return direccion;
    }
    return `${direccion}, Cali, Colombia`;
}

/**
 * Invoca el marcador telefónico nativo en dispositivos móviles.
 * @param {string} numeroTelefono 
 */
window.iniciarLlamadaAndroid = function(numeroTelefono) {
    if (!numeroTelefono || numeroTelefono.trim() === "" || numeroTelefono === "N/A") {
        alert("⚠️ No hay un número de teléfono válido para esta parada.");
        return;
    }
    const numeroLimpio = numeroTelefono.replace(/[^\d+]/g, '');
    window.location.href = `tel:${numeroLimpio}`;
};

/**
 * Fabrica dinámicamente la clase MenuRadialOverlay garantizando
 * que google.maps.OverlayView esté definido al momento de instanciar.
 * @returns {Function|null}
 */
function obtenerClaseMenuRadialOverlay() {
    if (window.MenuRadialOverlayClass) {
        return window.MenuRadialOverlayClass;
    }

    if (typeof google === "undefined" || !google.maps || !google.maps.OverlayView) {
        console.error("❌ [MAPA_MARCADORES]: google.maps.OverlayView no está disponible aún.");
        return null;
    }

    class MenuRadialOverlay extends google.maps.OverlayView {
        constructor(posicion, handlers = {}) {
            super();
            this.posicion = posicion;
            this.handlers = handlers; // { onEdit, onMove, onDelete, onReport }
            this.container = null;
            this.injectStyles();
        }

        injectStyles() {
            if (document.getElementById('cyberpunk-menu-styles')) return;
            const style = document.createElement('style');
            style.id = 'cyberpunk-menu-styles';
            style.textContent = `
                .cyberpunk-cross-menu {
                    position: absolute;
                    width: 150px;
                    height: 150px;
                    transform: translate(-50%, -50%);
                    pointer-events: auto;
                    z-index: 10000;
                    touch-action: manipulation;
                }
                .cyber-btn {
                    position: absolute;
                    width: 44px;
                    height: 44px;
                    background: #0d1117;
                    border: 2px solid #00e5ff;
                    color: #00e5ff;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Fira Code', monospace;
                    font-size: 13px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 0 10px #00e5ff, inset 0 0 4px #00e5ff;
                    transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: transparent;
                }
                .cyber-btn:active, .cyber-btn:hover {
                    background: #00e5ff;
                    color: #0d1117;
                    box-shadow: 0 0 18px #00e5ff;
                    transform: scale(1.15);
                }
                .cyber-btn.danger {
                    border-color: #ff3366;
                    color: #ff3366;
                    box-shadow: 0 0 10px #ff3366, inset 0 0 4px #ff3366;
                }
                .cyber-btn.danger:active, .cyber-btn.danger:hover {
                    background: #ff3366;
                    color: #0d1117;
                    box-shadow: 0 0 18px #ff3366;
                }
                .cyber-btn-norte { top: 0; left: 53px; }
                .cyber-btn-este  { top: 53px; right: 0; }
                .cyber-btn-sur   { bottom: 0; left: 53px; }
                .cyber-btn-oeste { top: 53px; left: 0; }
            `;
            document.head.appendChild(style);
        }

        onAdd() {
            this.container = document.createElement('div');
            this.container.className = 'cyberpunk-cross-menu';
            this.container.innerHTML = `
                <button type="button" class="cyber-btn cyber-btn-norte" title="Editar Parada" aria-label="Editar">N</button>
                <button type="button" class="cyber-btn cyber-btn-este" title="Mover Punto" aria-label="Mover">E</button>
                <button type="button" class="cyber-btn cyber-btn-sur danger" title="Eliminar Parada" aria-label="Eliminar">S</button>
                <button type="button" class="cyber-btn cyber-btn-oeste" title="Reportar Novedad" aria-label="Reportar">O</button>
            `;
            this.attachEvents();
            const panes = this.getPanes();
            if (panes && panes.floatPane) {
                panes.floatPane.appendChild(this.container);
            }
        }

        attachEvents() {
            if (!this.container) return;

            const bindAction = (selector, actionName, handler) => {
                const btn = this.container.querySelector(selector);
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`📢 [MENU_RADIAL]: Acción ${actionName} seleccionada`);
                        if (typeof handler === 'function') handler();
                        this.cerrar();
                    });
                }
            };

            bindAction('.cyber-btn-norte', 'NORTE (Editar)', this.handlers.onEdit);
            bindAction('.cyber-btn-este', 'ESTE (Mover)', this.handlers.onMove);
            bindAction('.cyber-btn-sur', 'SUR (Eliminar)', this.handlers.onDelete);
            bindAction('.cyber-btn-oeste', 'OESTE (Reportar)', this.handlers.onReport);
        }

        draw() {
            const projection = this.getProjection();
            if (!projection) return;
            const point = projection.fromLatLngToDivPixel(this.posicion);
            if (point && this.container) {
                this.container.style.left = `${point.x}px`;
                this.container.style.top = `${point.y}px`;
            }
        }

        cerrar() {
            this.setMap(null);
            if (window.overlayMenuActivo === this) {
                window.overlayMenuActivo = null;
            }
        }

        onRemove() {
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
                this.container = null;
            }
        }
    }

    window.MenuRadialOverlayClass = MenuRadialOverlay;
    return MenuRadialOverlay;
}

/**
 * Despliega la ventana modal de gestión de parada y evidencias (Acción Oeste - Reportar/Gestionar).
 * @param {Object} pedido 
 * @param {number} indice 
 */
export function abrirModalGestionParada(pedido, indice) {
    let modalExistente = document.getElementById("modal-gestion-parada-mapa");
    if (modalExistente) modalExistente.remove();

    const nombreCliente = pedido.destinatario || pedido.cliente || pedido.nombre_cliente || "Cliente";

    const modalHTML = `
        <div id="modal-gestion-parada-mapa" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 7, 15, 0.88); backdrop-filter: blur(6px); z-index: 99999; display: flex; align-items: center; justify-content: center; font-family: 'Fira Code', monospace;">
            <div style="background: #0d1117; border: 2px solid #00e5ff; box-shadow: 0 0 25px rgba(0,229,255,0.35); border-radius: 10px; width: 92%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 20px; color: #e6edf3;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-bottom: 15px;">
                    <h3 style="color: #00e5ff; margin: 0; font-size: 1.05rem; text-transform: uppercase;">⚡ [PARADA #${indice}] GESTIÓN & EVIDENCIAS</h3>
                    <button type="button" id="btn-cerrar-modal-gestion" style="background: transparent; border: none; color: #ff3366; font-size: 1.6rem; cursor: pointer; font-weight: bold; min-width: 44px; min-height: 44px;">&times;</button>
                </div>

                <form id="form-gestion-pin-mapa" style="display: flex; flex-direction: column; gap: 14px;">
                    <input type="hidden" name="id" value="${pedido.id || ''}">

                    <div>
                        <label style="color: #8af7b3; font-size: 0.8rem; display: block; margin-bottom: 4px;">DESTINATARIO:</label>
                        <input type="text" id="modal-destinatario" value="${nombreCliente}" style="width: 100%; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;" />
                    </div>

                    <div>
                        <label style="color: #8af7b3; font-size: 0.8rem; display: block; margin-bottom: 4px;">DIRECCIÓN:</label>
                        <input type="text" id="modal-direccion" value="${pedido.direccion || pedido.dir || ''}" style="width: 100%; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;" />
                    </div>

                    <div>
                        <label style="color: #8af7b3; font-size: 0.8rem; display: block; margin-bottom: 4px;">TELÉFONO:</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="modal-telefono" value="${pedido.telefono || pedido.tel || ''}" style="flex: 1; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;" />
                            <button type="button" onclick="window.iniciarLlamadaAndroid(document.getElementById('modal-telefono').value)" title="Llamar a cliente" style="background: #238636; border: 1px solid #2ea043; color: #fff; padding: 0 14px; min-height: 44px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                                📞
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style="color: #ffb300; font-size: 0.8rem; display: block; margin-bottom: 4px;">ESTADO DE LA PARADA:</label>
                        <select id="modal-estado" style="width: 100%; background: #161b22; border: 1px solid #ffb300; color: #fff; padding: 10px; border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;">
                            <option value="en-camino" ${(pedido.estado || '').toLowerCase() === 'en-camino' ? 'selected' : ''}>EN CAMINO</option>
                            <option value="entregado" ${(pedido.estado || '').toLowerCase() === 'entregado' ? 'selected' : ''}>ENTREGADO</option>
                            <option value="no-entregado" ${(pedido.estado || '').toLowerCase() === 'no-entregado' ? 'selected' : ''}>NO ENTREGADO</option>
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
    const cerrarModal = () => { if (modalElem) modalElem.remove(); };

    document.getElementById("btn-cerrar-modal-gestion")?.addEventListener("click", cerrarModal);
    document.getElementById("btn-cancelar-modal-gestion")?.addEventListener("click", cerrarModal);

    document.getElementById("form-gestion-pin-mapa").addEventListener("submit", async (e) => {
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
        pedido.updated_at = new Date().toISOString();

        try {
            if (typeof dbStore.actualizarParada === "function") {
                await dbStore.actualizarParada(pedido);
            } else if (typeof dbStore.guardarRegistro === "function") {
                await dbStore.guardarRegistro("paradas", pedido);
            }
            console.log("💾 [MAPA_MARCADORES]: Parada actualizada en IndexedDB desde Modal:", pedido);

            const idUnico = String(pedido.id || pedido.ssc || `#PNT-${indice}`).trim();
            mutarMarcadorPorId(idUnico, nuevoEstado);
            cerrarModal();

            // Sincronización Remota Saneada
            const baseUrl = obtenerEndpointAPI();
            const urlApi = `${baseUrl}?action=actualizar_parada`;
            
            const payload = {
                action: "actualizar_parada",
                accion: "actualizar_parada",
                id: pedido.id || idUnico,
                ssc: pedido.ssc || idUnico,
                estado: nuevoEstado,
                destinatario: nuevoDest,
                direccion: nuevaDir,
                telefono: nuevoTel,
                lat: pedido.lat,
                lng: pedido.lng,
                updated_at: pedido.updated_at
            };

            fetch(urlApi, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            }).then(async res => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok || data.error) {
                    console.warn("⚠️ [MAPA_MARCADORES_SYNC]: Respuesta con advertencia del servidor:", data);
                } else {
                    console.log("🌐 [MAPA_MARCADORES_SYNC]: Sincronizado exitosamente con API Backend:", data);
                }
            }).catch(err => console.warn("⚠️ [MAPA_MARCADORES_OFFLINE]: Sync diferido guardado en almacenamiento local.", err));

        } catch (err) {
            console.error("❌ [MAPA_MARCADORES]: Error guardando parada localmente:", err);
        }
    });
}

/**
 * Renderiza la colección de marcadores interactivos en el visor de Google Maps.
 * @param {Array<Object>} listaPedidos 
 * @param {number} indiceActivo 
 * @param {Function} callbackActualizacion 
 */
export function renderizarMarcadoresInteractivos(listaPedidos, indiceActivo, callbackActualizacion) {
    if (Array.isArray(window.marcadoresRutaMensajero)) {
        window.marcadoresRutaMensajero.forEach((m) => {
            if (typeof m.setMap === 'function') m.setMap(null);
        });
    }
    window.marcadoresRutaMensajero = [];

    if (!listaPedidos || listaPedidos.length === 0) return;

    const mapa = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) return;

    const bounds = new google.maps.LatLngBounds();
    const geocoder = new google.maps.Geocoder();

    listaPedidos.forEach((pedido, idx) => {
        let estadoCalculado = pedido.estado ? pedido.estado.toLowerCase() : 'asignado';

        if (idx === indiceActivo && estadoCalculado !== 'entregado' && estadoCalculado !== 'no-entregado') {
            estadoCalculado = 'en-camino';
        }

        const idUnicoParada = String(pedido.id || pedido.ssc || `#PNT-${idx + 1}`).trim();
        const nombreCliente = pedido.destinatario || pedido.cliente || pedido.nombre_cliente || "Cliente";

        const crearMarcadorEnPosicion = (latLngPos) => {
            bounds.extend(latLngPos);

            const iconoCyberpunk = crearIconoParadaCyberpunkSVG({
                estado: estadoCalculado,
                secuencia: idx + 1,
                causal: pedido.causal || ''
            });

            const marker = new google.maps.Marker({
                position: latLngPos,
                map: mapa,
                draggable: false,
                icon: iconoCyberpunk,
                title: `[STOP #${idx + 1}] ${nombreCliente}`
            });

            marker.set('idParada', idUnicoParada);
            marker.set('secuencia', idx + 1);

            const templateInfo = `
                <div style="background: #0d1117; color: #fff; padding: 10px; border: 1px solid #00e5ff; font-family: 'Fira Code', monospace; font-size: 0.78rem; border-radius: 6px; min-width: 180px;">
                    <div style="color: #00e5ff; font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #2d3748; padding-bottom: 2px;">
                        [STOP #${idx + 1}] ${nombreCliente}
                    </div>
                    <div><span style="color: #8af7b3;">📍 DIR:</span> ${pedido.direccion || pedido.dir || 'N/A'}</div>
                    <div><span style="color: #8af7b3;">📞 TEL:</span> ${pedido.telefono || pedido.tel || "N/A"}</div>
                    <div style="margin-top: 4px;">
                        <span style="color: #ffb300;">⚡ ESTADO:</span> 
                        <strong style="text-transform: uppercase;">${estadoCalculado}</strong>
                    </div>
                </div>`;

            marker.addListener("mouseover", () => {
                if (window.infoWindowMensajero) {
                    window.infoWindowMensajero.setContent(templateInfo);
                    window.infoWindowMensajero.open(mapa, marker);
                }
            });

            marker.addListener("mouseout", () => {
                if (window.infoWindowMensajero) window.infoWindowMensajero.close();
            });

            marker.addListener("click", () => {
                cerrarOverlayActivo();

                const MenuClass = obtenerClaseMenuRadialOverlay();
                if (!MenuClass) return;

                window.overlayMenuActivo = new MenuClass(marker.getPosition(), {
                    onEdit: () => window.cargarEdicionDesdePin(idUnicoParada),
                    onMove: () => activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion),
                    onDelete: () => eliminarParadaProceso(marker, idUnicoParada, callbackActualizacion),
                    onReport: () => abrirModalGestionParada(pedido, idx + 1)
                });

                window.overlayMenuActivo.setMap(mapa);
            });

            window.marcadoresRutaMensajero.push(marker);
            mapa.fitBounds(bounds);
        };

        if (pedido.lat && pedido.lng) {
            const pos = new google.maps.LatLng(parseFloat(pedido.lat), parseFloat(pedido.lng));
            crearMarcadorEnPosicion(pos);
        } else {
            const dirCompleta = sanitizarDireccionContexto(pedido.direccion || pedido.dir);
            geocoder.geocode({ address: dirCompleta }, (results, status) => {
                if (status === "OK" && results[0]) {
                    crearMarcadorEnPosicion(results[0].geometry.location);
                }
            });
        }
    });
}

/**
 * Habilita el arrastre del pin en el lienzo para reubicación (Acción Este - Mover).
 */
function activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion) {
    marker.setDraggable(true);
    const idParada = marker.get('idParada');
    console.log("📍 [MAPA_MARCADORES]: Arrastre activado para parada ID:", idParada);

    const listener = marker.addListener('dragend', async (event) => {
        const nuevaLat = event.latLng.lat();
        const nuevaLng = event.latLng.lng();

        pedido.lat = nuevaLat;
        pedido.lng = nuevaLng;
        pedido.updated_at = new Date().toISOString();

        geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, async (results, status) => {
            if (status === "OK" && results[0]) {
                pedido.direccion = results[0].formatted_address;
                pedido.dir = results[0].formatted_address;
            }

            try {
                if (typeof dbStore.actualizarParada === "function") {
                    await dbStore.actualizarParada(pedido);
                } else if (typeof dbStore.guardarRegistro === "function") {
                    await dbStore.guardarRegistro("paradas", pedido);
                }
                console.log("💾 [MAPA_MARCADORES]: Parada reubicada y guardada en IndexedDB:", pedido);
            } catch (err) {
                console.error("❌ [MAPA_MARCADORES]: Error al guardar reubicación en IndexedDB:", err);
            }

            // Sincronización Remota Saneada
            const baseUrl = obtenerEndpointAPI();
            const urlApi = `${baseUrl}?action=actualizar_parada`;

            const payload = {
                action: "actualizar_parada",
                accion: "actualizar_parada",
                id: pedido.id || idParada,
                ssc: pedido.ssc || idParada,
                lat: nuevaLat,
                lng: nuevaLng,
                direccion: pedido.direccion,
                updated_at: pedido.updated_at
            };

            fetch(urlApi, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            }).then(async res => {
                const data = await res.json().catch(() => ({}));
                console.log("🌐 [MAPA_MARCADORES_MOVE_SYNC]: Coordenadas sincronizadas con servidor:", data);
            }).catch(err => console.warn("⚠️ [MAPA_MARCADORES_OFFLINE]: Sync diferido a backend PHP:", err));

            if (typeof callbackActualizacion === "function") {
                callbackActualizacion(pedido);
            }
        });

        marker.setDraggable(false);
        google.maps.event.removeListener(listener);
    });
}

/**
 * Elimina la parada local y remotamente (Acción Sur - Eliminar).
 */
async function eliminarParadaProceso(marker, idParada, callbackActualizacion) {
    if (!confirm(`¿Eliminar la parada ${idParada} del mapa y registro local?`)) return;

    try {
        if (typeof dbStore.eliminarParada === "function") {
            await dbStore.eliminarParada(idParada);
        } else if (typeof dbStore.eliminarRegistro === "function") {
            await dbStore.eliminarRegistro("paradas", idParada);
        }
        console.log("💾 [MAPA_MARCADORES]: Parada eliminada de IndexedDB:", idParada);

        marker.setMap(null);
        window.marcadoresRutaMensajero = window.marcadoresRutaMensajero.filter(m => m !== marker);

        // Actualizar variables de estado RAM globales
        if (Array.isArray(window.__CACHE_PARADAS_MACONDO__)) {
            window.__CACHE_PARADAS_MACONDO__ = window.__CACHE_PARADAS_MACONDO__.filter(p => String(p.id || p.ssc) !== String(idParada));
        }

        const baseUrl = obtenerEndpointAPI();
        const urlApi = `${baseUrl}?action=eliminar_parada`;

        const payload = {
            action: "eliminar_parada",
            accion: "eliminar_parada",
            id: idParada
        };

        fetch(urlApi, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        }).then(async res => {
            const data = await res.json().catch(() => ({}));
            console.log("🌐 [MAPA_MARCADORES_DEL_SYNC]: Parada eliminada del servidor remoto:", data);
        }).catch(err => console.warn("⚠️ [MAPA_MARCADORES_OFFLINE]: Error eliminando en backend PHP (Offline):", err));

        if (typeof callbackActualizacion === "function") {
            callbackActualizacion();
        }
    } catch (err) {
        console.error("❌ [MAPA_MARCADORES]: Fallo al eliminar parada:", err);
    }
}

/**
 * Muta el icono de un marcador según su nuevo estado en tiempo real.
 * @param {string} idParada 
 * @param {string} nuevoEstado 
 * @param {string} [causal=''] 
 */
export function mutarMarcadorPorId(idParada, nuevoEstado, causal = '') {
    if (!window.marcadoresRutaMensajero) return;

    const marker = window.marcadoresRutaMensajero.find(m => String(m.get('idParada')).trim() === String(idParada).trim());

    if (marker) {
        const sec = marker.get('secuencia') || 1;
        const nuevoIcono = crearIconoParadaCyberpunkSVG({
            estado: nuevoEstado,
            secuencia: sec,
            causal: causal
        });

        marker.setIcon(nuevoIcono);
        console.log(`⚡ [MAPA_MARCADORES]: Icono del marcador #${idParada} mutado a estado: ${nuevoEstado}`);
    }
}

// BINDING GLOBAL PARA ACCIÓN NORTE (EDITAR)
window.cargarEdicionDesdePin = function(idParada) {
    console.log("🎯 [MAPA_MARCADORES]: Redirigiendo a edición para parada:", idParada);
    if (typeof window.navegarA === "function") {
        window.navegarA("vistas/ruta/ruta-activa.html");
    } else {
        const pestanaRuta = document.getElementById("pestana-ruta-activa");
        if (pestanaRuta) {
            document.querySelectorAll(".contenedor-pestana").forEach((p) => p.classList.remove("activa"));
            document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));
            pestanaRuta.classList.add("activa");
        }
    }

    setTimeout(() => {
        if (typeof window.prepararEdicionParadaUI === "function") {
            window.prepararEdicionParadaUI(idParada);
        }
    }, 120);
};

// BINDINGS GLOBALES EN WINDOW
if (typeof window !== "undefined") {
    window.renderizarMarcadoresInteractivos = renderizarMarcadoresInteractivos;
    window.mutarMarcadorPorId = mutarMarcadorPorId;
    window.abrirModalGestionParada = abrirModalGestionParada;
    window.cerrarOverlayActivo = cerrarOverlayActivo;
}