/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL Y ORQUESTADOR PWA TÁCTICO
 * Ubicación: pwa-mensajero/script2.js
 * Arquitectura: Async Local-First (IndexedDB / LocalStorage) con Invocación Cloud Multimodal
 */

import { 
    guardarRutaZonificada, 
    obtenerParadasGuardadas,
    sincronizarYRenderizarPool,
    sincronizarYRenderizarTransito
} from "./modulos/mensajero-persistencia.js";

import { inicializarMapaMensajero, refrescarLienzoMapa } from "./modulos/mapa/mapa-visor.js";
import { ImportadorMasivoMensajero } from "./modulos/mensajero-importer.js";
import { registrarIntentoLlamada as registrarLlamadaFlujo, configurarEventosFormularioNovedad } from "./modulos/mensajero-flujo.js";

// Submódulos desacoplados
import { 
    inicializarRutaPayload, 
    obtenerListaPedidosGlobal, 
    obtenerIndicePedidoActivo, 
    obtenerLlamadasRealizadas, 
    setLlamadasRealizadas, 
    refrescarUI, 
    avanzarAlSiguientePedido,
    determinarSiguientePedidoActivo,
    ejecutarPasoAceptarPedido,
    ejecutarPasoNotificarLlegada,
    ejecutarPasoFinalizarPedido,
    borrarParadaLocalUI,
    purgarTodaLaRutaUI,
    iniciarRutaCompleta
} from "./modulos/rutas/rutas-orquestador-flujo.js";

import { procesarCargaManualEnlace } from "./modulos/importer/carga-manual-handler.js";
import { inicializarControlSidebar, manejarClicSubmenu, manejarNavegacionSidebar } from "./modulos/mensajero-sidebar.js";
import { inicializarEventosPWA } from "./modulos/mensajero-pwa.js";

// Controller de mapa
import "./modulos/mapa/mapa-controlador.js";

// Importaciones Módulo Planillas
import { cambiarPestanaPlanillas, cargarPlanillasReportadasUI } from "./modulos/planilla/planillas-ui.js";
import { exportarYRespaldarPlanillaPDF } from "./modulos/planilla/planillas-pdf-sync.js";
import { guardarPlanillaReportada } from "./modulos/planilla/planillas-db.js";

// Importaciones Módulo Perfil del Conductor
import { cargarPerfilUI, manejarGuardarPerfil } from "./modulos/perfil/perfil-ui.js";

// --- CONFIGURACIÓN DE ENDPOINT API (FALLBACK LOCAL) ---
if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    window.ENDPOINT_API_PHP = pathname.includes("/pwa-gremio-mensajeria/")
        ? `${origin}/pwa-gremio-mensajeria/api.php`
        : `${origin}/api.php`;
    console.log(`🌐 [CONFIG_ENDPOINT]: API local configurada -> ${window.ENDPOINT_API_PHP}`);
}

console.log("🟢 [script2.js]: Orquestador PWA modularizado cargado.");

// --- EXPOSICIÓN GLOBAL EN WINDOW ---
window.manejarNavegacionSidebar = (btnNav) => {
    manejarNavegacionSidebar(btnNav, (targetId) => {
        console.log(`📍 [SIDEBAR_NAV]: Cambiando vista objetivo -> ${targetId}`);
        if (typeof window.alternarVistaPestaña === "function") {
            window.alternarVistaPestaña(targetId);
        }
    });
};

window.manejarClicSubmenu = manejarClicSubmenu;
window.cargarPerfilUI = cargarPerfilUI;
window.manejarGuardarPerfil = manejarGuardarPerfil;
window.cambiarPestanaPlanillas = cambiarPestanaPlanillas;
window.cargarPlanillasReportadasUI = cargarPlanillasReportadasUI;
window.ejecutarPasoAceptarPedido = ejecutarPasoAceptarPedido;
window.ejecutarPasoNotificarLlegada = ejecutarPasoNotificarLlegada;
window.ejecutarPasoFinalizarPedido = ejecutarPasoFinalizarPedido;
window.borrarParadaLocalUI = borrarParadaLocalUI;
window.purgarTodaLaRutaUI = purgarTodaLaRutaUI;
window.iniciarRutaCompleta = iniciarRutaCompleta;
window.procesarCargaManualEnlace = procesarCargaManualEnlace;
window.refrescarLienzoMapa = refrescarLienzoMapa;

// Inicialización PWA
inicializarEventosPWA();

// Banderas de control
let aplicacionInicializada = false;

