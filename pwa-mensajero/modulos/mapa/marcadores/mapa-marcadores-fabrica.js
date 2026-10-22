/**
 * Ubicación: pwa-mensajero/modulos/mapa/marcadores/mapa-marcadores-fabrica.js
 * Función: Fábrica de Nodos DOM Vectoriales con anclaje térmico estático anti-flicker
 */

import { obtenerStringSVGParadaCyberpunk, extraerNumeroSecuenciaParada } from "../mapa-iconos.js";

/**
 * Sanitiza la cadena SVG y la inyecta dentro de un nodo <div> con dimensiones fijas y secuencia reevaluada.
 * @param {HTMLElement|string|Object} contenidoIcono 
 * @param {Object} [paradaDatos=null]
 * @param {string} [tituloContexto=""]
 * @returns {HTMLElement}
 */
export function convertirAElementoNodoDOM(contenidoIcono, paradaDatos = null, tituloContexto = "") {
    const wrapper = document.createElement("div");
    wrapper.className = "macondo-cyberpunk-pin-wrapper";
    
    wrapper.style.width = "54px";
    wrapper.style.height = "72px";
    wrapper.style.display = "block";
    wrapper.style.position = "relative";
    wrapper.style.cursor = "pointer";
    wrapper.style.pointerEvents = "auto";
    wrapper.style.userSelect = "none";
    wrapper.style.webkitUserSelect = "none";
    
    // Anclaje estático por margen negativo que previene temblor/flicker en InfoWindow
    wrapper.style.marginLeft = "-27px";
    wrapper.style.marginTop = "-64px";

    let svgTexto = "";
    const numSeq = extraerNumeroSecuenciaParada(paradaDatos || contenidoIcono, tituloContexto);
    const seqStr = String(numSeq).padStart(2, '0');

    // Si viene de un objeto o si falta parsear la secuencia dentro del texto SVG
    if (paradaDatos && typeof paradaDatos === 'object') {
        svgTexto = obtenerStringSVGParadaCyberpunk(paradaDatos, tituloContexto);
    } else if (typeof contenidoIcono === 'string' && contenidoIcono.includes('<svg')) {
        svgTexto = contenidoIcono;
        // Reemplazo dinámico directo sobre la etiqueta de texto si venía fijada en 01
        svgTexto = svgTexto.replace(/(<text[^>]*>)\d+(<\/text>)/i, `$1${seqStr}$2`);
    } else if (contenidoIcono instanceof HTMLElement) {
        svgTexto = contenidoIcono.outerHTML;
        svgTexto = svgTexto.replace(/(<text[^>]*>)\d+(<\/text>)/i, `$1${seqStr}$2`);
    } else if (contenidoIcono && typeof contenidoIcono === 'object') {
        svgTexto = obtenerStringSVGParadaCyberpunk(contenidoIcono, tituloContexto);
    }

    const matchSvg = svgTexto.match(/<svg[\s\S]*<\/svg>/i);
    
    if (matchSvg) {
        let limpio = matchSvg[0];
        if (!limpio.includes('xmlns=')) {
            limpio = limpio.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        
        wrapper.innerHTML = limpio;
        
        const svgElemento = wrapper.querySelector('svg');
        if (svgElemento) {
            svgElemento.setAttribute("width", "54");
            svgElemento.setAttribute("height", "72");
            svgElemento.style.width = "54px";
            svgElemento.style.height = "72px";
            svgElemento.style.display = "block";
            svgElemento.style.pointerEvents = "none";
            svgElemento.style.filter = "drop-shadow(0px 4px 10px rgba(0, 229, 255, 0.5))";
        }
    } else {
        wrapper.innerHTML = '<span style="font-size:28px;">📍</span>';
    }

    return wrapper;
}

export function construirDataURISVG(svgString, paradaDatos = null, tituloContexto = "") {
    let limpio = "";
    if (paradaDatos && typeof paradaDatos === 'object') {
        limpio = obtenerStringSVGParadaCyberpunk(paradaDatos, tituloContexto);
    } else if (typeof svgString === 'string') {
        limpio = svgString.trim();
    } else if (svgString && typeof svgString === 'object') {
        limpio = obtenerStringSVGParadaCyberpunk(svgString, tituloContexto);
    }

    const matchSvg = limpio.match(/<svg[\s\S]*<\/svg>/i);
    if (matchSvg) limpio = matchSvg[0];

    if (!limpio.includes('xmlns=')) limpio = limpio.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

    const encoded = encodeURIComponent(limpio)
        .replace(/'/g, "%27")
        .replace(/"/g, "%22")
        .replace(/\(/g, "\%28")         .replace(/\)/g, "%29");

    return `data:image/svg+xml;charset=UTF-8,${encoded}`;
}

export function crearMarcadorEnPosicion({ mapaInstancia, posicion, contenidoIcono, titulo, paradaDatos = null }) {
    let marcador = null;
    const tieneMapId = mapaInstancia && (typeof mapaInstancia.get === "function" ? mapaInstancia.get("mapId") : mapaInstancia.mapId);
    const tieneAdvancedMarker = typeof google !== "undefined" && google.maps?.marker?.AdvancedMarkerElement && !!tieneMapId;

    const datosParadaCombinados = paradaDatos || (typeof contenidoIcono === 'object' && !contenidoIcono.nodeType ? contenidoIcono : null);
    const numSeq = extraerNumeroSecuenciaParada(datosParadaCombinados, titulo);

    if (tieneAdvancedMarker) {
        const elementoNodo = convertirAElementoNodoDOM(contenidoIcono, datosParadaCombinados, titulo);
        marcador = new google.maps.marker.AdvancedMarkerElement({
            map: mapaInstancia,
            position: posicion,
            content: elementoNodo,
            title: titulo || `[STOP #${numSeq}]`,
            zIndex: 999999
        });
        marcador.esAvanzado = true;
        console.log(`📌 [MAPA_MARCADORES]: AdvancedMarkerElement instanciado [#${numSeq}] -> "${titulo || `STOP #${numSeq}`}"`);
    } else {
        marcador = new google.maps.Marker({
            position: posicion,
            map: mapaInstancia,
            icon: {
                url: construirDataURISVG(contenidoIcono, datosParadaCombinados, titulo),
                scaledSize: new google.maps.Size(54, 72),
                anchor: new google.maps.Point(27, 64)
            },
            title: titulo || `[STOP #${numSeq}]`,
            optimized: false,
            zIndex: 999999
        });
        marcador.esAvanzado = false;
        console.warn(`⚠️ [MAPA_MARCADORES_FALLBACK]: google.maps.Marker legacy instanciado [#${numSeq}] -> "${titulo || `STOP #${numSeq}`}"`);
    }
    return marcador;
}

if (typeof window !== "undefined") {
    window.convertirAElementoNodoDOM = convertirAElementoNodoDOM;
    window.construirDataURISVG = construirDataURISVG;
    window.crearMarcadorEnPosicion = crearMarcadorEnPosicion;
}