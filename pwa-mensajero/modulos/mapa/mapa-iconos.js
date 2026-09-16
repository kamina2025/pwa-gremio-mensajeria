/**
 * PROTOCOLO MACONDO - GENERADOR DE ICONOS SVG (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-iconos.js
 */

export function crearIconoParadaRadarSVG(colorFill = "#00e5ff", colorStroke = "#ffffff") {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 100 100">
        <rect x="5" y="5" width="90" height="90" fill="none" stroke="${colorFill}" stroke-width="6" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="${colorStroke}" stroke-width="6" stroke-dasharray="3 4.5" />
    </svg>`;
    
    return {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 18)
    };
}