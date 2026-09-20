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
    eliminarParadaLocal,
    borrarRutaCompletaLocal
} from "./modulos/mensajero-persistencia.js";

import { inicializarMapaMensajero } from "./modulos/mapa/mapa-visor.js";
import { cargarRutaDesdeTextoOEnlace, ImportadorMasivoMensajero } from "./modulos/mensajero-importer.js";
import { renderizarConsolaOperaciones } from "./modulos/mensajero-ui.js";
import { registrarIntentoLlamada as registrarLlamadaFlujo, configurarEventosFormularioNovedad } from "./modulos/mensajero-flujo.js";

// Importación de módulos refactorizados
import { inicializarControlSidebar, manejarClicSubmenu, manejarNavegacionSidebar } from "./modulos/mensajero-sidebar.js";
import { inicializarEventosPWA } from "./modulos/mensajero-pwa.js";
import { procesarPayloadOStorage, buscarIndiceActivo } from "./modulos/mensajero-rutas.js";

// ⚡ Controller de mapa y planillas UI
import "./modulos/mapa/mapa-controlador.js";
import { cambiarPestanaPlanillas, cargarPlanillasReportadasUI } from "./modulos/planillas-ui.js";
import { exportarYRespaldarPlanillaPDF } from "./modulos/planillas-pdf-sync.js";

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
        console.log(" 📥 [PWA_INIT]: Vinculando escuchas del importador masivo...");
        window.ImportadorMasivoMensajero.vincularEscuchas();
    }

    try {
        console.log(" 🗺️ [PWA_INIT]: Invocando inicialización del visor del mapa...");
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

document.addEventListener("modulosCargados", () => {
    console.log(" 🔔 [EVENT]: Evento 'modulosCargados' capturado en script2.js.");
    inicializarConsolaYMenu();
});

document.addEventListener("DOMContentLoaded", () => {
    console.log(" 📄 [EVENT]: DOMContentLoaded disparado.");
    if (!document.querySelector("[data-include]")) {
        console.log(" ⚡ [EVENT]: Carga estática detectada (sin data-include). Ejecutando inicializarConsolaYMenu.");
        inicializarConsolaYMenu();
    }
});

// --- GESTIÓN DE RUTAS ---
function inicializarRutaPayload() {
    console.log(" 📦 [RUTAS]: Procesando payload o lectura de almacenamiento local...");
    listaPedidosGlobal = procesarPayloadOStorage();
    determinarSiguientePedidoActivo();
    refrescarUI();
}

function determinarSiguientePedidoActivo() {
    indicePedidoActivo = buscarIndiceActivo(listaPedidosGlobal);
    console.log(` 🎯 [RUTAS]: Indice activo determinado -> ${indicePedidoActivo}`);
}

function refrescarUI() {
    console.log(" 🎨 [UI_REFRESH]: Re-renderizando consola de operaciones...");
    renderizarConsolaOperaciones(listaPedidosGlobal, indicePedidoActivo, llamadasRealizadas);
}

function avanzarAlSiguientePedido() {
    console.log(" ⏭️ [RUTAS]: Avanzando al siguiente pedido...");
    listaPedidosGlobal = obtenerRutaZonificada();
    determinarSiguientePedidoActivo();
    refrescarUI();
}

// --- DELEGACIÓN GLOBAL DE EVENTOS ---
document.addEventListener("click", (e) => {
    // 1. Submenús (Acordeón)
    const btnSubmenu = e.target.closest(".btn-submenu-toggle");
    if (btnSubmenu) {
        console.log(" 📂 [DELEGACIÓN]: Clic en submenú toggle.");
        e.stopPropagation();
        manejarClicSubmenu(btnSubmenu);
        return;
    }

    // 2. Navegación en el Sidebar
    const btnNav = e.target.closest(".sidebar .nav-btn:not(.btn-submenu-toggle)");
    if (btnNav) {
        console.log(" 🚀 [DELEGACIÓN]: Clic en botón de navegación de Sidebar:", btnNav);
        manejarNavegacionSidebar(btnNav, (targetId) => {
            console.log(` 📍 [SIDEBAR_NAV]: Cambiando vista objetivo -> ${targetId}`);
            if (typeof window.alternarVistaPestaña === "function") {
                window.alternarVistaPestaña(targetId);
            }
        });
        return;
    }

    // 3. Modales
    if (e.target.classList.contains("cerrar-modal")) {
        console.log(" ✖️ [MODAL]: Cerrando modal por botón cerrar.");
        const modal = e.target.closest(".modal-overlay");
        if (modal) modal.classList.remove("activo");
    }
    if (e.target.classList.contains("modal-overlay")) {
        console.log(" ✖️ [MODAL]: Cerrando modal por clic fuera.");
        e.target.classList.remove("activo");
    }

    // 4. Tarjetas Interactivas
    const cardBtn = e.target.closest(".card-btn");
    if (cardBtn) {
        const targetId = cardBtn.getAttribute("data-target");
        console.log(` 🎴 [CARD_BTN]: Clic en tarjeta con data-target="${targetId}"`);
        if (targetId) {
            if (typeof window.alternarVistaPestaña === "function") {
                window.alternarVistaPestaña(targetId);
            }
        }
    }

    // 5. MÓDULO PLANILLAS: Cambio de Pestaña Interna (_GENERAR_PLANILLA / _PLANILLAS_REPORTADAS)
    const btnTabPlanilla = e.target.closest(".tab-btn[data-tab]");
    if (btnTabPlanilla) {
        const tabTarget = btnTabPlanilla.getAttribute("data-tab");
        console.log(` 📄 [PLANILLAS]: Clic en pestaña interna -> ${tabTarget}`);
        cambiarPestanaPlanillas(tabTarget);
        return;
    }

    // 6. MÓDULO PLANILLAS: Botón de Rescanalizar / Recargar
    const btnRescanalizar = e.target.closest("#btn-rescanalizar-planillas");
    if (btnRescanalizar) {
        console.log(" 🔄 [PLANILLAS]: Recargando planillas reportadas desde almacenamiento local...");
        cargarPlanillasReportadasUI();
        return;
    }

    // 7. MÓDULO PLANILLAS: Exportar PDF
    const btnExportarPdf = e.target.closest(".btn-exportar-planilla");
    if (btnExportarPdf) {
        const planillaId = btnExportarPdf.getAttribute("data-id");
        console.log(` 📄 [PLANILLAS]: Solicitud exportar PDF para planilla ID -> ${planillaId}`);
        exportarYRespaldarPlanillaPDF(planillaId);
        return;
    }
});

// --- NAVEGACIÓN SPA Y CONMUTACIÓN DE BARRA INFERIOR ---
export function alternarVistaPestaña(targetId) {
    console.log(` 🔄 [ALTERNAR_VISTA]: Iniciando transición a -> #${targetId}`);
    
    // 1. Ocultar todas las pestañas y activar la requerida
    const contenedores = document.querySelectorAll(".contenedor-pestana");
    contenedores.forEach((c) => c.classList.remove("activa"));

    const objetivo = document.getElementById(targetId);
    if (objetivo) {
        objetivo.classList.add("activa");
        console.log(` ✅ [ALTERNAR_VISTA]: Pestaña #${targetId} marcada como activa.`);
        
        // Cargar vista de planillas al navegar a su contenedor
        if (targetId === "pestana-notificaciones-planillas") {
            cargarPlanillasReportadasUI();
        }
    } else {
        console.warn(` ⚠️ [ALTERNAR_VISTA]: No se encontró el contenedor con ID '${targetId}' en el DOM.`);
    }

    // Actualizar resaltado de botones en sidebar
    document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));
    const sidebarNavBtn = document.querySelector(`.sidebar .nav-btn[data-target="${targetId}"]`);
    if (sidebarNavBtn) sidebarNavBtn.classList.add("active");

    // 2. Evaluar y conmutar la barra inferior
    if (targetId === "mapa-fullscreen-container") {
        console.log(" 🗺️ [BARRA_INFERIOR]: Cargando barra dinámica del MAPA (componentes/barra-inferior/mapa-barra-infe.html)...");
        if (typeof window.cargarBarraInferior === "function") {
            window.cargarBarraInferior("componentes/barra-inferior/mapa-barra-infe.html");
        } else {
            console.error(" ❌ [BARRA_INFERIOR]: 'window.cargarBarraInferior' no está definida en el entorno global.");
        }

        setTimeout(() => {
            if (window.mapaMensajero && typeof google !== "undefined") {
                console.log(" 📐 [MAPA]: Re-calculando dimensiones del mapa (resize)...");
                google.maps.event.trigger(window.mapaMensajero, "resize");
            }
        }, 150);
    } else {
        console.log(" 🏠 [BARRA_INFERIOR]: Cargando barra dinámica INICIO (componentes/barra-inferior/inicio-barra-infe.html)...");
        if (typeof window.cargarBarraInferior === "function") {
            window.cargarBarraInferior("componentes/barra-inferior/inicio-barra-infe.html");
        } else {
            console.error(" ❌ [BARRA_INFERIOR]: 'window.cargarBarraInferior' no está definida en el entorno global.");
        }
    }
}

