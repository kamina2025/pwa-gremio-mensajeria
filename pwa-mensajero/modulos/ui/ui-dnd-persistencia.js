/**
 * Módulo de Eventos Drag & Drop Nativo HTML5 y Persistencia
 * Ubicación: pwa-mensajero/modulos/ui/ui-dnd-persistencia.js
 */

import { IndexedStore } from "../db/indexed-store.js";

const dbStore = new IndexedStore();
let itemArrastradoUI = null;

/**
 * Registra los eventos Drag & Drop Nativo sobre una tarjeta de parada
 */
export function vincularDragDropUI(cardElement, zonaNombre, paradasMemoriaLocal, renderCallback) {
    cardElement.addEventListener("dragstart", (e) => {
        itemArrastradoUI = cardElement;
        cardElement.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", cardElement.getAttribute("data-id"));
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

            await recalcularYPersistirDragDrop(contenedorPadre, zonaNombre, paradasMemoriaLocal);
            if (typeof renderCallback === "function") renderCallback();
        }
    });

    cardElement.addEventListener("dragend", () => {
        cardElement.classList.remove("dragging");
        itemArrastradoUI = null;
        document.querySelectorAll(".item-parada-lista").forEach((c) => c.classList.remove("drag-over"));
    });
}

/**
 * Recalcula secuencias en memoria, las persiste en IndexedDB y notifica al sistema
 */
export async function recalcularYPersistirDragDrop(contenedorPadre, zonaNombre, paradasMemoriaLocal) {
    const cards = contenedorPadre.querySelectorAll(".item-parada-lista");
    const nuevaSecuencia = [];

    cards.forEach((card, nuevoIndex) => {
        const origIdx = parseInt(card.getAttribute("data-orig-index"), 10);
        if (!isNaN(origIdx) && paradasMemoriaLocal[origIdx]) {
            paradasMemoriaLocal[origIdx].secuencia = nuevoIndex + 1;
            paradasMemoriaLocal[origIdx].secuenciaZona = nuevoIndex + 1;
        }
        
        const strongEl = card.querySelector("strong");
        if (strongEl) {
            strongEl.textContent = strongEl.textContent.replace(/\[#\d+\]/, `[#${nuevoIndex + 1}]`);
        }
        nuevaSecuencia.push({ id: card.getAttribute("data-id"), secuencia: nuevoIndex + 1 });
    });

    for (const p of paradasMemoriaLocal) {
        await dbStore.actualizarParada(p);
    }
    localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
    console.log(`💾 [UI_DND]: Secuencia reordenada para ${zonaNombre} guardada en IndexedDB.`);

    window.dispatchEvent(new CustomEvent("rutasReordenadas", {
        detail: { zonaId: zonaNombre, nuevaSecuencia }
    }));
}