/**
 * PROTOCOLO MACONDO - CONTROL DE LIENZO, CÁMARA Y RESALTADO DE ZONAS
 * Ubicación: pwa-mensajero/modulos/mapa/core/mapa-lienzo.js
 * Arquitectura: Google Maps SDK / Viewport Operations / Geocoding Fallback / Local-First
 */

import { obtenerCoordenadasValidasParada } from "../utils/mapa-coordenadas.js";
import { guardarRutaZonificada } from "../../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../zonificacion/estandar-zonas.js";
import { calcularDistanciaHaversine } from "../zonificacion/geo-utils.js";

let temporizadorDebounceResize = null;
const KEY_ULTIMA_PARADA = 'macondo_ultima_parada_id';

/**
 * Sanitiza identificadores removiendo prefijos HTML, signos de numeral o 'PNT-'.
 * @param {string|number} rawId 
 * @returns {string}
 */
function sanitizarIdLienzo(rawId) {
    if (!rawId || rawId === "N/A" || rawId === "undefined" || rawId === "null") return "";
    return String(rawId).replace(/^#/, "").replace(/^PNT-?/i, "").trim();
}

/**
 * Redimensiona el lienzo del mapa de forma segura tras cambios en el DOM o transiciones de vista.
 */
export function refrescarLienzoMapa() {
    const mapa = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;
    if (!mapa || typeof google === "undefined" || !google.maps) return;

    const contenedor = mapa.getDiv();
    if (!contenedor || contenedor.clientWidth === 0 || contenedor.clientHeight === 0) return;

    if (temporizadorDebounceResize) clearTimeout(temporizadorDebounceResize);

    temporizadorDebounceResize = setTimeout(() => {
        requestAnimationFrame(() => {
            if (contenedor.clientWidth > 0 && contenedor.clientHeight > 0) {
                const centroActual = mapa.getCenter();
                google.maps.event.trigger(mapa, "resize");
                if (centroActual) {
                    mapa.setCenter(centroActual);
                }
                console.log("⚡ [MAPA_LIENZO]: Re-renderizado Post-Paint de lienzo ejecutado con éxito.");
            }
        });
    }, 80);
}

/**
 * Enfoca una zona ajustando sus límites geográficos (FitBounds).
 * @param {Array<Object>} paradasZona - Paradas pertenecientes a la zona
 */
export function enfocarZonaEnMapa(paradasZona) {
    const mapa = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;
    if (!mapa || !Array.isArray(paradasZona) || paradasZona.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let puntosValidos = 0;

    paradasZona.forEach(p => {
        if (p) {
            const coords = obtenerCoordenadasValidasParada(p);
            if (coords) {
                bounds.extend(new google.maps.LatLng(coords.lat, coords.lng));
                puntosValidos++;
            }
        }
    });

    if (puntosValidos > 0) {
        if (puntosValidos === 1) {
            mapa.setCenter(bounds.getCenter());
            mapa.setZoom(16);
        } else {
            mapa.fitBounds(bounds);
        }
        refrescarLienzoMapa();
    }
}

/**
 * Centra y acerca suavemente la cámara a una parada por objeto, ID o clave unívoca de zona.
 * Includes fallback por dirección de texto con geocodificación y auto-guardado en IndexedDB.
 * @param {Object|string} paradaOrId - Objeto de la parada, ID o clave compuesta
 */
export function enfocarParadaEnMapa(paradaOrId) {
    const mapa = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;
    
    if (!mapa) {
        console.warn("⚠️ [MAPA_LIENZO]: Instancia del mapa no disponible para enfocar la parada.", paradaOrId);
        return;
    }

    let parada = null;
    let zonaEsperada = null;

    const paradas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];

    if (typeof paradaOrId === "object" && paradaOrId !== null) {
        if (paradaOrId.idParada || paradaOrId.claveUnica || paradaOrId.id || paradaOrId.ssc || paradaOrId.scc) {
            const idTarget = sanitizarIdLienzo(paradaOrId.idParada || paradaOrId.id || paradaOrId.ssc || paradaOrId.scc);
            zonaEsperada = paradaOrId.zona ? estandarizarZonaCanonica(paradaOrId.zona) : null;
            const consecTarget = parseInt(paradaOrId.consecutivoZona || paradaOrId.secuenciaZona || 0, 10);

            parada = paradas.find(p => {
                const pId = sanitizarIdLienzo(p.id || p.ssc || p.scc || p.idParada);
                const pSsc = sanitizarIdLienzo(p.ssc);
                const pScc = sanitizarIdLienzo(p.scc);
                const pConsec = parseInt(p.consecutivoZona || p.secuenciaZona || p.secuencia || 0, 10);
                const pZona = estandarizarZonaCanonica(obtenerZonaParadaCanonica(p));

                const matchId = idTarget && (pId === idTarget || pSsc === idTarget || pScc === idTarget);
                const matchConsec = consecTarget > 0 && pConsec === consecTarget && (!zonaEsperada || pZona === zonaEsperada);

                if (zonaEsperada && matchId) {
                    return pZona === zonaEsperada || pZona === "GENERAL";
                }
                return matchId || matchConsec;
            });
        } else {
            parada = paradaOrId;
        }
    } else if (paradaOrId) {
        const idTarget = sanitizarIdLienzo(paradaOrId);
        parada = paradas.find(p => {
            const pId = sanitizarIdLienzo(p.id || p.ssc || p.scc || p.idParada);
            const pSsc = sanitizarIdLienzo(p.ssc);
            const pScc = sanitizarIdLienzo(p.scc);
            return pId === idTarget || pSsc === idTarget || pScc === idTarget;
        });
    }

    if (!parada) {
        console.warn("⚠️ [MAPA_LIENZO]: Referencia de parada no hallada en memoria local.");
        return;
    }

    const idTargetLocal = sanitizarIdLienzo(parada.id || parada.ssc || parada.scc);
    if (idTargetLocal) {
        try {
            localStorage.setItem(KEY_ULTIMA_PARADA, idTargetLocal);
            console.log(`💾 [MAPA_LIENZO]: 'macondo_ultima_parada_id' actualizado -> ${idTargetLocal}`);
        } catch (err) {
            console.warn("⚠️ Error guardando ID de última parada:", err);
        }
    }

    const coords = obtenerCoordenadasValidasParada(parada);

    if (coords) {
        console.log(`🎯 [MAPA_LIENZO]: Enfocando posición en mapa -> [Lat: ${coords.lat}, Lng: ${coords.lng}]`);
        const centroObjetivo = new google.maps.LatLng(coords.lat, coords.lng);
        mapa.panTo(centroObjetivo);
        mapa.setZoom(17);
        refrescarLienzoMapa();

        if (typeof window.mostrarDetalleParadaEnLienzo === "function") {
            window.mostrarDetalleParadaEnLienzo(parada);
        }
        return;
    }

    // Fallback: Geocodificación por dirección de texto
    const direccionTexto = parada?.direccion || parada?.dir;
    if (direccionTexto && typeof google !== "undefined" && google.maps && google.maps.Geocoder) {
        console.warn(`⚠️ [MAPA_LIENZO]: Parada sin coordenadas directas. Geocodificando dirección en vivo: "${direccionTexto}"`);
        const geocoder = new google.maps.Geocoder();
        const query = direccionTexto.toLowerCase().includes("cali") ? direccionTexto : `${direccionTexto}, Cali, Colombia`;

        geocoder.geocode({ address: query }, async (results, status) => {
            if (status === "OK" && results[0]) {
                const loc = results[0].geometry.location;
                const latNum = loc.lat();
                const lngNum = loc.lng();

                console.log(`✅ [MAPA_LIENZO]: Dirección geocodificada con éxito -> [Lat: ${latNum}, Lng: ${lngNum}]`);

                parada.lat = latNum;
                parada.lng = lngNum;
                parada.latitud = latNum;
                parada.longitud = lngNum;

                let coleccionActual = window.paradasRutaActiva || window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
                if (Array.isArray(coleccionActual) && coleccionActual.length > 0) {
                    try {
                        await guardarRutaZonificada(coleccionActual);
                        
                        // Sincronizar memorias RAM
                        window.__CACHE_PARADAS_MACONDO__ = [...coleccionActual];
                        window.paradasMemoriaLocal = [...coleccionActual];
                        window.paradasRutaActiva = [...coleccionActual];
                        window.pedidosGlobales = [...coleccionActual];

                        console.log(`💾 [MAPA_LIENZO]: Coordenadas de la parada ${parada.id || parada.ssc} persistidas en IndexedDB y RAM.`);
                    } catch (err) {
                        console.warn("⚠️ [MAPA_LIENZO]: No se pudo auto-guardar la coordenada en IndexedDB:", err);
                    }
                }

                mapa.panTo(loc);
                mapa.setZoom(17);
                refrescarLienzoMapa();

                if (typeof window.mostrarDetalleParadaEnLienzo === "function") {
                    window.mostrarDetalleParadaEnLienzo(parada);
                }
            } else {
                console.error(`❌ [MAPA_LIENZO]: No se pudo geocodificar la dirección "${query}". Status: ${status}`);
            }
        });
        return;
    }

    console.error("❌ [MAPA_LIENZO]: Parada con coordenadas e información de dirección inválidas:", parada);
}

/**
 * Centra el mapa de forma explícita utilizando una clave unívoca compuesta de parada.
 * @param {Object} payload - Objeto con { idParada, zona, consecutivoZona, claveUnica }
 */
export function centrarMapaEnParadaPorClave(payload) {
    if (!payload) return;

    const idParada = sanitizarIdLienzo(payload.idParada || payload.id || payload.ssc || payload.scc);
    const zonaTarget = payload.zona ? estandarizarZonaCanonica(payload.zona) : null;
    const consecutivoTarget = payload.consecutivoZona || payload.secuenciaZona;

    console.log(`🎯 [MAPA_LIENZO]: Centrado unívoco por clave -> ID: ${idParada || 'N/A'} | Zona: ${zonaTarget || 'TODAS'} | Stop: #${consecutivoTarget || 'N/A'}`);

    const mapa = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;

    // 1. Buscar en los marcadores activos renderizados en la capa de Google Maps
    const coleccionMarcadores = window.marcadoresRutaMensajero || window.__MAPA_MARCADORES_LISTA__ || [];

    if (Array.isArray(coleccionMarcadores) && coleccionMarcadores.length > 0) {
        const marcadorEncontrado = coleccionMarcadores.find(m => {
            if (!m) return false;
            const idM = sanitizarIdLienzo(m.datasetId || m.id || (typeof m.get === "function" ? m.get("idParada") || m.get("sscParada") : ""));
            const zonaM = m.zona || (typeof m.get === "function" ? m.get("zona") : "");
            const consecutivoM = m.consecutivoZona || (typeof m.get === "function" ? m.get("consecutivoZona") || m.get("secuencia") : "");

            const idCoincide = idParada && idM === idParada;
            const consecutivoCoincide = consecutivoTarget && String(consecutivoM) === String(consecutivoTarget);
            const zonaCoincide = !zonaTarget || estandarizarZonaCanonica(zonaM) === zonaTarget;

            return (idCoincide || consecutivoCoincide) && zonaCoincide;
        });

        if (marcadorEncontrado && mapa) {
            const pos = typeof marcadorEncontrado.getPosition === "function" ? marcadorEncontrado.getPosition() : marcadorEncontrado.position;
            if (pos) {
                mapa.panTo(pos);
                mapa.setZoom(17);
                
                // Animar suavemente el marcador si la API lo permite
                if (typeof marcadorEncontrado.setAnimation === "function" && google?.maps?.Animation) {
                    marcadorEncontrado.setAnimation(google.maps.Animation.BOUNCE);
                    setTimeout(() => marcadorEncontrado.setAnimation(null), 1400);
                }

                // Disparar evento click táctico sobre el marcador
                if (google?.maps?.event?.trigger) {
                    google.maps.event.trigger(marcadorEncontrado, "click");
                }
            }
        }
    }

    // 2. Ejecutar de forma complementaria el enfoque por objeto de datos para forzar tarjetas/detalles
    enfocarParadaEnMapa(payload);
}

/**
 * Centra la cámara en la parada seleccionada y resalta los marcadores pertenecientes a la misma zona o grupo.
 * @param {Object} parada - Objeto de la parada a resaltar
 */
export function enfocarYResaltarGrupoSCC(parada) {
    if (!parada) return;

    enfocarParadaEnMapa(parada);

    const zonaCanonica = estandarizarZonaCanonica(obtenerZonaParadaCanonica(parada));
    const grupoBuscado = String(parada.grupoId || parada.grupo || parada.cluster || zonaCanonica).trim().toLowerCase();
    
    let contadorResaltados = 0;
    const coleccionMarcadores = window.marcadoresRutaMensajero || window.__MAPA_MARCADORES_LISTA__ || [];

    if (Array.isArray(coleccionMarcadores)) {
        coleccionMarcadores.forEach(marker => {
            if (!marker) return;
            const grupoMarker = String((typeof marker.get === "function" ? marker.get("grupoId") || marker.get("zona") : marker.grupoId || marker.zona) || "").trim().toLowerCase();
            if (grupoMarker && grupoMarker === grupoBuscado) {
                if (typeof marker.setZIndex === "function") marker.setZIndex(1000);
                if (typeof marker.setAnimation === "function" && google?.maps?.Animation) {
                    marker.setAnimation(google.maps.Animation.BOUNCE);
                    setTimeout(() => marker.setAnimation(null), 1200);
                }
                contadorResaltados++;
            } else {
                if (typeof marker.setZIndex === "function") marker.setZIndex(1);
            }
        });
    }

    console.log(`⚡ [MAPA_LIENZO]: Resaltados ${contadorResaltados} marcadores del clúster/zona [${zonaCanonica}]`);
}

/**
 * Renderiza la tarjeta flotante con la información detallada de la parada y sus vecinas en zona.
 * @param {Object} parada - Objeto de la parada a presentar
 */
export function mostrarDetalleParadaEnLienzo(parada) {
    const contenedorTarjeta = document.getElementById("tarjeta-detalle-parada-mapa") || document.getElementById("tarjeta-detalle-parada");
    if (!contenedorTarjeta || !parada) return;

    const zonaCanonica = estandarizarZonaCanonica(obtenerZonaParadaCanonica(parada));
    const consecutivo = parada.consecutivoZona || parada.secuenciaZona || 1;
    const idParada = sanitizarIdLienzo(parada.id || parada.ssc || parada.scc);

    const todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
    const latA = parseFloat(parada.lat || parada.latitud);
    const lngA = parseFloat(parada.lng || parada.longitud);

    let htmlCercanas = "";

    if (!isNaN(latA) && !isNaN(lngA) && latA !== 0 && lngA !== 0) {
        const paradasMismaZona = todasLasParadas.filter(p => {
            const mismaZona = estandarizarZonaCanonica(obtenerZonaParadaCanonica(p)) === zonaCanonica;
            const distintoId = sanitizarIdLienzo(p.id || p.ssc || p.scc) !== idParada;
            const latP = parseFloat(p.lat || p.latitud);
            const lngP = parseFloat(p.lng || p.longitud);
            return mismaZona && distintoId && !isNaN(latP) && !isNaN(lngP) && latP !== 0 && lngP !== 0;
        });

        paradasMismaZona.sort((a, b) => {
            const distA = calcularDistanciaHaversine(latA, lngA, parseFloat(a.lat || a.latitud), parseFloat(a.lng || a.longitud));
            const distB = calcularDistanciaHaversine(latA, lngA, parseFloat(b.lat || b.latitud), parseFloat(b.lng || b.longitud));
            return distA - distB;
        });

        const tresCercanas = paradasMismaZona.slice(0, 3);

        tresCercanas.forEach(vecina => {
            const distKm = calcularDistanciaHaversine(latA, lngA, parseFloat(vecina.lat || vecina.latitud), parseFloat(vecina.lng || vecina.longitud));
            const distMetros = Math.round(distKm * 1000);
            const vecinaStop = vecina.consecutivoZona || vecina.secuenciaZona || "?";
            const vecinaId = sanitizarIdLienzo(vecina.id || vecina.ssc || vecina.scc);

            htmlCercanas += `
                <div class="item-vecina-cercana" style="cursor:pointer; padding:4px 0; border-bottom:1px solid #1a202c;" onclick="window.centrarMapaEnParadaPorClave({ idParada: '${vecinaId}', zona: '${zonaCanonica}', consecutivoZona: ${vecinaStop} })">
                    <span style="color:#00e5ff; font-weight:bold;">#Stop ${vecinaStop} (${distMetros} m)</span> - 
                    <span style="color:#e2e8f0;">${vecina.destinatario || vecina.cliente || 'Cliente'}</span>
                </div>
            `;
        });
    }

    const elemSec = document.getElementById("card-stop-secuencia");
    const elemGrupo = document.getElementById("card-stop-grupo");
    const elemSCC = document.getElementById("card-stop-scc");
    const elemEst = document.getElementById("card-stop-estado");
    const elemDest = document.getElementById("card-stop-destinatario");
    const elemDir = document.getElementById("card-stop-direccion");
    const elemTel = document.getElementById("card-stop-telefono");
    const contenedorCercanas = document.getElementById("contenedor-paradas-cercanas");

    if (elemSec) elemSec.textContent = `#STOP ${consecutivo}`;
    if (elemGrupo) elemGrupo.textContent = zonaCanonica;
    if (elemSCC) elemSCC.textContent = `SCC: ${parada.ssc || parada.scc || idParada}`;
    if (elemEst) elemEst.textContent = (parada.estado || "ASIGNADO").toUpperCase();
    if (elemDest) elemDest.textContent = parada.destinatario || parada.cliente || "Cliente";
    if (elemDir) elemDir.textContent = `📍 ${parada.direccion || parada.dir || 'Sin Dirección'}`;
    if (elemTel) elemTel.textContent = `📞 ${parada.telefono || parada.tel || 'Sin Teléfono'}`;

    if (contenedorCercanas) {
        contenedorCercanas.innerHTML = htmlCercanas || `<span style="color:#718096; font-size:0.75rem;">Sin paradas cercanas en esta zona</span>`;
    }

    contenedorTarjeta.style.display = "block";
}

// BINDINGS GLOBALES EN WINDOW
if (typeof window !== "undefined") {
    window.refrescarLienzoMapa = refrescarLienzoMapa;
    window.enfocarZonaEnMapa = enfocarZonaEnMapa;
    window.enfocarParadaEnMapa = enfocarParadaEnMapa;
    window.centrarMapaEnParadaPorClave = centrarMapaEnParadaPorClave;
    window.enfocarYResaltarGrupoSCC = enfocarYResaltarGrupoSCC;
    window.mostrarDetalleParadaEnLienzo = mostrarDetalleParadaEnLienzo;
}