/**
 * Función global para navegar utilizando alias de rutas.
 * @param {string} rutaVista - Ejemplo: 'vistas/ruta/mapa-activa.html'
 */
window.navegarA = function(rutaVista) {
    console.log(` 🧭 [NAVEGAR_A]: Invocado con la ruta -> ${rutaVista}`);
    if (rutaVista.includes("mapa-activa")) {
        alternarVistaPestaña("mapa-fullscreen-container");
    } else if (rutaVista.includes("ruta-activa")) {
        alternarVistaPestaña("pestana-ruta-activa");
    } else if (rutaVista.includes("crear")) {
        alternarVistaPestaña("pestana-ruta-crear");
    } else if (rutaVista.includes("historial")) {
        alternarVistaPestaña("pestana-monedero-historial");
    } else if (rutaVista.includes("saldo")) {
        alternarVistaPestaña("pestana-monedero-saldo");
    } else if (rutaVista.includes("planillas")) {
        alternarVistaPestaña("pestana-notificaciones-planillas");
    } else if (rutaVista.includes("reportes")) {
        alternarVistaPestaña("pestana-notificaciones-reportes");
    } else {
        console.warn(` ⚠️ [NAVEGAR_A]: Ruta no reconocida -> ${rutaVista}`);
    }
};

window.alternarVistaPestaña = alternarVistaPestaña;

