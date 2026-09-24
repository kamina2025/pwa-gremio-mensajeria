/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL Y ORQUESTADOR PWA TÁCTICO
 * Ubicación: pwa-mensajero/script2.js
 * Arquitectura: Async Local-First (IndexedDB / LocalStorage) con Invocación Cloud Multimodal
 */

// --- CONFIGURACIÓN DE ENDPOINT API (FALLBACK LOCAL) ---
if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    window.ENDPOINT_API_PHP = pathname.includes("/pwa-gremio-mensajeria/")
        ? `${origin}/pwa-gremio-mensajeria/api.php`
        : `${origin}/api.php`;
    console.log(`>>> [CONFIG_ENDPOINT]: API local apuntada a -> ${window.ENDPOINT_API_PHP}`);
}

import { 
    guardarRutaZonificada, 
    obtenerRutaZonificada, 
    obtenerParadasGuardadas,
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

// Importación de módulos auxiliares
import { inicializarControlSidebar, manejarClicSubmenu, manejarNavegacionSidebar } from "./modulos/mensajero-sidebar.js";
import { inicializarEventosPWA } from "./modulos/mensajero-pwa.js";
import { procesarPayloadOStorage, buscarIndiceActivo } from "./modulos/rutas/mensajero-rutas.js";

// Controller de mapa
import "./modulos/mapa/mapa-controlador.js";

// Importaciones Módulo Planillas
import { cambiarPestanaPlanillas, cargarPlanillasReportadasUI } from "./modulos/planilla/planillas-ui.js";
import { exportarYRespaldarPlanillaPDF } from "./modulos/planilla/planillas-pdf-sync.js";
import { guardarPlanillaReportada } from "./modulos/planilla/planillas-db.js";

// Importaciones Módulo Perfil del Conductor
import { cargarPerfilUI, manejarGuardarPerfil } from "./modulos/perfil/perfil-ui.js";

console.log(" 🟢 [script2.js] Orquestador PWA modularizado cargado.");

// --- EXPOSICIÓN GLOBAL DE FUNCIONES DE MÓDULOS EN WINDOW ---
window.manejarNavegacionSidebar = function(btnNav) {
    manejarNavegacionSidebar(btnNav, (targetId) => {
        console.log(` 📍 [SIDEBAR_NAV]: Cambiando vista objetivo -> ${targetId}`);
        if (typeof window.alternarVistaPestaña === "function") {
            window.alternarVistaPestaña(targetId);
        }
    });
};

window.manejarClicSubmenu = function(btnSubmenu, event) {
    manejarClicSubmenu(btnSubmenu, event);
};

window.cargarPerfilUI = cargarPerfilUI;
window.manejarGuardarPerfil = manejarGuardarPerfil;
window.cambiarPestanaPlanillas = cambiarPestanaPlanillas;
window.cargarPlanillasReportadasUI = cargarPlanillasReportadasUI;

// --- ESTADOS GLOBALES ---
let listaPedidosGlobal = [];
let indicePedidoActivo = 0;
let llamadasRealizadas = 0;

// Inicialización PWA
inicializarEventosPWA();

// Inicializador de Consola y Componentes
async function inicializarConsolaYMenu() {
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

    await inicializarRutaPayload();

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

// --- GESTIÓN DE RUTAS ASÍNCRONAS ---
async function inicializarRutaPayload() {
    console.log(" 📦 [RUTAS]: Procesando payload o lectura de almacenamiento local...");
    const resultado = await procesarPayloadOStorage();
    listaPedidosGlobal = Array.isArray(resultado) ? resultado : [];
    await determinarSiguientePedidoActivo();
    refrescarUI();
}

async function determinarSiguientePedidoActivo() {
    indicePedidoActivo = await buscarIndiceActivo(listaPedidosGlobal);
    console.log(` 🎯 [RUTAS]: Indice activo determinado -> ${indicePedidoActivo}`);
}

function refrescarUI() {
    console.log(" 🎨 [UI_REFRESH]: Re-renderizando consola de operaciones...");
    renderizarConsolaOperaciones(listaPedidosGlobal, indicePedidoActivo, llamadasRealizadas);
}

async function avanzarAlSiguientePedido() {
    console.log(" ⏭️ [RUTAS]: Avanzando al siguiente pedido...");
    const resultado = await obtenerParadasGuardadas();
    listaPedidosGlobal = Array.isArray(resultado) ? resultado : [];
    await determinarSiguientePedidoActivo();
    refrescarUI();
}

// --- DELEGACIÓN GLOBAL DE EVENTOS ---
document.addEventListener("click", (e) => {
    // 1. Submenús (Acordeón)
    const btnSubmenu = e.target.closest(".btn-submenu-toggle");
    if (btnSubmenu) {
        console.log(" 📂 [DELEGACIÓN]: Clic en submenú toggle.");
        e.stopPropagation();
        manejarClicSubmenu(btnSubmenu, e);
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

    // 5. MÓDULO PLANILLAS: Cambio de Pestaña Interna
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

    // 7. MÓDULO PLANILLAS: Exportar PDF con Notificación de Progreso
    const btnExportarPdf = e.target.closest(".btn-exportar-planilla");
    if (btnExportarPdf) {
        const planillaId = btnExportarPdf.getAttribute("data-id");
        console.log(` 📄 [PLANILLAS]: Solicitud exportar PDF para planilla ID -> ${planillaId}`);
        
        const toastId = `pdf-${planillaId}`;
        if (typeof window.mostrarAvisoProceso === 'function') {
            window.mostrarAvisoProceso({
                id: toastId,
                titulo: 'Exportando PDF',
                mensaje: 'Generando archivo de planilla y respaldo...',
                estado: 'procesando',
                progreso: 30
            });
        }

        exportarYRespaldarPlanillaPDF(planillaId).then(() => {
            if (typeof window.actualizarProgresoProceso === 'function') {
                window.actualizarProgresoProceso(toastId, 100, '¡PDF generado exitosamente!', 'exito');
            }
            if (typeof window.cerrarAvisoProceso === 'function') {
                window.cerrarAvisoProceso(toastId, 1800);
            }
        }).catch((err) => {
            console.error("❌ [PLANILLAS]: Error al exportar PDF:", err);
            if (typeof window.mostrarAvisoProceso === 'function') {
                window.mostrarAvisoProceso({
                    id: toastId,
                    titulo: 'Error de Exportación',
                    mensaje: 'No se pudo generar el documento PDF.',
                    estado: 'error',
                    progreso: 100,
                    acciones: [{ texto: 'Cerrar', clase: 'danger', accion: (id) => window.cerrarAvisoProceso(id) }]
                });
            }
        });
        return;
    }
});

// --- NAVEGACIÓN SPA Y CONMUTACIÓN DE BARRA INFERIOR ---
export function alternarVistaPestaña(targetId) {
    console.log(` 🔄 [ALTERNAR_VISTA]: Iniciando transición a -> #${targetId}`);
    
    const contenedores = document.querySelectorAll(".contenedor-pestana");
    contenedores.forEach((c) => c.classList.remove("activa"));

    const objetivo = document.getElementById(targetId);
    if (objetivo) {
        objetivo.classList.add("activa");
        console.log(` ✅ [ALTERNAR_VISTA]: Pestaña #${targetId} marcada como activa.`);
        
        if (targetId === "pestana-notificaciones-planillas") {
            cargarPlanillasReportadasUI();
        } else if (targetId === "pestana-perfil-conductor") {
            if (typeof cargarPerfilUI === "function") {
                console.log(" 👤 [PERFIL]: Cargando datos del perfil desde almacenamiento local...");
                cargarPerfilUI();
            }
        }
    } else {
        console.warn(` ⚠️ [ALTERNAR_VISTA]: No se encontró el contenedor con ID '${targetId}' en el DOM.`);
    }

    document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));
    const sidebarNavBtn = document.querySelector(`.sidebar .nav-btn[data-target="${targetId}"]`);
    if (sidebarNavBtn) sidebarNavBtn.classList.add("active");

    if (targetId === "mapa-fullscreen-container") {
        console.log(" 🗺️ [BARRA_INFERIOR]: Cargando barra dinámica del MAPA...");
        if (typeof window.cargarBarraInferior === "function") {
            window.cargarBarraInferior("componentes/barra-inferior/mapa-barra-infe.html");
        }
        setTimeout(() => {
            if (window.mapaMensajero && typeof google !== "undefined") {
                console.log(" 📐 [MAPA]: Re-calculando dimensiones del mapa (resize)...");
                google.maps.event.trigger(window.mapaMensajero, "resize");
            }
        }, 150);
    } else {
        console.log(" 🏠 [BARRA_INFERIOR]: Cargando barra dinámica INICIO...");
        if (typeof window.cargarBarraInferior === "function") {
            window.cargarBarraInferior("componentes/barra-inferior/inicio-barra-infe.html");
        }
    }
}

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
    } else if (rutaVista.includes("conductor")) {
        alternarVistaPestaÑA("pestana-perfil-conductor");
    } else {
        console.warn(` ⚠️ [NAVEGAR_A]: Ruta no reconocida -> ${rutaVista}`);
    }
};

