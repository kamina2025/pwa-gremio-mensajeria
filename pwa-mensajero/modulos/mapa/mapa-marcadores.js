/**
 * PROTOCOLO MACONDO - GESTOR DE MARCADORES E INTERACCIONES EN MAPA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-marcadores.js
 * Arquitectura: Google Maps OverlayView / Local-First / Orbital UI / GPS Navigation
 */

import { crearIconoParadaCyberpunkSVG } from "./mapa-iconos.js";
import { IndexedStore } from "../db/indexed-store.js";
import { actualizarParadaEnPlanillaLocal } from "../planilla/planillas-db.js";
import { obtenerClaseMenuRadialOverlay } from "./marcadores/mapa-overlay-orbital.js";
import { abrirModalGestionParada as abrirModalGestionParadaImpl } from "./marcadores/mapa-modal-parada.js";

// Instancia de persistencia Local-First para operaciones de IndexedDB
const dbStore = new IndexedStore();
const KEY_ULTIMA_PARADA = 'macondo_ultima_parada_id';

// Garantizar arreglos globales y estado overlay
window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];
window.overlayMenuActivo = null;

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

export function cerrarOverlayActivo() {
    if (window.overlayMenuActivo && typeof window.overlayMenuActivo.cerrar === "function") {
        window.overlayMenuActivo.cerrar();
    }
}

function sanitizarDireccionContexto(direccion) {
    if (!direccion) return "Cali, Colombia";
    const dirLower = direccion.toLowerCase();
    if (dirLower.includes("cali") || dirLower.includes("jamundi") || dirLower.includes("yumbo") || dirLower.includes("palmira")) {
        return direccion;
    }
    return `${direccion}, Cali, Colombia`;
}

window.iniciarLlamadaAndroid = function (numeroTelefono) {
    if (!numeroTelefono || numeroTelefono.trim() === "" || numeroTelefono === "N/A") {
        alert("⚠️ No hay un número de teléfono válido para esta parada.");
        return;
    }
    const numeroLimpio = numeroTelefono.replace(/[^\d+]/g, "");
    window.location.href = `tel:${numeroLimpio}`;
};

export function iniciarViajeNavegacionGPS(parada) {
    if (!parada) {
        console.warn("⚠️ [MAPA_NAVEGACION]: Parada inválida para iniciar viaje.");
        return;
    }

    console.log(`🚀 [MAPA_NAVEGACION]: Iniciando navegación interna para la parada: #${parada.id || parada.ssc}`);

    if (typeof window.trazarRutaNavegacionInternaGPS === "function") {
        window.trazarRutaNavegacionInternaGPS(parada);
    } else {
        console.warn("⚠️ [MAPA_NAVEGACION]: Módulo 'trazarRutaNavegacionInternaGPS' no encontrado. Ejecutando fallback externo.");
        
        const coordsDestino = typeof window.obtenerCoordenadasValidasParada === "function"
            ? window.obtenerCoordenadasValidasParada(parada)
            : null;

        if (coordsDestino) {
            const { lat, lng } = coordsDestino;
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, "_blank");
        }
    }
}

export function manejarAccionOrbitalViajar(paradaSeleccionada) {
    console.log(`🚀 [MENU_ORBITAL]: Acción 'VIAJAR' activada para parada -> #${paradaSeleccionada.id || paradaSeleccionada.ssc}`);
    iniciarViajeNavegacionGPS(paradaSeleccionada);
}

export function abrirModalGestionParada(pedido, indice) {
    abrirModalGestionParadaImpl(pedido, indice, mutarMarcadorPorId);
}

