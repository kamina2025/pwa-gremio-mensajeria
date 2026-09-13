/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL Y ORQUESTADOR PWA TÁCTICO
 * Ubicación: pwa-mensajero/script2.js
 */
// --- CONFIGURACIÓN TELEMÁTICA DE ENDPOINT API (RESILIENTE A ENTORNO XAMPP) ---
if (typeof window !== "undefined") {
    const origin = window.location.origin; // e.g. http://localhost
    const pathname = window.location.pathname; // e.g. /pwa-gremio-mensajeria/pwa-mensajero/index2.html

    // Si la URL actual contiene la carpeta del proyecto en el path
    if (pathname.includes("/pwa-gremio-mensajeria/")) {
        window.ENDPOINT_API_PHP = `${origin}/pwa-gremio-mensajeria/api.php`;
    } else {
        // Fallback cuando Apache apunta DocumentRoot directamente a la carpeta del proyecto
        window.ENDPOINT_API_PHP = `${origin}/api.php`;
    }

    console.log(`>>> [CONFIG_ENDPOINT]: Apuntando backend API a -> ${window.ENDPOINT_API_PHP}`);
}

import { 
    guardarRutaZonificada, 
    obtenerRutaZonificada, 
    actualizarEstadoPedido, 
    capturarCoordenadasGPS,
    sincronizarYRenderizarPool,
    sincronizarYRenderizarTransito
} from "./modulos/mensajero-persistencia.js";

import { inicializarMapaMensajero } from "./modulos/mapa-mensajero-visor.js";
import { cargarRutaDesdeTextoOEnlace, ImportadorMasivoMensajero } from "./modulos/mensajero-importer.js";
import { renderizarConsolaOperaciones } from "./modulos/mensajero-ui.js";
import { 
    registrarIntentoLlamada as registrarLlamadaFlujo, 
    configurarEventosFormularioNovedad 
} from "./modulos/mensajero-flujo.js";

console.log(" 🟢 [script2.js] Orquestador PWA cargado e inicializado.");


// --- ESTADOS GLOBALES ---
let listaPedidosGlobal = [];
let indicePedidoActivo = 0;
let llamadasRealizadas = 0;
let deferredPrompt;

// 1. LÓGICA DE INSTALACIÓN PWA (Resiliente a carga asíncrona)
window.addEventListener("beforeinstallprompt", (e) => {
    console.log(" 📲 [PWA] Evento 'beforeinstallprompt' capturado.");
    e.preventDefault();
    deferredPrompt = e;
    
    const installBtn = document.getElementById("install-btn");
    if (installBtn) {
        installBtn.style.display = "inline-block";
    }
});

// 2. INICIALIZACIÓN DEL SISTEMA Y MENÚ (Sincronizado con app.js)
function inicializarConsolaYMenu() {
    console.log(" 🔄 [PWA_INIT] Evento 'modulosCargados' recibido. Vinculando componentes...");
    
    // --- Configuración de UI y Sidebar ---
    const dashboard = document.querySelector(".dashboard-container");
    const toggleMenuBtn = document.getElementById("toggle-menu-btn");

    if (toggleMenuBtn && dashboard) {
        toggleMenuBtn.onclick = () => {
            console.log(" 🔘 [Menu] Clic en #toggle-menu-btn. Alternando 'collapsed'.");
            dashboard.classList.toggle("collapsed");
        };
    }

    const installBtn = document.getElementById("install-btn");
    if (installBtn && deferredPrompt) {
        installBtn.style.display = "inline-block";
    }

    // --- Vincular escuchas de la carga masiva e IA Cloud ---
    if (window.ImportadorMasivoMensajero && typeof window.ImportadorMasivoMensajero.vincularEscuchas === "function") {
        window.ImportadorMasivoMensajero.vincularEscuchas();
    }

    // --- Configuración de Servicios Telemáticos y Ruta ---
    try {
        inicializarMapaMensajero();
    } catch (err) {
        console.warn(" ⚠️ [MAPA] Error al inicializar mapa visor:", err);
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

// Escuchar inyección dinámica de componentes desde app.js
document.addEventListener("modulosCargados", inicializarConsolaYMenu);

// Fallback por si la página no usa inyección dinámica y se carga de manera estática
document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector("[data-include]")) {
        console.log(" ⚡ [PWA_INIT] Carga estática detectada. Inicializando directamente...");
        inicializarConsolaYMenu();
    }
});