window.alternarVistaPestaña = alternarVistaPestaña;
window.refrescarUI = refrescarUI;

// --- BINDINGS EN WINDOW CON ANIMACIÓN Y AVISOS DE PROCESOS ---

window.ejecutarPasoAceptarPedido = async function(idPedido) {
    console.log(` 📥 [OPERACION]: Aceptando pedido -> ${idPedido}`);
    
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: `aceptar-${idPedido}`,
            titulo: 'Aceptando Pedido',
            mensaje: 'Actualizando estado en base local...',
            estado: 'procesando',
            progreso: 50
        });
    }

    listaPedidosGlobal = await actualizarEstadoPedido(idPedido, "EN_CAMINO");
    refrescarUI();

    if (typeof window.actualizarProgresoProceso === 'function') {
        window.actualizarProgresoProceso(`aceptar-${idPedido}`, 100, '¡Pedido En Camino!', 'exito');
        window.cerrarAvisoProceso(`aceptar-${idPedido}`, 1200);
    }
};

window.ejecutarPasoNotificarLlegada = async function(idPedido) {
    console.log(` 🔔 [OPERACION]: Notificando llegada para pedido -> ${idPedido}`);
    
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: `llegada-${idPedido}`,
            titulo: 'Notificando Llegada',
            mensaje: 'Registrando estado de arribo...',
            estado: 'procesando',
            progreso: 50
        });
    }

    llamadasRealizadas = 0;
    listaPedidosGlobal = await actualizarEstadoPedido(idPedido, "LLEGADO");
    refrescarUI();

    if (typeof window.actualizarProgresoProceso === 'function') {
        window.actualizarProgresoProceso(`llegada-${idPedido}`, 100, '¡Arribo Registrado!', 'exito');
        window.cerrarAvisoProceso(`llegada-${idPedido}`, 1200);
    }
};

