/**
 * Módulo de Handlers y Eventos de Navegación Global
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-handlers.js
 */

import { calcularRutaAisladaPorZona } from "./rutas-aislamiento.js";
import { optimizarRutaPorProximidadZona } from "./rutas-optimizacion.js";
import { obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

/**
 * Registra y expone los controladores de eventos globales en el objeto window.
 */
export function registrarHandlersGlobales() {
    
    /**
     * Inicia la navegación táctica e isolación de mapa para una zona específica.
     */
    window.iniciarRutaZona = function (zona) {
        const targetCanónico = estandarizarZonaCanonica(zona);
        console.log(`► [MENSAJERO_RUTAS]: Iniciar Ruta ejecutado para Zona: ${zona} -> '${targetCanónico}'`);
        
        localStorage.setItem("zona_activa_operacion", targetCanónico);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/ruta/mapa-activa.html", { zona: targetCanónico });
            setTimeout(() => calcularRutaAisladaPorZona(targetCanónico), 350);
        } else {
            window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(targetCanónico)}`;
        }
    };

    /**
     * Invoca la optimización por proximidad vía Google Maps Directions API,
     * detectando si hay puntos iniciales o finales configurados en la UI.
     */
    window.optimizarProximidadZona = async function (zona) {
        const targetCanónico = estandarizarZonaCanonica(zona);
        console.group(`⚡ [MENSAJERO_RUTAS]: Invocando optimización Google Maps para Zona: ${zona} -> '${targetCanónico}'`);

        // 1. Cargar paradas almacenadas
        let todasLasParadas = await obtenerParadasGuardadas();
        if (!todasLasParadas || todasLasParadas.length === 0) {
            todasLasParadas = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
        }

        // 2. Filtrar paradas de la zona
        const paradasDeZona = todasLasParadas.filter(p => obtenerZonaParadaCanonica(p) === targetCanónico);

        // 3. Capturar selectores de punto de inicio / fin desde la UI (si existen)
        const selectInicio = document.getElementById(`select-inicio-${targetCanónico}`);
        const selectFin = document.getElementById(`select-fin-${targetCanónico}`);

        const idInicio = selectInicio ? selectInicio.value : null;
        const idFin = selectFin ? selectFin.value : null;

        const paradaInicio = idInicio ? paradasDeZona.find(p => String(p.id || p.ssc) === String(idInicio)) : null;
        const paradaFin = idFin ? paradasDeZona.find(p => String(p.id || p.ssc) === String(idFin)) : null;

        if (paradaInicio) console.log(`📍 [OPTIMIZAR_HANDLERS]: Punto inicial fijado: ${paradaInicio.destinatario || paradaInicio.ssc}`);
        if (paradaFin) console.log(`🏁 [OPTIMIZAR_HANDLERS]: Punto final fijado: ${paradaFin.destinatario || paradaFin.ssc}`);

        // 4. Ejecutar optimización por carretera
        await optimizarRutaPorProximidadZona(targetCanónico, paradaInicio, paradaFin);

        console.groupEnd();
    };

    /**
     * Redirige al módulo de generación y descarga de planillas operativas.
     */
    window.planillarRutaZona = function (zona) {
        const targetCanónico = estandarizarZonaCanonica(zona);
        console.log(`📝 [MENSAJERO_RUTAS]: Generando planilla para Zona: ${zona} -> '${targetCanónico}'`);
        
        localStorage.setItem("zona_planillar_activa", targetCanónico);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/notificaciones/planillas.html", { zona: targetCanónico });
        } else if (typeof window.renderizarModuloPlanillas === "function") {
            window.renderizarModuloPlanillas(targetCanónico);
        } else {
            window.location.href = `vistas/notificaciones/planillas.html?zona=${encodeURIComponent(targetCanónico)}`;
        }
    };

    /**
     * Abre el lienzo de mapa interactivo enfocado exclusivamente en los waypoints de la zona.
     */
    window.verMapaZona = function (zona) {
        const targetCanónico = estandarizarZonaCanonica(zona);
        console.log(`🗺️ [MENSAJERO_RUTAS]: Abrir Mapa Zona: ${zona} -> '${targetCanónico}'`);
        
        localStorage.setItem("zona_activa_operacion", targetCanónico);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/ruta/mapa-activa.html", { zona: targetCanónico });
            setTimeout(() => calcularRutaAisladaPorZona(targetCanónico), 350);
        } else {
            window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(targetCanónico)}`;
        }
    };

    /**
     * Mueve manualmente una parada hacia arriba (-1) o abajo (+1) dentro de su secuencia.
     */
    window.moverParadaManual = async function (paradaId, direccion, zonaNombre) {
        const delta = (direccion === "arriba" || direccion === -1) ? -1 : 1;
        console.log(`>>> [REORDER_MANUAL]: Mover parada ${paradaId} (delta: ${delta}) en zona: ${zonaNombre}`);

        if (typeof window.moverParadaSecuenciaUI === "function") {
            const paradasLocal = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
            await window.moverParadaSecuenciaUI(paradasLocal, paradaId, delta, window.renderizarParadasZonificadasUI);
        } else {
            console.warn("⚠️ [REORDER_MANUAL]: 'moverParadaSecuenciaUI' no está definido en el contexto global.");
        }
    };

    console.log("🟢 [RUTAS_HANDLERS]: Handlers globales de rutas inicializados correctamente.");
}

// Ejecución automática al cargar el módulo ES6
registrarHandlersGlobales();