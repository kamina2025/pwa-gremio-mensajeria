/**
 * PROTOCOLO MACONDO - CONTROLADOR DE EVENTOS DE NAVEGACIÓN Y ACCIONES GLOBALES
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-handlers.js
 * Arquitectura: Local-First / Clustering Sync / Handlers Globales
 */

import { calcularRutaAisladaPorZona } from "./rutas-aislamiento.js";
import { optimizarRutaPorProximidadZona } from "./rutas-optimizacion.js";
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
    window.iniciarRutaZona = function (zona) {
        if (!zona) return;
        const targetCanonico = estandarizarZonaCanonica(zona);
        console.log(`► [MENSAJERO_RUTAS]: Iniciar Ruta ejecutado para Zona: ${zona} -> '${targetCanonico}'`);
        
        localStorage.setItem("zona_activa_operacion", targetCanonico);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/ruta/mapa-activa.html", { zona: targetCanonico });
            setTimeout(() => {
                if (typeof calcularRutaAisladaPorZona === "function") {
                    calcularRutaAisladaPorZona(targetCanonico);
                }
            }, 300);
        } else if (typeof window.alternarVistaPestaña === "function") {
            window.alternarVistaPestaña("mapa-fullscreen-container");
            setTimeout(() => calcularRutaAisladaPorZona(targetCanonico), 300);
        } else {
            const basePath = window.location.origin;
            window.location.href = `${basePath}/vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(targetCanonico)}`;
        }
    };

    /**
     * Invoca la optimización por proximidad detectando si hay puntos iniciales o finales configurados en la UI.
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

            const idInicio = (selectInicio && selectInicio.value && selectInicio.value !== "null") ? String(selectInicio.value).trim() : null;
            const idFin = (selectFin && selectFin.value && selectFin.value !== "null") ? String(selectFin.value).trim() : null;

            const paradaInicio = idInicio ? paradasDeZona.find(p => String(p.id || p.scc || p.ssc || "").trim() === idInicio) : null;
            const paradaFin = idFin ? paradasDeZona.find(p => String(p.id || p.scc || p.ssc || "").trim() === idFin) : null;

            if (paradaInicio) console.log(`📍 [OPTIMIZAR_HANDLERS]: Punto inicial fijado: ${paradaInicio.destinatario || paradaInicio.cliente || paradaInicio.ssc}`);
            if (paradaFin) console.log(`🏁 [OPTIMIZAR_HANDLERS]: Punto final fijado: ${paradaFin.destinatario || paradaFin.cliente || paradaFin.ssc}`);

            // 4. Ejecutar algoritmo de optimización jerárquico por proximidad
            const secuenciaResultante = await optimizarRutaPorProximidadZona(targetCanonico, paradaInicio, paradaFin);

            // 5. Refrescar interfaces
            const paradasReordenadas = await obtenerParadasGuardadas();

            if (typeof window.refrescarConsolaOperacionesUI === "function") {
                await window.refrescarConsolaOperacionesUI(paradasReordenadas);
            } else if (typeof window.renderizarParadasZonificadasUI === "function") {
                await window.renderizarParadasZonificadasUI(paradasReordenadas);
            }

            console.groupEnd();
            return secuenciaResultante;
        } catch (error) {
            console.error(`❌ [OPTIMIZAR_HANDLERS]: Error durante la optimización de zona '${targetCanonico}':`, error);
            console.groupEnd();
            return null;
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
            requestAnimationFrame(() => calcularRutaAisladaPorZona(targetCanonico));
        } else if (typeof window.alternarVistaPestaña === "function") {
            await window.alternarVistaPestaña("mapa-fullscreen-container");
            requestAnimationFrame(() => calcularRutaAisladaPorZona(targetCanonico));
        } else {
            const basePath = window.location.origin;
            window.location.href = `${basePath}/vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(targetCanonico)}`;
        }
    };

    /**
     * Mueve manualmente una parada hacia arriba (-1) o abajo (+1) dentro de su secuencia
     * y recalcula atómicamente la pertenencia a clústeres/grupos.
     * @param {string} paradaId - ID de la parada a desplazar
     * @param {string|number} direccion - Direccion: 'arriba', -1, 'abajo', 1
     * @param {string} zonaNombre - Nombre de la zona contenedor
     */
    window.moverParadaManual = async function (paradaId, direccion, zonaNombre) {
        if (!paradaId) return;
        const delta = (direccion === "arriba" || direccion === -1) ? -1 : 1;
        const targetCanonico = estandarizarZonaCanonica(zonaNombre);
        console.log(`>>> [REORDER_MANUAL]: Mover parada ${paradaId} (delta: ${delta}) en zona: ${targetCanonico}`);

        let todasLasParadas = (await obtenerParadasGuardadas()) || window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
        
        // 1. Filtrar paradas de la zona objetivo y ordenarlas por secuencia
        let paradasZona = todasLasParadas.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanonico);
        paradasZona.sort((a, b) => (a.secuenciaZona || a.secuencia || 0) - (b.secuenciaZona || b.secuencia || 0));

        const idxActual = paradasZona.findIndex(p => String(p.id || p.scc || p.ssc) === String(paradaId));
        if (idxActual === -1) return;

        const idxNuevo = idxActual + delta;
        if (idxNuevo < 0 || idxNuevo >= paradasZona.length) return; // Límites alcanzados

        // 2. Intercambiar posiciones en el arreglo
        const temp = paradasZona[idxActual];
        paradasZona[idxActual] = paradasZona[idxNuevo];
        paradasZona[idxNuevo] = temp;

        // 3. Re-asignar secuenciaZona y grupoId de forma coordinada
        paradasZona.forEach((p, index) => {
            const nuevaSecuencia = index + 1;
            p.secuenciaZona = nuevaSecuencia;
            p.secuencia = nuevaSecuencia;
            p.orden = nuevaSecuencia;

            // Re-clustering automático en bloques de 4
            const numGrupo = Math.ceil(nuevaSecuencia / 4);
            p.grupoId = `GRUPO-${numGrupo.toString().padStart(2, "0")}`;
            p.updated_at = new Date().toISOString();
        });

        // 4. Reintegrar cambios a la colección global
        const mapaActualizados = new Map(paradasZona.map(p => [String(p.id || p.scc || p.ssc), p]));
        const listaGlobalSincronizada = todasLasParadas.map(p => {
            const key = String(p.id || p.scc || p.ssc);
            return mapaActualizados.has(key) ? mapaActualizados.get(key) : p;
        });

        // 5. Persistir y actualizar memorias RAM
        await guardarRutaZonificada(listaGlobalSincronizada);
        window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalSincronizada];
        window.paradasMemoriaLocal = [...listaGlobalSincronizada];
        window.paradasRutaActiva = [...listaGlobalSincronizada];

        // 6. Redibujar trazado y refrescar la UI del acordeón
        if (typeof window.trazarPolilineaRuta === "function") {
            window.trazarPolilineaRuta(listaGlobalSincronizada, targetCanonico);
        }

        if (typeof window.renderizarParadasZonificadasUI === "function") {
            await window.renderizarParadasZonificadasUI(listaGlobalSincronizada);
        }
    };

    console.log("🟢 [RUTAS_HANDLERS]: Handlers globales de rutas inicializados correctamente.");
}

// Ejecución automática al cargar el módulo ES6
registrarHandlersGlobales();