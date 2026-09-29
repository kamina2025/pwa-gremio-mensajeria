/**
 * PROTOCOLO MACONDO - GESTOR DE MARCADORES E INTERACCIONES EN MAPA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-marcadores.js
 * Arquitectura: Google Maps OverlayView / Local-First / Orbital UI / GitHub Pages Compatible
 */

import { crearIconoParadaCyberpunkSVG } from "./mapa-iconos.js";
import { IndexedStore } from "../db/indexed-store.js";
import { actualizarParadaEnPlanillaLocal } from "../planilla/planillas-db.js";
import { guardarRutaZonificada } from "../mensajero-persistencia.js";
import { obtenerClaseMenuRadialOverlay } from "./marcadores/mapa-overlay-orbital.js";
import { abrirModalGestionParada as abrirModalGestionParadaImpl } from "./marcadores/mapa-modal-parada.js";

// Instancia de persistencia Local-First para operaciones de IndexedDB
const dbStore = new IndexedStore();
const KEY_ULTIMA_PARADA = 'macondo_ultima_parada_id';
const KEY_COLA_OFFLINE = 'macondo_cola_offline_pwa';

window.marcadoresRutaMensajero = window.marcadoresRutaMensajero || [];
window.overlayMenuActivo = null;

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

function compararIdsParada(idA, idB) {
    if (!idA || !idB) return false;
    const normA = String(idA).replace(/^[#PNT-]+/i, '').trim();
    const normB = String(idB).replace(/^[#PNT-]+/i, '').trim();
    return normA === normB || String(idA).trim() === String(idB).trim();
}

function obtenerCoordenadasNavegacion(parada) {
    if (!parada) return null;
    const lat = parseFloat(parada.lat || parada.latitud);
    const lng = parseFloat(parada.lng || parada.longitud);
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
    return { lat, lng };
}

function limpiarParadaDeBuffersRAM(idTarget) {
    const filtrarArray = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter(p => p && !compararIdsParada(p.id || p.ssc, idTarget));
    };

    const nuevoCache = filtrarArray(window.__CACHE_PARADAS_MACONDO__);
    window.__CACHE_PARADAS_MACONDO__ = nuevoCache;
    window.paradasMemoriaLocal = filtrarArray(window.paradasMemoriaLocal);
    window.paradasRutaActiva = filtrarArray(window.paradasRutaActiva);
    window.pedidosGlobales = filtrarArray(window.pedidosGlobales);

    if (typeof guardarRutaZonificada === "function") {
        guardarRutaZonificada(nuevoCache).catch(err => {
            console.warn("⚠️ [MAPA_MARCADORES]: Snapshot en IndexedDB no actualizada:", err);
        });
    }

    return nuevoCache;
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

    const idDisplay = parada.id || parada.ssc || "PNT";
    console.log(`🚀 [MAPA_NAVEGACION]: Iniciando navegación interna para la parada: #${idDisplay}`);

    if (typeof window.trazarRutaNavegacionInternaGPS === "function") {
        window.trazarRutaNavegacionInternaGPS(parada);
    } else {
        console.warn("⚠️ [MAPA_NAVEGACION]: Módulo 'trazarRutaNavegacionInternaGPS' no encontrado. Ejecutando fallback externo.");
        
        const coordsDestino = typeof window.obtenerCoordenadasValidasParada === "function"
            ? window.obtenerCoordenadasValidasParada(parada)
            : obtenerCoordenadasNavegacion(parada);

        if (coordsDestino) {
            const { lat, lng } = coordsDestino;
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, "_blank");
        } else {
            console.warn("⚠️ [MAPA_NAVEGACION]: Coordenadas insuficientes para iniciar navegación GPS externa.");
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
            if (m) {
                if (typeof google !== "undefined" && google.maps && google.maps.event) {
                    google.maps.event.clearInstanceListeners(m);
                }
                if (typeof m.setMap === "function") m.setMap(null);
            }
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
            marker.set("sscParada", pedido.ssc || idUnicoParada);
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

        const coordsDirectas = obtenerCoordenadasNavegacion(pedido);
        if (coordsDirectas) {
            const pos = new google.maps.LatLng(coordsDirectas.lat, coordsDirectas.lng);
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
            const idx = arr.findIndex((p) => p && compararIdsParada(p.id || p.ssc, pedido.id || pedido.ssc || idParada));
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

            if (esEntornoEstatico()) {
                console.log("ℹ️ [MAPA_MARCADORES_GITPAGES]: Entorno estático detectado. Reubicación guardada en cola local.");
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
                        console.log("🌐 [MAPA_MARCADORES_MOVE_SYNC]: Respuesta del servidor:", data);
                    })
                    .catch(async (err) => {
                        console.warn("⚠️ [MAPA_MARCADORES_OFFLINE]: Sync diferido guardado en cola offline:", err);
                        await registrarOperacionPendienteDefensivo("actualizar_parada", payload);
                    });
            }

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
        console.log(`🗑️ [MAPA_MARCADORES]: Iniciando eliminación atómica para parada: ${idParada}`);

        // 1. Ocultar y remover el marcador visual en Google Maps
        if (marker) {
            if (typeof google !== "undefined" && google.maps && google.maps.event) {
                google.maps.event.clearInstanceListeners(marker);
            }
            if (typeof marker.setMap === "function") {
                marker.setMap(null);
            }
        }
        if (Array.isArray(window.marcadoresRutaMensajero)) {
            window.marcadoresRutaMensajero = window.marcadoresRutaMensajero.filter((m) => m !== marker);
        }

        // 2. Limpieza sincrónica de memoria RAM y sobrescritura de snapshot en IndexedDB
        const paradasActualizadas = limpiarParadaDeBuffersRAM(idParada);

        // 3. Persistencia Local en IndexedDB eliminando explícitamente de las tablas secundarias
        if (typeof dbStore.eliminarParada === "function") {
            await dbStore.eliminarParada(idParada, "paradas_rutas");
            await dbStore.eliminarParada(idParada, "rutas_zonificadas").catch(() => {});
        }
        console.log("💾 [MAPA_MARCADORES]: Parada eliminada de IndexedDB:", idParada);

        // 4. Sincronización Remota Backend o Cola Offline defensiva para GitHub Pages
        const payload = {
            action: "eliminar_parada",
            id: idParada
        };

        if (esEntornoEstatico()) {
            console.log("ℹ️ [MAPA_MARCADORES_GITPAGES]: Entorno estático detectado. Eliminación registrada en cola local.");
            await registrarOperacionPendienteDefensivo("eliminar_parada", payload);
        } else {
            const baseUrl = obtenerEndpointAPI();
            const urlApi = `${baseUrl}?action=eliminar_parada&id=${encodeURIComponent(idParada)}`;

            fetch(urlApi, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload)
            })
                .then(async (res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json().catch(() => ({}));
                    console.log("🌐 [MAPA_MARCADORES_DEL_SYNC]: Parada eliminada del servidor remoto:", data);
                })
                .catch(async (err) => {
                    console.warn("⚠️ [MAPA_MARCADORES_OFFLINE]: Operación guardada en cola offline:", err);
                    await registrarOperacionPendienteDefensivo("eliminar_parada", payload);
                });
        }

        // 5. Refresco de Consola de Operaciones pasando directamente la colección purgada
        if (typeof window.refrescarConsolaOperacionesUI === "function") {
            await window.refrescarConsolaOperacionesUI(paradasActualizadas);
        }

        if (typeof callbackActualizacion === "function") {
            callbackActualizacion(paradasActualizadas);
        }
    } catch (err) {
        console.error("❌ [MAPA_MARCADORES]: Fallo al eliminar parada:", err);
    }
}

export function mutarMarcadorPorId(idParada, nuevoEstado, causal = "") {
    if (!window.marcadoresRutaMensajero) return;

    const marker = window.marcadoresRutaMensajero.find(
        (m) => compararIdsParada(m.get("idParada"), idParada) || compararIdsParada(m.get("sscParada"), idParada)
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