// --- LÓGICA DE GESTIÓN DE RUTAS Y PEDIDOS ---
function inicializarRutaPayload() {
    const urlParams = new URLSearchParams(window.location.search);
    const payloadRaw = urlParams.get("payload");

    if (payloadRaw) {
        try {
            listaPedidosGlobal = JSON.parse(decodeURIComponent(payloadRaw)).map(pedido => ({
                ...pedido,
                estado: pedido.estado || "ASIGNADO",
                registroOperaciones: pedido.registroOperaciones || {}
            }));
            console.log(` >>> [PAYLOAD_OK]: Se cargaron ${listaPedidosGlobal.length} pedidos desde URL.`);
            guardarRutaZonificada(listaPedidosGlobal);
        } catch (e) {
            console.error(" >>> [PAYLOAD_ERROR]: Error al deserializar payload URL:", e);
            listaPedidosGlobal = obtenerRutaZonificada();
        }
    } else {
        console.log(" >>> [STORAGE_READ]: Leyendo ruta zonificada desde almacenamiento local.");
        listaPedidosGlobal = obtenerRutaZonificada();
    }

    determinarSiguientePedidoActivo();
    refrescarUI();
}

function determinarSiguientePedidoActivo() {
    const index = listaPedidosGlobal.findIndex(p => p.estado !== "FINALIZADO" && p.estado !== "NOVEDAD");
    indicePedidoActivo = index !== -1 ? index : (listaPedidosGlobal.length > 0 ? listaPedidosGlobal.length - 1 : 0);
    console.log(` >>> [ESTADO_ACTIVO]: Pedido activo seleccionado en el índice ${indicePedidoActivo}`);
}

function refrescarUI() {
    console.log(" >>> [UI_REFRESH]: Actualizando consola de operaciones y mapa...");
    renderizarConsolaOperaciones(listaPedidosGlobal, indicePedidoActivo, llamadasRealizadas);
}

function avanzarAlSiguientePedido() {
    listaPedidosGlobal = obtenerRutaZonificada();
    determinarSiguientePedidoActivo();
    refrescarUI();
}

// 3. DELEGACIÓN GLOBAL DE EVENTOS (Navegación, Pestañas, Modales y Tarjetas)
document.addEventListener("click", (e) => {

    // 3a. Manejo de Submenús (Acordeón)
    const btnSubmenu = e.target.closest(".btn-submenu-toggle");
    if (btnSubmenu) {
        e.stopPropagation();
        const parentItem = btnSubmenu.closest(".menu-item-has-submenu");
        if (parentItem) {
            const submenusAbiertos = document.querySelectorAll(".menu-item-has-submenu.open");
            submenusAbiertos.forEach((item) => {
                if (item !== parentItem) item.classList.remove("open");
            });
            parentItem.classList.toggle("open");
        }
        return;
    }

    // 3b. Navegación Principal del Sidebar
    const btnNav = e.target.closest(".sidebar .nav-btn:not(.btn-submenu-toggle)");
    if (btnNav) {
        const targetId = btnNav.getAttribute("data-target");
        if (!targetId) return;

        const targetElement = document.getElementById(targetId);
        if (!targetElement) return;

        const dashboardContainer = document.querySelector(".dashboard-container");
        if (dashboardContainer) {
            dashboardContainer.classList.add("collapsed");
        }

        if (targetElement.classList.contains("modal-overlay")) {
            targetElement.classList.add("activo");
        } else if (targetElement.classList.contains("contenedor-pestana")) {
            document.querySelectorAll(".contenedor-pestana").forEach((p) => p.classList.remove("activa"));
            document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));

            targetElement.classList.add("activa");
            btnNav.classList.add("active");

            if (targetId === "pestana-ruta-activa") {
                setTimeout(() => {
                    if (typeof inicializarMapaMensajero === "function") inicializarMapaMensajero();
                }, 100);
            }
        }
    }

    // 3c y 3d. Control de Modales
    if (e.target.classList.contains("cerrar-modal")) {
        const modalPadre = e.target.closest(".modal-overlay");
        if (modalPadre) modalPadre.classList.remove("activo");
    }

    if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.remove("activo");
    }

    // 3e. Instalación PWA
    const installBtnClicked = e.target.closest("#install-btn");
    if (installBtnClicked && deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice) => {
            console.log(" 📲 [PWA] Elección de usuario:", choice.outcome);
            deferredPrompt = null;
            installBtnClicked.style.display = "none";
        });
    }

    // 3f. Tarjetas Interactivas
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
                if (sidebarNavBtn) {
                    sidebarNavBtn.classList.add("active");
                }

                if (cardBtn.id === "btn-cargar-ruta") {
                    setTimeout(() => {
                        if (typeof inicializarMapaMensajero === "function") inicializarMapaMensajero();
                    }, 100);
                }
            }
        }
    }
});

// --- BINDINGS EXPLICITOS A WINDOW (Llamados dinámicos desde mensajero-ui.js y crear.html) ---
window.ejecutarPasoAceptarPedido = function(idPedido) {
    console.log(` >>> [FLUJO_PASO_1]: Aceptando pedido ${idPedido}`);
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "EN_CAMINO");
    refrescarUI();
};

