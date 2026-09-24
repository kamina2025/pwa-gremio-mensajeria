/**
 * Módulo de Eventos Drag & Drop Nativo HTML5 y Persistencia de Secuencia
 * Ubicación: pwa-mensajero/modulos/ui/ui-dnd-persistencia.js
 */

import { guardarRutaZonificada } from "../mensajero-persistencia.js";

let itemArrastradoUI = null;

/**
 * Registra los eventos Drag & Drop Nativo sobre una tarjeta de parada.
 * 
 * @param {HTMLElement} cardElement - Elemento HTML de la tarjeta
 * @param {string} zonaNombre - Nombre de la zona correspondiente
 * @param {Array<Object>} paradasMemoriaLocal - Arreglo local de paradas
 * @param {Function} [renderCallback] - Función opcional de re-renderizado
 */
export function vincularDragDropUI(cardElement, zonaNombre, paradasMemoriaLocal, renderCallback) {
    if (!cardElement) return;

    cardElement.addEventListener("dragstart", (e) => {
        itemArrastradoUI = cardElement;
        cardElement.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", cardElement.getAttribute("data-id") || "");
    });

    cardElement.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (cardElement !== itemArrastradoUI) {
            cardElement.classList.add("drag-over");
        }
    });

    cardElement.addEventListener("dragleave", () => {
        cardElement.classList.remove("drag-over");
    });

    cardElement.addEventListener("drop", async (e) => {
        e.preventDefault();
        cardElement.classList.remove("drag-over");

        if (itemArrastradoUI && itemArrastradoUI !== cardElement) {
            const contenedorPadre = cardElement.parentNode;
            const tarjetas = Array.from(contenedorPadre.querySelectorAll(".item-parada-lista, .parada-card"));
            const origenIndex = tarjetas.indexOf(itemArrastradoUI);
            const destinoIndex = tarjetas.indexOf(cardElement);

            if (origenIndex < destinoIndex) {
                contenedorPadre.insertBefore(itemArrastradoUI, cardElement.nextSibling);
            } else {
                contenedorPadre.insertBefore(itemArrastradoUI, cardElement);
            }

            // Recalcular orden en memoria, persistir y refrescar mapa
            await recalcularYPersistirDragDrop(contenedorPadre, zonaNombre, paradasMemoriaLocal);
            
            if (typeof renderCallback === "function") {
                renderCallback();
            }
        }
    });

    cardElement.addEventListener("dragend", () => {
        cardElement.classList.remove("dragging");
        itemArrastradoUI = null;
        document.querySelectorAll(".item-parada-lista, .parada-card").forEach((c) => c.classList.remove("drag-over"));
    });
}

/**
 * Recalcula las secuencias según el DOM actual, actualiza cachés globales y persiste en IndexedDB.
 * 
 * @param {HTMLElement} contenedorPadre - Elemento contenedor de las tarjetas
 * @param {string} zonaNombre - Nombre de la zona actual
 * @param {Array<Object>} paradasMemoriaLocal - Arreglo local de paradas
 */
export async function recalcularYPersistirDragDrop(contenedorPadre, zonaNombre, paradasMemoriaLocal) {
    if (!contenedorPadre) return;

    const cards = Array.from(contenedorPadre.querySelectorAll(".item-parada-lista, .parada-card"));
    const mapaIdAParada = new Map();

    // Colección global unificada
    const listaOriginal = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || paradasMemoriaLocal || [];
    
    listaOriginal.forEach((p) => {
        const idUnico = String(p.id || p.ssc || p.idParada || p.id_parada || "").trim();
        if (idUnico) {
            mapaIdAParada.set(idUnico, p);
        }
    });

    const subListaZonaReordenada = [];

    // Reconstruir la secuencia de la zona según el orden del DOM
    cards.forEach((card, nuevoIndex) => {
        const cardId = String(card.getAttribute("data-id") || "").trim();
        const paradaObj = mapaIdAParada.get(cardId);

        if (paradaObj) {
            const nuevaSec = nuevoIndex + 1;
            paradaObj.secuencia = nuevaSec;
            paradaObj.secuenciaZona = nuevaSec;
            paradaObj.orden = nuevaSec;
            paradaObj.updated_at = new Date().toISOString();
            subListaZonaReordenada.push(paradaObj);
        }

        // Refrescar el número de secuencia en el encabezado visible
        const strongEl = card.querySelector("strong");
        if (strongEl) {
            strongEl.textContent = strongEl.textContent.replace(/\[#\d+\]/, `[#${nuevoIndex + 1}]`);
        }
    });

    // Re-ensamblar la lista global respetando paradas de otras zonas
    const idsZonaSet = new Set(subListaZonaReordenada.map(p => String(p.id || p.ssc || p.idParada || p.id_parada).trim()));
    const listaGlobalActualizada = [];
    let idxInsert = 0;

    listaOriginal.forEach((p) => {
        const idUnico = String(p.id || p.ssc || p.idParada || p.id_parada).trim();
        if (idsZonaSet.has(idUnico)) {
            listaGlobalActualizada.push(subListaZonaReordenada[idxInsert]);
            idxInsert++;
        } else {
            listaGlobalActualizada.push(p);
        }
    });

    // Sincronizar todas las referencias RAM globales
    window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
    window.paradasMemoriaLocal = [...listaGlobalActualizada];
    window.paradasRutaActiva = [...listaGlobalActualizada];

    // Persistir en IndexedDB / LocalStorage
    try {
        await guardarRutaZonificada(listaGlobalActualizada);
        localStorage.setItem("ruta_zonificada", JSON.stringify(listaGlobalActualizada));
        console.log(`💾 [UI_DND]: Secuencia reordenada para '${zonaNombre}' sincronizada exitosamente.`);
    } catch (err) {
        console.error("❌ [UI_DND_ERROR]: Fallo al persistir secuencia reordenada:", err);
    }

    // Refrescar marcadores en el mapa interactivo
    if (typeof window.actualizarPuntosEnMapa === "function") {
        window.actualizarPuntosEnMapa(listaGlobalActualizada, 0);
    }

    // Emitir evento para componentes desacoplados
    if (typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent("rutasReordenadas", {
            detail: { zonaId: zonaNombre, nuevaSecuencia: listaGlobalActualizada }
        }));
    }
}

// Bindings globales inmediatos
if (typeof window !== "undefined") {
    window.vincularDragDropUI = vincularDragDropUI;
    window.recalcularYPersistirDragDrop = recalcularYPersistirDragDrop;
}