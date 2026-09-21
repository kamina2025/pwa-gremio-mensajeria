/**
 * PROTOCOLO MACONDO - GESTOR DE MARCADORES, INFOWINDOWS Y MENÚ RADIAL CYBERPUNK
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-marcadores.js
 */

import { crearIconoParadaCyberpunkSVG } from "./mapa-iconos.js";
import { IndexedStore } from "../db/indexed-store.js";

window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];
window.overlayMenuActivo = null;

const dbStore = new IndexedStore();

/**
 * Normaliza y añade contexto a las direcciones si no vienen con ciudad
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
 * Invoca el marcador de llamadas nativo
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
 * Overlay personalizado para menú radial en cruz (Estética Cyberpunk)
 */
export class MenuRadialOverlay extends google.maps.OverlayView {
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
                width: 140px;
                height: 140px;
                transform: translate(-50%, -50%);
                pointer-events: auto;
                z-index: 1000;
            }
            .cyber-btn {
                position: absolute;
                width: 38px;
                height: 38px;
                background: #0d1117;
                border: 2px solid #00e5ff;
                color: #00e5ff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Fira Code', monospace;
                font-size: 11px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 0 8px #00e5ff, inset 0 0 4px #00e5ff;
                transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
            }
            .cyber-btn:hover {
                background: #00e5ff;
                color: #0d1117;
                box-shadow: 0 0 15px #00e5ff;
                transform: scale(1.15);
            }
            .cyber-btn.danger {
                border-color: #ff3366;
                color: #ff3366;
                box-shadow: 0 0 8px #ff3366, inset 0 0 4px #ff3366;
            }
            .cyber-btn.danger:hover {
                background: #ff3366;
                color: #0d1117;
                box-shadow: 0 0 15px #ff3366;
            }
            .cyber-btn-norte { top: 0; left: 51px; }
            .cyber-btn-este  { top: 51px; right: 0; }
            .cyber-btn-sur   { bottom: 0; left: 51px; }
            .cyber-btn-oeste { top: 51px; left: 0; }
        `;
        document.head.appendChild(style);
    }

    onAdd() {
        this.container = document.createElement('div');
        this.container.className = 'cyberpunk-cross-menu';
        this.container.innerHTML = `
            <button class="cyber-btn cyber-btn-norte" title="Editar Parada">N</button>
            <button class="cyber-btn cyber-btn-este" title="Mover Punto">E</button>
            <button class="cyber-btn cyber-btn-sur danger" title="Eliminar Parada">S</button>
            <button class="cyber-btn cyber-btn-oeste" title="Reportar Novedad">O</button>
        `;
        this.attachEvents();
        const panes = this.getPanes();
        panes.floatPane.appendChild(this.container);
    }

    attachEvents() {
        this.container.querySelector('.cyber-btn-norte').onclick = (e) => {
            e.stopPropagation();
            console.log("[MENU_RADIAL]: Acción NORTE - Editar");
            if (this.handlers.onEdit) this.handlers.onEdit();
            this.cerrar();
        };
        this.container.querySelector('.cyber-btn-este').onclick = (e) => {
            e.stopPropagation();
            console.log("[MENU_RADIAL]: Acción ESTE - Mover");
            if (this.handlers.onMove) this.handlers.onMove();
            this.cerrar();
        };
        this.container.querySelector('.cyber-btn-sur').onclick = (e) => {
            e.stopPropagation();
            console.log("[MENU_RADIAL]: Acción SUR - Eliminar");
            if (this.handlers.onDelete) this.handlers.onDelete();
            this.cerrar();
        };
        this.container.querySelector('.cyber-btn-oeste').onclick = (e) => {
            e.stopPropagation();
            console.log("[MENU_RADIAL]: Acción OESTE - Reportar");
            if (this.handlers.onReport) this.handlers.onReport();
            this.cerrar();
        };
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

/**
 * Despliega el modal flotante de gestión/evidencias (Oeste)
 */
export function abrirModalGestionParada(pedido, indice) {
    let modalExistente = document.getElementById("modal-gestion-parada-mapa");
    if (modalExistente) modalExistente.remove();

    const modalHTML = `
        <div id="modal-gestion-parada-mapa" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 7, 15, 0.85); backdrop-filter: blur(5px); z-index: 99999; display: flex; align-items: center; justify-content: center; font-family: 'Fira Code', monospace;">
            <div style="background: #0d1117; border: 2px solid #00e5ff; box-shadow: 0 0 20px rgba(0,229,255,0.3); border-radius: 8px; width: 90%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 20px; color: #e6edf3;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-bottom: 15px;">
                    <h3 style="color: #00e5ff; margin: 0; font-size: 1.1rem; text-transform: uppercase;">⚡ [PARADA #${indice}] GESTIÓN & EVIDENCIAS</h3>
                    <button type="button" onclick="document.getElementById('modal-gestion-parada-mapa').remove()" style="background: transparent; border: none; color: #ff3366; font-size: 1.5rem; cursor: pointer; font-weight: bold;">&times;</button>
                </div>

                <form id="form-gestion-pin-mapa" style="display: flex; flex-direction: column; gap: 12px;">
                    <input type="hidden" name="id" value="${pedido.id || ''}">

                    <div>
                        <label style="color: #8af7b3; font-size: 0.8rem; display: block; margin-bottom: 3px;">DESTINATARIO:</label>
                        <input type="text" id="modal-destinatario" value="${pedido.destinatario || ''}" style="width: 100%; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 8px; border-radius: 4px; font-size: 0.85rem;" />
                    </div>

                    <div>
                        <label style="color: #8af7b3; font-size: 0.8rem; display: block; margin-bottom: 3px;">DIRECCIÓN:</label>
                        <input type="text" id="modal-direccion" value="${pedido.direccion || ''}" style="width: 100%; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 8px; border-radius: 4px; font-size: 0.85rem;" />
                    </div>

                    <div>
                        <label style="color: #8af7b3; font-size: 0.8rem; display: block; margin-bottom: 3px;">TELÉFONO:</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="modal-telefono" value="${pedido.telefono || ''}" style="flex: 1; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 8px; border-radius: 4px; font-size: 0.85rem;" />
                            <button type="button" onclick="window.iniciarLlamadaAndroid(document.getElementById('modal-telefono').value)" title="Llamar a cliente" style="background: #238636; border: 1px solid #2ea043; color: #fff; padding: 8px 12px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                📞
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style="color: #ffb300; font-size: 0.8rem; display: block; margin-bottom: 3px;">ESTADO DE LA PARADA:</label>
                        <select id="modal-estado" style="width: 100%; background: #161b22; border: 1px solid #ffb300; color: #fff; padding: 8px; border-radius: 4px; font-size: 0.85rem;">
                            <option value="en-camino" ${pedido.estado === 'en-camino' ? 'selected' : ''}>EN CAMINO</option>
                            <option value="entregado" ${pedido.estado === 'entregado' ? 'selected' : ''}>ENTREGADO</option>
                            <option value="no-entregado" ${pedido.estado === 'no-entregado' ? 'selected' : ''}>NO ENTREGADO</option>
                        </select>
                    </div>

                    <fieldset style="border: 1px dashed #00e5ff; border-radius: 6px; padding: 10px; margin-top: 5px;">
                        <legend style="color: #00e5ff; font-size: 0.8rem; padding: 0 5px;">📸 CARGA DE EVIDENCIAS</legend>
                        <div style="margin-bottom: 8px;">
                            <label style="font-size: 0.75rem; color: #d2a8ff; display: block;">📞 Registro / Evidencia de Llamada:</label>
                            <input type="file" id="evidencia-llamada" accept="image/*,audio/*,.pdf" style="font-size: 0.75rem; color: #8b949e; margin-top: 2px;" />
                        </div>
                        <div style="margin-bottom: 8px;">
                            <label style="font-size: 0.75rem; color: #d2a8ff; display: block;">🏠 Foto de Fachada:</label>
                            <input type="file" id="evidencia-fachada" accept="image/*" capture="environment" style="font-size: 0.75rem; color: #8b949e; margin-top: 2px;" />
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; color: #d2a8ff; display: block;">🧾 Foto de Tirilla / Comprobante:</label>
                            <input type="file" id="evidencia-tirilla" accept="image/*" capture="environment" style="font-size: 0.75rem; color: #8b949e; margin-top: 2px;" />
                        </div>
                    </fieldset>

                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button type="button" onclick="document.getElementById('modal-gestion-parada-mapa').remove()" style="flex: 1; background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 10px; border-radius: 4px; font-weight: bold; cursor: pointer;">CANCELAR</button>
                        <button type="submit" style="flex: 1; background: #00e5ff; border: none; color: #05070f; padding: 10px; border-radius: 4px; font-weight: bold; cursor: pointer;">GUARDAR CAMBIOS</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    document.getElementById("form-gestion-pin-mapa").addEventListener("submit", async (e) => {
        e.preventDefault();

        const nuevoEstado = document.getElementById("modal-estado").value;
        pedido.destinatario = document.getElementById("modal-destinatario").value;
        pedido.direccion = document.getElementById("modal-direccion").value;
        pedido.telefono = document.getElementById("modal-telefono").value;
        pedido.estado = nuevoEstado;

        // Persistencia local en IndexedDB
        try {
            await dbStore.actualizarParada(pedido);
            console.log("[MAPA_MARCADORES]: Parada actualizada en IndexedDB desde Modal", pedido);

            mutarMarcadorPorId(pedido.id || `#PNT-${indice}`, nuevoEstado);
            document.getElementById("modal-gestion-parada-mapa").remove();

            // Intento de sync con API PHP REST
            if (navigator.onLine) {
                fetch('/api/paradas.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pedido)
                }).catch(err => console.warn("[MAPA_MARCADORES]: Sync diferido a PHP:", err));
            }
        } catch (err) {
            console.error("[MAPA_MARCADORES]: Error guardando parada en IndexedDB:", err);
        }
    });
}

