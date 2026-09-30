/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE BÚSQUEDA MULTIMODAL Y ENFOQUE POR ZONA
 * Ubicación: pwa-mensajero/modulos/mapa/eventos/mapa-buscador.js
 * Arquitectura: Multimodal / Local-First Query / Haversine
 */

import { crearIconoParadaRadarSVG } from "../mapa-iconos.js";
import { calcularDistanciaHaversine } from "../zonificacion/mensajero-zonificacion.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../zonificacion/estandar-zonas.js";
import { enfocarParadaEnMapa, enfocarYResaltarGrupoSCC } from "../core/mapa-lienzo.js";
import { obtenerParadasGuardadas } from "../../mensajero-persistencia.js";

const KEY_ULTIMA_PARADA = 'macondo_ultima_parada_id';
let debounceTimerBuscador = null;
let marcadorBusquedaTemp = null;

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

function obtenerIdUnicoParada(p) {
    if (!p) return "";
    return String(p.id || p.scc || p.ssc || p.idParada || p.id_parada || p.secuencia || p.orden || "").trim();
}

function clasificarIntencionBusqueda(query) {
    const qNorm = normalizarTextoBusqueda(query);
    const patronStopExplicito = /^(?:#\s*|stop\s+)(\d+)$/i;
    const matchStop = qNorm.match(patronStopExplicito);

    if (matchStop) {
        return {
            tipo: 'STOP',
            valorLimpio: qNorm,
            numeroStop: parseInt(matchStop[1], 10)
        };
    }

    return {
        tipo: 'MULTIMODAL',
        valorLimpio: qNorm,
        numeroStop: isNaN(qNorm) ? null : parseInt(qNorm, 10)
    };
}

export const mapaBuscador = {
    inicializar() {
        console.log("🔍 [MAPA_BUSCADOR]: Inicializando Buscador Multimodal SCC con soporte de Zonas.");

        const inputBuscador = document.getElementById("buscador-paradas-mapa") || document.getElementById("input-filtrar-paradas");
        const listaSugerencias = document.getElementById("sugerencias-paradas-mapa") || document.getElementById("sugerencias-busqueda-mapa") || document.querySelector(".cyber-sugerencias-lista");
        const btnLimpiar = document.getElementById("btn-limpiar-busqueda") || document.querySelector(".cyber-btn-clear");
        const btnCerrarCard = document.getElementById("btn-cerrar-tarjeta");
        const btnEnfocarUltimaParada = document.getElementById('btn-enfocar-ultimo-grupo') || document.getElementById('btn-enfocar-ultima-parada');

        if (btnEnfocarUltimaParada) {
            const manejarEnfoqueUltimaParada = async (e) => {
                if (e) e.preventDefault();
                console.log("🎯 [MAPA_BUSCADOR]: Solicitud de enfoque rápido sobre la última parada...");

                const paradas = await this.obtenerColeccionParadas();
                if (!Array.isArray(paradas) || paradas.length === 0) return;

                const idUltimaGuardada = localStorage.getItem(KEY_ULTIMA_PARADA);
                let paradaObjetivo = null;

                if (idUltimaGuardada) {
                    paradaObjetivo = paradas.find(p => obtenerIdUnicoParada(p) === String(idUltimaGuardada).trim());
                }

                if (!paradaObjetivo) {
                    paradaObjetivo = paradas[paradas.length - 1];
                }

                if (paradaObjetivo) {
                    this.seleccionarParadaBuscada(paradaObjetivo);
                }
            };

            btnEnfocarUltimaParada.addEventListener("click", manejarEnfoqueUltimaParada);
            btnEnfocarUltimaParada.addEventListener("touchend", manejarEnfoqueUltimaParada);
        }

        if (!inputBuscador) return;

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
            }, 150);
        });

        inputBuscador.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(debounceTimerBuscador);
                const query = inputBuscador.value.trim();
                if (query.length > 0) {
                    this.ejecutarFiltradoParadas(query);
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
                const card = document.getElementById("tarjeta-detalle-parada") || document.getElementById("tarjeta-detalle-parada-mapa");
                if (card) card.style.display = "none";
            });
        }
    },

    async obtenerColeccionParadas() {
        let paradas = await obtenerParadasGuardadas();
        if (!Array.isArray(paradas) || paradas.length === 0) {
            paradas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
        }

        paradas.sort((a, b) => {
            const seqA = parseInt(a.consecutivoZona || a.secuenciaZona || a.orden || 0, 10);
            const seqB = parseInt(b.consecutivoZona || b.secuenciaZona || b.orden || 0, 10);
            return seqA - seqB;
        });

        return paradas;
    },

    async ejecutarFiltradoParadas(query) {
        const paradas = await this.obtenerColeccionParadas();
        const intencion = clasificarIntencionBusqueda(query);
        const qNorm = intencion.valorLimpio;
        let resultados = [];

        if (intencion.tipo === 'STOP') {
            resultados = paradas.filter((p, idx) => {
                const sec = parseInt(p.consecutivoZona || p.secuenciaZona || p.orden || (idx + 1), 10);
                return sec === intencion.numeroStop;
            }).map(p => ({ ...p, _categoriaBusqueda: 'STOP' }));
        } else {
            resultados = paradas.filter((p, idx) => {
                const sccVal = normalizarTextoBusqueda(p.scc || p.ssc || p.id_scc || p.codigo_scc || "");
                const clienteVal = normalizarTextoBusqueda(p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "");
                const dirVal = normalizarTextoBusqueda(p.direccion || p.dir || "");
                const secVal = String(p.consecutivoZona || p.secuenciaZona || p.orden || (idx + 1));

                const coincideSCC = sccVal.length > 0 && sccVal.includes(qNorm);
                const coincideStop = secVal === qNorm;
                const coincideTexto = clienteVal.includes(qNorm) || dirVal.includes(qNorm);

                if (coincideSCC) p._categoriaBusqueda = 'SCC';
                else if (coincideStop) p._categoriaBusqueda = 'STOP';
                else if (coincideTexto) p._categoriaBusqueda = 'GENERAL';

                return coincideSCC || coincideStop || coincideTexto;
            });
        }

        this.renderizarSugerencias(resultados, query);
    },

    renderizarSugerencias(coincidencias, queryOriginal) {
        const listaSugerencias = document.getElementById("sugerencias-paradas-mapa") || document.getElementById("sugerencias-busqueda-mapa") || document.querySelector(".cyber-sugerencias-lista");
        if (!listaSugerencias) return;

        let html = "";

        if (coincidencias.length > 0) {
            html += coincidencias.map((p, idx) => {
                const zonaLabel = estandarizarZonaCanonica(obtenerZonaParadaCanonica(p));
                const sec = p.consecutivoZona || p.secuenciaZona || p.orden || (idx + 1);
                const uid = obtenerIdUnicoParada(p);
                const scc = p.scc || p.ssc || uid || "N/A";
                const cliente = p.destinatario || p.cliente || "Cliente N/A";
                const direccionTexto = p.direccion || p.dir || "Sin dirección";

                let badgeHTML = `
                    <span class="badge-zona-cyberpunk">${zonaLabel}</span>
                    <span class="badge-stop-cyberpunk">STOP #${sec}</span>
                `;

                if (p._categoriaBusqueda === 'SCC') {
                    badgeHTML += `<span class="cyber-sug-badge badge-scc" style="background:#00e5ff; color:#000;">SCC</span>`;
                }

                return `
                    <li class="cyber-sugerencia-item" data-type="parada" data-id="${uid}" data-zona="${zonaLabel}" data-consecutivo="${sec}">
                        <div class="header-card-busqueda">
                            ${badgeHTML}
                        </div>
                        <div class="cyber-sug-info">
                            <strong>SCC: ${scc} — ${cliente}</strong>
                            <small>📍 ${direccionTexto}</small>
                        </div>
                    </li>
                `;
            }).join("");
        }

        html += `
            <li class="cyber-sugerencia-item" data-type="geocode" data-query="${queryOriginal}">
                <span class="cyber-sug-badge badge-geo" style="background:#39ff14; color:#000;">📍 GEO</span>
                <div class="cyber-sug-info">
                    <strong>Geocodificar: "${queryOriginal}"</strong>
                    <small>Señalar punto exacto en el mapa</small>
                </div>
            </li>
        `;

        listaSugerencias.innerHTML = html;
        listaSugerencias.style.display = "block";

        listaSugerencias.querySelectorAll(".cyber-sugerencia-item").forEach((item) => {
            const seleccionar = (e) => {
                if (e) e.preventDefault();
                const type = item.getAttribute("data-type");
                if (type === "parada") {
                    const id = item.getAttribute("data-id");
                    const zona = item.getAttribute("data-zona");
                    const consecutivo = item.getAttribute("data-consecutivo");
                    const seleccionada = coincidencias.find(p => obtenerIdUnicoParada(p) === id && estandarizarZonaCanonica(obtenerZonaParadaCanonica(p)) === zona);
                    
                    if (seleccionada) {
                        this.seleccionarParadaBuscada(seleccionada);
                    } else if (coincidencias.length > 0) {
                        this.seleccionarParadaBuscada(coincidencias[0]);
                    }
                } else if (type === "geocode") {
                    this.ejecutarGeocodificacionDireccion(queryOriginal);
                }
                listaSugerencias.style.display = "none";
            };

            item.addEventListener("click", seleccionar);
            item.addEventListener("touchend", seleccionar);
        });
    },

    seleccionarParadaBuscada(parada) {
        const uid = obtenerIdUnicoParada(parada);
        const zonaLabel = estandarizarZonaCanonica(obtenerZonaParadaCanonica(parada));
        const consecutivo = parada.consecutivoZona || parada.secuenciaZona || 1;
        const claveUnica = `${uid}_${zonaLabel}_${consecutivo}`;

        if (uid) {
            try {
                localStorage.setItem(KEY_ULTIMA_PARADA, uid);
            } catch (err) {
                console.warn("⚠️ Error guardando última parada cliqueada:", err);
            }
        }

        if (typeof window.centrarMapaEnParadaPorClave === "function") {
            window.centrarMapaEnParadaPorClave({
                idParada: uid,
                zona: zonaLabel,
                consecutivoZona: consecutivo,
                claveUnica
            });
        } else if (typeof enfocarParadaEnMapa === "function") {
            enfocarParadaEnMapa(parada);
        }

        if (typeof window.mostrarDetalleParadaEnLienzo === "function") {
            window.mostrarDetalleParadaEnLienzo(parada);
        } else {
            this.mostrarTarjetaDetalle(parada);
            this.calcularYRenderizarParadasCercanas(parada);
        }
    },

    ejecutarGeocodificacionDireccion(direccion) {
        if (!direccion) return;
        const mapa = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;

        if (typeof google === "undefined" || !google.maps || !mapa) {
            console.warn("⚠️ [BUSQUEDA_MAPA_WARN]: Google Maps SDK no disponible.");
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
            } else {
                console.error("❌ [GEOCODE_ERROR]: Geocodificación fallida:", status);
            }
        });
    },

    mostrarTarjetaDetalle(parada) {
        const card = document.getElementById("tarjeta-detalle-parada") || document.getElementById("tarjeta-detalle-parada-mapa");
        if (!card) return;

        const zonaLabel = estandarizarZonaCanonica(obtenerZonaParadaCanonica(parada));
        const sec = parada.consecutivoZona || parada.secuenciaZona || parada.orden || 1;
        const nombreCliente = parada.destinatario || parada.cliente || parada.nombre_cliente || parada.nombre || "Cliente N/A";

        const elemSec = document.getElementById("card-stop-secuencia");
        const elemGrupo = document.getElementById("card-stop-grupo");
        const elemSCC = document.getElementById("card-stop-scc");
        const elemEst = document.getElementById("card-stop-estado");
        const elemDest = document.getElementById("card-stop-destinatario");
        const elemDir = document.getElementById("card-stop-direccion");
        const elemTel = document.getElementById("card-stop-telefono");

        if (elemSec) elemSec.textContent = `#STOP ${sec}`;
        if (elemGrupo) elemGrupo.textContent = zonaLabel;
        if (elemSCC) elemSCC.textContent = `SCC: ${parada.scc || parada.ssc || 'N/A'}`;
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
        const zonaOrigen = estandarizarZonaCanonica(obtenerZonaParadaCanonica(paradaOrigen));

        const conDistancias = paradas
            .filter(p => obtenerIdUnicoParada(p) !== idOrigen && estandarizarZonaCanonica(obtenerZonaParadaCanonica(p)) === zonaOrigen)
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
            contenedor.innerHTML = `<span class="cyber-cercana-empty">Sin paradas cercanas en esta zona</span>`;
            return;
        }

        contenedor.innerHTML = conDistancias.map(p => {
            const distTexto = p.distanciaMetros >= 1000 
                ? `${(p.distanciaMetros / 1000).toFixed(2)} km` 
                : `${Math.round(p.distanciaMetros)} m`;
            const sec = p.consecutivoZona || p.secuenciaZona || p.orden || "?";
            const uid = obtenerIdUnicoParada(p);
            const nombreCliente = p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "Cliente";

            return `
                <button type="button" class="btn-parada-cercana" data-id="${uid}" data-zona="${zonaOrigen}" data-consecutivo="${sec}">
                    <span>#Stop ${sec} (${distTexto})</span>
                    <small>${nombreCliente}</small>
                </button>
            `;
        }).join("");

        contenedor.querySelectorAll(".btn-parada-cercana").forEach(btn => {
            const seleccionar = (e) => {
                if (e) e.preventDefault();
                const id = btn.getAttribute("data-id");
                const zona = btn.getAttribute("data-zona");
                const consecutivo = btn.getAttribute("data-consecutivo");
                const destino = paradas.find(p => obtenerIdUnicoParada(p) === id && estandarizarZonaCanonica(obtenerZonaParadaCanonica(p)) === zona);
                if (destino) {
                    this.seleccionarParadaBuscada(destino);
                }
            };

            btn.addEventListener("click", seleccionar);
            btn.addEventListener("touchend", seleccionar);
        });
    }
};

if (typeof window !== "undefined") {
    window.mapaBuscador = mapaBuscador;
}