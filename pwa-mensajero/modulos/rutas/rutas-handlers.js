/**
 * PROTOCOLO MACONDO - CONTROLADOR DE EVENTOS DE NAVEGACIÓN Y ACCIONES GLOBALES
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-handlers.js
 */

import { calcularRutaAisladaPorZona } from "./rutas-aislamiento.js";
import { optimizarRutaPorProximidadZona } from "./rutas-optimizacion.js";
import { obtenerParadasGuardadas } from "../mensajero-persistencia.js";
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
                    calcularRutaAisladaPorZona(targetCanonico);
                }
            });
        } else if (typeof window.alternarVistaPestaña === "function") {
            await window.alternarVistaPestaña("mapa-fullscreen-container");
            requestAnimationFrame(() => calcularRutaAisladaPorZona(targetCanonico));
        } else {
            const basePath = window.location.origin;
            window.location.href = `${basePath}/vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(targetCanonico)}`;
        }
    };

    /**
     * Invoca la optimización por proximidad vía Google Maps Directions API,
     * detectando si hay puntos iniciales o finales configurados en la UI.
     * @param {string} zona - Nombre o clave de la zona a optimizar
     */
    window.optimizarProximidadZona = async function (zona) {
        if (!zona) return null;
        const targetCanonico = estandarizarZonaCanonica(zona);
        console.group(`⚡ [MENSAJERO_RUTAS]: Invocando optimización Google Maps para Zona: ${zona} -> '${targetCanonico}'`);

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

            const paradaInicio = idInicio ? paradasDeZona.find(p => String(p.id || p.ssc || "").trim() === idInicio) : null;
            const paradaFin = idFin ? paradasDeZona.find(p => String(p.id || p.ssc || "").trim() === idFin) : null;

            if (paradaInicio) console.log(`📍 [OPTIMIZAR_HANDLERS]: Punto inicial fijado: ${paradaInicio.destinatario || paradaInicio.cliente || paradaInicio.ssc}`);
            if (paradaFin) console.log(`🏁 [OPTIMIZAR_HANDLERS]: Punto final fijado: ${paradaFin.destinatario || paradaFin.cliente || paradaFin.ssc}`);

            // 4. Ejecutar optimización por carretera vía Google Maps API
            const secuenciaResultante = await optimizarRutaPorProximidadZona(targetCanonico, paradaInicio, paradaFin);

            // 5. Refrescar interfaces evitando ejecuciones redundantes o dobles renderizados
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
     * Mueve manualmente una parada hacia arriba (-1) o abajo (+1) dentro de su secuencia.
     * @param {string} paradaId - ID de la parada a desplazar
     * @param {string|number} direccion - Direccion: 'arriba', -1, 'abajo', 1
     * @param {string} zonaNombre - Nombre de la zona contenedor
     */
    window.moverParadaManual = async function (paradaId, direccion, zonaNombre) {
        if (!paradaId) return;
        const delta = (direccion === "arriba" || direccion === -1) ? -1 : 1;
        console.log(`>>> [REORDER_MANUAL]: Mover parada ${paradaId} (delta: ${delta}) en zona: ${zonaNombre}`);

        if (typeof window.moverParadaSecuenciaUI === "function") {
            let paradasLocal = await obtenerParadasGuardadas();
            if (!Array.isArray(paradasLocal) || paradasLocal.length === 0) {
                paradasLocal = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || [];
            }
            await window.moverParadaSecuenciaUI(
                paradasLocal, 
                String(paradaId).trim(), 
                delta, 
                window.renderizarParadasZonificadasUI
            );
        } else {
            console.warn("⚠️ [REORDER_MANUAL]: 'moverParadaSecuenciaUI' no está definido en el contexto global.");
        }
    };

    console.log("🟢 [RUTAS_HANDLERS]: Handlers globales de rutas inicializados correctamente.");
}

// Ejecución automática al cargar el módulo ES6
registrarHandlersGlobales();