/**
 * Asigna o actualiza la colección de marcadores interactivos en Google Maps
 */
export function renderizarMarcadoresInteractivos(listaPedidos, indiceActivo, callbackActualizacion) {
    if (Array.isArray(window.marcadoresRutaMensajero)) {
        window.marcadoresRutaMensajero.forEach((m) => m.setMap(null));
    }
    window.marcadoresRutaMensajero = [];

    if (!listaPedidos || listaPedidos.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    const geocoder = new google.maps.Geocoder();

    listaPedidos.forEach((pedido, idx) => {
        let estadoCalculado = pedido.estado ? pedido.estado.toLowerCase() : 'asignado';
        
        if (idx === indiceActivo && estadoCalculado !== 'entregado' && estadoCalculado !== 'no-entregado') {
            estadoCalculado = 'en-camino';
        }

        const iconoCyberpunk = crearIconoParadaCyberpunkSVG({
            estado: estadoCalculado,
            secuencia: idx + 1,
            causal: pedido.causal || ''
        });

        const crearMarcadorEnPosicion = (latLngPos) => {
            bounds.extend(latLngPos);

            const marker = new google.maps.Marker({
                position: latLngPos,
                map: window.mapaMensajero,
                draggable: false,
                icon: iconoCyberpunk,
                title: `[STOP #${idx + 1}] ${pedido.destinatario || "Cliente"}`
            });

            const idUnicoParada = pedido.id || `#PNT-${idx + 1}`;
            marker.set('idParada', idUnicoParada);
            marker.set('secuencia', idx + 1);

            const templateInfo = `
                <div style="background: #0d1117; color: #fff; padding: 10px; border: 1px solid #00e5ff; font-family: 'Fira Code', monospace; font-size: 0.78rem; border-radius: 4px; min-width: 180px;">
                    <div style="color: #00e5ff; font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #2d3748; padding-bottom: 2px;">
                        [STOP #${idx + 1}] ${pedido.destinatario || "CLIENTE"}
                    </div>
                    <div><span style="color: #8af7b3;">📍 DIR:</span> ${pedido.direccion}</div>
                    <div><span style="color: #8af7b3;">📞 TEL:</span> ${pedido.telefono || "N/A"}</div>
                    <div style="margin-top: 4px;">
                        <span style="color: #ffb300;">⚡ ESTADO:</span> 
                        <strong style="text-transform: uppercase;">${estadoCalculado}</strong>
                    </div>
                </div>`;

            marker.addListener("mouseover", () => {
                if (window.infoWindowMensajero) {
                    window.infoWindowMensajero.setContent(templateInfo);
                    window.infoWindowMensajero.open(window.mapaMensajero, marker);
                }
            });

            marker.addListener("mouseout", () => {
                if (window.infoWindowMensajero) window.infoWindowMensajero.close();
            });

            // DESPLIEGUE DEL MENÚ RADIAL FLOTANTE EN CRUZ
            marker.addListener("click", () => {
                if (window.overlayMenuActivo) {
                    window.overlayMenuActivo.cerrar();
                }

                window.overlayMenuActivo = new MenuRadialOverlay(marker.getPosition(), {
                    onEdit: () => window.cargarEdicionDesdePin(idUnicoParada),
                    onMove: () => activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion),
                    onDelete: () => eliminarParadaProceso(marker, idUnicoParada, callbackActualizacion),
                    onReport: () => abrirModalGestionParada(pedido, idx + 1)
                });

                window.overlayMenuActivo.setMap(window.mapaMensajero);
            });

            window.marcadoresRutaMensajero.push(marker);
            window.mapaMensajero.fitBounds(bounds);
        };

        if (pedido.lat && pedido.lng) {
            const pos = new google.maps.LatLng(parseFloat(pedido.lat), parseFloat(pedido.lng));
            crearMarcadorEnPosicion(pos);
        } else {
            const dirCompleta = sanitizarDireccionContexto(pedido.direccion);
            geocoder.geocode({ address: dirCompleta }, (results, status) => {
                if (status === "OK" && results[0]) {
                    crearMarcadorEnPosicion(results[0].geometry.location);
                }
            });
        }
    });
}

