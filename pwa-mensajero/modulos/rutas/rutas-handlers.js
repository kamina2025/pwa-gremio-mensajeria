/**
 * PROTOCOLO MACONDO - CONTROLADOR DE EVENTOS DE NAVEGACIÓN, MODALES Y ACCIONES GLOBALES DE RUTAS
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-handlers.js
 * Arquitectura: Event-Driven / Local-First / Sincronización Atómica
 */

import { calcularRutaAisladaPorZona } from "./rutas-aislamiento.js";
import { optimizarRutaPorProximidadZona, invertirSecuenciaRutaZona } from "./rutas-optimizacion.js";
import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

// =========================================================================
// SECCIÓN 1: HANDLERS DE MODALES UI (INYECCIÓN DIRECTA EN WINDOW)
// =========================================================================

export function vincularHandlersModalesGlobales() {
    window.mostrarModalImportarRutaUI = function () {
        console.log("🖥️ [UI_MODAL]: Abriendo modal de importación de ruta.");
        const modal = document.getElementById('modal-importar-ruta');
        if (modal) {
            if (typeof modal.showModal === "function") {
                modal.showModal();
            } else {
                modal.style.display = "block";
            }
        }
    };

    window.cerrarModalImportarRutaUI = function () {
        console.log("🖥️ [UI_MODAL]: Cerrando modal de importación de ruta.");
        const modal = document.getElementById('modal-importar-ruta');
        if (modal) {
            if (typeof modal.close === "function") {
                modal.close();
            } else {
                modal.style.display = "none";
            }
        }
    };

    window.ejecutarImportacionYRutaUI = async function () {
        console.log("⚡ [UI_MODAL]: Ejecutando importación manual de ruta.");
        if (typeof window.procesarCargaManualEnlace === "function") {
            await window.procesarCargaManualEnlace();
        }
        window.cerrarModalImportarRutaUI();
    };

    window.mostrarModalGestionParadaUI = function () {
        console.log("✏️ [UI_MODAL]: Abriendo modal de gestión/creación de parada.");
        const modal = document.getElementById('modal-gestion-parada');
        if (modal) {
            if (typeof modal.showModal === "function") {
                modal.showModal();
            } else {
                modal.style.display = "block";
            }
        }
    };

    window.cerrarModalGestionParadaUI = function () {
        console.log("✏️ [UI_MODAL]: Cerrando modal de gestión de parada.");
        if (typeof window.limpiarFormularioParadaUI === "function") {
            window.limpiarFormularioParadaUI();
        }
        const modal = document.getElementById('modal-gestion-parada');
        if (modal) {
            if (typeof modal.close === "function") {
                modal.close();
            } else {
                modal.style.display = "none";
            }
        }
    };

    window.guardarYcerrarParadaManualUI = async function () {
        console.log("💾 [UI_MODAL]: Guardando parada desde ventana modal.");
        if (typeof window.guardarParadaManualUI === "function") {
            await window.guardarParadaManualUI();
        }
        window.cerrarModalGestionParadaUI();
    };
}

// Ejecución inmediata al importar el módulo ES6
vincularHandlersModalesGlobales();

// =========================================================================
// SECCIÓN 2: CONTROLADOR Y REGISTRO GLOBAL DE EVENTOS DE RUTA
// =========================================================================