window.ejecutarPasoFinalizarPedido = async function(idPedido) {
    console.log(` ✅ [OPERACION]: Finalizando pedido -> ${idPedido}`);
    const toastId = `fin-${idPedido}`;

    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: toastId,
            titulo: 'Finalizando Pedido',
            mensaje: 'Obteniendo coordenadas GPS de entrega...',
            estado: 'procesando',
            progreso: 30
        });
    }

    try {
        const coords = await capturarCoordenadasGPS();
        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 70, 'Guardando evidencia y avanzando...');
        }

        listaPedidosGlobal = await actualizarEstadoPedido(idPedido, "FINALIZADO", { coordenadasGPS: coords });
        await avanzarAlSiguientePedido();

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Entrega registrada con éxito!', 'exito');
            window.cerrarAvisoProceso(toastId, 1500);
        }
    } catch (err) {
        console.error("❌ Error finalizando pedido:", err);
        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, 'Error al capturar ubicación GPS', 'error');
            window.cerrarAvisoProceso(toastId, 2500);
        }
    }
};

window.registrarIntentoLlamada = function() {
    console.log(" 📞 [OPERACION]: Registrando intento de llamada...");
    registrarLlamadaFlujo(() => llamadasRealizadas, (v) => llamadasRealizadas = v, refrescarUI);
};

