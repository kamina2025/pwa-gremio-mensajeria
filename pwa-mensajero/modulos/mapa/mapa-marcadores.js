/**
 * PROTOCOLO MACONDO - GESTOR DE MARCADORES E INFOWINDOWS CYBERPUNK CON MODAL Y LLAMADA NATIVA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-marcadores.js
 */

import { crearIconoParadaCyberpunkSVG } from "./mapa-iconos.js";

// Asegurar arreglo global para referencia
window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];

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
 * Invoca el marcador de llamadas nativo de Android / Dispositivos Móviles
 * @param {string} numeroTelefono 
 */
window.iniciarLlamadaAndroid = function(numeroTelefono) {
    if (!numeroTelefono || numeroTelefono.trim() === "" || numeroTelefono === "N/A") {
        alert("⚠️ No hay un número de teléfono válido para esta parada.");
        return;
    }
    // Elimina caracteres que no sean dígitos ni el símbolo '+'
    const numeroLimpio = numeroTelefono.replace(/[^\d+]/g, '');
    window.location.href = `tel:${numeroLimpio}`;
};

/**
 * Inyecta y despliega el modal flotante para la gestión completa y subida de evidencias
 */
function abrirModalGestionParada(pedido, indice) {
    let modalExistente = document.getElementById("modal-gestion-parada-mapa");
    if (modalExistente) {
        modalExistente.remove();
    }

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
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
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

    // Manejador del envío del formulario
    document.getElementById("form-gestion-pin-mapa").addEventListener("submit", async (e) => {
        e.preventDefault();

        const nuevoEstado = document.getElementById("modal-estado").value;
        pedido.destinatario = document.getElementById("modal-destinatario").value;
        pedido.direccion = document.getElementById("modal-direccion").value;
        pedido.telefono = document.getElementById("modal-telefono").value;
        pedido.estado = nuevoEstado;

        const archivoLlamada = document.getElementById("evidencia-llamada").files[0];
        const archivoFachada = document.getElementById("evidencia-fachada").files[0];
        const archivoTirilla = document.getElementById("evidencia-tirilla").files[0];

        // Carga útil para la API REST en PHP
        const formData = new FormData();
        formData.append("id_parada", pedido.id || `#PNT-${indice}`);
        formData.append("destinatario", pedido.destinatario);
        formData.append("direccion", pedido.direccion);
        formData.append("telefono", pedido.telefono);
        formData.append("estado", nuevoEstado);

        if (archivoLlamada) formData.append("evidencia_llamada", archivoLlamada);
        if (archivoFachada) formData.append("evidencia_fachada", archivoFachada);
        if (archivoTirilla) formData.append("evidencia_tirilla", archivoTirilla);

        try {
            if (typeof window.guardarEvidenciasParada === "function") {
                await window.guardarEvidenciasParada(formData);
            } else {
                console.log("Datos/Evidencias guardados localmente:", Object.fromEntries(formData));
            }

            mutarMarcadorPorId(pedido.id || `#PNT-${indice}`, nuevoEstado);

            document.getElementById("modal-gestion-parada-mapa").remove();
            alert("Parada y evidencias actualizadas correctamente.");
        } catch (err) {
            console.error("Error al procesar la actualización:", err);
            alert("Ocurrió un error al guardar los cambios.");
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
                draggable: true,
                icon: iconoCyberpunk,
                title: `[STOP #${idx + 1}] ${pedido.destinatario || "Cliente"}`
            });

            marker.set('idParada', pedido.id || `#PNT-${idx + 1}`);
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

            marker.addListener("click", () => {
                abrirModalGestionParada(pedido, idx + 1);
            });

            marker.addListener("dragend", (event) => {
                const nuevaLat = event.latLng.lat();
                const nuevaLng = event.latLng.lng();

                pedido.lat = nuevaLat;
                pedido.lng = nuevaLng;

                geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, (revResults, revStatus) => {
                    if (revStatus === "OK" && revResults[0]) {
                        pedido.direccion = revResults[0].formatted_address;
                        if (typeof callbackActualizacion === "function") {
                            callbackActualizacion(pedido);
                        }
                    }
                });
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

// BINDING GLOBAL
window.cargarEdicionDesdePin = function(idParada) {
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