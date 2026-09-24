/**
 * PROTOCOLO MACONDO - EVENTOS, BUSCADOR MULTICRITERIO Y CONTROLES DEL MAPA
 * Ubicación: modulos/mapa/mapa-eventos.js
 */

import { crearIconoParadaRadarSVG } from "./mapa-iconos.js";
import { calcularDistanciaHaversine } from "./zonificacion/mensajero-zonificacion.js";
import { enfocarParadaEnMapa } from "./mapa-visor.js";
import { IndexedStore } from "../db/indexed-store.js";

const KEY_PERSISTENCIA_LOCK = 'map_interaction_locked';

let modoCrearParadaActivo = false;
let listenerClicMapa = null;
let marcadorBusquedaTemp = null;

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
        this.mapaInstancia = mapa;
        console.log('⚡ [MAPA_EVENTOS]: Asignando listeners a los controles del mapa.');

        const btnZoomIn = document.getElementById('btn-zoom-in');
        const btnZoomOut = document.getElementById('btn-zoom-out');
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

        inputBuscador.addEventListener("input", (e) => {
            const query = e.target.value;
            if (btnLimpiar) btnLimpiar.style.display = query.trim().length > 0 ? "block" : "none";

            if (query.trim().length === 0) {
                if (listaSugerencias) {
                    listaSugerencias.style.display = "none";
                    listaSugerencias.innerHTML = "";
                }
                return;
            }

            this.ejecutarFiltradoParadas(query);
        });

        inputBuscador.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
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
                if (marcadorBusquedaTemp) {
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
     * Recupera la lista activa de paradas desde la memoria global o IndexedDB
     * @returns {Promise<Array<Object>>}
     */
    async obtenerColeccionParadas() {
        // Prioridad 1: Objetos globales en memoria activa
        if (Array.isArray(window.paradasRutaActiva) && window.paradasRutaActiva.length > 0) {
            return window.paradasRutaActiva;
        }
        if (Array.isArray(window.pedidosGlobales) && window.pedidosGlobales.length > 0) {
            window.paradasRutaActiva = window.pedidosGlobales;
            return window.paradasRutaActiva;
        }

        // Prioridad 2: Base de Datos Local IndexedDB
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
                return window.paradasRutaActiva;
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
                const sec = parseInt(p.secuencia || p.orden || index + 1, 10);
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

        // Búsqueda amplia si el filtro estricto por categoría no produce coincidencia
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
                const sec = p.secuencia || p.orden || idx + 1;
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
                    <li class="cyber-sugerencia-item" data-type="parada" data-id="${p.id || sec}">
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
                    const seleccionada = coincidencias.find(p => (p.id || (p.secuencia || p.orden)).toString() === id.toString());
                    if (seleccionada) {
                        this.seleccionarParadaBuscada(seleccionada);
                    }
                } else if (type === "geocode") {
                    this.ejecutarGeocodificacionDireccion(queryOriginal);
                }
                listaSugerencias.style.display = "none";
            });
        });
    },

    seleccionarParadaBuscada(parada) {
        console.log("⚡ [MAPA_EVENTOS]: Parada seleccionada:", parada);

        if (typeof enfocarParadaEnMapa === "function") {
            enfocarParadaEnMapa(parada);
        }

        this.mostrarTarjetaDetalle(parada);
        this.calcularYRenderizarParadasCercanas(parada);
    },

    ejecutarGeocodificacionDireccion(direccion) {
        if (!direccion) return;
        const mapa = window.mapaMensajero || window.mapaInstancia;

        if (typeof google === "undefined" || !google.maps || !mapa) {
            console.warn("⚠️ [BUSQUEDA_MAPA_WARN]: Google Maps SDK no está inicializado.");
            return;
        }

        const geocoder = new google.maps.Geocoder();
        const query = direccion.toLowerCase().includes("cali") ? direccion : `${direccion}, Cali, Colombia`;

        geocoder.geocode({ address: query }, (results, status) => {
            if (status === "OK" && results[0]) {
                let ubicacionActual = results[0].geometry.location;
                let dirFormateada = results[0].formatted_address;

                mapa.setCenter(ubicacionActual);
                mapa.setZoom(16);

                if (marcadorBusquedaTemp) {
                    marcadorBusquedaTemp.setMap(null);
                }

                marcadorBusquedaTemp = new google.maps.Marker({
                    position: ubicacionActual,
                    map: mapa,
                    draggable: true,
                    icon: crearIconoParadaRadarSVG("#ff007f", "#ffffff"),
                    title: `📍 ${dirFormateada}`
                });

                const actualizarInfoWindow = (direccionTexto) => {
                    if (window.infoWindowMensajero) {
                        const infoContent = `
                            <div style="background: #0c080f; color: #fff; padding: 10px; border: 1px solid #ff007f; font-family: 'Fira Code', monospace; font-size: 0.78rem; border-radius: 6px; text-align: center; max-width: 220px;">
                                <strong style="color: #ff007f;">[📍 UBICACIÓN SELECCIONADA]</strong><br/>
                                <span style="display:inline-block; margin: 4px 0; color: #e0e0e0;">${direccionTexto}</span><br/>
                                <small style="color: #00ff66;">👉 Clic para agregar parada</small><br/>
                                <button type="button" onclick="window.confirmarParadaDesdePinBusqueda()" style="margin-top: 8px; background: #ff007f; color: #fff; border: none; padding: 10px; font-weight: bold; font-size: 0.75rem; cursor: pointer; border-radius: 4px; width: 100%; min-height: 44px;">
                                    ➕ DESPLEGAR FORMULARIO
                                </button>
                            </div>`;
                        window.infoWindowMensajero.setContent(infoContent);
                        window.infoWindowMensajero.open(mapa, marcadorBusquedaTemp);
                    }
                };

                actualizarInfoWindow(dirFormateada);

                window.confirmarParadaDesdePinBusqueda = function() {
                    const pos = marcadorBusquedaTemp.getPosition();
                    desplegarFormularioConDireccion(dirFormateada, pos.lat(), pos.lng());
                };

                marcadorBusquedaTemp.addListener("click", () => {
                    const pos = marcadorBusquedaTemp.getPosition();
                    desplegarFormularioConDireccion(dirFormateada, pos.lat(), pos.lng());
                });

                console.log(`✅ [GEOCODE_OK]: Punto marcado en ${dirFormateada}`);
            } else {
                alert("⚠️ No se logró ubicar la dirección ingresada en el mapa.");
            }
        });
    },

    mostrarTarjetaDetalle(parada) {
        const card = document.getElementById("tarjeta-detalle-parada");
        if (!card) return;

        const sec = parada.secuencia || parada.orden || 1;
        const nombreCliente = parada.destinatario || parada.cliente || parada.nombre_cliente || parada.nombre || "Cliente N/A";

        document.getElementById("card-stop-secuencia").textContent = `#STOP ${sec}`;
        document.getElementById("card-stop-estado").textContent = (parada.estado || "ASIGNADO").toUpperCase();
        document.getElementById("card-stop-destinatario").textContent = nombreCliente;
        document.getElementById("card-stop-direccion").textContent = `📍 ${parada.direccion || parada.dir || 'N/A'}`;
        document.getElementById("card-stop-telefono").textContent = `📞 ${parada.telefono || parada.tel || 'N/A'}`;

        card.style.display = "block";
    },

    async calcularYRenderizarParadasCercanas(paradaOrigen) {
        const contenedor = document.getElementById("contenedor-paradas-cercanas");
        if (!contenedor) return;

        const paradas = await this.obtenerColeccionParadas();
        const latO = parseFloat(paradaOrigen.lat || paradaOrigen.latitud);
        const lngO = parseFloat(paradaOrigen.lng || paradaOrigen.longitud);

        if (isNaN(latO) || isNaN(lngO)) {
            contenedor.innerHTML = `<span class="cyber-cercana-empty">Coordenadas no válidas</span>`;
            return;
        }

        const conDistancias = paradas
            .filter(p => (p.id || p.secuencia) !== (paradaOrigen.id || paradaOrigen.secuencia))
            .map(p => {
                const latD = parseFloat(p.lat || p.latitud);
                const lngD = parseFloat(p.lng || p.longitud);
                const distM = calcularDistanciaHaversine(latO, lngO, latD, lngD);
                return { ...p, distanciaMetros: distM };
            })
            .filter(p => p.distanciaMetros !== Infinity)
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
            const sec = p.secuencia || p.orden || "?";
            const nombreCliente = p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "Cliente";

            return `
                <button type="button" class="btn-parada-cercana" data-id="${p.id || sec}">
                    <span>#Stop ${sec} (${distTexto})</span>
                    <small>${nombreCliente}</small>
                </button>
            `;
        }).join("");

        contenedor.querySelectorAll(".btn-parada-cercana").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const destino = paradas.find(p => (p.id || (p.secuencia || p.orden)).toString() === id.toString());
                if (destino) {
                    this.seleccionarParadaBuscada(destino);
                }
            });
        });
    },

    ejecutarZoom(delta) {
        if (!this.mapaInstancia) {
            this.mapaInstancia = window.mapaMensajero || window.mapaInstancia;
        }
        if (!this.mapaInstancia) return;

        if (typeof this.mapaInstancia.getZoom === 'function') {
            const currentZoom = this.mapaInstancia.getZoom();
            this.mapaInstancia.setZoom(currentZoom + delta);
        }
    },

    alternarBloqueoMapa(estadoForzado = null) {
        if (!this.mapaInstancia) {
            this.mapaInstancia = window.mapaMensajero || window.mapaInstancia;
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

        if (this.mapaInstancia) {
            if (typeof this.mapaInstancia.setOptions === 'function') {
                this.mapaInstancia.setOptions({
                    draggable: !nuevoEstado,
                    scrollwheel: !nuevoEstado,
                    disableDoubleClickZoom: nuevoEstado
                });
            }
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
    } else {
        const pestanaRuta = document.getElementById("pestana-ruta-activa");
        if (pestanaRuta) {
            document.querySelectorAll(".contenedor-pestana").forEach((p) => p.classList.remove("activa"));
            document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));
            pestanaRuta.classList.add("activa");
        }
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
    if (inputBuscador) inputBuscador.focus();
}

export function ejecutarBusquedaDireccion(dir) {
    mapaEventos.ejecutarGeocodificacionDireccion(dir);
}

window.toggleBuscadorMapaUI = toggleBuscadorMapaUI;
window.ejecutarBusquedaDireccion = ejecutarBusquedaDireccion;

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
        mapaEventos.inicializarBuscadorMapa();
    });
}