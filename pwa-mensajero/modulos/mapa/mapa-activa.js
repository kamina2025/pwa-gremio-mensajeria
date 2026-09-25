/**
 * PROTOCOLO MACONDO - NAVEGACIÓN Y CONTROL DEL MAPA
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-activa.js
 * Optimizado para PWA Local-First, Geocodificación asíncrona y Sincronización de Memoria
 */

import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "./zonificacion/estandar-zonas.js";

// Estado interno del módulo de mapa
let modoCrearParadaActivo = false;
let trazadoRutaPolyline = null;
let marcadoresMapa = [];

/**
 * 1. Alterna la visibilidad del cuadro de búsqueda del mapa
 */
export function toggleBuscadorMapaUI() {
    const input = document.getElementById("input-mapa-buscar-dir");
    if (input) {
        const estaOculto = input.style.display === "none" || getComputedStyle(input).display === "none";
        input.style.display = estaOculto ? "block" : "none";
        if (estaOculto) {
            input.focus();
        }
    }
    console.log("🔍 [MAPA_UI]: Toggle buscador dirección:", input ? input.style.display : "nodo no encontrado");
}

/**
 * 2. Activa o desactiva el modo interactivo para crear paradas haciendo clic sobre el mapa
 */
export function activarModoSeleccionMapaUI() {
    modoCrearParadaActivo = !modoCrearParadaActivo;
    const btn = document.getElementById("btn-modo-crear-parada");
    if (btn) {
        btn.style.background = modoCrearParadaActivo ? "var(--neon-green, #39ff14)" : "";
        btn.style.color = modoCrearParadaActivo ? "#0d1117" : "";
        btn.style.boxShadow = modoCrearParadaActivo ? "0 0 12px var(--neon-green, #39ff14)" : "";
    }
    console.log("⚡ [MAPA_UI]: Modo selección táctica de parada activo:", modoCrearParadaActivo);
}

/**
 * 3. Registra el listener de clics geográficos sobre el mapa para agregar paradas dinámicas
 */
export function registrarEventosClicMapa() {
    const mapaInstancia = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;

    if (!mapaInstancia) {
        console.warn("⚠️ [MAPA_EVENTOS]: Instancia de mapa no detectada para vincular clics.");
        return;
    }

    mapaInstancia.addListener("click", async (e) => {
        if (!modoCrearParadaActivo) return;

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        console.log(`📍 [MAPA_EVENTOS]: Clic capturado en coordenadas Lat: ${lat}, Lng: ${lng}`);

        if (typeof google === "undefined" || !google.maps || !google.maps.Geocoder) {
            console.error("❌ [MAPA_EVENTOS]: Google Maps Geocoder SDK no está disponible.");
            return;
        }

        const geocoder = new google.maps.Geocoder();
        
        try {
            const response = await new Promise((resolve, reject) => {
                geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                    if (status === "OK" && results && results[0]) {
                        resolve(results[0].formatted_address);
                    } else {
                        reject(status);
                    }
                });
            });

            const nuevaDireccion = response || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
            
            // Reemplazo asíncrono no bloqueante
            const destinatario = window.prompt ? window.prompt("Nombre del Destinatario para esta parada:", "Cliente Nuevo") : "Cliente Nuevo";
            
            if (destinatario && destinatario.trim() !== "") {
                const nuevaParada = {
                    id: "PARADA_" + Date.now(),
                    ssc: "NEW-" + Math.floor(1000 + Math.random() * 9000),
                    destinatario: destinatario.trim(),
                    direccion: nuevaDireccion,
                    lat: lat,
                    lng: lng,
                    estado: "PENDIENTE",
                    zona: localStorage.getItem("zona_activa_operacion") || "GENERAL",
                    created_at: new Date().toISOString()
                };

                console.log("➕ [MAPA_EVENTOS]: Creando y persisiendo nueva parada:", nuevaParada);

                // Integración local y actualización global de memorias RAM
                if (typeof window.agregarParadaLocal === "function") {
                    await window.agregarParadaLocal(nuevaParada);
                } else {
                    let paradasActuales = await obtenerParadasGuardadas();
                    paradasActuales.push(nuevaParada);
                    await guardarRutaZonificada(paradasActuales);
                    
                    window.__CACHE_PARADAS_MACONDO__ = [...paradasActuales];
                    window.paradasMemoriaLocal = [...paradasActuales];
                    window.paradasRutaActiva = [...paradasActuales];
                    window.pedidosGlobales = [...paradasActuales];
                }

                // Refrescar mapa e interfaz
                if (typeof window.actualizarPuntosEnMapa === "function") {
                    const paradasActualizadas = window.__CACHE_PARADAS_MACONDO__ || await obtenerParadasGuardadas();
                    window.actualizarPuntosEnMapa(paradasActualizadas, 0);
                }
            }
        } catch (error) {
            console.error("❌ [MAPA_EVENTOS]: Fallo en la geocodificación inversa:", error);
        } finally {
            activarModoSeleccionMapaUI(); // Desactivar modo edición tras completar
        }
    });
}

