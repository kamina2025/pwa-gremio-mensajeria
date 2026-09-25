/**
 * PROTOCOLO MACONDO - EVENTOS, BUSCADOR MULTIMODAL Y ESCÁNER TÁCTICO SCC
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-eventos.js
 * Arquitectura: Google Maps SDK / Local-First / BarcodeDetector / Android Secure Context
 */

import { crearIconoParadaRadarSVG } from "./mapa-iconos.js";
import { calcularDistanciaHaversine } from "./zonificacion/mensajero-zonificacion.js";
import { enfocarParadaEnMapa, recargarMapaCompleto, enfocarYResaltarGrupoSCC } from "./mapa-visor.js";
import { obtenerParadasGuardadas } from "../mensajero-persistencia.js";

const KEY_PERSISTENCIA_LOCK = 'map_interaction_locked';

let modoCrearParadaActivo = false;
let mediaStreamCamara = null;
let animFrameScanner = null;
let debounceTimerBuscador = null;
let marcadorBusquedaTemp = null;

/**
 * Normaliza cadenas eliminando diacríticos, tildes y espacios superfluos.
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
    return String(p.id || p.scc || p.ssc || p.idParada || p.id_parada || p.secuencia || p.orden || "").trim();
}

/**
 * Clasifica la intención de búsqueda preservando la compatibilidad con el código SCC.
 * @param {string} query 
 * @returns {Object}
 */
