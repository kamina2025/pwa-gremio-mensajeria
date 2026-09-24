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
    window.iniciarRutaZona = function (zona) {
        if (!zona) return;
        const targetCanónico = estandarizarZonaCanonica(zona);
        console.log(`► [MENSAJERO_RUTAS]: Iniciar Ruta ejecutado para Zona: ${zona} -> '${targetCanónico}'`);
        
        localStorage.setItem("zona_activa_operacion", targetCanónico);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/ruta/mapa-activa.html", { zona: targetCanónico });
            setTimeout(() => {
                if (typeof calcularRutaAisladaPorZona === "function") {
                    calcularRutaAisladaPorZona(targetCanónico);
                }
            }, 300);
        } else if (typeof window.alternarVistaPestaña === "function") {
            window.alternarVistaPestaña("mapa-fullscreen-container");
            setTimeout(() => calcularRutaAisladaPorZona(targetCanónico), 300);
        } else {
            window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(targetCanónico)}`;
        }
    };

    /**
     * Invoca la optimización por proximidad vía Google Maps Directions API,
     * detectando si hay puntos iniciales o finales configurados en la UI.
     * @param {string} zona - Nombre o clave de la zona a optimizar
     */
    window.optimizarProximidadZona = async function (zona) {
        if (!zona) return;
        const targetCanónico = estandarizarZonaCanonica(zona);
        console.group(`⚡ [MENSAJERO_RUTAS]: Invocando optimización Google Maps para Zona: ${zona} -> '${targetCanónico}'`);

        // 1. Cargar paradas almacenadas
        let todasLasParadas = await obtenerParadasGuardadas();
        if (!todasLasParadas || todasLasParadas.length === 0) {
            todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || [];
        }

        // 2. Filtrar paradas de la zona objetivo
        const paradasDeZona = todasLasParadas.filter(p => p && obtenerZonaParadaCanonica(p) === targetCanónico);

        // 3. Capturar selectores de punto de inicio / fin desde la UI (si existen)
        const selectInicio = document.getElementById(`select-inicio-${targetCanónico}`);
        const selectFin = document.getElementById(`select-fin-${targetCanónico}`);

        const idInicio = (selectInicio && selectInicio.value && selectInicio.value !== "null") ? selectInicio.value.trim() : null;
        const idFin = (selectFin && selectFin.value && selectFin.value !== "null") ? selectFin.value.trim() : null;

        const paradaInicio = idInicio ? paradasDeZona.find(p => String(p.id || p.ssc || "").trim() === idInicio) : null;
        const paradaFin = idFin ? paradasDeZona.find(p => String(p.id || p.ssc || "").trim() === idFin) : null;

        if (paradaInicio) console.log(`📍 [OPTIMIZAR_HANDLERS]: Punto inicial fijado: ${paradaInicio.destinatario || paradaInicio.cliente || paradaInicio.ssc}`);
        if (paradaFin) console.log(`🏁 [OPTIMIZAR_HANDLERS]: Punto final fijado: ${paradaFin.destinatario || paradaFin.cliente || paradaFin.ssc}`);

        // 4. Ejecutar optimización por carretera vía Google Maps API
        const secuenciaResultante = await optimizarRutaPorProximidadZona(targetCanónico, paradaInicio, paradaFin);

        // 5. Refrescar interfaces y consolas
        if (typeof window.refrescarConsolaOperacionesUI === "function") {
            await window.refrescarConsolaOperacionesUI();
        } else if (typeof window.renderizarParadasZonificadasUI === "function") {
            const paradasReordenadas = await obtenerParadasGuardadas();
            await window.renderizarParadasZonificadasUI(paradasReordenadas);
        }

        console.groupEnd();
        return secuenciaResultante;
    };

    /**
     * Redirige al módulo de generación y descarga de planillas operativas.
     * @param {string} zona - Nombre de la zona a planillar
     */
    window.planillarRutaZona = function (zona) {
        if (!zona) return;
        const targetCanónico = estandarizarZonaCanonica(zona);
        console.log(`📝 [MENSAJERO_RUTAS]: Generando planilla para Zona: ${zona} -> '${targetCanónico}'`);
        
        localStorage.setItem("zona_planillar_activa", targetCanónico);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/notificaciones/planillas.html", { zona: targetCanónico });
        } else if (typeof window.alternarVistaPestaña === "function") {
            window.alternarVistaPestaña("pestana-notificaciones-planillas");
        } else if (typeof window.renderizarModuloPlanillas === "function") {
            window.renderizarModuloPlanillas(targetCanónico);
        } else {
            window.location.href = `vistas/notificaciones/planillas.html?zona=${encodeURIComponent(targetCanónico)}`;
        }
    };

    /**
     * Abre el lienzo de mapa interactivo enfocado exclusivamente en los waypoints de la zona.
     * @param {string} zona - Nombre de la zona a enfocar
     */
    window.verMapaZona = function (zona) {
        if (!zona) return;
        const targetCanónico = estandarizarZonaCanonica(zona);
        console.log(`🗺️ [MENSAJERO_RUTAS]: Abrir Mapa Zona: ${zona} -> '${targetCanónico}'`);
        
        localStorage.setItem("zona_activa_operacion", targetCanónico);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/ruta/mapa-activa.html", { zona: targetCanónico });
            setTimeout(() => calcularRutaAisladaPorZona(targetCanónico), 300);
        } else if (typeof window.alternarVistaPestaña === "function") {
            window.alternarVistaPestaña("mapa-fullscreen-container");
            setTimeout(() => calcularRutaAisladaPorZona(targetCanónico), 300);
        } else {
            window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(targetCanónico)}`;
        }
    };

    /**
     * Mueve manualmente una parada hacia arriba (-1) o abajo (+1) dentro de su secuencia.
     * @param {string} paradaId - ID de la parada a desplazar
     * @param {string|number} direccion - Direccion: 'arriba', -1, 'abajo', 1
     * @param {string} zonaNombre - Nombre de la zona contenedor
     */
    window.moverParadaManual = async function (paradaId, direccion, zonaNombre) {
        const delta = (direccion === "arriba" || direccion === -1) ? -1 : 1;
        console.log(`>>> [REORDER_MANUAL]: Mover parada ${paradaId} (delta: ${delta}) en zona: ${zonaNombre}`);

        if (typeof window.moverParadaSecuenciaUI === "function") {
            const paradasLocal = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || [];
            await window.moverParadaSecuenciaUI(paradasLocal, paradaId, delta, window.renderizarParadasZonificadasUI);
        } else {
            console.warn("⚠️ [REORDER_MANUAL]: 'moverParadaSecuenciaUI' no está definido en el contexto global.");
        }
    };

    console.log("🟢 [RUTAS_HANDLERS]: Handlers globales de rutas inicializados correctamente.");
}

// Ejecución automática al cargar el módulo ES6
registrarHandlersGlobales();