export function registrarHandlersGlobales() {
    vincularHandlersModalesGlobales();

    if (window.__RUTAS_HANDLERS_INITIALIZED__) {
        console.log("ℹ️ [RUTAS_HANDLERS]: Handlers de rutas ya registrados en window.");
        return;
    }

    window.iniciarRutaZona = async function (zona) {
        if (!zona) return;
        const targetCanonico = estandarizarZonaCanonica(zona);
        console.log(`► [MENSAJERO_RUTAS]: Iniciar Ruta ejecutado para Zona: ${zona} -> '${targetCanonico}'`);
        
        localStorage.setItem("zona_activa_operacion", targetCanonico);

        if (typeof window.navegarA === "function") {
            await window.navegarA("vistas/ruta/mapa-activa.html", { zona: targetCanonico });
            requestAnimationFrame(() => {
                if (typeof calcularRutaAisladaPorZona === "function") {
                    calcularRutaAisladaPorZona(targetCanonico, true);
                }
            });
        } else if (typeof window.alternarVistaPestaña === "function") {
            await window.alternarVistaPestaña("mapa-fullscreen-container");
            requestAnimationFrame(() => calcularRutaAisladaPorZona(targetCanonico, true));
        } else {
            const basePath = window.location.origin;
            window.location.href = `${basePath}/vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(targetCanonico)}`;
        }
    };

    window.optimizarProximidadZona = async function (zona) {
        if (!zona) return null;
        const targetCanonico = estandarizarZonaCanonica(zona);
        console.group(`⚡ [MENSAJERO_RUTAS]: Invocando optimización por proximidad para Zona: ${zona} -> '${targetCanonico}'`);

        try {
            let todasLasParadas = await obtenerParadasGuardadas();
            if (!Array.isArray(todasLasParadas) || todasLasParadas.length === 0) {
                todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
            }

            const paradasDeZona = todasLasParadas.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico);

            const selectInicio = document.getElementById(`select-inicio-${targetCanonico}`);
            const selectFin = document.getElementById(`select-fin-${targetCanonico}`);

            const valInicio = selectInicio ? String(selectInicio.value).trim() : "";
            const valFin = selectFin ? String(selectFin.value).trim() : "";

            const idInicioValido = (valInicio && valInicio !== "null" && valInicio !== "auto" && !valInicio.includes("Automático")) ? valInicio : null;
            const idFinValido = (valFin && valFin !== "null" && valFin !== "auto" && !valFin.includes("Automático")) ? valFin : null;

            const paradaInicio = idInicioValido ? paradasDeZona.find(p => String(p.id || p.scc || p.ssc || "").trim() === idInicioValido) : null;
            const paradaFin = idFinValido ? paradasDeZona.find(p => String(p.id || p.scc || p.ssc || "").trim() === idFinValido) : null;

            const secuenciaResultante = await optimizarRutaPorProximidadZona(targetCanonico, paradaInicio, paradaFin);
            const paradasReordenadas = (await obtenerParadasGuardadas()) || window.__CACHE_PARADAS_MACONDO__ || [];

            if (typeof window.renderizarParadasZonificadasUI === "function") {
                await window.renderizarParadasZonificadasUI(paradasReordenadas);
            }
            if (typeof window.refrescarConsolaOperacionesUI === "function") {
                await window.refrescarConsolaOperacionesUI(paradasReordenadas);
            }

            if (typeof calcularRutaAisladaPorZona === "function") {
                await calcularRutaAisladaPorZona(targetCanonico, true);
            }

            console.groupEnd();
            return secuenciaResultante;
        } catch (error) {
            console.error(`❌ [OPTIMIZAR_HANDLERS]: Error durante la optimización de zona '${targetCanonico}':`, error);
            console.groupEnd();
            return null;
        }
    };

    window.invertirSecuenciaZona = async function (zona) {
        if (!zona) return;
        const targetCanonico = estandarizarZonaCanonica(zona);
        console.log(`🔄 [MENSAJERO_RUTAS]: Invertir secuencia solicitada para Zona: ${targetCanonico}`);
        
        if (typeof invertirSecuenciaRutaZona === "function") {
            const resultado = await invertirSecuenciaRutaZona(targetCanonico);
            if (typeof window.renderizarParadasZonificadasUI === "function") {
                await window.renderizarParadasZonificadasUI(resultado);
            }
            if (typeof calcularRutaAisladaPorZona === "function") {
                await calcularRutaAisladaPorZona(targetCanonico, true);
            }
            return resultado;
        }
    };

    window.planillarRutaZona = function (zona) {
        if (!zona) return;
        const targetCanonico = estandarizarZonaCanonica(zona);
        console.log(`📝 [MENSAJERO_RUTAS]: Generando planilla para Zona: ${zona} -> '${targetCanonico}'`);
        
        localStorage.setItem("zona_planillar_activa", targetCanonico);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/notificaciones/planillas.html", { zona: targetCanonico });
        } else if (typeof window.alternarVistaPestaña === "function") {
            window.alternarVistaPestaña("pestana-notificaciones-planillas");
        } else if (typeof window.renderizarModuloPlanillas === "function") {
            window.renderizarModuloPlanillas(targetCanonico);
        } else {
            const basePath = window.location.origin;
            window.location.href = `${basePath}/vistas/notificaciones/planillas.html?zona=${encodeURIComponent(targetCanonico)}`;
        }
    };

    window.verMapaZona = async function (zona) {
        if (!zona) return;
        const targetCanonico = estandarizarZonaCanonica(zona);
        console.log(`🗺️ [MENSAJERO_RUTAS]: Abrir Mapa Zona: ${zona} -> '${targetCanonico}'`);
        
        localStorage.setItem("zona_activa_operacion", targetCanonico);

        if (typeof window.navegarA === "function") {
            await window.navegarA("vistas/ruta/mapa-activa.html", { zona: targetCanonico });
            requestAnimationFrame(() => calcularRutaAisladaPorZona(targetCanonico, true));
        } else if (typeof window.alternarVistaPestaña === "function") {
            await window.alternarVistaPestaña("mapa-fullscreen-container");
            requestAnimationFrame(() => calcularRutaAisladaPorZona(targetCanonico, true));
        } else {
            const basePath = window.location.origin;
            window.location.href = `${basePath}/vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(targetCanonico)}`;
        }
    };

    window.reordenarParadaManual = async function (paradaId, direccion, zonaNombre) {
        if (!paradaId) return;
        const delta = (direccion === "arriba" || direccion === -1) ? -1 : 1;
        const targetCanonico = estandarizarZonaCanonica(zonaNombre);
        console.log(`>>> [REORDER_MANUAL]: Mover parada #${paradaId} (delta: ${delta}) en zona: ${targetCanonico}`);

        let todasLasParadas = (await obtenerParadasGuardadas()) || window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
        if (!todasLasParadas || todasLasParadas.length === 0) return;

        let paradasZona = todasLasParadas.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico);
        paradasZona.sort((a, b) => parseInt(a.secuenciaZona || a.secuencia || 0, 10) - parseInt(b.secuenciaZona || b.secuencia || 0, 10));

        const idxActual = paradasZona.findIndex(p => String(p.id || p.scc || p.ssc).trim() === String(paradaId).trim());
        if (idxActual === -1) return;

        const idxNuevo = idxActual + delta;
        if (idxNuevo < 0 || idxNuevo >= paradasZona.length) return;

        const itemMover = paradasZona.splice(idxActual, 1)[0];
        paradasZona.splice(idxNuevo, 0, itemMover);

        const TAMANO_CLUSTER = 4;
        paradasZona.forEach((p, idx) => {
            const seq = idx + 1;
            p.secuenciaZona = seq;
            p.secuencia = seq;
            p.orden = seq;
            p.updated_at = new Date().toISOString();
            p.grupoId = `GRUPO-${Math.ceil(seq / TAMANO_CLUSTER).toString().padStart(2, "0")}`;
        });

        const mapaActualizados = new Map(paradasZona.map(p => [String(p.id || p.scc || p.ssc).trim(), p]));
        const listaGlobalActualizada = todasLasParadas.map(p => {
            const key = String(p.id || p.scc || p.ssc).trim();
            return mapaActualizados.has(key) ? mapaActualizados.get(key) : p;
        });

        await guardarRutaZonificada(listaGlobalActualizada);
        window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
        window.paradasMemoriaLocal = [...listaGlobalActualizada];
        window.paradasRutaActiva = [...listaGlobalActualizada];
        window.pedidosGlobales = [...listaGlobalActualizada];

        if (typeof window.renderizarParadasZonificadasUI === "function") {
            await window.renderizarParadasZonificadasUI(listaGlobalActualizada);
        }
        if (typeof window.refrescarConsolaOperacionesUI === "function") {
            await window.refrescarConsolaOperacionesUI(listaGlobalActualizada);
        }

        if (typeof calcularRutaAisladaPorZona === "function") {
            await calcularRutaAisladaPorZona(targetCanonico, true);
        }
    };

    window.moverParadaManual = window.reordenarParadaManual;

    window.__RUTAS_HANDLERS_INITIALIZED__ = true;
    console.log("🟢 [RUTAS_HANDLERS]: Handlers globales de rutas inicializados correctamente.");
}

// Auto-inicialización al importar el módulo ES6
if (typeof window !== "undefined") {
    registrarHandlersGlobales();
}