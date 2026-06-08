/**
 * PROTOCOLO MACONDO - CONFIGURACIÓN Y ESTADO NODAL CENTRAL
 */

// --- VARIABLES GLOBALES DE CONTROL ---
window.loteActualPedidos = [];
window.hashFotoActual = "";
window.mapa = null;
window.geocodificador = null;
window.renderRutas = null;
window.googleMapsOperativo = false;

// --- CONFIGURACIÓN DE CAPACIDAD Y MASA ---
window.LIMITE_MASA_HARDWARE_MOTO = 15.0; // Suspensión máxima Discover 125
window.pesoAcumuladoLote = 0.0;

// --- PARÁMETROS FINANCIEROS DE DIGNIDAD LABORAL 2026 ---
window.COORDENADAS_PARADERO_CENTRAL = { lat: 3.2536, lng: -76.2281 };
window.COSTO_POR_KILOMETRO = 1000;  // Desgaste energético y combustible
window.COSTO_POR_MINUTO = 122;     // Dividido desde el valor de la hora diurna ($7295)
window.APORTE_MUTUAL_FIJO = 1000;   // Resistencia comunitaria

// Sincronización continua de reloj nodal en terminal
setInterval(() => {
  const txtReloj = document.getElementById("reloj-nodo");
  if (txtReloj) {
    txtReloj.innerText = new Date().toISOString().split("T")[1].substring(0, 8) + " UTC_NODE";
  }
}, 1000);