/**
 * PROTOCOLO MACONDO - CONTROLADOR DE EVENTOS DE NAVEGACIÓN, MODALES Y ACCIONES GLOBALES DE RUTAS
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-handlers.js
 * Arquitectura: Event-Driven / Local-First / Cascada $0.00 COP / Sincronización Atómica
 */

import { calcularRutaAisladaPorZona } from "./rutas-aislamiento.js";
import { optimizarRutaPorProximidadZona, invertirSecuenciaRutaZona } from "./rutas-optimizacion.js";
import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";
import { geocodificarDireccionGratis } from "../mapa/geocoding-service.js";

// Exposición inmediata del servicio de geocodificación $0.00 COP en window
if (typeof window !== "undefined") {
    window.geocodificarDireccionGratis = geocodificarDireccionGratis;
}

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

    window.mostrarModalGestionParadaUI = function (datosParada = null) {
        console.log("✏️ [UI_MODAL]: Abriendo modal de gestión/creación de parada.", datosParada || "Nueva Parada");
        const modal = document.getElementById('modal-gestion-parada') || document.getElementById('modal-formulario-parada') || document.getElementById('modal-editar-parada');
        
        if (modal) {
            if (datosParada && typeof window.precargarFormularioParadaUI === "function") {
                window.precargarFormularioParadaUI(datosParada);
            } else if (typeof window.limpiarFormularioParadaUI === "function") {
                window.limpiarFormularioParadaUI();
            }

            if (typeof modal.showModal === "function") {
                modal.showModal();
            } else {
                modal.style.display = "block";
                modal.classList.add("active", "show");
            }
        } else {
            console.warn("⚠️ [UI_MODAL]: No se encontró el contenedor modal de gestión de parada en el DOM.");
        }
    };

    window.cerrarModalGestionParadaUI = function () {
        console.log("✏️ [UI_MODAL]: Cerrando modal de gestión de parada.");
        if (typeof window.limpiarFormularioParadaUI === "function") {
            window.limpiarFormularioParadaUI();
        }
        const modal = document.getElementById('modal-gestion-parada') || document.getElementById('modal-formulario-parada') || document.getElementById('modal-editar-parada');
        if (modal) {
            if (typeof modal.close === "function") {
                modal.close();
            } else {
                modal.style.display = "none";
                modal.classList.remove("active", "show");
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

// Vinculación preventiva
vincularHandlersModalesGlobales();

// =========================================================================
// SECCIÓN 2: CONTROLADOR Y REGISTRO GLOBAL DE EVENTOS DE RUTA
// =========================================================================

export function registrarHandlersGlobales() {
    if (typeof window === "undefined") return;

    if (window.__RUTAS_HANDLERS_INITIALIZED__) {
        console.log("ℹ️ [RUTAS_HANDLERS]: Handlers de rutas ya estaban inicializados en window.");
        return;
    }

    /**
     * Permite subir o bajar manualmente la posición de una parada en la lista con aislamiento estricto de RAM.
     */
    window.reordenarParadaManual = async function (paradaId, direccion, zonaNombre) {
        if (!paradaId) return;
        const delta = (direccion === "arriba" || direccion === -1) ? -1 : 1;
        const targetCanonico = estandarizarZonaCanonica(zonaNombre);
        console.log(`>>> [REORDER_MANUAL]: Mover parada #${paradaId} (delta: ${delta}) en zona: ${targetCanonico}`);

        let todasLasParadas = (await obtenerParadasGuardadas()) || window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
        if (!todasLasParadas || todasLasParadas.length === 0) return;

        let paradasZona = todasLasParadas
            .filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico)
            .map(p => structuredClone(p));

        paradasZona.sort((a, b) => parseInt(a.secuenciaZona || a.secuencia || a.orden || 0, 10) - parseInt(b.secuenciaZona || b.secuencia || b.orden || 0, 10));

        const idxActual = paradasZona.findIndex(p => String(p.id || p.scc || p.ssc || p.idParada || "").trim() === String(paradaId).trim());
        if (idxActual === -1) return;

        const idxNuevo = idxActual + delta;
        if (idxNuevo < 0 || idxNuevo >= paradasZona.length) return;

        // Reordenar elemento en el sub-arreglo de zona
        const itemMover = paradasZona.splice(idxActual, 1)[0];
        paradasZona.splice(idxNuevo, 0, itemMover);

        // Recalcular secuencias y clústeres atómicos
        const TAMANO_CLUSTER = 4;
        paradasZona.forEach((p, idx) => {
            const seq = idx + 1;
            p.consecutivoZona = seq;
            p.secuenciaZona = seq;
            p.secuencia = seq;
            p.orden = seq;
            p.updated_at = new Date().toISOString();
            p.grupoId = `GRUPO-${Math.ceil(seq / TAMANO_CLUSTER).toString().padStart(2, "0")}`;
        });

        const mapaActualizados = new Map(paradasZona.map(p => [String(p.id || p.scc || p.ssc || p.idParada || "").trim(), p]));
        const listaGlobalActualizada = todasLasParadas.map(p => {
            const key = String(p.id || p.scc || p.ssc || p.idParada || "").trim();
            return mapaActualizados.has(key) ? mapaActualizados.get(key) : structuredClone(p);
        });

        // Persistir snapshot en IndexedDB y localStorage
        await guardarRutaZonificada(listaGlobalActualizada);
        try {
            localStorage.setItem("ruta_zonificada", JSON.stringify(listaGlobalActualizada));
        } catch (e) {
            console.warn("⚠️ [REORDER_MANUAL]: No se pudo escribir en localStorage:", e);
        }

        // AISLAMIENTO DE MEMORIA RAM: Asignación por copia profunda independiente
        window.__CACHE_PARADAS_MACONDO__ = structuredClone(listaGlobalActualizada);
        window.paradasMemoriaLocal = structuredClone(listaGlobalActualizada);
        window.paradasRutaActiva = structuredClone(listaGlobalActualizada);
        window.pedidosGlobales = structuredClone(listaGlobalActualizada);

        if (typeof window.renderizarParadasZonificadasUI === "function") {
            await window.renderizarParadasZonificadasUI(listaGlobalActualizada);
        }
        if (typeof window.refrescarConsolaOperacionesUI === "function") {
            await window.refrescarConsolaOperacionesUI(listaGlobalActualizada);
        }
        if (typeof window.calcularRutaAisladaPorZona === "function") {
            await window.calcularRutaAisladaPorZona(targetCanonico, true);
        }
    };

    window.moverParadaManual = window.reordenarParadaManual;
    window.__RUTAS_HANDLERS_INITIALIZED__ = true;
    console.log("🟢 [RUTAS_HANDLERS]: Handlers globales de rutas inicializados correctamente.");
}

if (typeof window !== "undefined") {
    registrarHandlersGlobales();
}