/**
 * PROTOCOLO MACONDO - CONTROLADOR DE LA VISTA MAPA (PWA MENSAJERO)
 * Ubicación: pwa-mensajero/modulos/mapa/mapa-controlador.js
 */

import { crearIconoParadaCyberpunkSVG } from './mapa-iconos.js';

// Asegurar la existencia de las colecciones globales de marcadores
window.mapaGoogleInstance = window.mapaGoogleInstance || window.mapaMensajero || null;
window.marcadoresParadasMap = window.marcadoresParadasMap || new Map();

/**
 * Función auxiliar para buscar un marcador en el Map o en el Array global
 * Soporta variaciones del ID como '#PNT-1818', 'PNT-1818', o números.
 */
function obtenerMarcadorPorId(idParada) {
    const idStr = String(idParada).trim();
    const idLimpio = idStr.replace(/^#/, ''); // Remueve el '#' si existe

    // 1. Buscar en el Map (window.marcadoresParadasMap)
    if (window.marcadoresParadasMap instanceof Map && window.marcadoresParadasMap.size > 0) {
        if (window.marcadoresParadasMap.has(idStr)) return window.marcadoresParadasMap.get(idStr);
        if (window.marcadoresParadasMap.has(idLimpio)) return window.marcadoresParadasMap.get(idLimpio);
    }

    // 2. Buscar en el Arreglo (window.marcadoresRutaMensajero)
    const listaArray = window.marcadoresRutaMensajero || window.marcadoresRuta;
    if (Array.isArray(listaArray)) {
        const encontrado = listaArray.find(m => {
            if (!m) return false;
            const mId = String(m.get('idParada') || m.id || '').trim();
            return mId === idStr || mId === idLimpio || mId.replace(/^#/, '') === idLimpio;
        });
        if (encontrado) return encontrado;
    }

    return null;
}

/**
 * Función global para Mutar el estado de una parada y redibujar su pin SVG Cyberpunk en vivo
 */
window.mutarEstadoParadaMapaUI = function(idParada, nuevoEstado, causalText = '') {
    const marker = obtenerMarcadorPorId(idParada);

    if (!marker) {
        console.warn(`⚠️ [MAPA_UI]: No se encontró la parada en el mapa con ID: ${idParada}`);
        return;
    }

    const secuenciaActual = marker.get('secuencia') || 1;
    
    // Generar el nuevo Data-URI SVG con el color neón correspondiente
    const nuevoIcono = crearIconoParadaCyberpunkSVG({
        estado: nuevoEstado,
        secuencia: secuenciaActual,
        causal: causalText
    });

    // Reemplazar ícono dinámicamente en el mapa de Google Maps
    marker.setIcon(nuevoIcono);
    console.log(`⚡ [MAPA_UI]: Parada ${idParada} mutada exitosamente a -> [${nuevoEstado}] ${causalText ? 'Causal: ' + causalText : ''}`);
};

/**
 * Registra y renderiza la colección de paradas asegurando el mapeo de IDs
 */
window.renderizarParadasEnMapaCyberpunk = function(listaParadas = []) {
    const mapa = window.mapaGoogleInstance || window.mapaMensajero;
    if (!mapa) return;

    if (window.marcadoresParadasMap instanceof Map) {
        window.marcadoresParadasMap.forEach(marker => marker.setMap(null));
        window.marcadoresParadasMap.clear();
    }

    listaParadas.forEach((parada, index) => {
        const stopId = String(parada.id || `#PNT-${index + 1}`);
        const idLimpio = stopId.replace(/^#/, '');
        const seq = parada.secuencia || (index + 1);

        const iconoSVG = crearIconoParadaCyberpunkSVG({
            estado: parada.estado || 'asignado',
            secuencia: seq,
            causal: parada.causal || ''
        });

        const marker = new google.maps.Marker({
            position: { lat: parseFloat(parada.lat), lng: parseFloat(parada.lng) },
            map: mapa,
            title: `[STOP ${seq}]: ${parada.direccion || ''}`,
            icon: iconoSVG
        });

        marker.set('secuencia', seq);
        marker.set('idParada', stopId);

        if (window.marcadoresParadasMap instanceof Map) {
            // Guardar por múltiples llaves para indexación flexible
            window.marcadoresParadasMap.set(stopId, marker);
            window.marcadoresParadasMap.set(idLimpio, marker);
            window.marcadoresParadasMap.set(index, marker);
        }
    });
};