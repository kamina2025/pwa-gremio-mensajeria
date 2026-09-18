/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL Y ORQUESTADOR PWA TÁCTICO
 * Ubicación: pwa-mensajero/script2.js
 */

// --- CONFIGURACIÓN DE ENDPOINT API ---
if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    window.ENDPOINT_API_PHP = pathname.includes("/pwa-gremio-mensajeria/")
        ? `${origin}/pwa-gremio-mensajeria/api.php`
        : `${origin}/api.php`;
    console.log(`>>> [CONFIG_ENDPOINT]: API apuntada a -> ${window.ENDPOINT_API_PHP}`);
}

import { 
    guardarRutaZonificada, 
    obtenerRutaZonificada, 
    actualizarEstadoPedido, 
    capturarCoordenadasGPS,
    sincronizarYRenderizarPool,
    sincronizarYRenderizarTransito,
    eliminarParadaLocal,        // 👈 FIX: Importación agregada
    borrarRutaCompletaLocal      // 👈 FIX: Importación agregada
} from "./modulos/mensajero-persistencia.js";

import { inicializarMapaMensajero } from "./modulos/mapa/mapa-visor.js";
import { cargarRutaDesdeTextoOEnlace, ImportadorMasivoMensajero } from "./modulos/mensajero-importer.js";
import { renderizarConsolaOperaciones } from "./modulos/mensajero-ui.js";
import { registrarIntentoLlamada as registrarLlamadaFlujo, configurarEventosFormularioNovedad } from "./modulos/mensajero-flujo.js";

// Importación de módulos refactorizados
import { inicializarControlSidebar, manejarClicSubmenu, manejarNavegacionSidebar } from "./modulos/mensajero-sidebar.js";
import { inicializarEventosPWA } from "./modulos/mensajero-pwa.js";
import { procesarPayloadOStorage, buscarIndiceActivo } from "./modulos/mensajero-rutas.js";

// ⚡ Controller de mapa
import "./modulos/mapa/mapa-controlador.js";

console.log(" 🟢 [script2.js] Orquestador PWA modularizado cargado.");

// --- ESTADOS GLOBALES ---
let listaPedidosGlobal = [];
let indicePedidoActivo = 0;
let llamadasRealizadas = 0;

// Inicialización PWA
inicializarEventosPWA();

// Inicializador de Consola y Componentes
function inicializarConsolaYMenu() {
    console.log(" 🔄 [PWA_INIT]: Inicializando menú, visor y componentes...");
    
    // Activar controladores del menú y el sidebar
    inicializarControlSidebar();

    if (window.ImportadorMasivoMensajero && typeof window.ImportadorMasivoMensajero.vincularEscuchas === "function") {
        window.ImportadorMasivoMensajero.vincularEscuchas();
    }

    try {
        inicializarMapaMensajero();
    } catch (err) {
        console.warn(" ⚠️ [MAPA]: Error inicializando el mapa visor:", err);
    }

    inicializarRutaPayload();

    configurarEventosFormularioNovedad(
        () => listaPedidosGlobal[indicePedidoActivo],
        () => llamadasRealizadas,
        avanzarAlSiguientePedido
    );

    if (typeof sincronizarYRenderizarPool === "function") sincronizarYRenderizarPool();
    if (typeof sincronizarYRenderizarTransito === "function") sincronizarYRenderizarTransito();
}

document.addEventListener("modulosCargados", inicializarConsolaYMenu);
document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-include]")) {
        inicializarConsolaYMenu();
    }
});

// --- GESTIÓN DE RUTAS ---
function inicializarRutaPayload() {
    listaPedidosGlobal = procesarPayloadOStorage();
    determinarSiguientePedidoActivo();
    refrescarUI();
}

function determinarSiguientePedidoActivo() {
    indicePedidoActivo = buscarIndiceActivo(listaPedidosGlobal);
}

function refrescarUI() {
    renderizarConsolaOperaciones(listaPedidosGlobal, indicePedidoActivo, llamadasRealizadas);
}

function avanzarAlSiguientePedido() {
    listaPedidosGlobal = obtenerRutaZonificada();
    determinarSiguientePedidoActivo();
    refrescarUI();
}

