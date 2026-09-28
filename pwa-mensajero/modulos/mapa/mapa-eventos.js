/**
 * PROTOCOLO MACONDO - EVENTOS, BUSCADOR MULTIMODAL Y ESCÁNER TÁCTICO SCC
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-eventos.js
 * Arquitectura: Event-Driven / Modular Orchestrator
 */

import { mapaControles } from "./eventos/mapa-controles.js";
import { mapaBuscador } from "./eventos/mapa-buscador.js";
import { mapaEscanner } from "./eventos/mapa-escanner.js";

let modoCrearParadaActivo = false;

export const mapaEventos = {
    mapaInstancia: null,

    /**
     * Inicializa todos los sub-módulos de eventos y controladores del mapa.
     * @param {google.maps.Map} mapa 
     */
    inicializarControles(mapa) {
        this.mapaInstancia = mapa || window.mapaMensajero || window.mapaInstancia;
        console.log('⚡ [MAPA_EVENTOS]: Inicializando orquestador de controles, buscador y escáner.');

        mapaControles.inicializar(this.mapaInstancia);
        mapaBuscador.inicializar();
        
        mapaEscanner.inicializar((codigoEscaneado) => {
            const inputBuscador = document.getElementById("buscador-paradas-mapa");
            if (inputBuscador) inputBuscador.value = codigoEscaneado;
            mapaBuscador.ejecutarFiltradoParadas(codigoEscaneado);
        });
    },

    inicializarBuscadorMapa() {
        mapaBuscador.inicializar();
    },

    ejecutarFiltradoParadas(query) {
        return mapaBuscador.ejecutarFiltradoParadas(query);
    },

    ejecutarGeocodificacionDireccion(dir) {
        return mapaBuscador.ejecutarGeocodificacionDireccion(dir);
    },

    iniciarEscanerCamaraSCC() {
        return mapaEscanner.iniciarEscanerCamaraSCC((codigo) => {
            const inputBuscador = document.getElementById("buscador-paradas-mapa");
            if (inputBuscador) inputBuscador.value = codigo;
            mapaBuscador.ejecutarFiltradoParadas(codigo);
        });
    },

    detenerEscanerCamaraSCC() {
        return mapaEscanner.detenerEscanerCamaraSCC();
    },

    ejecutarZoom(delta) {
        return mapaControles.ejecutarZoom(delta);
    },

    alternarBloqueoMapa(estado) {
        return mapaControles.alternarBloqueoMapa(estado);
    }
};

export function activarModoSeleccionMapaUI() {
    modoCrearParadaActivo = !modoCrearParadaActivo;
    console.log(`📌 [MAPA_EVENTOS]: Modo selección manual de posición ${modoCrearParadaActivo ? 'ACTIVADO' : 'DESACTIVADO'}.`);
    return modoCrearParadaActivo;
}

export function registrarEventosClicMapa(callbackNuevaParada) {
    if (typeof callbackNuevaParada === "function") {
        console.log("⚡ [MAPA_EVENTOS]: Callback de clic en mapa registrado.");
    }
}

export function toggleBuscadorMapaUI() {
    const inputBuscador = document.getElementById("buscador-paradas-mapa");
    if (inputBuscador) {
        inputBuscador.focus();
    }
}

export function ejecutarBusquedaDireccion(dir) {
    mapaBuscador.ejecutarGeocodificacionDireccion(dir);
}

// BINDINGS GLOBALES EN WINDOW
window.mapaEventos = mapaEventos;
window.activarModoSeleccionMapaUI = activarModoSeleccionMapaUI;
window.registrarEventosClicMapa = registrarEventosClicMapa;
window.toggleBuscadorMapaUI = toggleBuscadorMapaUI;
window.ejecutarBusquedaDireccion = ejecutarBusquedaDireccion;
window.ejecutarBusquedaParadas = (query) => mapaBuscador.ejecutarFiltradoParadas(query);

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
        mapaBuscador.inicializar();
    });
}