// --- INICIALIZADOR DE CONSOLA Y COMPONENTES ---
async function inicializarConsolaYMenu() {
    if (aplicacionInicializada) {
        console.log("ℹ️ [PWA_INIT]: Inicialización ya ejecutada previamente. Omitiendo duplicados.");
        return;
    }
    aplicacionInicializada = true;

    console.group("🔄 [PWA_INIT]: Inicializando componentes y orquestador...");

    try {
        inicializarControlSidebar();

        if (window.ImportadorMasivoMensajero?.vincularEscuchas) {
            console.log("📥 [PWA_INIT]: Vinculando escuchas del importador masivo...");
            window.ImportadorMasivoMensajero.vincularEscuchas();
        }

        console.log("🗺️ [PWA_INIT]: Inicializando visor de mapa...");
        const mapa = inicializarMapaMensajero();
        if (!mapa) {
            console.log("⏳ [PWA_INIT]: Mapa en estado de espera por carga de elementos DOM.");
        }

        await inicializarRutaPayload();

        configurarEventosFormularioNovedad(
            () => obtenerListaPedidosGlobal()[obtenerIndicePedidoActivo()],
            () => obtenerLlamadasRealizadas(),
            avanzarAlSiguientePedido
        );

        if (typeof sincronizarYRenderizarPool === "function") await sincronizarYRenderizarPool();
        if (typeof sincronizarYRenderizarTransito === "function") await sincronizarYRenderizarTransito();

        console.log("✅ [PWA_INIT]: Inicialización de componentes completada.");
    } catch (err) {
        console.error("❌ [PWA_INIT_ERROR]: Fallo crítico durante la inicialización:", err);
    } finally {
        console.groupEnd();
    }
}

// Escuchadores de Inicialización
document.addEventListener("modulosCargados", () => {
    console.log("🔔 [EVENT]: Evento 'modulosCargados' capturado.");
    inicializarConsolaYMenu();
});

document.addEventListener("DOMContentLoaded", () => {
    console.log("📄 [EVENT]: DOMContentLoaded detectado.");
    if (!document.querySelector("[data-include]")) {
        console.log("⚡ [EVENT]: Estructura estática. Inicializando componentes...");
        inicializarConsolaYMenu();
    }
});

// --- DELEGACIÓN GLOBAL DE EVENTOS DE CLIC ---
document.addEventListener("click", (e) => {
    const btnSubmenu = e.target.closest(".btn-submenu-toggle");
    if (btnSubmenu) {
        e.stopPropagation();
        manejarClicSubmenu(btnSubmenu, e);
        return;
    }

    const btnNav = e.target.closest(".sidebar .nav-btn:not(.btn-submenu-toggle)");
    if (btnNav) {
        window.manejarNavegacionSidebar(btnNav);
        return;
    }

    if (e.target.classList.contains("cerrar-modal") || e.target.classList.contains("modal-overlay")) {
        const modal = e.target.closest(".modal-overlay") || e.target;
        modal.classList.remove("activo");
        return;
    }

    const cardBtn = e.target.closest(".card-btn");
    if (cardBtn) {
        const targetId = cardBtn.getAttribute("data-target");
        if (targetId && typeof window.alternarVistaPestaña === "function") {
            window.alternarVistaPestaña(targetId);
        }
        return;
    }

    const btnTabPlanilla = e.target.closest(".tab-btn[data-tab]");
    if (btnTabPlanilla) {
        cambiarPestanaPlanillas(btnTabPlanilla.getAttribute("data-tab"));
        return;
    }

    const btnRescanalizar = e.target.closest("#btn-rescanalizar-planillas");
    if (btnRescanalizar) {
        cargarPlanillasReportadasUI();
        return;
    }

    const btnExportarPdf = e.target.closest(".btn-exportar-planilla");
    if (btnExportarPdf) {
        const planillaId = btnExportarPdf.getAttribute("data-id");
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

        exportarYRespaldarPlanillaPDF(planillaId)
            .then(() => {
                if (typeof window.actualizarProgresoProceso === 'function') {
                    window.actualizarProgresoProceso(toastId, 100, '¡PDF generado exitosamente!', 'exito');
                }
                if (typeof window.cerrarAvisoProceso === 'function') {
                    window.cerrarAvisoProceso(toastId, 1800);
                }
            })
            .catch((err) => {
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

// --- NAVEGACIÓN SPA Y CONMUTACIÓN DE VISTAS ---
export function alternarVistaPestaña(targetId) {
    console.log(`🔄 [ALTERNAR_VISTA]: Transición a -> #${targetId}`);
    
    document.querySelectorAll(".contenedor-pestana").forEach((c) => c.classList.remove("activa"));

    const objetivo = document.getElementById(targetId);
    if (objetivo) {
        objetivo.classList.add("activa");
        if (targetId === "pestana-notificaciones-planillas") {
            if (typeof window.cargarPlanillasReportadasUI === "function") window.cargarPlanillasReportadasUI();
        } else if (targetId === "pestana-perfil-conductor") {
            if (typeof window.cargarPerfilUI === "function") window.cargarPerfilUI();
        }
    }

    document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));
    const sidebarNavBtn = document.querySelector(`.sidebar .nav-btn[data-target="${targetId}"]`);
    if (sidebarNavBtn) sidebarNavBtn.classList.add("active");

    if (targetId === "mapa-fullscreen-container") {
        if (typeof window.cargarBarraInferior === "function") {
            window.cargarBarraInferior("componentes/barra-inferior/mapa-barra-infe.html");
        }
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (typeof window.refrescarLienzoMapa === "function") {
                    window.refrescarLienzoMapa();
                }
            }, 150);
        });
    } else {
        if (typeof window.cargarBarraInferior === "function") {
            window.cargarBarraInferior("componentes/barra-inferior/inicio-barra-infe.html");
        }
    }
}

