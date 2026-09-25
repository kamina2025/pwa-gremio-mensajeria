/**
 * PROTOCOLO MACONDO - EVENTOS, BUSCADOR MULTICRITERIO Y CONTROLES DEL MAPA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-eventos.js
 */

import { crearIconoParadaRadarSVG } from "./mapa-iconos.js";
import { calcularDistanciaHaversine } from "./zonificacion/mensajero-zonificacion.js";
import { enfocarParadaEnMapa } from "./mapa-visor.js";
import { IndexedStore } from "../db/indexed-store.js";

const KEY_PERSISTENCIA_LOCK = 'map_interaction_locked';

let modoCrearParadaActivo = false;
let marcadorBusquedaTemp = null;
let debounceTimerBuscador = null;

const dbStore = new IndexedStore();

/**
 * Normaliza cadenas eliminando diacríticos, tildes y caracteres especiales.
 * @param {string} texto 
 * @returns {string}
 */
function normalizarTextoBusqueda(texto) {
    if (!texto) return "";
    return texto
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

/**
 * Extrae un identificador único y consistente de una parada.
 * @param {Object} p
 * @returns {string}
 */
function obtenerIdUnicoParada(p) {
    if (!p) return "";
    return String(p.id || p.ssc || p.idParada || p.id_parada || p.secuencia || p.orden || "").trim();
}

/**
 * Identifica la intención de búsqueda (STOP, CLIENTE o DIRECCION)
 * @param {string} query 
 * @returns {Object}
 */
function clasificarIntencionBusqueda(query) {
    const qNorm = normalizarTextoBusqueda(query);
    
    // Búsqueda por número de parada (#stop 1, stop 1, #1, 1)
    const patronStop = /^(?:#?\s*stop\s*|#\s*)?(\d+)$/i;
    const matchStop = qNorm.match(patronStop);
    if (matchStop) {
        return {
            tipo: 'STOP',
            valorLimpio: qNorm,
            numeroStop: parseInt(matchStop[1], 10)
        };
    }

    // Búsqueda por nomenclatura vial o dirección
    const patronDireccion = /\b(cra|carrera|cll|calle|av|avenida|dg|diagonal|tv|transversal|cl|cr|kr)\b/i;
    if (patronDireccion.test(qNorm) || /\d+[\s\w]*[-#]\s*\d+/.test(qNorm)) {
        return {
            tipo: 'DIRECCION',
            valorLimpio: qNorm,
            numeroStop: null
        };
    }

    // Búsqueda por Nombre de Cliente / Destinatario
    return {
        tipo: 'CLIENTE',
        valorLimpio: qNorm,
        numeroStop: null
    };
}

export const mapaEventos = {
    mapaInstancia: null,

    inicializarControles(mapa) {
        this.mapaInstancia = mapa || window.mapaMensajero || window.mapaInstanciaGlobal;
        console.log('⚡ [MAPA_EVENTOS]: Asignando listeners a los controles del mapa.');

        const btnZoomIn = document.getElementById('btn-zoom-in');
        const btnZoomOut = document.getElementById('btn-zoom-out');
        const btnRefresh = document.getElementById('btn-refresh-map');
        const btnToggleLock = document.getElementById('btn-toggle-lock');

        if (btnZoomIn) {
            btnZoomIn.onclick = (e) => {
                e.preventDefault();
                this.ejecutarZoom(1);
            };
        }

        if (btnZoomOut) {
            btnZoomOut.onclick = (e) => {
                e.preventDefault();
                this.ejecutarZoom(-1);
            };
        }

        if (btnRefresh) {
            btnRefresh.onclick = async (e) => {
                e.preventDefault();
                console.log("🔄 [MAPA_EVENTOS]: Solicitud de recarga manual activada por el usuario.");

                if (btnRefresh.classList.contains("spinning")) {
                    console.warn("⚠️ [MAPA_EVENTOS]: Refresco en ejecución. Operación omitida.");
                    return;
                }

                btnRefresh.classList.add("spinning");
                btnRefresh.disabled = true;

                try {
                    if (typeof window.recargarMapaCompleto === "function") {
                        await window.recargarMapaCompleto();
                        console.log("✅ [MAPA_EVENTOS]: Sincronización Local-First del mapa completada.");
                    } else if (typeof window.actualizarPuntosEnMapa === "function") {
                        const paradas = await this.obtenerColeccionParadas();
                        window.actualizarPuntosEnMapa(paradas, 0);
                    }
                } catch (err) {
                    console.error("❌ [MAPA_EVENTOS]: Error crítico durante la recarga del mapa:", err);
                } finally {
                    setTimeout(() => {
                        btnRefresh.classList.remove("spinning");
                        btnRefresh.disabled = false;
                    }, 400);
                }
            };
        }

        if (btnToggleLock) {
            btnToggleLock.onclick = (e) => {
                e.preventDefault();
                this.alternarBloqueoMapa();
            };
            this.restaurarEstadoBloqueo();
        }

        this.inicializarBuscadorMapa();
    },

    inicializarBuscadorMapa() {
        console.log("🔍 [MAPA_EVENTOS]: Inicializando Buscador con Identificador de Patrón.");

        const inputBuscador = document.getElementById("buscador-paradas-mapa");
        const listaSugerencias = document.getElementById("sugerencias-paradas-mapa");
        const btnLimpiar = document.getElementById("btn-limpiar-busqueda");
        const btnCerrarCard = document.getElementById("btn-cerrar-tarjeta");

        if (!inputBuscador) return;

        // Búsqueda fluida con debounce de 200 ms
        inputBuscador.addEventListener("input", (e) => {
            const query = e.target.value;
            if (btnLimpiar) btnLimpiar.style.display = query.trim().length > 0 ? "block" : "none";

            clearTimeout(debounceTimerBuscador);

            if (query.trim().length === 0) {
                if (listaSugerencias) {
                    listaSugerencias.style.display = "none";
                    listaSugerencias.innerHTML = "";
                }
                return;
            }

            debounceTimerBuscador = setTimeout(() => {
                this.ejecutarFiltradoParadas(query);
            }, 200);
        });

        inputBuscador.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(debounceTimerBuscador);
                const query = inputBuscador.value.trim();
                if (query.length > 0) {
                    if (listaSugerencias) listaSugerencias.style.display = "none";
                    this.ejecutarGeocodificacionDireccion(query);
                }
            }
        });

        if (btnLimpiar) {
            btnLimpiar.addEventListener("click", () => {
                inputBuscador.value = "";
                btnLimpiar.style.display = "none";
                if (listaSugerencias) {
                    listaSugerencias.style.display = "none";
                    listaSugerencias.innerHTML = "";
                }
                if (marcadorBusquedaTemp && typeof marcadorBusquedaTemp.setMap === "function") {
                    marcadorBusquedaTemp.setMap(null);
                }
                inputBuscador.focus();
            });
        }

        if (btnCerrarCard) {
            btnCerrarCard.addEventListener("click", () => {
                const card = document.getElementById("tarjeta-detalle-parada");
                if (card) card.style.display = "none";
            });
        }
    },

    /**
     * Recupera la lista activa de paradas desde las RAMs o IndexedDB
     * @returns {Promise<Array<Object>>}
     */
    async obtenerColeccionParadas() {
        const cacheRAM = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales;
        if (Array.isArray(cacheRAM) && cacheRAM.length > 0) {
            return cacheRAM;
        }

        try {
            let paradasLocal = [];
            if (typeof dbStore.obtenerParadas === 'function') {
                paradasLocal = await dbStore.obtenerParadas();
            } else if (typeof dbStore.obtenerTodasParadas === 'function') {
                paradasLocal = await dbStore.obtenerTodasParadas();
            } else if (typeof dbStore.getAll === 'function') {
                paradasLocal = await dbStore.getAll('paradas');
            }

            if (Array.isArray(paradasLocal) && paradasLocal.length > 0) {
                window.paradasRutaActiva = paradasLocal;
                window.__CACHE_PARADAS_MACONDO__ = paradasLocal;
                return paradasLocal;
            }
        } catch (err) {
            console.warn("⚠️ [MAPA_EVENTOS]: No se pudo consultar IndexedDB. Usando fallback de memoria:", err);
        }

        return window.paradasRutaActiva || [];
    },

    /**
     * Filtra la colección por cliente, dirección o secuencia (#STOP)
     * @param {string} query 
     */
    async ejecutarFiltradoParadas(query) {
        const paradas = await this.obtenerColeccionParadas();
        const intencion = clasificarIntencionBusqueda(query);
        
        let resultados = [];

        if (intencion.tipo === 'STOP') {
            resultados = paradas.filter((p, index) => {
                const sec = parseInt(p.secuencia || p.orden || p.secuenciaZona || index + 1, 10);
                return sec === intencion.numeroStop;
            }).map(p => ({ ...p, _categoriaBusqueda: 'STOP' }));
        } 
        else if (intencion.tipo === 'CLIENTE') {
            resultados = paradas.filter((p) => {
                const nombreCliente = normalizarTextoBusqueda(p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "");
                return nombreCliente.includes(intencion.valorLimpio);
            }).map(p => ({ ...p, _categoriaBusqueda: 'CLIENTE' }));
        } 
        else if (intencion.tipo === 'DIRECCION') {
            resultados = paradas.filter((p) => {
                const dir = normalizarTextoBusqueda(p.direccion || p.dir || "");
                return dir.includes(intencion.valorLimpio);
            }).map(p => ({ ...p, _categoriaBusqueda: 'DIRECCION' }));
        }

        if (resultados.length === 0 && intencion.tipo !== 'STOP') {
            resultados = paradas.filter((p, index) => {
                const sec = (p.secuencia || p.orden || index + 1).toString();
                const nombreCliente = normalizarTextoBusqueda(p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "");
                const dir = normalizarTextoBusqueda(p.direccion || p.dir || "");

                return sec.includes(intencion.valorLimpio) ||
                       nombreCliente.includes(intencion.valorLimpio) ||
                       dir.includes(intencion.valorLimpio);
            }).map(p => ({ ...p, _categoriaBusqueda: 'GENERAL' }));
        }

        console.log(`🔍 [MAPA_EVENTOS]: Consulta [${intencion.tipo}] "${query}" -> ${resultados.length} resultado(s) local(es).`);
        this.renderizarSugerencias(resultados, query, intencion);
    },

    renderizarSugerencias(coincidencias, queryOriginal, intencion) {
        const listaSugerencias = document.getElementById("sugerencias-paradas-mapa");
        if (!listaSugerencias) return;

        let html = "";

        if (coincidencias.length > 0) {
            html += coincidencias.map((p, idx) => {
                const sec = p.secuencia || p.orden || p.secuenciaZona || idx + 1;
                const uid = obtenerIdUnicoParada(p);
                const nombreCliente = p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "Cliente N/A";
                const direccionTexto = p.direccion || p.dir || "Sin dirección";

                let badgeHTML = "";
                if (p._categoriaBusqueda === 'STOP') {
                    badgeHTML = `<span class="cyber-sug-badge badge-stop">#STOP ${sec}</span>`;
                } else if (p._categoriaBusqueda === 'CLIENTE') {
                    badgeHTML = `<span class="cyber-sug-badge badge-cliente">👤 CLIENTE</span>`;
                } else if (p._categoriaBusqueda === 'DIRECCION') {
                    badgeHTML = `<span class="cyber-sug-badge badge-dir">📍 DIR LOCAL</span>`;
                } else {
                    badgeHTML = `<span class="cyber-sug-badge">#STOP ${sec}</span>`;
                }

                return `
                    <li class="cyber-sugerencia-item" data-type="parada" data-id="${uid}">
                        ${badgeHTML}
                        <div class="cyber-sug-info">
                            <strong>#Stop ${sec} - ${nombreCliente}</strong>
                            <small>${direccionTexto}</small>
                        </div>
                    </li>
                `;
            }).join("");
        }

        html += `
            <li class="cyber-sugerencia-item" data-type="geocode" data-query="${queryOriginal}">
                <span class="cyber-sug-badge badge-geo">📍 GEO</span>
                <div class="cyber-sug-info">
                    <strong>Geocodificar: "${queryOriginal}"</strong>
                    <small>Señalar punto exacto en el mapa</small>
                </div>
            </li>
        `;

        listaSugerencias.innerHTML = html;
        listaSugerencias.style.display = "block";

        listaSugerencias.querySelectorAll(".cyber-sugerencia-item").forEach((item) => {
            item.addEventListener("click", () => {
                const type = item.getAttribute("data-type");
                if (type === "parada") {
                    const id = item.getAttribute("data-id");
                    const seleccionada = coincidencias.find(p => obtenerIdUnicoParada(p) === id);
                    if (seleccionada) {
                        this.seleccionarParadaBuscada(seleccionada);
                    } else {
                        console.warn("⚠️ [MAPA_EVENTOS]: No se localizó la parada seleccionada en el set de datos:", id);
                    }
                } else if (type === "geocode") {
                    this.ejecutarGeocodificacionDireccion(queryOriginal);
                }
                listaSugerencias.style.display = "none";
            });
        });
    },

    seleccionarParadaBuscada(parada) {
        console.log("⚡ [MAPA_EVENTOS]: Parada seleccionada en búsqueda:", parada);

        if (typeof enfocarParadaEnMapa === "function") {
            enfocarParadaEnMapa(parada);
        } else if (typeof window.enfocarParadaEnMapa === "function") {
            window.enfocarParadaEnMapa(parada);
        }

        this.mostrarTarjetaDetalle(parada);
        this.calcularYRenderizarParadasCercanas(parada);
    },

    ejecutarGeocodificacionDireccion(direccion) {
        if (!direccion) return;
        const mapa = this.mapaInstancia || window.mapaMensajero || window.mapaInstanciaGlobal;

        if (typeof google === "undefined" || !google.maps || !mapa) {
            console.warn("⚠️ [BUSQUEDA_MAPA_WARN]: Google Maps SDK no está inicializado.");
            return;
        }

        const geocoder = new google.maps.Geocoder();
        const query = direccion.toLowerCase().includes("cali") ? direccion : `${direccion}, Cali, Colombia`;

        geocoder.geocode({ address: query }, (results, status) => {
            if (status === "OK" && results && results[0]) {
                const ubicacionActual = results[0].geometry.location;
                const dirFormateada = results[0].formatted_address;

                mapa.setCenter(ubicacionActual);
                mapa.setZoom(16);

                if (marcadorBusquedaTemp && typeof marcadorBusquedaTemp.setMap === "function") {
                    marcadorBusquedaTemp.setMap(null);
                }

                marcadorBusquedaTemp = new google.maps.Marker({
                    position: ubicacionActual,
                    map: mapa,
                    draggable: true,
                    icon: crearIconoParadaRadarSVG("#ff007f", "#ffffff"),
                    title: `📍 ${dirFormateada}`
                });

                marcadorBusquedaTemp.addListener("click", () => {
                    const pos = marcadorBusquedaTemp.getPosition();
                    desplegarFormularioConDireccion(dirFormateada, pos.lat(), pos.lng());
                });

                console.log(`✅ [GEOCODE_OK]: Punto marcado en ${dirFormateada}`);
            } else {
                console.error("❌ [GEOCODE_ERROR]: Geocodificación fallida:", status);
            }
        });
    },

    mostrarTarjetaDetalle(parada) {
        const card = document.getElementById("tarjeta-detalle-parada");
        if (!card) return;

        const sec = parada.secuencia || parada.orden || parada.secuenciaZona || 1;
        const nombreCliente = parada.destinatario || parada.cliente || parada.nombre_cliente || parada.nombre || "Cliente N/A";

        const elemSec = document.getElementById("card-stop-secuencia");
        const elemEst = document.getElementById("card-stop-estado");
        const elemDest = document.getElementById("card-stop-destinatario");
        const elemDir = document.getElementById("card-stop-direccion");
        const elemTel = document.getElementById("card-stop-telefono");

        if (elemSec) elemSec.textContent = `#STOP ${sec}`;
        if (elemEst) elemEst.textContent = (parada.estado || "ASIGNADO").toUpperCase();
        if (elemDest) elemDest.textContent = nombreCliente;
        if (elemDir) elemDir.textContent = `📍 ${parada.direccion || parada.dir || 'N/A'}`;
        if (elemTel) elemTel.textContent = `📞 ${parada.telefono || parada.tel || 'N/A'}`;

        card.style.display = "block";
    },

    async calcularYRenderizarParadasCercanas(paradaOrigen) {
        const contenedor = document.getElementById("contenedor-paradas-cercanas");
        if (!contenedor) return;

        const paradas = await this.obtenerColeccionParadas();
        const latO = parseFloat(paradaOrigen.lat || paradaOrigen.latitud || paradaOrigen.latitud_num);
        const lngO = parseFloat(paradaOrigen.lng || paradaOrigen.longitud || paradaOrigen.longitud_num);

        if (isNaN(latO) || isNaN(lngO)) {
            contenedor.innerHTML = `<span class="cyber-cercana-empty">Coordenadas no válidas</span>`;
            return;
        }

        const idOrigen = obtenerIdUnicoParada(paradaOrigen);

        const conDistancias = paradas
            .filter(p => obtenerIdUnicoParada(p) !== idOrigen)
            .map(p => {
                const latD = parseFloat(p.lat || p.latitud || p.latitud_num);
                const lngD = parseFloat(p.lng || p.longitud || p.longitud_num);
                const distM = calcularDistanciaHaversine(latO, lngO, latD, lngD);
                return { ...p, distanciaMetros: distM };
            })
            .filter(p => p.distanciaMetros !== Infinity && !isNaN(p.distanciaMetros))
            .sort((a, b) => a.distanciaMetros - b.distanciaMetros)
            .slice(0, 3);

        if (conDistancias.length === 0) {
            contenedor.innerHTML = `<span class="cyber-cercana-empty">Sin paradas cercanas</span>`;
            return;
        }

        contenedor.innerHTML = conDistancias.map(p => {
            const distTexto = p.distanciaMetros >= 1000 
                ? `${(p.distanciaMetros / 1000).toFixed(2)} km` 
                : `${Math.round(p.distanciaMetros)} m`;
            const sec = p.secuencia || p.orden || p.secuenciaZona || "?";
            const uid = obtenerIdUnicoParada(p);
            const nombreCliente = p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "Cliente";

            return `
                <button type="button" class="btn-parada-cercana" data-id="${uid}">
                    <span>#Stop ${sec} (${distTexto})</span>
                    <small>${nombreCliente}</small>
                </button>
            `;
        }).join("");

        contenedor.querySelectorAll(".btn-parada-cercana").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const destino = paradas.find(p => obtenerIdUnicoParada(p) === id);
                if (destino) {
                    this.seleccionarParadaBuscada(destino);
                }
            });
        });
    },

    ejecutarZoom(delta) {
        if (!this.mapaInstancia) {
            this.mapaInstancia = window.mapaMensajero || window.mapaInstanciaGlobal;
        }
        if (!this.mapaInstancia) return;

        if (typeof this.mapaInstancia.getZoom === 'function') {
            const currentZoom = this.mapaInstancia.getZoom();
            this.mapaInstancia.setZoom(currentZoom + delta);
        }
    },

    alternarBloqueoMapa(estadoForzado = null) {
        if (!this.mapaInstancia) {
            this.mapaInstancia = window.mapaMensajero || window.mapaInstanciaGlobal;
        }

        const btnToggleLock = document.getElementById('btn-toggle-lock');
        const iconLockState = document.getElementById('icon-lock-state');

        let estaBloqueado = btnToggleLock ? btnToggleLock.getAttribute('data-locked') === 'true' : false;
        if (estadoForzado !== null) {
            estaBloqueado = !estadoForzado;
        }

        const nuevoEstado = !estaBloqueado;

        if (btnToggleLock) {
            btnToggleLock.setAttribute('data-locked', nuevoEstado ? 'true' : 'false');
        }

        if (iconLockState) {
            iconLockState.textContent = nuevoEstado ? '🔒' : '🔓';
        }

        if (this.mapaInstancia && typeof this.mapaInstancia.setOptions === 'function') {
            this.mapaInstancia.setOptions({
                draggable: !nuevoEstado,
                scrollwheel: !nuevoEstado,
                disableDoubleClickZoom: nuevoEstado
            });
        }

        try {
            localStorage.setItem(KEY_PERSISTENCIA_LOCK, JSON.stringify(nuevoEstado));
        } catch (err) {
            console.warn("⚠️ Error en persistencia de bloqueo:", err);
        }
    },

    restaurarEstadoBloqueo() {
        try {
            const estadoGuardado = localStorage.getItem(KEY_PERSISTENCIA_LOCK);
            if (estadoGuardado !== null) {
                const estaBloqueado = JSON.parse(estadoGuardado);
                if (estaBloqueado) {
                    this.alternarBloqueoMapa(true);
                }
            }
        } catch (err) {
            console.warn("⚠️ Error al recuperar estado de bloqueo:", err);
        }
    }
};

