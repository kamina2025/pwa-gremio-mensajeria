/**
 * Módulo de Handlers y Eventos de Navegación Global
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-handlers.js
 */

import { calcularRutaAisladaPorZona } from "./rutas-aislamiento.js";
import { optimizarRutaPorProximidadZona } from "./rutas-optimizacion.js";

export function registrarHandlersGlobales() {
    window.iniciarRutaZona = function (zona) {
        console.log(`► [MENSAJERO_RUTAS]: Iniciar Ruta ejecutado para Zona: ${zona}`);
        localStorage.setItem("zona_activa_operacion", zona);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/ruta/mapa-activa.html", { zona: zona });
            setTimeout(() => calcularRutaAisladaPorZona(zona), 350);
        } else {
            window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(zona)}`;
        }
    };

    window.optimizarProximidadZona = async function (zona) {
        console.log(`⚡ [MENSAJERO_RUTAS]: Invocando optimización por proximidad para Zona: ${zona}`);
        await optimizarRutaPorProximidadZona(zona);
    };

    window.planillarRutaZona = function (zona) {
        console.log(`📝 [MENSAJERO_RUTAS]: Generando planilla para Zona: ${zona}`);
        localStorage.setItem("zona_planillar_activa", zona);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/notificaciones/planillas.html", { zona: zona });
        } else if (typeof window.renderizarModuloPlanillas === "function") {
            window.renderizarModuloPlanillas(zona);
        } else {
            window.location.href = `vistas/notificaciones/planillas.html?zona=${encodeURIComponent(zona)}`;
        }
    };

    window.verMapaZona = function (zona) {
        console.log(`🗺️ [MENSAJERO_RUTAS]: Abrir Mapa Zona: ${zona}`);
        localStorage.setItem("zona_activa_operacion", zona);

        if (typeof window.navegarA === "function") {
            window.navegarA("vistas/ruta/mapa-activa.html", { zona: zona });
            setTimeout(() => calcularRutaAisladaPorZona(zona), 350);
        } else {
            window.location.href = `vistas/ruta/mapa-activa.html?zona=${encodeURIComponent(zona)}`;
        }
    };

    window.moverParadaManual = function (paradaId, direccion, zonaNombre) {
        console.log(`>>> [REORDER_MANUAL]: Mover parada ${paradaId} dirección: ${direccion} en zona: ${zonaNombre}`);
    };
}