/**
 * Habilita el movimiento del marcador (Este - Mover)
 */
function activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion) {
    marker.setDraggable(true);
    console.log("[MAPA_MARCADORES]: Arrastro activado para el pin:", marker.get('idParada'));

    const listener = marker.addListener('dragend', async (event) => {
        const nuevaLat = event.latLng.lat();
        const nuevaLng = event.latLng.lng();

        pedido.lat = nuevaLat;
        pedido.lng = nuevaLng;

        geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, async (results, status) => {
            if (status === "OK" && results[0]) {
                pedido.direccion = results[0].formatted_address;
            }

            try {
                await dbStore.actualizarParada(pedido);
                console.log("[MAPA_MARCADORES]: Parada reubicada y guardada en IndexedDB:", pedido);
            } catch (err) {
                console.error("[MAPA_MARCADORES]: Error al guardar geocodificación en IndexedDB:", err);
            }

            if (navigator.onLine) {
                fetch('/api/paradas.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pedido)
                }).catch(err => console.warn("[MAPA_MARCADORES]: Falló sync backend PHP:", err));
            }

            if (typeof callbackActualizacion === "function") {
                callbackActualizacion(pedido);
            }
        });

        marker.setDraggable(false);
        google.maps.event.removeListener(listener);
    });
}

