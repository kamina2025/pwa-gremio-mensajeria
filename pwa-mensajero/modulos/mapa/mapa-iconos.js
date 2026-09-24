/**
 * PROTOCOLO MACONDO - GENERADOR DE ICONOS Y PINS CYBERPUNK (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-iconos.js
 */

// Configuración visual de estados (Colores Neón y Símbolos ASCII/Técnicos)
const ESTADOS_PARADA = {
    'creacion': { color: '#b359ff', glow: '#d980ff', symbol: '✏️', tag: 'DRAFT' },      // Neon Purple
    'asignado': { color: '#00e5ff', glow: '#80f2ff', symbol: '📋', tag: 'ASSIGNED' },   // Neon Blue / Crypto
    'en-camino': { color: '#ffb300', glow: '#ffd166', symbol: '⚡', tag: 'EN_ROUTE' },   // Amber Alert
    'en-punto': { color: '#00ff66', glow: '#66ff99', symbol: '🎯', tag: 'ARRIVED' },    // Neon Green
    'entregado': { color: '#00e5ff', glow: '#00ffcc', symbol: '✅', tag: 'COMPLETED' },  // Crypto Secure
    'no-entregado': { color: '#ff3333', glow: '#ff8080', symbol: '⚠️', tag: 'FAIL_ERR' } // Alert Fail
};

/**
 * Convierte una cadena SVG a Data URL codificado en Base64 seguro para Google Maps SDK
 * @param {string} svgText - Markup XML/SVG
 * @returns {string} Data URL en formato Base64
 */
function svgToBase64DataUrl(svgText) {
    try {
        const base64 = btoa(unescape(encodeURIComponent(svgText)));
        return `data:image/svg+xml;base64,${base64}`;
    } catch (e) {
        console.warn("⚠️ [MAPA_ICONOS]: Fallo en codificación Base64 SVG, recurriendo a URIComponent fallback.", e);
        return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgText);
    }
}

/**
 * Genera una estructura MarkerIcon de Google Maps basada en SVG vectorial recortado (Clip-Path)
 * @param {Object} params Configuración de la parada
 * @param {string} [params.estado='asignado'] - Estado operativo de la parada
 * @param {number|string} [params.secuencia=1] - Número ordinal de la parada
 * @param {string} [params.causal=''] - Texto abreviado de la causal en caso de fallo
 * @returns {google.maps.Icon} Objeto listo para asignarse a new google.maps.Marker({ icon: ... })
 */
export function crearIconoParadaCyberpunkSVG({ estado = 'asignado', secuencia = 1, causal = '' } = {}) {
    // Normalización de clave de estado
    const estadoLimpio = String(estado || 'asignado').toLowerCase().trim();
    const config = ESTADOS_PARADA[estadoLimpio] || ESTADOS_PARADA['asignado'];
    
    const colorFill = config.color;
    const colorGlow = config.glow;
    const seqStr = String(secuencia).padStart(2, '0');
    
    // Procesamiento de Causal para paradas fallidas
    const txtCausalLimpia = String(causal || '').trim().toUpperCase();
    const txtCausal = (estadoLimpio === 'no-entregado' && txtCausalLimpia.length > 0) 
        ? txtCausalLimpia.substring(0, 7) 
        : null;

    console.log(`📌 [MAPA_ICONOS]: Generando Pin SVG [#${seqStr}] - Estado: '${estadoLimpio}' ${txtCausal ? `[Causal: ${txtCausal}]` : ''}`);

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64">
        <defs>
            <!-- Sombra neón Cyberpunk -->
            <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <g filter="url(#neon-glow)">
            <!-- Badge de Causal superior (Solo si es No-Entregado y cuenta con causal) -->
            ${txtCausal ? `
                <polygon points="4,2 44,2 40,12 8,12" fill="#ff3333" />
                <text x="24" y="7.5" fill="#000000" font-family="'Fira Code', 'Courier New', monospace" font-weight="900" font-size="7" text-anchor="middle" dominant-baseline="central">${txtCausal}</text>
            ` : ''}

            <!-- Pin Base Hexagonal / Sci-Fi con esquinas biseladas -->
            <polygon points="6,14 42,14 42,42 28,42 24,58 20,42 6,42" 
                     fill="#0d1117" 
                     stroke="${colorFill}" 
                     stroke-width="2" />

            <!-- Línea interna de acento -->
            <polygon points="9,17 39,17 39,39 9,39" 
                     fill="none" 
                     stroke="${colorGlow}" 
                     stroke-width="0.8" 
                     stroke-dasharray="2 2" 
                     opacity="0.6" />

            <!-- Número de Parada / Secuencia -->
            <text x="17" y="28" fill="#ffffff" font-family="'Fira Code', 'Courier New', monospace" font-weight="bold" font-size="12" text-anchor="middle" dominant-baseline="central">${seqStr}</text>

            <!-- Separador vertical / Indicador -->
            <line x1="25" y1="22" x2="25" y2="34" stroke="${colorFill}" stroke-width="1.5" opacity="0.8" />

            <!-- Icono / Símbolo técnico -->
            <text x="33" y="28" fill="${colorFill}" font-size="9" text-anchor="middle" dominant-baseline="central">${config.symbol}</text>

            <!-- Indicador inferior en aguja -->
            <circle cx="24" cy="58" r="2" fill="${colorFill}" />
        </g>
    </svg>`.trim();

    return {
        url: svgToBase64DataUrl(svg),
        scaledSize: typeof google !== 'undefined' && google.maps ? new google.maps.Size(48, 64) : { width: 48, height: 64 },
        anchor: typeof google !== 'undefined' && google.maps ? new google.maps.Point(24, 58) : { x: 24, y: 58 }
    };
}

/**
 * Genera un marcador circular con patrón de radar sci-fi para uso geodésico secundario
 * @param {string} [colorFill="#00e5ff"] - Color neón principal
 * @param {string} [colorStroke="#ffffff"] - Color del borde perimetral
 * @returns {google.maps.Icon} Objeto MarkerIcon
 */
export function crearIconoParadaRadarSVG(colorFill = "#00e5ff", colorStroke = "#ffffff") {
    console.log(`📡 [MAPA_ICONOS]: Generando marcador tipo Radar SVG (${colorFill})`);

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 100 100">
        <rect x="5" y="5" width="90" height="90" fill="none" stroke="${colorFill}" stroke-width="6" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="${colorStroke}" stroke-width="6" stroke-dasharray="3 4.5" />
    </svg>`.trim();
    
    return {
        url: svgToBase64DataUrl(svg),
        scaledSize: typeof google !== 'undefined' && google.maps ? new google.maps.Size(36, 36) : { width: 36, height: 36 },
        anchor: typeof google !== 'undefined' && google.maps ? new google.maps.Point(18, 18) : { x: 18, y: 18 }
    };
}

// BINDINGS GLOBALES DE COMPATIBILIDAD LEGACY / WINDOW
if (typeof window !== "undefined") {
    window.crearIconoParadaCyberpunkSVG = crearIconoParadaCyberpunkSVG;
    window.crearIconoParadaRadarSVG = crearIconoParadaRadarSVG;
}