window.procesarCargaManualEnlace = function() {
    const inputTxt = document.getElementById("txt-payload-manual");
    if (inputTxt && inputTxt.value.trim()) {
        console.log(" 📝 [OPERACION]: Cargando enlace/payload manual...");
        
        const toastId = 'carga-manual';
        if (typeof window.mostrarAvisoProceso === 'function') {
            window.mostrarAvisoProceso({
                id: toastId,
                titulo: 'Procesando Enlace',
                mensaje: 'Decodificando paradas de la ruta...',
                estado: 'procesando',
                progreso: 30
            });
        }

        cargarRutaDesdeTextoOEnlace(inputTxt.value, async (nuevasParadas) => {
            if (typeof window.actualizarProgresoProceso === 'function') {
                window.actualizarProgresoProceso(toastId, 80, 'Actualizando consola y mapa...');
            }

            listaPedidosGlobal = nuevasParadas;
            await determinarSiguientePedidoActivo();
            refrescarUI();

            if (typeof window.actualizarProgresoProceso === 'function') {
                window.actualizarProgresoProceso(toastId, 100, '¡Ruta cargada exitosamente!', 'exito');
                window.cerrarAvisoProceso(toastId, 1500);
            }
        });
    } else {
        alert("⚠️ [ALERTA]: Por favor ingrese un texto o enlace de payload válido.");
    }
};

window.ejecutarProcesamientoIaCloud = async function() {
    const loteArchivos = typeof window.obtenerLoteFotosActual === "function" 
        ? window.obtenerLoteFotosActual() 
        : [];

    if (loteArchivos.length === 0) {
        if (typeof window.notificarError === "function") {
            window.notificarError("LOTE VACÍO", "Capture o seleccione al menos una foto antes de procesar.");
        } else {
            alert("⚠️ Capture al menos una foto antes de procesar.");
        }
        return;
    }

    console.log(`🤖 [OPERACION]: Enviando lote de ${loteArchivos.length} fotos a IA Cloud...`);

    // Abrir Modal de Progreso Cyberpunk
    if (window.visorAnimaciones && typeof window.visorAnimaciones.mostrarModal === "function") {
        window.visorAnimaciones.mostrarModal("EXTRAYENDO DATOS CON IA CLOUD", `Procesando 0 de ${loteArchivos.length} tirillas...`);
    }

    try {
        // Enviar la lista completa al importador masivo
        if (window.ImportadorMasivoMensajero && typeof window.ImportadorMasivoMensajero.ejecutarImportacionLote === "function") {
            
            await window.ImportadorMasivoMensajero.ejecutarImportacionLote(loteArchivos, (progresoActual, total) => {
                // Actualizar la barra y porcentaje en tiempo real
                if (window.visorAnimaciones && typeof window.visorAnimaciones.actualizarProgreso === "function") {
                    window.visorAnimaciones.actualizarProgreso(progresoActual, total, `Analizando tirilla ${progresoActual} de ${total}...`);
                }
            }, async (nuevasParadas) => {
                listaPedidosGlobal = nuevasParadas;
                await determinarSiguientePedidoActivo();
                refrescarUI();

                // Ocultar modal y limpiar el lote
                if (window.visorAnimaciones && typeof window.visorAnimaciones.ocultarModal === "function") {
                    window.visorAnimaciones.ocultarModal();
                }
                if (typeof window.limpiarLoteFotos === "function") {
                    window.limpiarLoteFotos();
                }
                if (typeof window.notificarExito === "function") {
                    window.notificarExito("PROCESO COMPLETADO", `Se extrajeron ${nuevasParadas.length} paradas exitosamente.`);
                }
            });

        } else {
            alert("⚠️ Subsistema de importación por lote no configurado.");
            if (window.visorAnimaciones) window.visorAnimaciones.ocultarModal();
        }
    } catch (err) {
        console.error("❌ [IA_CLOUD]: Error al procesar el lote:", err);
        if (window.visorAnimaciones) window.visorAnimaciones.ocultarModal();
        if (typeof window.notificarError === "function") {
            window.notificarError("ERROR IA CLOUD", err.message || "Fallo en el procesamiento masivo.");
        }
    }
};

