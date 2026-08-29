/**
 * PROTOCOLO MACONDO - CONFIGURACIÓN Y ESTADO NODAL CENTRAL
 * Ubicación: modulos/config.js
 */

// --- BANDERAS DE ENTORNO OPERATIVO ---
window.MODO_OPERATIVO = "BODEGA"; // Opciones: "NEGOCIO" | "BODEGA" | "MENSAJERO"

// --- VARIABLES GLOBALES DE CONTROL Y MEMORIA ---
window.loteActualPedidos = [];
window.hashFotoActual = "";
window.mapa = null;
window.geocodificador = null;
window.renderRutas = null;
window.googleMapsOperativo = false;

// --- CONFIGURACIÓN DE CAPACIDAD Y MASA ---
window.LIMITE_MASA_HARDWARE_MOTO = 15.0; // Suspensión máxima Discover 125
window.pesoAcumuladoLote = 0.0;

// --- PARÁMETROS FINANCIEROS Y TARIFARIOS 2026 ---
window.COORDENADAS_PARADERO_CENTRAL = { lat: 3.2536, lng: -76.2281 };

// Modelo Distancia/Tiempo (pwa-negocios)
window.COSTO_POR_KILOMETRO = 1000;  // COP por km
window.COSTO_POR_MINUTO = 122;     // COP por min ($7295 hora base)
window.APORTE_MUTUAL_FIJO = 1000;   // COP por entrega

// Modelo Créditos Fijos API (pwa-bodega)
window.VALOR_CREDITO_COP = 500;    // 1 Punto / Crédito = $500 COP
window.CREDITOS_POR_PUNTO = 1;

// --- CRONÓMETRO Y SINCRONIZACIÓN NODAL UTC ---
if (!window.intervaloRelojNodal) {
  window.intervaloRelojNodal = setInterval(() => {
    const txtReloj = document.getElementById("reloj-nodo");
    if (txtReloj) {
      txtReloj.innerText = new Date().toISOString().split("T")[1].substring(0, 8) + " UTC_NODE";
    }
  }, 1000);
}