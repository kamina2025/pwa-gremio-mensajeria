/**
 * PROTOCOLO MACONDO - CONTROLADOR DE EVENTOS DE NAVEGACIÓN Y ACCIONES GLOBALES DE RUTAS
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-handlers.js
 * Arquitectura: Event-Driven / Local-First / Sincronización Atómica
 */

import { calcularRutaAisladaPorZona } from "./rutas-aislamiento.js";
import { optimizarRutaPorProximidadZona, invertirSecuenciaRutaZona } from "./rutas-optimizacion.js";
import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

/**
 * Registra y expone los controladores de eventos globales de rutas en el objeto window.
 */
export function registrarHandlersGlobales() {

    /**
     * Inicia la navegación táctica e aislamiento de mapa para una zona específica.
     * @param {string} zona - Nombre o clave de la zona objetivo
     */
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

    /**
     * Invoca la optimización por proximidad detectando si hay puntos iniciales o finales configurados en la UI
     * y forzando el refresco gráfico en caliente tanto en la consola como sobre el lienzo del mapa.
     * 
     * @param {string} zona - Nombre o clave de la zona a optimizar
     */
    window.optimizarProximidadZona = async function (zona) {
        if (!zona) return null;
        const targetCanonico = estandarizarZonaCanonica(zona);
        console.group(`⚡ [MENSAJERO_RUTAS]: Invocando optimización por proximidad para Zona: ${zona} -> '${targetCanonico}'`);

        try {
            // 1. Cargar paradas almacenadas con fallback resiliente
            let todasLasParadas = await obtenerParadasGuardadas();
            if (!Array.isArray(todasLasParadas) || todasLasParadas.length === 0) {
                todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || [];
            }

            // 2. Filtrar paradas de la zona objetivo
            const paradasDeZona = todasLasParadas.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico);

            // 3. Capturar selectores de punto de inicio / fin desde la UI (si existen)
            const selectInicio = document.getElementById(`select-inicio-${targetCanonico}`);
            const selectFin = document.getElementById(`select-fin-${targetCanonico}`);

            const valInicio = selectInicio ? String(selectInicio.value).trim() : "";
            const valFin = selectFin ? String(selectFin.value).trim() : "";

            // Sanitización estricta para ignorar valores por defecto/automáticos
            const idInicioValido = (valInicio && valInicio !== "null" && valInicio !== "auto" && !valInicio.includes("Automático")) ? valInicio : null;
            const idFinValido = (valFin && valFin !== "null" && valFin !== "auto" && !valFin.includes("Automático")) ? valFin : null;

            const paradaInicio = idInicioValido ? paradasDeZona.find(p => String(p.id || p.scc || p.ssc || "").trim() === idInicioValido) : null;
            const paradaFin = idFinValido ? paradasDeZona.find(p => String(p.id || p.scc || p.ssc || "").trim() === idFinValido) : null;

            if (paradaInicio) console.log(`📍 [OPTIMIZAR_HANDLERS]: Punto inicial fijado: ${paradaInicio.destinatario || paradaInicio.cliente || paradaInicio.ssc}`);
            if (paradaFin) console.log(`🏁 [OPTIMIZAR_HANDLERS]: Punto final fijado: ${paradaFin.destinatario || paradaFin.cliente || paradaFin.ssc}`);

            // 4. Ejecutar algoritmo de optimización jerárquico por proximidad
            const secuenciaResultante = await optimizarRutaPorProximidadZona(targetCanonico, paradaInicio, paradaFin);

            // 5. Refrescar interfaces de usuario y forzar re-trazado sobre el mapa por las calles
            const paradasReordenadas = (await obtenerParadasGuardadas()) || window.__CACHE_PARADAS_MACONDO__ || [];

            console.log("🎨 [OPTIMIZAR_HANDLERS]: Re-renderizando acordeones y mapa en caliente...");

            if (typeof window.renderizarParadasZonificadasUI === "function") {
                await window.renderizarParadasZonificadasUI(paradasReordenadas);
            } else if (typeof window.refrescarConsolaOperacionesUI === "function") {
                await window.refrescarConsolaOperacionesUI(paradasReordenadas);
            }

            // Forzar el aislamiento y trazado por calles en el mapa con romper de caché
            await calcularRutaAisladaPorZona(targetCanonico, true);

            console.groupEnd();
            return secuenciaResultante;
        } catch (error) {
            console.error(`❌ [OPTIMIZAR_HANDLERS]: Error durante la optimización de zona '${targetCanonico}':`, error);
            console.groupEnd();
            return null;
        }
    };

    /**
     * Invierte la secuencia de recorrido para una zona específica.
     * @param {string} zona - Nombre o clave de la zona
     */
    window.invertirSecuenciaZona = async function (zona) {
        if (!zona) return;
        const targetCanonico = estandarizarZonaCanonica(zona);
        console.log(`🔄 [MENSAJERO_RUTAS]: Invertir secuencia solicitada para Zona: ${targetCanonico}`);
        
        if (typeof invertirSecuenciaRutaZona === "function") {
            const resultado = await invertirSecuenciaRutaZona(targetCanonico);
            
            // Refrescar la UI y mapa inmediatamente
            if (typeof window.renderizarParadasZonificadasUI === "function") {
                await window.renderizarParadasZonificadasUI(resultado);
            }
            await calcularRutaAisladaPorZona(targetCanonico, true);
            return resultado;
        }
    };

    /**
     * Redirige al módulo de generación y descarga de planillas operativas.
     * @param {string} zona - Nombre de la zona a planillar
     */
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

    /**
     * Abre el lienzo de mapa interactivo enfocado exclusivamente en los waypoints de la zona.
     * @param {string} zona - Nombre de la zona a enfocar
     */
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

    /**
     * Mueve manualmente una parada hacia arriba (-1) o abajo (+1) dentro de su secuencia
     * y recalcula atómicamente la pertenencia a clústeres/grupos.
     * 
     * @param {string} paradaId - ID de la parada a desplazar
     * @param {string|number} direccion - Direccion: 'arriba', -1, 'abajo', 1
     * @param {string} zonaNombre - Nombre de la zona contenedor
     */
    window.reordenarParadaManual = async function (paradaId, direccion, zonaNombre) {
        if (!paradaId) return;
        const delta = (direccion === "arriba" || direccion === -1) ? -1 : 1;
        const targetCanonico = estandarizarZonaCanonica(zonaNombre);
        console.log(`>>> [REORDER_MANUAL]: Mover parada #${paradaId} (delta: ${delta}) en zona: ${targetCanonico}`);

        let todasLasParadas = (await obtenerParadasGuardadas()) || window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
        
        if (!todasLasParadas || todasLasParadas.length === 0) return;

        // 1. Filtrar paradas de la zona objetivo y ordenarlas por secuencia
        let paradasZona = todasLasParadas.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico);
        paradasZona.sort((a, b) => parseInt(a.secuenciaZona || a.secuencia || 0, 10) - parseInt(b.secuenciaZona || b.secuencia || 0, 10));

        const idxActual = paradasZona.findIndex(p => String(p.id || p.scc || p.ssc).trim() === String(paradaId).trim());
        if (idxActual === -1) return;

        const idxNuevo = idxActual + delta;
        if (idxNuevo < 0 || idxNuevo >= paradasZona.length) return; // Límites alcanzados

        // 2. Intercambiar posiciones en el arreglo
        const itemMover = paradasZona.splice(idxActual, 1)[0];
        paradasZona.splice(idxNuevo, 0, itemMover);

        // 3. Re-asignar secuenciaZona y grupoId de forma coordinada (Bloques de 4)
        const TAMANO_CLUSTER = 4;
        paradasZona.forEach((p, idx) => {
            const seq = idx + 1;
            p.secuenciaZona = seq;
            p.secuencia = seq;
            p.orden = seq;
            p.grupoId = `GRUPO-${Math.ceil(seq / TAMANO_CLUSTER).toString().padStart(2, "0")}`;
            p.updated_at = new Date().toISOString();
        });

        // 4. Reintegrar cambios a la colección global
        const mapaActualizados = new Map(paradasZona.map(p => [String(p.id || p.scc || p.ssc).trim(), p]));
        const listaGlobalActualizada = todasLasParadas.map(p => {
            const key = String(p.id || p.scc || p.ssc).trim();
            return mapaActualizados.has(key) ? mapaActualizados.get(key) : p;
        });

        // 5. Persistir y actualizar memorias RAM globales
        await guardarRutaZonificada(listaGlobalActualizada);
        window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
        window.paradasMemoriaLocal = [...listaGlobalActualizada];
        window.paradasRutaActiva = [...listaGlobalActualizada];
        window.pedidosGlobales = [...listaGlobalActualizada];

        // 6. Redibujar trazado y refrescar la UI del acordeón
        if (typeof window.renderizarParadasZonificadasUI === "function") {
            await window.renderizarParadasZonificadasUI(listaGlobalActualizada);
        }

        await calcularRutaAisladaPorZona(targetCanonico, true);
    };

    // Alias de compatibilidad global
    window.moverParadaManual = window.reordenarParadaManual;

    console.log("🟢 [RUTAS_HANDLERS]: Handlers globales de rutas inicializados correctamente.");
}

// Auto-inicialización de bindings en window
if (typeof window !== "undefined") {
    registrarHandlersGlobales();
}