// --- BINDINGS EN WINDOW PARA OPERACIONES EN BD Y UI ---
window.refrescarUI = refrescarUI;

window.ejecutarPasoAceptarPedido = function(idPedido) {
    console.log(` 📥 [OPERACION]: Aceptando pedido -> ${idPedido}`);
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "EN_CAMINO");
    refrescarUI();
};

window.ejecutarPasoNotificarLlegada = function(idPedido) {
    console.log(` 🔔 [OPERACION]: Notificando llegada para pedido -> ${idPedido}`);
    llamadasRealizadas = 0;
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "LLEGADO");
    refrescarUI();
};

window.ejecutarPasoFinalizarPedido = async function(idPedido) {
    console.log(` ✅ [OPERACION]: Finalizando pedido -> ${idPedido}`);
    const coords = await capturarCoordenadasGPS();
    listaPedidosGlobal = actualizarEstadoPedido(idPedido, "FINALIZADO", { coordenadasGPS: coords });
    avanzarAlSiguientePedido();
};

window.registrarIntentoLlamada = function() {
    console.log(" 📞 [OPERACION]: Registrando intento de llamada...");
    registrarLlamadaFlujo(() => llamadasRealizadas, (v) => llamadasRealizadas = v, refrescarUI);
};

window.procesarCargaManualEnlace = function() {
    const inputTxt = document.getElementById("txt-payload-manual");
    if (inputTxt) {
        console.log(" 📝 [OPERACION]: Cargando enlace/payload manual...");
        cargarRutaDesdeTextoOEnlace(inputTxt.value, (nuevasParadas) => {
            listaPedidosGlobal = nuevasParadas;
            indicePedidoActivo = 0;
            refrescarUI();
        });
    }
};