function clasificarIntencionBusqueda(query) {
    const qNorm = normalizarTextoBusqueda(query);

    // Detección estricta de orden de parada solo si viene antecedido por # o la palabra STOP
    const patronStopExplicito = /^(?:#\s*|stop\s+)(\d+)$/i;
    const matchStop = qNorm.match(patronStopExplicito);

    if (matchStop) {
        return {
            tipo: 'STOP',
            valorLimpio: qNorm,
            numeroStop: parseInt(matchStop[1], 10)
        };
    }

    // Clasificación Multimodal Unificada (SCC / Secuencia / Cliente / Dirección)
    return {
        tipo: 'MULTIMODAL',
        valorLimpio: qNorm,
        numeroStop: isNaN(qNorm) ? null : parseInt(qNorm, 10)
    };
}

export const mapaEventos = {
    mapaInstancia: null,

    inicializarControles(mapa) {
        this.mapaInstancia = mapa || window.mapaMensajero || window.mapaInstanciaGlobal;
        console.log('⚡ [MAPA_EVENTOS]: Asignando listeners a los controles del mapa y escáner SCC.');

        const btnZoomIn = document.getElementById('btn-zoom-in');
        const btnZoomOut = document.getElementById('btn-zoom-out');
        const btnRefresh = document.getElementById('btn-refresh-map') || document.getElementById('btn-refrescar-mapa');
        const btnToggleLock = document.getElementById('btn-toggle-lock');
        const btnEscanear = document.getElementById('btn-escanear-scc');
        const btnCerrarScanner = document.getElementById('btn-cerrar-escanner');

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
                    if (typeof recargarMapaCompleto === "function") {
                        await recargarMapaCompleto();
                    } else if (typeof window.recargarMapaCompleto === "function") {
                        await window.recargarMapaCompleto();
                    } else if (typeof window.ejecutarRefrescoLocalMapa === "function") {
                        await window.ejecutarRefrescoLocalMapa();
                    }
                    console.log("✅ [MAPA_EVENTOS]: Sincronización Local-First del mapa completada.");
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

        if (btnEscanear) {
            btnEscanear.onclick = (e) => {
                e.preventDefault();
                this.iniciarEscanerCamaraSCC();
            };
        }

        if (btnCerrarScanner) {
            btnCerrarScanner.onclick = () => {
                this.detenerEscanerCamaraSCC();
            };
        }

        this.inicializarBuscadorMapa();
    },

    inicializarBuscadorMapa() {
        console.log("🔍 [MAPA_EVENTOS]: Inicializando Buscador Multimodal SCC con Identificador de Patrón.");

        const inputBuscador = document.getElementById("buscador-paradas-mapa");
        const listaSugerencias = document.getElementById("sugerencias-paradas-mapa");
        const btnLimpiar = document.getElementById("btn-limpiar-busqueda");
        const btnCerrarCard = document.getElementById("btn-cerrar-tarjeta");

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
                const card = document.getElementById("tarjeta-detalle-parada");
                if (card) card.style.display = "none";
            });
        }
    },

    /**
     * Recupera la lista activa de paradas desde IndexedDB o RAM.
     * @returns {Promise<Array<Object>>}
     */
    async obtenerColeccionParadas() {
        let paradas = await obtenerParadasGuardadas();
        if (!Array.isArray(paradas) || paradas.length === 0) {
            paradas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
        }

        paradas.sort((a, b) => {
            const seqA = parseInt(a.secuenciaZona || a.secuencia || a.orden || 0, 10);
            const seqB = parseInt(b.secuenciaZona || b.secuencia || b.orden || 0, 10);
            return seqA - seqB;
        });

        return paradas;
    },

    /**
     * Filtra la colección local evaluando coincidencia por SCC, #Stop, Cliente o Dirección.
     * @param {string} query 
     */
    async ejecutarFiltradoParadas(query) {
        const paradas = await this.obtenerColeccionParadas();
        const intencion = clasificarIntencionBusqueda(query);
        const qNorm = intencion.valorLimpio;
        let resultados = [];

        console.log(`🔍 [MAPA_EVENTOS]: Evaluando query="${query}" [Intención: ${intencion.tipo}] en ${paradas.length} paradas locales...`);

        if (intencion.tipo === 'STOP') {
            resultados = paradas.filter((p, idx) => {
                const sec = parseInt(p.secuenciaZona || p.secuencia || p.orden || (idx + 1), 10);
                return sec === intencion.numeroStop;
            }).map(p => ({ ...p, _categoriaBusqueda: 'STOP' }));
        } else {
            // Evaluación Multimodo Flexible
            resultados = paradas.filter((p, idx) => {
                const sccVal = normalizarTextoBusqueda(p.scc || p.ssc || p.id_scc || p.codigo_scc || "");
                const clienteVal = normalizarTextoBusqueda(p.destinatario || p.cliente || p.nombre_cliente || p.nombre || "");
                const dirVal = normalizarTextoBusqueda(p.direccion || p.dir || "");
                const secVal = String(p.secuenciaZona || p.secuencia || p.orden || (idx + 1));

                const coincideSCC = sccVal.length > 0 && sccVal.includes(qNorm);
                const coincideStop = secVal === qNorm;
                const coincideTexto = clienteVal.includes(qNorm) || dirVal.includes(qNorm);

                if (coincideSCC) p._categoriaBusqueda = 'SCC';
                else if (coincideStop) p._categoriaBusqueda = 'STOP';
                else if (coincideTexto) p._categoriaBusqueda = 'GENERAL';

                return coincideSCC || coincideStop || coincideTexto;
            });
        }

        console.log(`🎯 [MAPA_EVENTOS]: ${resultados.length} coincidencia(s) local(es) halladas por SCC/Texto.`);
        this.renderizarSugerencias(resultados, query);
    },

    renderizarSugerencias(coincidencias, queryOriginal) {
        const listaSugerencias = document.getElementById("sugerencias-paradas-mapa");
        if (!listaSugerencias) return;

        let html = "";

        if (coincidencias.length > 0) {
            html += coincidencias.map((p, idx) => {
                const sec = p.secuenciaZona || p.secuencia || p.orden || idx + 1;
                const uid = obtenerIdUnicoParada(p);
                const scc = p.scc || p.ssc || "N/A";
                const cliente = p.destinatario || p.cliente || "Cliente N/A";
                const direccionTexto = p.direccion || p.dir || "Sin dirección";
                const grupo = p.grupoId || "GRUPO-01";
                const subgrupo = p.subgrupoId || "SUB-001";

                let badgeHTML = `<span class="cyber-sug-badge badge-stop">#${sec}</span>`;
                if (p._categoriaBusqueda === 'SCC') {
                    badgeHTML += `<span class="cyber-sug-badge badge-scc" style="background:#00e5ff; color:#000;">SCC</span>`;
                }

                badgeHTML += `<span class="cyber-sug-badge badge-grupo">${grupo}</span>`;
                badgeHTML += `<span class="cyber-sug-badge badge-subgrupo">${subgrupo}</span>`;

                return `
                    <li class="cyber-sugerencia-item" data-type="parada" data-id="${uid}">
                        ${badgeHTML}
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
                    }
                } else if (type === "geocode") {
                    this.ejecutarGeocodificacionDireccion(queryOriginal);
                }
                listaSugerencias.style.display = "none";
            });
        });
    },

    seleccionarParadaBuscada(parada) {
        console.log("⚡ [MAPA_EVENTOS]: Parada seleccionada en búsqueda SCC:", parada);

        if (typeof enfocarYResaltarGrupoSCC === "function") {
            enfocarYResaltarGrupoSCC(parada);
        } else if (typeof enfocarParadaEnMapa === "function") {
            enfocarParadaEnMapa(parada);
        }

        this.mostrarTarjetaDetalle(parada);
        this.calcularYRenderizarParadasCercanas(parada);
    },

    ejecutarGeocodificacionDireccion(direccion) {
        if (!direccion) return;
        const mapa = this.mapaInstancia || window.mapaMensajero || window.mapaInstanciaGlobal;

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

                console.log(`✅ [GEOCODE_OK]: Punto marcado en ${dirFormateada}`);
            } else {
                console.error("❌ [GEOCODE_ERROR]: Geocodificación fallida:", status);
            }
        });
    },

    mostrarTarjetaDetalle(parada) {
        const card = document.getElementById("tarjeta-detalle-parada");
        if (!card) return;

        const sec = parada.secuenciaZona || parada.secuencia || parada.orden || 1;
        const nombreCliente = parada.destinatario || parada.cliente || parada.nombre_cliente || parada.nombre || "Cliente N/A";

        const elemSec = document.getElementById("card-stop-secuencia");
        const elemGrupo = document.getElementById("card-stop-grupo");
        const elemSubgrupo = document.getElementById("card-stop-subgrupo");
        const elemSCC = document.getElementById("card-stop-scc");
        const elemEst = document.getElementById("card-stop-estado");
        const elemDest = document.getElementById("card-stop-destinatario");
        const elemDir = document.getElementById("card-stop-direccion");
        const elemTel = document.getElementById("card-stop-telefono");

        if (elemSec) elemSec.textContent = `#STOP ${sec}`;
        if (elemGrupo) elemGrupo.textContent = parada.grupoId || "GRUPO-01";
        if (elemSubgrupo) elemSubgrupo.textContent = parada.subgrupoId || "SUB-001";
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
            const sec = p.secuenciaZona || p.secuencia || p.orden || "?";
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

    /**
     * Inicia el escáner táctico por cámara con resolución adaptable para Android PWA / WebView.
     */
    async iniciarEscanerCamaraSCC() {
        const modal = document.getElementById("contenedor-escanner-modal");
        const video = document.getElementById("video-preview-escanner");
        const txtStatus = document.getElementById("status-escanner-texto");

        if (!modal || !video) return;
        modal.style.display = "flex";

        // 1. Verificación de Contexto Seguro Web API
        const esContextoSeguro = window.isSecureContext || window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

        if (!esContextoSeguro) {
            console.warn("⚠️ [ESCÁNER_WARN]: Acceso a cámara restringido por la API de Web Browsers debido a un contexto HTTP inseguro.");
            if (txtStatus) {
                txtStatus.innerHTML = `⚠️ <b>Contexto HTTP Inseguro</b><br>Android requiere HTTPS para la cámara.<br><small>Habilite chrome://flags/#unsafely-treat-insecure-origin-as-secure con IP local.</small>`;
            }
            return;
        }

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
            if (txtStatus) txtStatus.textContent = "❌ Tu navegador no soporta captura de video (MediaDevices API).";
            return;
        }

        if (txtStatus) txtStatus.textContent = "⏳ Solicitando acceso a la cámara...";

        // 2. Fallback progresivo para perfiles de cámara en Android
        const perfilesCamara = [
            { video: { facingMode: { ideal: "environment" } } },
            { video: { facingMode: "environment" } },
            { video: true }
        ];

        let streamObtenido = null;
        let ultimoError = null;

        for (const constraints of perfilesCamara) {
            try {
                console.log("📷 [ESCÁNER_SCC]: Solicitando cámara con perfil:", constraints);
                streamObtenido = await navigator.mediaDevices.getUserMedia(constraints);
                if (streamObtenido) break;
            } catch (err) {
                ultimoError = err;
                console.warn("⚠️ [ESCÁNER_SCC]: Perfil de cámara rechazado, probando fallback...", err.name || err.message);
            }
        }

        if (!streamObtenido) {
            console.error("❌ [ESCÁNER_ERROR]: Fallaron todas las opciones de acceso a la cámara:", ultimoError);
            if (txtStatus) {
                const msjError = ultimoError?.name === "NotAllowedError" 
                    ? "❌ Permiso de cámara denegado. Conceda permisos a la app." 
                    : `❌ ERROR DE ACCESO A CÁMARA (${ultimoError?.name || "Desconocido"}).`;
                txtStatus.textContent = msjError;
            }
            return;
        }

        mediaStreamCamara = streamObtenido;
        video.srcObject = mediaStreamCamara;
        video.setAttribute("playsinline", "true");
        video.play();

        if (txtStatus) txtStatus.textContent = "🔍 Apunte la cámara hacia el código de barras o QR...";

        // 3. Integración con la API BarcodeDetector
        if ("BarcodeDetector" in window) {
            try {
                const detector = new BarcodeDetector({ formats: ["code_128", "qr_code", "ean_13", "code_39"] });
                const escaneoLoop = async () => {
                    if (!mediaStreamCamara) return;
                    try {
                        const barcodes = await detector.detect(video);
                        if (barcodes.length > 0) {
                            const codigoEscaneado = barcodes[0].rawValue;
                            console.log("📷 [ESCÁNER_SCC_OK]: Código capturado:", codigoEscaneado);
                            if (txtStatus) txtStatus.textContent = `✅ Capturado: ${codigoEscaneado}`;
                            
                            this.detenerEscanerCamaraSCC();
                            
                            const inputBuscador = document.getElementById("buscador-paradas-mapa");
                            if (inputBuscador) inputBuscador.value = codigoEscaneado;
                            
                            await this.ejecutarFiltradoParadas(codigoEscaneado);
                            return;
                        }
                    } catch (err) {
                        // Reintento silencioso en siguiente frame
                    }
                    animFrameScanner = requestAnimationFrame(escaneoLoop);
                };
                animFrameScanner = requestAnimationFrame(escaneoLoop);
            } catch (errDet) {
                console.warn("⚠️ [ESCÁNER_SCC]: BarcodeDetector no pudo instanciarse:", errDet);
            }
        } else {
            if (txtStatus) txtStatus.textContent = "⚠️ Escáner de hardware no soportado en este navegador. Digite el SCC manualmente.";
        }
    },

    detenerEscanerCamaraSCC() {
        const modal = document.getElementById("contenedor-escanner-modal");
        if (modal) modal.style.display = "none";

        if (animFrameScanner) cancelAnimationFrame(animFrameScanner);

        if (mediaStreamCamara) {
            mediaStreamCamara.getTracks().forEach(track => {
                track.stop();
                console.log("📷 [ESCÁNER_SCC]: Track de cámara liberado limpiamente.");
            });
            mediaStreamCamara = null;
        }
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

export function activarModoSeleccionMapaUI() {
    modoCrearParadaActivo = !modoCrearParadaActivo;
    console.log(`📌 [MAPA_EVENTOS]: Modo selección manual de posición ${modoCrearParadaActivo ? 'ACTIVADO' : 'DESACTIVADO'}.`);
    return modoCrearParadaActivo;
}

export function registrarEventosClicMapa(callbackNuevaParada) {
    if (typeof callbackNuevaParada === "function") {
        console.log("⚡ [MAPA_EVENTOS]: Callback de clic en mapa registrado.");
    }
}

export function toggleBuscadorMapaUI() {
    const inputBuscador = document.getElementById("buscador-paradas-mapa");
    if (inputBuscador) {
        inputBuscador.focus();
    }
}

export function ejecutarBusquedaDireccion(dir) {
    mapaEventos.ejecutarGeocodificacionDireccion(dir);
}

// BINDINGS GLOBALES EN WINDOW
window.activarModoSeleccionMapaUI = activarModoSeleccionMapaUI;
window.registrarEventosClicMapa = registrarEventosClicMapa;
window.toggleBuscadorMapaUI = toggleBuscadorMapaUI;
window.ejecutarBusquedaDireccion = ejecutarBusquedaDireccion;
window.ejecutarBusquedaParadas = (query) => mapaEventos.ejecutarFiltradoParadas(query);

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
        mapaEventos.inicializarBuscadorMapa();
    });
}