/**
 * 4. Dibujar / Actualizar Trazado de Ruta y Marcadores sobre el mapa
 * @param {string|null} zonaFilter - Filtro opcional de zona
 * @param {Array} listaParadas - Arreglo de paradas ordenadas
 */
export function actualizarTrazadoMapa(zonaFilter = null, listaParadas = []) {
    const mapaInstancia = window.mapaMensajero || window.mapaInstanciaGlobal || window.mapaInstancia;
    if (!mapaInstancia) return;

    const targetZona = zonaFilter ? estandarizarZonaCanonica(zonaFilter) : null;
    console.log(`🗺️ [MAPA_TRAZADO]: Actualizando ruta. Zona: ${targetZona || 'GLOBAL'}, Paradas: ${listaParadas.length}`);

    // Limpieza de marcadores locales previos
    marcadoresMapa.forEach(marker => {
        if (marker && typeof marker.setMap === "function") marker.setMap(null);
    });
    marcadoresMapa = [];

    // Limpieza de polilíneas
    if (trazadoRutaPolyline && typeof trazadoRutaPolyline.setMap === "function") {
        trazadoRutaPolyline.setMap(null);
        trazadoRutaPolyline = null;
    }

    if (!listaParadas || listaParadas.length === 0) return;

    // Filtrar paradas por zona si aplica
    const paradasProcesar = targetZona 
        ? listaParadas.filter(p => p && obtenerZonaParadaCanonica(p) === targetZona)
        : listaParadas;

    const pathCoordinates = [];
    const bounds = new google.maps.LatLngBounds();

    paradasProcesar.forEach((parada, index) => {
        const lat = parseFloat(parada.lat || parada.latitud);
        const lng = parseFloat(parada.lng || parada.longitud);

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            const pos = { lat, lng };
            pathCoordinates.push(pos);
            bounds.extend(pos);
        }
    });

    // Dibujar línea conectora neón si no existe DirectionsRenderer activo
    if (pathCoordinates.length > 0) {
        if (!window.__DIRECTIONS_RENDERER__) {
            trazadoRutaPolyline = new google.maps.Polyline({
                path: pathCoordinates,
                geodesic: true,
                strokeColor: "#00e5ff",
                strokeOpacity: 0.85,
                strokeWeight: 4
            });

            trazadoRutaPolyline.setMap(mapaInstancia);
        }

        if (!bounds.isEmpty()) {
            mapaInstancia.fitBounds(bounds);
        }
        console.log("✅ [MAPA_TRAZADO]: Trazado y límites de mapa re-calculados exitosamente.");
    }
}

// 5. Escuchar eventos globales de reordenamiento
window.addEventListener("rutasReordenadas", (event) => {
    const { zonaId, nuevaSecuencia } = event.detail || {};
    console.log(`🔄 [MAPA_EVENTO]: Evento 'rutasReordenadas' capturado para Zona: ${zonaId}`);
    
    const paradasLocales = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || [];
    actualizarTrazadoMapa(zonaId, nuevaSecuencia || paradasLocales);
});

// Bindings globales para compatibilidad heredada (Window Scope)
window.toggleBuscadorMapaUI = toggleBuscadorMapaUI;
window.activarModoSeleccionMapaUI = activarModoSeleccionMapaUI;
window.actualizarTrazadoMapa = actualizarTrazadoMapa;
window.registrarEventosClicMapa = registrarEventosClicMapa;

// Inicialización automática
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const zonaParam = urlParams.get("zona");
    if (zonaParam) {
        const zonaLimpia = estandarizarZonaCanonica(zonaParam);
        console.log(`📍 [MAPA_INIT]: Inicializando vista con foco en Zona: ${zonaLimpia}`);
        localStorage.setItem("zona_activa_operacion", zonaLimpia);
    }
});