window.ejecutarProcesamientoIaCloud = function() {
    console.log(" 🤖 [OPERACION]: Ejecutando procesamiento IA Cloud...");
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
    console.log(" 🔄 [OPERACION]: Refrescando consola desde base local...");
    listaPedidosGlobal = obtenerRutaZonificada() || [];
    determinarSiguientePedidoActivo();
    refrescarUI();
};

window.borrarParadaLocalUI = function(idParada) {
    console.log(` 🗑️ [OPERACION]: Solicitud para borrar parada ID -> ${idParada}`);
    if (confirm(`>>> ¿Desea borrar la parada ID: ${idParada}?`)) {
        listaPedidosGlobal = eliminarParadaLocal(idParada);
        determinarSiguientePedidoActivo();
        refrescarUI();
    }
};

window.purgarTodaLaRutaUI = function() {
    console.log(" 🧹 [OPERACION]: Purgando toda la ruta local...");
    if (confirm(">>> ¿Desea borrar TODAS las paradas?")) {
        listaPedidosGlobal = borrarRutaCompletaLocal();
        indicePedidoActivo = 0;
        refrescarUI();
    }
};

window.prepararEdicionParadaUI = function(idParada) {
    console.log(` ✏️ [OPERACION]: Cargando parada en formulario para edición ID -> ${idParada}`);
    const parada = listaPedidosGlobal.find((p) => p.id === idParada);
    if (!parada) {
        console.warn(` ⚠️ [OPERACION]: No se encontró la parada con ID ${idParada}`);
        return;
    }

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
    console.log(" 🧼 [OPERACION]: Limpiando campos del formulario...");
    if (document.getElementById("edit-parada-id")) document.getElementById("edit-parada-id").value = "";
    if (document.getElementById("edit-parada-destinatario")) document.getElementById("edit-parada-destinatario").value = "";
    if (document.getElementById("edit-parada-direccion")) document.getElementById("edit-parada-direccion").value = "";
    if (document.getElementById("edit-parada-telefono")) document.getElementById("edit-parada-telefono").value = "";
    if (document.getElementById("edit-parada-ssc")) document.getElementById("edit-parada-ssc").value = "";
    if (document.getElementById("edit-parada-cuota")) document.getElementById("edit-parada-cuota").value = "";

    const detailsForm = document.getElementById("details-formulario-parada");
    if (detailsForm) detailsForm.open = false;
};

window.agregarParadaLocal = function (nuevaParadaDatos) {
    if (!nuevaParadaDatos || !nuevaParadaDatos.direccion) return;

    console.log(" ➕ [OPERACION]: Guardando nueva parada recibida:", nuevaParadaDatos);
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
    
    listaPedidosGlobal = rutaActual;
    determinarSiguientePedidoActivo();
    refrescarUI();

    console.log(` >>> [PARADA_AGREGADA_OK]: Parada en ${nuevaParada.direccion} guardada exitosamente.`);
};

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
        console.log(` 💾 [FORMULARIO]: Guardando cambios de edición para ID -> ${id}`);
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
        console.log(" 💾 [FORMULARIO]: Creando nueva parada manual...");
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