window.ejecutarPasoNotificarLlegada = function(idPedido) {
    console.log(` >>> [FLUJO_PASO_2]: Notificando llegada para ${idPedido}`);
    llamadasRealizadas = 0;
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "LLEGADO");
    refrescarUI();
};

window.ejecutarPasoFinalizarPedido = async function(idPedido) {
    console.log(` >>> [FLUJO_PASO_3]: Finalizando pedido ${idPedido}`);
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
    listaPedidosGlobal = obtenerRutaZonificada();
    determinarSiguientePedidoActivo();
    refrescarUI();
};
// --- BINDINGS PARA EDICIÓN, BORRADO Y PERSISTENCIA DE PARADAS ---

// 1. Borrar una parada individual
window.borrarParadaLocalUI = function(idParada) {
    if (confirm(`>>> ¿Está seguro de borrar la parada ID: ${idParada} de la base local?`)) {
        listaPedidosGlobal = eliminarParadaLocal(idParada);
        determinarSiguientePedidoActivo();
        refrescarUI();
        console.log(`>>> [UI]: Parada ${idParada} eliminada localmente.`);
    }
};

// 2. Purgar toda la ruta
window.purgarTodaLaRutaUI = function() {
    if (confirm(">>> ¿ALERTA: Desea borrar TODAS las paradas de la base de datos local?")) {
        listaPedidosGlobal = borrarRutaCompletaLocal();
        indicePedidoActivo = 0;
        refrescarUI();
        console.log(">>> [UI]: Base local purgada completamente.");
    }
};

// 3. Cargar datos de una parada en el formulario para editar
window.prepararEdicionParadaUI = function(idParada) {
    const parada = listaPedidosGlobal.find(p => p.id === idParada);
    if (!parada) return;

    document.getElementById("edit-parada-id").value = parada.id;
    document.getElementById("edit-parada-destinatario").value = parada.destinatario || "";
    document.getElementById("edit-parada-direccion").value = parada.direccion || "";
    document.getElementById("edit-parada-telefono").value = parada.telefono || "";
    document.getElementById("edit-parada-ssc").value = parada.ssc || "";
    document.getElementById("edit-parada-cuota").value = parada.cuotaModeradora || "";

    const detailsForm = document.getElementById("details-formulario-parada");
    if (detailsForm) detailsForm.open = true;
};

// 4. Limpiar formulario manual
window.limpiarFormularioParadaUI = function() {
    document.getElementById("edit-parada-id").value = "";
    document.getElementById("edit-parada-destinatario").value = "";
    document.getElementById("edit-parada-direccion").value = "";
    document.getElementById("edit-parada-telefono").value = "";
    document.getElementById("edit-parada-ssc").value = "";
    document.getElementById("edit-parada-cuota").value = "";
    
    const detailsForm = document.getElementById("details-formulario-parada");
    if (detailsForm) detailsForm.open = false;
};

// 5. Guardar parada manual (Nueva o Edición)
window.guardarParadaManualUI = function() {
    const id = document.getElementById("edit-parada-id").value;
    const destinatario = document.getElementById("edit-parada-destinatario").value.trim();
    const direccion = document.getElementById("edit-parada-direccion").value.trim();
    const telefono = document.getElementById("edit-parada-telefono").value.trim();
    const ssc = document.getElementById("edit-parada-ssc").value.trim();
    const cuotaModeradora = document.getElementById("edit-parada-cuota").value.trim();

    if (!destinatario || !direccion) {
        alert(">>> ALERTA: Ingrese al menos el Destinatario y la Dirección.");
        return;
    }

    let rutaActual = obtenerRutaZonificada();

    if (id) {
        // Modo Edición
        rutaActual = rutaActual.map(p => {
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
    } else {
        // Modo Creación Nueva Parada
        const nuevaParada = {
            id: `#PNT-${Math.floor(1000 + Math.random() * 9000)}`,
            ssc: ssc || "N/A",
            destinatario: destinatario,
            direccion: direccion,
            telefono: telefono || "3000000000",
            puntoOrigen: "Cafam Cali Tequendama",
            cuotaModeradora: cuotaModeradora || "$0",
            carga: "Medicamentos Dispensación",
            estado: "ASIGNADO",
            registroOperaciones: {}
        };
        rutaActual.push(nuevaParada);
    }

    guardarRutaZonificada(rutaActual);
    listaPedidosGlobal = rutaActual;
    determinarSiguientePedidoActivo();
    refrescarUI();
    limpiarFormularioParadaUI();
    alert(">>> PARADA GUARDADA EXITOSAMENTE EN LA BASE LOCAL.");
};