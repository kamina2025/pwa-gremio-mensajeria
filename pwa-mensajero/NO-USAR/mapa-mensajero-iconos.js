/**
 * PROTOCOLO MACONDO - GENERADOR DE ICONOS Y MARCADORES SVG (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa-mensajero-iconos.js
 */

/**
 * Icono de parada estilo Radar / Marco cuadrado con círculo punteado.
 * @param {string} colorFill - Color del marco cuadrado exterior.
 * @param {string} colorStroke - Color del círculo interno punteado.
 * @returns {google.maps.Icon}
 */
export function crearIconoParadaRadarSVG(colorFill = "#00e5ff", colorStroke = "#ffffff") {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 100 100">
        <!-- Cuadrado exterior -->
        <rect x="5" y="5" width="90" height="90" fill="none" stroke="${colorFill}" stroke-width="6" />
        <!-- Círculo interior segmentado/punteado -->
        <circle cx="50" cy="50" r="34" fill="none" stroke="${colorStroke}" stroke-width="6" stroke-dasharray="3 4.5" />
    </svg>`;
    
    return {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 18)
    };
}

/**
 * Icono dinámico estilo Cajita (Diseño anterior de respaldo).
 */
export function crearIconoCajitaSVG(colorFill = "#00e5ff", colorStroke = "#ffffff") {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="7" width="18" height="14" rx="2" fill="${colorFill}" stroke="${colorStroke}" stroke-width="1.5" />
        <path d="M3 10H21" stroke="${colorStroke}" stroke-width="1.5" stroke-dasharray="2 2" />
        <path d="M12 7V21" stroke="${colorStroke}" stroke-width="1.5" />
        <path d="M7 7L12 10L17 7" stroke="${colorStroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="14" r="1.5" fill="${colorStroke}" />
    </svg>`;
    
    return {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
    };
}