function desplegarFormularioConDireccion(direccion, lat, lng) {
    if (typeof window.navegarA === "function") {
        window.navegarA("vistas/ruta/ruta-activa.html");
    } else if (typeof window.alternarVistaPestaña === "function") {
        window.alternarVistaPestaña("pestana-ruta-activa");
    }

    setTimeout(() => {
        const inputDir = document.getElementById("edit-parada-direccion");
        if (inputDir) inputDir.value = direccion;
    }, 120);
}

export function activarModoSeleccionMapaUI() {
    modoCrearParadaActivo = !modoCrearParadaActivo;
}

export function registrarEventosClicMapa(callbackNuevaParada) {}

export function toggleBuscadorMapaUI() {
    const inputBuscador = document.getElementById("buscador-paradas-mapa");
    if (inputBuscador) {
        inputBuscador.focus();
    }
}

export function ejecutarBusquedaDireccion(dir) {
    mapaEventos.ejecutarGeocodificacionDireccion(dir);
}

// Global Bindings
window.toggleBuscadorMapaUI = toggleBuscadorMapaUI;
window.ejecutarBusquedaDireccion = ejecutarBusquedaDireccion;
window.ejecutarBusquedaParadas = (query) => mapaEventos.ejecutarFiltradoParadas(query);

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
        mapaEventos.inicializarBuscadorMapa();
    });
}