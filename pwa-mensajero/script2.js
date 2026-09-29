/**
 * PROTOCOLO MACONDO - CONTROLADOR PRINCIPAL Y ORQUESTADOR PWA TÁCTICO
 * Ubicación: pwa-mensajero/script2.js
 * Arquitectura: Async Local-First (IndexedDB / LocalStorage) con Invocación Cloud Multimodal
 */

import { 
    guardarRutaZonificada, 
    obtenerParadasGuardadas,
    sincronizarYRenderizarPool,
    sincronizarYRenderizarTransito,
    eliminarParadaLocal,
    borrarRutaCompletaLocal
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

// --- CONTROL DE BARRA INFERIOR CON MUTEX ANTI-CARRERA ---
let cargandoBarraPromesa = null;

/**
 * Carga dinámicamente la barra inferior en función estricta de la vista activa.
 */
export async function cargarBarraInferior(vistaTarget = "", reintentos = 3) {
    const contenedorFooter = document.getElementById("contenedor-barra-inferior") || document.querySelector("footer");
    
    if (!contenedorFooter) {
        if (reintentos > 0) {
            setTimeout(() => cargarBarraInferior(vistaTarget, reintentos - 1), 100);
            return;
        }
        console.warn("⚠️ [BARRA_INFERIOR]: Contenedor de barra inferior no hallado en el DOM.");
        return;
    }

    const vistaActivaActual = vistaTarget || localStorage.getItem("vista_activa") || "pestana-ruta-activa";
    const esVistaMapa = vistaActivaActual.includes("mapa-fullscreen-container") || 
                        vistaActivaActual.includes("mapa-activa") || 
                        vistaActivaActual.includes("mapa");

    const rutaComponente = esVistaMapa 
        ? "componentes/barra-inferior/mapa-barra-infe.html" 
        : "componentes/barra-inferior/inicio-barra-infe.html";

    if (contenedorFooter.dataset.componenteCargado === rutaComponente && contenedorFooter.children.length > 0) {
        return;
    }

    if (cargandoBarraPromesa) {
        await cargandoBarraPromesa;
        if (contenedorFooter.dataset.componenteCargado === rutaComponente) return;
    }

    console.log(`[BARRA_INFERIOR] Cargando barra [Target: ${vistaActivaActual}] -> ${rutaComponente}`);

    cargandoBarraPromesa = fetch(rutaComponente)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        })
        .then((html) => {
            contenedorFooter.innerHTML = html;
            contenedorFooter.dataset.componenteCargado = rutaComponente;
            console.log(`✅ [BARRA_INFERIOR]: Barra (${esVistaMapa ? "MAPA" : "INICIO"}) fijada exitosamente.`);
        })
        .catch((err) => {
            console.error("❌ [BARRA_INFERIOR]: Error al cargar componente de barra:", err);
        })
        .finally(() => {
            cargandoBarraPromesa = null;
        });

    return cargandoBarraPromesa;
}

/**
 * Transición atómica de pestañas y vistas en la PWA garantizando visibilidad y re-renderizado de Google Maps
 * @param {string} targetInput - Selector (#id), ruta relativa o ID de contenedor
 * @param {boolean} forzarNavegacion - Omitir bloqueos de seguridad anti-rebote
 */