window.alternarVistaPestaña = alternarVistaPestaña;

window.navegarA = (rutaVista) => {
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
        alternarVistaPestaña("pestana-perfil-conductor");
    }
};

window.refrescarUI = refrescarUI;

window.registrarIntentoLlamada = () => {
    console.log("📞 [OPERACION]: Registrando intento de llamada...");
    registrarLlamadaFlujo(
        () => obtenerLlamadasRealizadas(), 
        (v) => setLlamadasRealizadas(v), 
        refrescarUI
    );
};

window.refrescarConsolaOperacionesUI = async (paradasOpcionales) => {
    const paradas = paradasOpcionales || await obtenerParadasGuardadas();
    let lista = obtenerListaPedidosGlobal();
    lista.length = 0;
    lista.push(...(Array.isArray(paradas) ? paradas : []));
    await determinarSiguientePedidoActivo();
    refrescarUI();
};

window.prepararEdicionParadaUI = (idParada) => {
    const parada = obtenerListaPedidosGlobal().find((p) => p.id === idParada);
    if (!parada) return;

    const elId = document.getElementById("edit-parada-id");
    const elDest = document.getElementById("edit-parada-destinatario");
    const elDir = document.getElementById("edit-parada-direccion");
    const elTel = document.getElementById("edit-parada-telefono");
    const elSsc = document.getElementById("edit-parada-ssc");
    const elCuota = document.getElementById("edit-parada-cuota");

    if (elId) elId.value = parada.id;
    if (elDest) elDest.value = parada.destinatario || "";
    if (elDir) elDir.value = parada.direccion || "";
    if (elTel) elTel.value = parada.telefono || "";
    if (elSsc) elSsc.value = parada.ssc || "";
    if (elCuota) elCuota.value = parada.cuotaModeradora || "";

    const detailsForm = document.getElementById("details-formulario-parada");
    if (detailsForm) detailsForm.open = true;
};

window.limpiarFormularioParadaUI = () => {
    ["edit-parada-id", "edit-parada-destinatario", "edit-parada-direccion", "edit-parada-telefono", "edit-parada-ssc", "edit-parada-cuota"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const detailsForm = document.getElementById("details-formulario-parada");
    if (detailsForm) detailsForm.open = false;
};

window.agregarParadaLocal = async (nuevaParadaDatos) => {
    if (!nuevaParadaDatos?.direccion) return;

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
    
    let lista = obtenerListaPedidosGlobal();
    lista.length = 0;
    lista.push(...rutaActual);

    await determinarSiguientePedidoActivo();
    refrescarUI();
};

window.guardarParadaManualUI = async () => {
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
        let lista = obtenerListaPedidosGlobal();
        lista.length = 0;
        lista.push(...rutaActual);

        await determinarSiguientePedidoActivo();
        refrescarUI();
        window.limpiarFormularioParadaUI();
    } else {
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
        if (typeof window.cerrarAvisoProceso === 'function') window.cerrarAvisoProceso(toastId, 1500);
    }
};

window.generarPlanillaDesdeRuta = async () => {
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

    const nuevaPlanilla = {
        scc: paradasActuales.map(p => p.ssc || p.id).join(", "),
        fecha: new Date().toLocaleDateString("es-CO"),
        nombreMensajero: localStorage.getItem("nombreMensajero") || "Mensajero Acreditado",
        placaMensajero: localStorage.getItem("placaMensajero") || "MXX-000",
        estadoScc: paradasActuales.every(p => p.estado === "FINALIZADO") ? "Entregado" : "Devuelto",
        paradas: paradasActuales.map(p => ({
            id: p.id,
            ssc: p.ssc || p.id,
            destinatario: p.destinatario || 'Cliente General',
            direccion: p.direccion || 'Dirección no especificada',
            telefono: p.telefono || 'N/A',
            cuotaModeradora: p.cuotaModeradora || '$0',
            estado: p.estado === 'FINALIZADO' ? 'ENTREGADO' : (p.estado || 'DEVUELTO'),
            registroOperaciones: p.registroOperaciones || {}
        })),
        creadoEn: new Date().toISOString()
    };

    try {
        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 75, 'Guardando en módulo de planillas...');
        }

        await guardarPlanillaReportada(nuevaPlanilla);

        if (typeof window.actualizarProgresoProceso === 'function') {
            window.actualizarProgresoProceso(toastId, 100, '¡Planilla guardada exitosamente!', 'exito');
            if (typeof window.cerrarAvisoProceso === 'function') window.cerrarAvisoProceso(toastId, 1500);
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