// --- DELEGACIÓN GLOBAL DE EVENTOS ---
document.addEventListener("click", (e) => {
    // 1. Submenús (Acordeón)
    const btnSubmenu = e.target.closest(".btn-submenu-toggle");
    if (btnSubmenu) {
        e.stopPropagation();
        manejarClicSubmenu(btnSubmenu);
        return;
    }

    // 2. Navegación en el Sidebar
    const btnNav = e.target.closest(".sidebar .nav-btn:not(.btn-submenu-toggle)");
    if (btnNav) {
        manejarNavegacionSidebar(btnNav, (targetId) => {
            if (targetId === "pestana-ruta-activa" && typeof inicializarMapaMensajero === "function") {
                setTimeout(inicializarMapaMensajero, 100);
            }
        });
        return;
    }

    // 3. Modales
    if (e.target.classList.contains("cerrar-modal")) {
        const modal = e.target.closest(".modal-overlay");
        if (modal) modal.classList.remove("activo");
    }
    if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.remove("activo");
    }

    // 4. Tarjetas Interactivas
    const cardBtn = e.target.closest(".card-btn");
    if (cardBtn) {
        const targetId = cardBtn.getAttribute("data-target");
        if (targetId) {
            const targetElement = document.getElementById(targetId);
            if (targetElement && targetElement.classList.contains("contenedor-pestana")) {
                document.querySelectorAll(".contenedor-pestana").forEach((p) => p.classList.remove("activa"));
                document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));
                targetElement.classList.add("activa");

                const sidebarNavBtn = document.querySelector(`.sidebar .nav-btn[data-target="${targetId}"]`);
                if (sidebarNavBtn) sidebarNavBtn.classList.add("active");

                if (cardBtn.id === "btn-cargar-ruta" && typeof inicializarMapaMensajero === "function") {
                    setTimeout(inicializarMapaMensajero, 100);
                }
            }
        }
    }
});

// --- BINDINGS EN WINDOW ---
window.refrescarUI = refrescarUI;

window.ejecutarPasoAceptarPedido = function(idPedido) {
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "EN_CAMINO");
    refrescarUI();
};

window.ejecutarPasoNotificarLlegada = function(idPedido) {
    llamadasRealizadas = 0;
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "LLEGADO");
    refrescarUI();
};

window.ejecutarPasoFinalizarPedido = async function(idPedido) {
    const coords = await capturarCoordenadasGPS();
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "FINALIZADO", { coordenadasGPS: coords });
    avanzarAlSiguientePedido();
};

window.registrarIntentoLlamada = function() {
    registrarLlamadaFlujo(() => llamadasRealizadas, (v) => llamadasRealizadas = v, refrescarUI);
};

window.procesarCargaManualEnlace = function() {
    const inputTxt = document.getElementById("txt-payload-manual");
    if (inputTxt) {
        cargarRutaDesdeTextoOEnlace(inputTxt.value, (nuevasParadas) => {
            listaPedidosGlobal = nuevasParadas;
            indicePedidoActivo = 0;
            refrescarUI();
        });
    }
};

window.ejecutarProcesamientoIaCloud = function() {
    if (window.ImportadorMasivoMensajero && typeof window.ImportadorMasivoMensajero.ejecutarImportacionArchivo === "function") {
        window.ImportadorMasivoMensajero.ejecutarImportacionArchivo((nuevasParadas) => {
            listaPedidosGlobal = nuevasParadas;
            indicePedidoActivo = 0;
            refrescarUI();
        });
    } else {
        alert(">>> ALERTA: Subsistema de importación masiva no instanciado.");
    }
};

window.refrescarConsolaOperacionesUI = function() {
    listaPedidosGlobal = obtenerRutaZonificada() || [];
    determinarSiguientePedidoActivo();
    refrescarUI();
};

window.borrarParadaLocalUI = function(idParada) {
    if (confirm(`>>> ¿Desea borrar la parada ID: ${idParada}?`)) {
        listaPedidosGlobal = eliminarParadaLocal(idParada);
        determinarSiguientePedidoActivo();
        refrescarUI();
    }
};

window.purgarTodaLaRutaUI = function() {
    if (confirm(">>> ¿Desea borrar TODAS las paradas?")) {
        listaPedidosGlobal = borrarRutaCompletaLocal();
        indicePedidoActivo = 0;
        refrescarUI();
    }
};

window.prepararEdicionParadaUI = function(idParada) {
    const parada = listaPedidosGlobal.find((p) => p.id === idParada);
    if (!parada) return;

    if (document.getElementById("edit-parada-id")) document.getElementById("edit-parada-id").value = parada.id;
    if (document.getElementById("edit-parada-destinatario")) document.getElementById("edit-parada-destinatario").value = parada.destinatario || "";
    if (document.getElementById("edit-parada-direccion")) document.getElementById("edit-parada-direccion").value = parada.direccion || "";
    if (document.getElementById("edit-parada-telefono")) document.getElementById("edit-parada-telefono").value = parada.telefono || "";
    if (document.getElementById("edit-parada-ssc")) document.getElementById("edit-parada-ssc").value = parada.ssc || "";
    if (document.getElementById("edit-parada-cuota")) document.getElementById("edit-parada-cuota").value = parada.cuotaModeradora || "";

    const detailsForm = document.getElementById("details-formulario-parada");
    if (detailsForm) detailsForm.open = true;
};