export function alternarVistaPestaña(targetInput, forzarNavegacion = false) {
    if (!targetInput) return;

    let targetId = String(targetInput).replace("#", "").trim();
    if (targetId.includes("/")) {
        const partes = targetId.split("/");
        targetId = partes[partes.length - 1].replace(".html", "");
    }

    const mapaAliases = {
        "mapa-activa": "mapa-fullscreen-container",
        "mapa": "mapa-fullscreen-container",
        "pestana-mapa-activa": "mapa-fullscreen-container",
        "pestana-mapa": "mapa-fullscreen-container",
        "ruta-activa": "pestana-ruta-activa",
        "crear": "pestana-ruta-crear",
        "historial": "pestana-monedero-historial",
        "saldo": "pestana-monedero-saldo",
        "planillas": "pestana-notificaciones-planillas",
        "reportes": "pestana-notificaciones-reportes",
        "conductor": "pestana-perfil-conductor"
    };

    if (mapaAliases[targetId]) {
        targetId = mapaAliases[targetId];
    }

    const vistaPrevia = localStorage.getItem("vista_activa");
    const esTransicionMapa = targetId === "mapa-fullscreen-container" || targetId.includes("mapa");

    // CORRECCIÓN ANTI-REBOTE: Solo omitir si se intenta recargar LA MISMA VISTA activa y no es forzado.
    // Si es una navegación intencional a otra vista (como el mapa), se desbloquea y procede.
    if (window.__BLOQUEAR_REBOOT_VISTA__ && !forzarNavegacion) {
        if (vistaPrevia === targetId) {
            console.log(`🛑 [ALTERNAR_VISTA]: Transición redundante a #${targetId} omitida por anti-rebote.`);
            return;
        }
        console.warn(`🔓 [ALTERNAR_VISTA]: Levantando bloqueo anti-rebote para transición prioritaria a -> #${targetId}`);
        window.__BLOQUEAR_REBOOT_VISTA__ = false;
    }

    console.log(`🔄 [ALTERNAR_VISTA]: Transición a -> #${targetId}`);
    localStorage.setItem("vista_activa", targetId);

    // CORRECCIÓN DEL SELECTOR: Seleccionar solo contenedores principales de vista.
    // NUNCA usar comodín [id^='mapa-'] porque ocultaba los lienzos internos del mapa (#mapa-lienzo, etc.)
    const todasLasVistas = document.querySelectorAll(
        ".contenedor-pestana, .vista-pantalla, .pestana-contenido, [id^='pestana-'], #mapa-fullscreen-container"
    );
    let nodoEncontrado = false;

    todasLasVistas.forEach((v) => {
        // Protección: Si el elemento es hijo del contenedor objetivo, no modificar
        if (v.id !== targetId && v.closest && v.closest(`#${targetId}`)) {
            return;
        }

        if (v.id === targetId) {
            v.style.display = "block";
            v.style.width = "100%";
            v.style.height = "100vh";
            v.classList.remove("oculto");
            v.classList.add("activa");
            nodoEncontrado = true;
        } else if (v.id && !v.id.includes("lienzo") && !v.id.includes("canvas")) {
            v.style.display = "none";
            v.classList.add("oculto");
            v.classList.remove("activa");
        }
    });

    if (!nodoEncontrado) {
        const nodoDirecto = document.getElementById(targetId);
        if (nodoDirecto) {
            nodoDirecto.style.display = "block";
            nodoDirecto.style.width = "100%";
            nodoDirecto.style.height = "100vh";
            nodoDirecto.classList.remove("oculto");
            nodoDirecto.classList.add("activa");
        }
    }

    // Actualizar estado visual de navegación en sidebar
    document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));
    const sidebarNavBtn = document.querySelector(`.sidebar .nav-btn[data-target="${targetId}"]`);
    if (sidebarNavBtn) sidebarNavBtn.classList.add("active");

    // LÓGICA ESPECÍFICA DE VISTAS Y REDIMENSIONAMIENTO DE MAPA GOOGLE
    if (targetId === "pestana-notificaciones-planillas") {
        if (typeof window.cargarPlanillasReportadasUI === "function") window.cargarPlanillasReportadasUI();
    } else if (targetId === "pestana-perfil-conductor") {
        if (typeof window.cargarPerfilUI === "function") window.cargarPerfilUI();
    } else if (esTransicionMapa) {
        console.log("🗺️ [ALTERNAR_VISTA]: Vista de mapa activa. Sincronizando dimensiones de lienzo Google Maps...");
        
        // Asegurar que el lienzo interno del mapa esté visible
        const mapaLienzo = document.getElementById("mapa-lienzo") || document.querySelector(".mapa-lienzo");
        if (mapaLienzo) {
            mapaLienzo.style.display = "block";
            mapaLienzo.style.width = "100%";
            mapaLienzo.style.height = "100%";
        }

        const sincronizarMapaGoogle = () => {
            // 1. Inicializar si la instancia no existía o quedó pendiente
            if (typeof inicializarMapaMensajero === "function") {
                inicializarMapaMensajero();
            } else if (typeof window.inicializarMapaMensajero === "function") {
                window.inicializarMapaMensajero();
            }

            // 2. Notificar redimensionamiento al SDK Google Maps
            window.dispatchEvent(new Event("resize"));
            const instanciaMapa = window.mapaInstanciaGlobal || window.mapaMensajero || window.mapaInstancia;
            if (window.google?.maps && instanciaMapa) {
                window.google.maps.event.trigger(instanciaMapa, "resize");
            }

            // 3. Forzar re-dibujado de trazados y marcadores
            if (typeof refrescarLienzoMapa === "function") {
                refrescarLienzoMapa();
            } else if (typeof window.refrescarLienzoMapa === "function") {
                window.refrescarLienzoMapa();
            }
        };

        // Doble refresco escalonado: asegura el repintado tras transiciones CSS del DOM
        requestAnimationFrame(() => {
            sincronizarMapaGoogle();
            setTimeout(sincronizarMapaGoogle, 100);
            setTimeout(sincronizarMapaGoogle, 300);
        });
    }

    // Inyectar o conmutar la barra inferior de forma condicional
    cargarBarraInferior(targetId);
}

// Aliases e inyecciones globales
window.cargarBarraInferior = cargarBarraInferior;
window.alternarVistaPestaña = alternarVistaPestaña;
window.alternarVista = alternarVistaPestaña;
window.inicializarMapaMensajero = inicializarMapaMensajero;
window.refrescarLienzoMapa = refrescarLienzoMapa;

window.navegarA = (rutaVista, forzar = true) => {
    alternarVistaPestaña(rutaVista, forzar);
};

window.manejarNavegacionSidebar = (btnNav) => {
    manejarNavegacionSidebar(btnNav, (targetId) => {
        console.log(`📍 [SIDEBAR_NAV]: Cambiando vista objetivo -> ${targetId}`);
        window.alternarVistaPestaña(targetId, true);
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
window.refrescarUI = refrescarUI;

// Inicialización de eventos PWA
inicializarEventosPWA();

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

        const vistaInicial = localStorage.getItem("vista_activa") || "pestana-ruta-activa";
        await cargarBarraInferior(vistaInicial);

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
        if (targetId) {
            window.alternarVistaPestaña(targetId, true);
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

// --- MÉTODOS DE OPERACIÓN Y FORMULARIOS ---
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