window.refrescarConsolaOperacionesUI = async function(paradasOpcionales) {
    console.log(" 🔄 [OPERACION]: Refrescando consola desde base local...");
    const paradas = paradasOpcionales || await obtenerParadasGuardadas();
    listaPedidosGlobal = Array.isArray(paradas) ? paradas : [];
    await determinarSiguientePedidoActivo();
    refrescarUI();
};

window.borrarParadaLocalUI = async function(idParada) {
    console.log(` 🗑️ [OPERACION]: Solicitud para borrar parada ID -> ${idParada}`);
    if (confirm(`>>> ¿Desea borrar la parada ID: ${idParada}?`)) {
        listaPedidosGlobal = await eliminarParadaLocal(idParada);
        await determinarSiguientePedidoActivo();
        refrescarUI();
    }
};

window.purgarTodaLaRutaUI = async function() {
    console.log(" 🧹 [OPERACION]: Purgando toda la ruta local...");
    if (confirm(">>> ¿Desea borrar TODAS las paradas?")) {
        const toastId = 'purgar-ruta';
        if (typeof window.mostrarAvisoProceso === 'function') {
            window.mostrarAvisoProceso({
                id: toastId,
                titulo: 'Eliminando Ruta',
                mensaje: 'Limpiando IndexedDB y registros...',
                estado: 'procesando',
                progreso: 50
            });
        }

        listaPedidosGlobal = await borrarRutaCompletaLocal();
        indicePedidoActivo = 0;
        refrescarUI();

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Ruta purgada completamente!', 'advertencia');
            window.cerrarAvisoProceso(toastId, 1500);
        }
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

window.agregarParadaLocal = async function (nuevaParadaDatos) {
    if (!nuevaParadaDatos || !nuevaParadaDatos.direccion) return;

    console.log(" ➕ [OPERACION]: Guardando nueva parada recibida:", nuevaParadaDatos);
    let rutaActual = (await obtenerParadasGuardadas()) || [];

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
    await guardarRutaZonificada(rutaActual);
    
    listaPedidosGlobal = rutaActual;
    await determinarSiguientePedidoActivo();
    refrescarUI();

    console.log(` >>> [PARADA_AGREGADA_OK]: Parada en ${nuevaParada.direccion} guardada exitosamente.`);
};

window.guardarParadaManualUI = async function () {
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

    const toastId = 'guardar-parada';
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: toastId,
            titulo: id ? 'Actualizando Parada' : 'Creando Parada',
            mensaje: 'Sincronizando con almacenamiento IndexedDB...',
            estado: 'procesando',
            progreso: 40
        });
    }

    if (id) {
        console.log(` 💾 [FORMULARIO]: Guardando cambios de edición para ID -> ${id}`);
        let rutaActual = (await obtenerParadasGuardadas()) || [];
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

        await guardarRutaZonificada(rutaActual);
        listaPedidosGlobal = rutaActual;
        await determinarSiguientePedidoActivo();
        refrescarUI();
        window.limpiarFormularioParadaUI();
    } else {
        console.log(" 💾 [FORMULARIO]: Creando nueva parada manual...");
        await window.agregarParadaLocal({
            destinatario,
            direccion,
            telefono,
            ssc,
            cuotaModeradora
        });
        window.limpiarFormularioParadaUI();
    }

    if (typeof window.actualizarProgresoProceso === 'function') {
        window.actualizarProgresoProceso(toastId, 100, '¡Parada guardada con éxito!', 'exito');
        window.cerrarAvisoProceso(toastId, 1500);
    }
};