window.limpiarFormularioParadaUI = function() {
    if (document.getElementById("edit-parada-id")) document.getElementById("edit-parada-id").value = "";
    if (document.getElementById("edit-parada-destinatario")) document.getElementById("edit-parada-destinatario").value = "";
    if (document.getElementById("edit-parada-direccion")) document.getElementById("edit-parada-direccion").value = "";
    if (document.getElementById("edit-parada-telefono")) document.getElementById("edit-parada-telefono").value = "";
    if (document.getElementById("edit-parada-ssc")) document.getElementById("edit-parada-ssc").value = "";
    if (document.getElementById("edit-parada-cuota")) document.getElementById("edit-parada-cuota").value = "";

    const detailsForm = document.getElementById("details-formulario-parada");
    if (detailsForm) detailsForm.open = false;
};

// --- BINDING CENTRALIZADO PARA INSERTAR DESDE EL MAPA ---
window.agregarParadaLocal = function (nuevaParadaDatos) {
    if (!nuevaParadaDatos || !nuevaParadaDatos.direccion) return;

    let rutaActual = obtenerRutaZonificada() || [];

    const nuevaParada = {
        id: `#PNT-${Math.floor(1000 + Math.random() * 9000)}`,
        ssc: nuevaParadaDatos.ssc || "N/A",
        destinatario: nuevaParadaDatos.destinatario || "Cliente Nuevo",
        direccion: nuevaParadaDatos.direccion,
        telefono: nuevaParadaDatos.telefono || "3000000000",
        puntoOrigen: "Cafam Cali Tequendama",
        cuotaModeradora: nuevaParadaDatos.cuotaModeradora || "$0",
        carga: "Medicamentos Dispensación",
        estado: "ASIGNADO",
        registroOperaciones: {},
        lat: nuevaParadaDatos.lat || null,
        lng: nuevaParadaDatos.lng || null
    };

    rutaActual.push(nuevaParada);
    guardarRutaZonificada(rutaActual);
    
    // Sincronizar estado global
    listaPedidosGlobal = rutaActual;
    determinarSiguientePedidoActivo();
    refrescarUI();

    console.log(`>>> [PARADA_AGREGADA_OK]: Parada en ${nuevaParada.direccion} guardada exitosamente.`);
};

// --- FUNCIÓN UNIFICADA Y SIN DUPLICADOS DEL FORMULARIO MANUAL ---
window.guardarParadaManualUI = function () {
    const id = document.getElementById("edit-parada-id")?.value;
    const destinatario = document.getElementById("edit-parada-destinatario")?.value.trim();
    const direccion = document.getElementById("edit-parada-direccion")?.value.trim();
    const telefono = document.getElementById("edit-parada-telefono")?.value.trim();
    const ssc = document.getElementById("edit-parada-ssc")?.value.trim();
    const cuotaModeradora = document.getElementById("edit-parada-cuota")?.value.trim();

    if (!destinatario || !direccion) {
        alert(">>> [ALERTA]: Por favor ingrese al menos el Destinatario y la Dirección.");
        return;
    }

    if (id) {
        // MODO EDICIÓN
        let rutaActual = obtenerRutaZonificada() || [];
        rutaActual = rutaActual.map((p) => {
            if (p.id === id) {
                return {
                    ...p,
                    destinatario,
                    direccion,
                    telefono: telefono || "3000000000",
                    ssc: ssc || "N/A",
                    cuotaModeradora: cuotaModeradora || "$0"
                };
            }
            return p;
        });

        guardarRutaZonificada(rutaActual);
        listaPedidosGlobal = rutaActual;
        determinarSiguientePedidoActivo();
        refrescarUI();
        window.limpiarFormularioParadaUI();
        alert(">>> [ÉXITO]: Parada actualizada correctamente en la base local.");
    } else {
        // MODO CREACIÓN
        window.agregarParadaLocal({
            destinatario,
            direccion,
            telefono,
            ssc,
            cuotaModeradora
        });
        window.limpiarFormularioParadaUI();
        alert(">>> [ÉXITO]: Parada guardada correctamente.");
    }
};