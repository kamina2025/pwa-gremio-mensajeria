/**
 * Módulo de Eventos Drag & Drop Nativo HTML5 y Persistencia de Secuencia
 * Ubicación: pwa-mensajero/modulos/ui/ui-dnd-persistencia.js
 */

import { guardarRutaZonificada } from "../mensajero-persistencia.js";

let itemArrastradoUI = null;

/**
 * Registra los eventos Drag & Drop Nativo sobre una tarjeta de parada
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
            const tarjetas = Array.from(contenedorPadre.querySelectorAll(".item-parada-lista"));
            const origenIndex = tarjetas.indexOf(itemArrastradoUI);
            const destinoIndex = tarjetas.indexOf(cardElement);

            if (origenIndex < destinoIndex) {
                contenedorPadre.insertBefore(itemArrastradoUI, cardElement.nextSibling);
            } else {
                contenedorPadre.insertBefore(itemArrastradoUI, cardElement);
            }

            // Recalcular el orden físico en memoria, persistir y refrescar el mapa
            await recalcularYPersistirDragDrop(contenedorPadre, zonaNombre, paradasMemoriaLocal);
            
            if (typeof renderCallback === "function") {
                renderCallback();
            }
        }
    });

    cardElement.addEventListener("dragend", () => {
        cardElement.classList.remove("dragging");
        itemArrastradoUI = null;
        document.querySelectorAll(".item-parada-lista").forEach((c) => c.classList.remove("drag-over"));
    });
}

/**
 * Recalcula las secuencias reordenando físicamente los arreglos en RAM, 
 * persiste en IndexedDB/localStorage e invoca la actualización del mapa.
 * 
 * @param {HTMLElement} contenedorPadre - Elemento contenedor de los acordeones
 * @param {string} zonaNombre - Nombre de la zona actual
 * @param {Array<Object>} paradasMemoriaLocal - Arreglo actual de paradas
 */
export async function recalcularYPersistirDragDrop(contenedorPadre, zonaNombre, paradasMemoriaLocal) {
    if (!contenedorPadre) return;

    const cards = Array.from(contenedorPadre.querySelectorAll(".item-parada-lista"));
    const mapaIdAParada = new Map();

    // Mapear todas las paradas en memoria por su ID único o SSC
    const listaOriginal = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || paradasMemoriaLocal || [];
    listaOriginal.forEach((p) => {
        const idUnico = p.id || p.ssc || p.idParada || p.id_parada;
        if (idUnico) {
            mapaIdAParada.set(String(idUnico), p);
        }
    });

    const subListaZonaReordenada = [];

    // Reconstruir la lista reordenada de esta zona según la secuencia del DOM
    cards.forEach((card, nuevoIndex) => {
        const cardId = String(card.getAttribute("data-id") || "");
        const paradaObj = mapaIdAParada.get(cardId);

        if (paradaObj) {
            paradaObj.secuencia = nuevoIndex + 1;
            paradaObj.secuenciaZona = nuevoIndex + 1;
            paradaObj.orden = nuevoIndex + 1;
            paradaObj.updated_at = new Date().toISOString();
            subListaZonaReordenada.push(paradaObj);
        }

        // Actualizar el número ordinal `#1, #2, #3` en el encabezado de la tarjeta visual
        const strongEl = card.querySelector("strong");
        if (strongEl) {
            strongEl.textContent = strongEl.textContent.replace(/\[#\d+\]/, `[#${nuevoIndex + 1}]`);
        }
    });

    // Re-ensamblar la lista global insertando físicamente la secuencia reordenada de la zona
    const idsZonaSet = new Set(subListaZonaReordenada.map(p => String(p.id || p.ssc || p.idParada || p.id_parada)));
    const listaGlobalActualizada = [];
    let idxInsert = 0;

    listaOriginal.forEach((p) => {
        const idUnico = String(p.id || p.ssc || p.idParada || p.id_parada);
        if (idsZonaSet.has(idUnico)) {
            listaGlobalActualizada.push(subListaZonaReordenada[idxInsert]);
            idxInsert++;
        } else {
            listaGlobalActualizada.push(p);
        }
    });

    // Actualizar estados locales y globales en memoria RAM
    window.__CACHE_PARADAS_MACONDO__ = [...listaGlobalActualizada];
    window.paradasMemoriaLocal = [...listaGlobalActualizada];

    // Persistir en IndexedDB / localStorage
    try {
        await guardarRutaZonificada(listaGlobalActualizada);
        console.log(`💾 [UI_DND]: Secuencia reordenada para ZONA '${zonaNombre}' guardada y sincronizada exitosamente.`);
    } catch (err) {
        console.error("❌ [UI_DND_ERROR]: Fallo al persistir secuencia reordenada en IndexedDB:", err);
    }

    // REFRESCO DIRECTO DEL MAPA (Marcadores e indicadores)
    if (typeof window.actualizarPuntosEnMapa === "function") {
        console.log("🗺️ [UI_DND]: Refrescando marcadores en el lienzo del mapa con la nueva secuencia...");
        window.actualizarPuntosEnMapa(listaGlobalActualizada, 0);
    }

    // Emitir evento custom para integración con otros oyentes desacoplados
    window.dispatchEvent(new CustomEvent("rutasReordenadas", {
        detail: { zonaId: zonaNombre, nuevaSecuencia: listaGlobalActualizada }
    }));
}

// Bindings globales inmediatos
window.vincularDragDropUI = vincularDragDropUI;
window.recalcularYPersistirDragDrop = recalcularYPersistirDragDrop;