export function renderizarMarcadoresInteractivos(listaPedidos, indiceActivo, callbackActualizacion) {
    if (Array.isArray(window.marcadoresRutaMensajero)) {
        window.marcadoresRutaMensajero.forEach((m) => {
            if (typeof m.setMap === "function") m.setMap(null);
        });
    }
    window.marcadoresRutaMensajero = [];

    if (!listaPedidos || listaPedidos.length === 0) return;

    const mapa = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) return;

    const bounds = new google.maps.LatLngBounds();
    const geocoder = new google.maps.Geocoder();

    listaPedidos.forEach((pedido, idx) => {
        let estadoCalculado = pedido.estado ? pedido.estado.toLowerCase() : "asignado";

        if (idx === indiceActivo && estadoCalculado !== "entregado" && estadoCalculado !== "no-entregado") {
            estadoCalculado = "en-camino";
        }

        const idUnicoParada = String(pedido.id || pedido.ssc || `#PNT-${idx + 1}`).trim();
        const nombreCliente = pedido.destinatario || pedido.cliente || pedido.nombre_cliente || "Cliente";

        const crearMarcadorEnPosicion = (latLngPos) => {
            bounds.extend(latLngPos);

            const iconoCyberpunk = crearIconoParadaCyberpunkSVG({
                estado: estadoCalculado,
                secuencia: idx + 1,
                causal: pedido.causal || ""
            });

            const marker = new google.maps.Marker({
                position: latLngPos,
                map: mapa,
                draggable: false,
                icon: iconoCyberpunk,
                title: `[STOP #${idx + 1}] ${nombreCliente}`
            });

            const grupoAsignado = String(pedido.grupoId || pedido.grupo || pedido.cluster || "").trim();
            marker.set("idParada", idUnicoParada);
            marker.set("secuencia", idx + 1);
            marker.set("grupoId", grupoAsignado);
            marker.set("cluster", grupoAsignado);

            const templateInfo = `
                <div style="background: #0d1117; color: #fff; padding: 10px; border: 1px solid #00e5ff; font-family: 'Fira Code', monospace; font-size: 0.78rem; border-radius: 6px; min-width: 180px;">
                    <div style="color: #00e5ff; font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #2d3748; padding-bottom: 2px;">
                        [STOP #${idx + 1}] ${nombreCliente}
                    </div>
                    <div><span style="color: #8af7b3;">📍 DIR:</span> ${pedido.direccion || pedido.dir || "N/A"}</div>
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

            const registrarSeleccionDirecta = () => {
                try {
                    localStorage.setItem(KEY_ULTIMA_PARADA, idUnicoParada);
                    console.log(`📌 [MAPA_MARCADORES]: Selección directa registrada -> ${idUnicoParada} (${nombreCliente})`);
                } catch (err) {
                    console.warn("⚠️ Error guardando selección directa en localStorage:", err);
                }
            };

            marker.addListener("click", (e) => {
                if (e && e.domEvent) e.domEvent.stopPropagation();
                registrarSeleccionDirecta();
                cerrarOverlayActivo();

                const MenuClass = obtenerClaseMenuRadialOverlay();
                if (!MenuClass) return;

                window.overlayMenuActivo = new MenuClass(marker.getPosition(), {
                    onEdit: () => window.cargarEdicionDesdePin(idUnicoParada),
                    onSequence: () => {
                        if (typeof window.moverParadaManual === "function") {
                            window.moverParadaManual(idUnicoParada, -1, pedido.zonaKey || pedido.zona);
                        }
                    },
                    onMove: () => activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion),
                    onCall: () => window.iniciarLlamadaAndroid(pedido.telefono || pedido.tel),
                    onDelete: () => eliminarParadaProceso(marker, idUnicoParada, callbackActualizacion),
                    onCopyGPS: () => {
                        const lat = pedido.lat || marker.getPosition().lat();
                        const lng = pedido.lng || marker.getPosition().lng();
                        navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => alert(`📋 Coordenadas copiadas: ${lat}, ${lng}`));
                    },
                    onReport: () => abrirModalGestionParada(pedido, idx + 1),
                    onExternalNav: () => iniciarViajeNavegacionGPS(pedido)
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

function activarArrastreMarcador(marker, pedido, geocoder, callbackActualizacion) {
    marker.setDraggable(true);
    const idParada = marker.get("idParada");
    console.log("📍 [MAPA_MARCADORES]: Arrastre activado para parada ID:", idParada);

    const listener = marker.addListener("dragend", async (event) => {
        const nuevaLat = event.latLng.lat();
        const nuevaLng = event.latLng.lng();

        pedido.lat = nuevaLat;
        pedido.lng = nuevaLng;
        pedido.latitud = nuevaLat;
        pedido.longitud = nuevaLng;
        if (pedido.coordenadas && typeof pedido.coordenadas === "object") {
            pedido.coordenadas.lat = nuevaLat;
            pedido.coordenadas.lng = nuevaLng;
        }
        pedido.updated_at = new Date().toISOString();

        const actualizarBufferRAM = (arr) => {
            if (!Array.isArray(arr)) return;
            const idx = arr.findIndex(
                (p) => String(p.id || p.ssc || "").trim() === String(pedido.id || pedido.ssc || idParada).trim()
            );
            if (idx !== -1) {
                arr[idx] = { ...arr[idx], ...pedido };
            }
        };

        actualizarBufferRAM(window.__CACHE_PARADAS_MACONDO__);
        actualizarBufferRAM(window.paradasMemoriaLocal);
        actualizarBufferRAM(window.paradasRutaActiva);
        actualizarBufferRAM(window.pedidosGlobales);

        geocoder.geocode({ location: { lat: nuevaLat, lng: nuevaLng } }, async (results, status) => {
            if (status === "OK" && results[0]) {
                pedido.direccion = results[0].formatted_address;
                pedido.dir = results[0].formatted_address;
            }

            try {
                if (typeof dbStore.actualizarParada === "function") {
                    await dbStore.actualizarParada(pedido, "paradas_rutas");
                }
                await actualizarParadaEnPlanillaLocal(pedido);

                console.log("💾 [MAPA_MARCADORES]: Reubicación persistida atómicamente en IndexedDB.");
            } catch (err) {
                console.error("❌ [MAPA_MARCADORES]: Error al guardar reubicación local:", err);
            }

            const baseUrl = obtenerEndpointAPI();
            const urlApi = `${baseUrl}?action=actualizar_parada`;

            const payload = {
                action: "actualizar_parada",
                id: pedido.id || idParada,
                ssc: pedido.ssc || idParada,
                planilla_id: pedido.planilla_id || null,
                lat: nuevaLat,
                lng: nuevaLng,
                latitud: nuevaLat,
                longitud: nuevaLng,
                direccion: pedido.direccion,
                updated_at: pedido.updated_at
            };

            fetch(urlApi, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload)
            })
                .then(async (res) => {
                    const data = await res.json().catch(() => ({}));
                    console.log("🌐 [MAPA_MARCADORES_MOVE_SYNC]: Respuesta del servidor:", data);
                })
                .catch(async (err) => {
                    console.warn("⚠️ [MAPA_MARCADORES_OFFLINE]: Sync diferido guardado en cola offline:", err);
                    await dbStore.registrarOperacionPendiente("actualizar_parada", payload);
                });

            if (typeof callbackActualizacion === "function") {
                callbackActualizacion(pedido);
            }
        });

        marker.setDraggable(false);
        google.maps.event.removeListener(listener);
    });
}

async function eliminarParadaProceso(marker, idParada, callbackActualizacion) {
    if (!confirm(`¿Eliminar la parada ${idParada} del mapa y registro local?`)) return;

    try {
        if (typeof dbStore.eliminarParada === "function") {
            await dbStore.eliminarParada(idParada, "paradas_rutas");
        }
        console.log("💾 [MAPA_MARCADORES]: Parada eliminada de IndexedDB:", idParada);

        marker.setMap(null);
        window.marcadoresRutaMensajero = window.marcadoresRutaMensajero.filter((m) => m !== marker);

        if (Array.isArray(window.__CACHE_PARADAS_MACONDO__)) {
            window.__CACHE_PARADAS_MACONDO__ = window.__CACHE_PARADAS_MACONDO__.filter(
                (p) => String(p.id || p.ssc) !== String(idParada)
            );
        }

        const baseUrl = obtenerEndpointAPI();
        const urlApi = `${baseUrl}?action=eliminar_parada`;

        const payload = {
            action: "eliminar_parada",
            id: idParada
        };

        fetch(urlApi, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload)
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                console.log("🌐 [MAPA_MARCADORES_DEL_SYNC]: Parada eliminada del servidor remoto:", data);
            })
            .catch(async (err) => {
                console.warn("⚠️ [MAPA_MARCADORES_OFFLINE]: Operación guardada en cola offline:", err);
                await dbStore.registrarOperacionPendiente("eliminar_parada", payload);
            });

        if (typeof callbackActualizacion === "function") {
            callbackActualizacion();
        }
    } catch (err) {
        console.error("❌ [MAPA_MARCADORES]: Fallo al eliminar parada:", err);
    }
}

export function mutarMarcadorPorId(idParada, nuevoEstado, causal = "") {
    if (!window.marcadoresRutaMensajero) return;

    const marker = window.marcadoresRutaMensajero.find(
        (m) => String(m.get("idParada")).trim() === String(idParada).trim()
    );

    if (marker) {
        const sec = marker.get("secuencia") || 1;
        const nuevoIcono = crearIconoParadaCyberpunkSVG({
            estado: nuevoEstado,
            secuencia: sec,
            causal: causal
        });

        marker.setIcon(nuevoIcono);
        console.log(`⚡ [MAPA_MARCADORES]: Icono del marcador #${idParada} mutado a estado: ${nuevoEstado}`);
    }
}

window.cargarEdicionDesdePin = function (idParada) {
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

if (typeof window !== "undefined") {
    window.renderizarMarcadoresInteractivos = renderizarMarcadoresInteractivos;
    window.mutarMarcadorPorId = mutarMarcadorPorId;
    window.abrirModalGestionParada = abrirModalGestionParada;
    window.cerrarOverlayActivo = cerrarOverlayActivo;
    window.iniciarViajeNavegacionGPS = iniciarViajeNavegacionGPS;
    window.manejarAccionOrbitalViajar = manejarAccionOrbitalViajar;
}