/**
 * Elimina la parada local y notifica (Sur - Eliminar)
 */
async function eliminarParadaProceso(marker, idParada, callbackActualizacion) {
    if (!confirm(`¿Eliminar la parada ${idParada} del mapa y registro local?`)) return;

    try {
        await dbStore.eliminarParada(idParada);
        console.log("[MAPA_MARCADORES]: Parada eliminada de IndexedDB:", idParada);

        marker.setMap(null);
        window.marcadoresRutaMensajero = window.marcadoresRutaMensajero.filter(m => m !== marker);

        if (navigator.onLine) {
            fetch(`/api/paradas.php?id=${encodeURIComponent(idParada)}`, { method: 'DELETE' })
                .catch(err => console.warn("[MAPA_MARCADORES]: Error eliminando en backend PHP:", err));
        }

        if (typeof callbackActualizacion === "function") {
            callbackActualizacion();
        }
    } catch (err) {
        console.error("[MAPA_MARCADORES]: Fallo al eliminar parada:", err);
    }
}

/**
 * Mutar el marcador en tiempo real cuando el usuario cambia el estado
 */
export function mutarMarcadorPorId(idParada, nuevoEstado, causal = '') {
    if (!window.marcadoresRutaMensajero) return;

    const marker = window.marcadoresRutaMensajero.find(m => m.get('idParada') === idParada);
    if (marker) {
        const sec = marker.get('secuencia') || 1;
        const nuevoIcono = crearIconoParadaCyberpunkSVG({
            estado: nuevoEstado,
            secuencia: sec,
            causal: causal
        });
        marker.setIcon(nuevoIcono);
    }
}

// BINDING GLOBAL PARA REDIRECCIÓN NORTE (EDITAR)
window.cargarEdicionDesdePin = function(idParada) {
    console.log("[MAPA_MARCADORES]: Redirigiendo a edición para parada:", idParada);
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