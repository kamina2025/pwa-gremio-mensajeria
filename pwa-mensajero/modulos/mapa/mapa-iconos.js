/**
 * PROTOCOLO MACONDO - GENERADOR DE ICONOS Y PINS CYBERPUNK (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-iconos.js
 * Optimizado para Accesibilidad Android (High Contrast & Clean Vector Graphics)
 */

// Configuración visual de estados y glifos vectoriales SVG puros
const ESTADOS_PARADA = {
    'creacion': { 
        color: '#b359ff', 
        glow: '#d980ff', 
        tag: 'DRAFT',
        clase: 'estado-creacion',
        path: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>'
    },
    'asignado': { 
        color: '#00e5ff', 
        glow: '#80f2ff', 
        tag: 'ASSIGNED',
        clase: 'estado-asignado',
        path: '<path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/>'
    },
    'en-camino': { 
        color: '#ffb300', 
        glow: '#ffd166', 
        tag: 'EN_ROUTE',
        clase: 'estado-en-camino',
        path: '<path d="M7 2v11h3v9l7-12h-4l4-8z" fill="currentColor"/>'
    },
    'en-punto': { 
        color: '#00ff66', 
        glow: '#66ff99', 
        tag: 'ARRIVED',
        clase: 'estado-en-punto',
        path: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" fill="currentColor"/>'
    },
    'entregado': { 
        color: '#39ff14', 
        glow: '#00ffcc', 
        tag: 'COMPLETED',
        clase: 'estado-entregado',
        path: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-5.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="currentColor"/>'
    },
    'no-entregado': { 
        color: '#ff3366', 
        glow: '#ff8080', 
        tag: 'FAIL_ERR',
        clase: 'estado-no-entregado',
        path: '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>'
    }
};

/**
 * Retorna la configuración de color y metadatos del estado táctico.
 * @param {string} estado 
 * @returns {Object}
 */
export function obtenerPaletaEstado(estado) {
    const est = String(estado || 'asignado').toLowerCase().trim();
    return ESTADOS_PARADA[est] || ESTADOS_PARADA['asignado'];
}

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
 * Genera un marcador de parada Cyberpunk vectorial optimizado para accesibilidad y usabilidad
 * @param {Object} params Configuración de la parada
 * @param {string} [params.estado='asignado'] - Estado operativo de la parada
 * @param {number|string} [params.secuencia=1] - Número ordinal de la parada
 * @param {string} [params.causal=''] - Texto abreviado de la causal en caso de fallo
 * @returns {google.maps.Icon} Objeto listo para asignarse a new google.maps.Marker({ icon: ... })
 */
export function crearIconoParadaCyberpunkSVG({ estado = 'asignado', secuencia = 1, causal = '' } = {}) {
    const estadoLimpio = String(estado || 'asignado').toLowerCase().trim();
    const config = ESTADOS_PARADA[estadoLimpio] || ESTADOS_PARADA['asignado'];
    
    const colorFill = config.color;
    const colorGlow = config.glow;
    const seqStr = String(secuencia).padStart(2, '0');
    
    const txtCausalLimpia = String(causal || '').trim().toUpperCase();
    const txtCausal = (estadoLimpio === 'no-entregado' && txtCausalLimpia.length > 0) 
        ? txtCausalLimpia.substring(0, 8) 
        : null;

    console.log(`📌 [MAPA_ICONOS]: Generando Pin Táctico SVG [#${seqStr}] - Estado: '${estadoLimpio}' ${txtCausal ? `[Causal: ${txtCausal}]` : ''}`);

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="54" height="72" viewBox="0 0 54 72">
        <defs>
            <!-- Resplandor neón ajustado para menor sobreexposición visual -->
            <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.8" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <g filter="url(#neon-glow)">
            <!-- Badge Superior Táctico de Causal (Solo fallo) -->
            ${txtCausal ? `
                <polygon points="5,2 49,2 45,13 9,13" fill="#ff3333" stroke="#ffffff" stroke-width="0.8"/>
                <text x="27" y="7.5" fill="#ffffff" font-family="'Fira Code', 'Roboto Mono', monospace" font-weight="900" font-size="7.5" text-anchor="middle" dominant-baseline="central" letter-spacing="0.5">${txtCausal}</text>
            ` : ''}

            <!-- Pin Base Hexagonal Biselado Sci-Fi -->
            <polygon points="4,15 50,15 50,47 32,47 27,64 22,47 4,47" 
                     fill="#080c14" 
                     stroke="${colorFill}" 
                     stroke-width="2.5" 
                     stroke-linejoin="round"/>

            <!-- Marco Interno Neón -->
            <polygon points="7,18 47,18 47,44 7,44" 
                     fill="none" 
                     stroke="${colorGlow}" 
                     stroke-width="1" 
                     stroke-dasharray="3 2" 
                     opacity="0.5"/>

            <!-- Indicador Numérico de Secuencia (Súper legible) -->
            <text x="19" y="31" fill="#ffffff" font-family="'Fira Code', 'Roboto', sans-serif" font-weight="900" font-size="14" text-anchor="middle" dominant-baseline="central">${seqStr}</text>

            <!-- Separador Vertical HUD -->
            <line x1="28" y1="23" x2="28" y2="39" stroke="${colorFill}" stroke-width="1.5" opacity="0.7"/>

            <!-- Icono Vectorial SVG Técnico del Estado -->
            <g transform="translate(32, 23) scale(0.65)" fill="${colorFill}">
                ${config.path}
            </g>

            <!-- Anclaje Táctico Inferior (Cruz / Target Crosshair) -->
            <circle cx="27" cy="64" r="3.5" fill="#080c14" stroke="${colorFill}" stroke-width="1.5"/>
            <circle cx="27" cy="64" r="1.2" fill="${colorGlow}"/>
        </g>
    </svg>`.trim();

    return {
        url: svgToBase64DataUrl(svg),
        scaledSize: typeof google !== 'undefined' && google.maps ? new google.maps.Size(54, 72) : { width: 54, height: 72 },
        anchor: typeof google !== 'undefined' && google.maps ? new google.maps.Point(27, 64) : { x: 27, y: 64 }
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
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100">
        <rect x="5" y="5" width="90" height="90" fill="#080c14" fill-opacity="0.6" stroke="${colorFill}" stroke-width="6" rx="10"/>
        <circle cx="50" cy="50" r="32" fill="none" stroke="${colorStroke}" stroke-width="5" stroke-dasharray="4 4"/>
        <circle cx="50" cy="50" r="6" fill="${colorFill}"/>
    </svg>`.trim();
    
    return {
        url: svgToBase64DataUrl(svg),
        scaledSize: typeof google !== 'undefined' && google.maps ? new google.maps.Size(40, 40) : { width: 40, height: 40 },
        anchor: typeof google !== 'undefined' && google.maps ? new google.maps.Point(20, 20) : { x: 20, y: 20 }
    };
}

// BINDINGS GLOBALES DE COMPATIBILIDAD LEGACY / WINDOW
if (typeof window !== "undefined") {
    window.crearIconoParadaCyberpunkSVG = crearIconoParadaCyberpunkSVG;
    window.crearIconoParadaRadarSVG = crearIconoParadaRadarSVG;
    window.obtenerPaletaEstado = obtenerPaletaEstado;
}