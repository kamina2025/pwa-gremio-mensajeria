/**
 * PROTOCOLO MACONDO - SIMBOLOGÍA VISUAL Y TOOLTIPS INFOWINDOW
 * Ubicación: pwa-bodega/modulos/mapa/mapa-iconos.js
 */

export function crearIconoCajitaSVG(colorFill = "#b359ff", colorStroke = "#ffffff") {
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

export function generarTemplateInfoWindow(infoPunto, colorBox) {
  return `
    <div style="background: #0c080f; color: #fff; padding: 8px 12px; border: 1px solid ${colorBox}; font-family: monospace; font-size: 0.78rem; border-radius: 4px;">
      <strong style="color: ${colorBox}; font-size: 0.85rem;">${infoPunto.id} | ${infoPunto.alias}</strong><br/>
      <span style="color: #aaa;">📍 Dir:</span> ${infoPunto.direccion}<br/>
      <span style="color: #aaa;">📞 Tel:</span> ${infoPunto.telefono}<br/>
      <span style="color: #00ff66;">📦 Detalle:</span> ${infoPunto.carga}
    </div>`;
}

// Inyección en ámbito global
window.crearIconoCajitaSVG = crearIconoCajitaSVG;
window.generarTemplateInfoWindow = generarTemplateInfoWindow;