window.iniciarRutaCompleta = async function() {
    console.log("🚀 [OPERACION]: Iniciando recorrido completo de la ruta...");
    listaPedidosGlobal = (await obtenerParadasGuardadas()) || [];

    if (!listaPedidosGlobal || listaPedidosGlobal.length === 0) {
        alert("⚠️ [ALERTA]: No hay paradas en la ruta para iniciar.");
        return;
    }

    indicePedidoActivo = 0;
    refrescarUI();

    if (typeof window.alternarVistaPestaña === "function") {
        window.alternarVistaPestaña("mapa-fullscreen-container");
    }

    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: 'inicio-ruta',
            titulo: 'Ruta Iniciada',
            mensaje: 'Navegando a la primera parada en el mapa.',
            estado: 'exito',
            progreso: 100
        });
        window.cerrarAvisoProceso('inicio-ruta', 2000);
    }
};

window.generarPlanillaDesdeRuta = async function() {
    console.log("📝 [OPERACION]: Generando planilla desde la ruta activa...");
    const paradasActuales = (await obtenerParadasGuardadas()) || [];

    if (!paradasActuales || paradasActuales.length === 0) {
        alert("⚠️ [ALERTA]: No hay datos de paradas para planillar.");
        return;
    }

    const toastId = `planilla-${Date.now()}`;
    if (typeof window.mostrarAvisoProceso === 'function') {
        window.mostrarAvisoProceso({
            id: toastId,
            titulo: 'Generando Planilla',
            mensaje: 'Procesando historial y estados SCC...',
            estado: 'procesando',
            progreso: 30
        });
    }

    const listaScc = paradasActuales.map(p => p.ssc || p.id).join(", ");
    const estadosScc = paradasActuales.every(p => p.estado === "FINALIZADO") ? "Entregado" : "Devuelto";

    const paradasDetalle = paradasActuales.map(p => ({
        id: p.id,
        ssc: p.ssc || p.id,
        destinatario: p.destinatario || 'Cliente General',
        direccion: p.direccion || 'Dirección no especificada',
        telefono: p.telefono || 'N/A',
        cuotaModeradora: p.cuotaModeradora || '$0',
        estado: p.estado === 'FINALIZADO' ? 'ENTREGADO' : (p.estado || 'DEVUELTO'),
        registroOperaciones: p.registroOperaciones || {}
    }));

    const nuevaPlanilla = {
        scc: listaScc,
        fecha: new Date().toLocaleDateString("es-CO"),
        nombreMensajero: localStorage.getItem("nombreMensajero") || "Mensajero Acreditado",
        placaMensajero: localStorage.getItem("placaMensajero") || "MXX-000",
        estadoScc: estadosScc,
        paradas: paradasDetalle,
        creadoEn: new Date().toISOString()
    };

    try {
        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 75, 'Guardando en módulo de planillas...');
        }

        await guardarPlanillaReportada(nuevaPlanilla);

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Planilla guardada exitosamente!', 'exito');
            window.cerrarAvisoProceso(toastId, 1500);
        }

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/notificaciones/planillas.html");
        }
    } catch (err) {
        console.error("❌ [PLANILLA]: Error generando planilla:", err);
        if (typeof window.mostrarAvisoProceso === 'function') {
            window.mostrarAvisoProceso({
                id: toastId,
                titulo: 'Error de Planilla',
                mensaje: 'Ocurrió un fallo al guardar la planilla local.',
                estado: 'error',
                progreso: 100,
                acciones: [{ texto: 'Cerrar', clase: 'danger', accion: (id) => window.cerrarAvisoProceso(id) }]
            });
        }
    }
};