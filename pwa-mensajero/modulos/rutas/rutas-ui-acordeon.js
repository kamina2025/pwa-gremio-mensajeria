/**
 * Módulo de Renderizado de UI Acordeones, Selección de Puntos Fijos y Drag & Drop
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-ui-acordeon.js
 * Arquitectura: Async Local-First
 */

import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

let itemArrastrado = null;
let touchElementoInicial = null;

/**
 * Renderiza la UI de acordeones con selectores de inicio/fin, botones de zona y tarjetas interactivas.
 * 
 * @param {Array<Object>|Promise<Array<Object>>} listaPedidosParam
 */
export async function renderizarParadasZonificadasUI(listaPedidosParam = []) {
    console.log(">>> [RUTAS_UI]: Ejecutando renderizarParadasZonificadasUI...");

    const contenedor = document.getElementById("lista-paradas-zonificadas") || document.getElementById("contenedor-acordeones-zonas");
    if (!contenedor) {
        console.warn(">>> [RUTAS_WARN]: Contenedor de acordeones no hallado en el DOM.");
        return;
    }

    let listaPedidos = await Promise.resolve(listaPedidosParam);

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        listaPedidos = (await obtenerParadasGuardadas()) || [];
    }

    window.__CACHE_PARADAS_MACONDO__ = structuredClone(listaPedidos);
    window.paradasMemoriaLocal = structuredClone(listaPedidos);

    contenedor.innerHTML = "";

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        contenedor.innerHTML = `<p style="text-align:center; color:#aaa; font-family:monospace; padding:10px;">[SISTEMA]: No hay paradas en la ruta activa.</p>`;
        return;
    }

    // Agrupar pedidos estrictamente por la clave canónica GeoJSON
    const zonasMap = {};
    listaPedidos.forEach((ped) => {
        const claveCanonica = obtenerZonaParadaCanonica(ped);
        if (!zonasMap[claveCanonica]) zonasMap[claveCanonica] = [];
        zonasMap[claveCanonica].push(ped);
    });

    Object.entries(zonasMap).forEach(([claveCanonica, paradasZona]) => {
        paradasZona.sort((a, b) => (a.secuenciaZona || 0) - (b.secuenciaZona || 0));

        const totalParadas = paradasZona.length;
        const colorHex = paradasZona[0]?.colorZona || "#39FF14";
        const nombreZonaDisplay = `ZONA ${claveCanonica}`;

        const details = document.createElement("details");
        details.className = "cyber-accordion";
        details.style.setProperty("border-color", colorHex, "important");
        details.style.marginBottom = "12px";
        details.open = true;

        console.log(`🎨 [RUTAS_UI]: Acordeón asignado a zona '${claveCanonica}' con color: ${colorHex}`);

        const summary = document.createElement("summary");
        summary.className = "cyber-summary";
        summary.style.borderLeft = `4px solid ${colorHex}`;
        summary.innerHTML = `
            <span>▼ ${nombreZonaDisplay} (${totalParadas})</span>
            <span class="badge-zone" style="background-color: ${colorHex}; color: #0d1117;">${colorHex}</span>
        `;

        // BARRA DE ACCIONES DE ZONA CON SELECTORES DE PUNTO INICIAL Y FINAL
        const accionesContainer = document.createElement("div");
        accionesContainer.className = "zona-acciones-container";
        accionesContainer.style.cssText = "background: #080b10; border-bottom: 1px solid #30363d; padding: 8px; margin-bottom: 8px;";

        const selectoresBar = document.createElement("div");
        selectoresBar.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px; font-size: 0.75rem;";

        const selectInicio = document.createElement("select");
        selectInicio.id = `select-inicio-${claveCanonica}`;
        selectInicio.className = "select-punto-fijo";
        selectInicio.style.cssText = "width:100%; background:#161b22; color:#fff; border:1px solid #30363d; padding:4px; border-radius:4px; font-size:0.75rem;";

        const selectFin = document.createElement("select");
        selectFin.id = `select-fin-${claveCanonica}`;
        selectFin.className = "select-punto-fijo";
        selectFin.style.cssText = "width:100%; background:#161b22; color:#fff; border:1px solid #30363d; padding:4px; border-radius:4px; font-size:0.75rem;";

        const optDefaultInicio = new Option("-- Automático (Por Posición) --", "");
        const optDefaultFin = new Option("-- Automático (Por Posición) --", "");
        selectInicio.add(optDefaultInicio);
        selectFin.add(optDefaultFin);

        let inicioPersistido = null;
        let finPersistido = null;

        paradasZona.forEach((p) => {
            const pId = String(p.id || p.ssc);
            const pNombre = p.destinatario || p.cliente || `Parada #${p.secuenciaZona}`;
            
            const optInicio = new Option(`[#${p.secuenciaZona}] ${pNombre}`, pId);
            const optFin = new Option(`[#${p.secuenciaZona}] ${pNombre}`, pId);

            selectInicio.add(optInicio);
            selectFin.add(optFin);

            if (p.esInicioZona) inicioPersistido = pId;
            if (p.esFinZona) finPersistido = pId;
        });

        if (inicioPersistido) selectInicio.value = inicioPersistido;
        if (finPersistido) selectFin.value = finPersistido;

        // Listeners para cambio de punto fijo
        selectInicio.addEventListener("change", (e) => {
            console.log(`📌 [RUTAS_UI]: Inicio fijado para ${claveCanonica} -> ${e.target.value}`);
            if (typeof window.fijarPuntoInicioZona === "function") {
                window.fijarPuntoInicioZona(claveCanonica, e.target.value);
            }
        });

        selectFin.addEventListener("change", (e) => {
            console.log(`📌 [RUTAS_UI]: Fin fijado para ${claveCanonica} -> ${e.target.value}`);
            if (typeof window.fijarPuntoFinZona === "function") {
                window.fijarPuntoFinZona(claveCanonica, e.target.value);
            }
        });

        const divInicio = document.createElement("div");
        divInicio.style.flex = "1";
        divInicio.innerHTML = `<label style="color: #8b949e; display:block; margin-bottom:2px;">📍 Inicio Fijado:</label>`;
        divInicio.appendChild(selectInicio);

        const divFin = document.createElement("div");
        divFin.style.flex = "1";
        divFin.innerHTML = `<label style="color: #8b949e; display:block; margin-bottom:2px;">🏁 Fin Fijado:</label>`;
        divFin.appendChild(selectFin);

        selectoresBar.appendChild(divInicio);
        selectoresBar.appendChild(divFin);

        const botonesBar = document.createElement("div");
        botonesBar.className = "zona-acciones-bar";
        botonesBar.style.cssText = "display: flex; gap: 6px; overflow-x: auto;";
        botonesBar.innerHTML = `
            <button type="button" class="btn-zona-action btn-zona-iniciar" data-action="iniciar" data-zona="${claveCanonica}" style="background: #0d1117; color: #00e5ff; border: 1px solid #00e5ff; font-weight: bold; cursor: pointer; padding: 4px 8px;">
                ► _INICIAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-optimizar" data-action="optimizar" data-zona="${claveCanonica}" style="background: #0d1117; color: #ffb300; border: 1px solid #ffb300; font-weight: bold; cursor: pointer; padding: 4px 8px;">
                ⚡ OPTIMIZAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-planillar" data-action="planillar" data-zona="${claveCanonica}" style="background: #0d1117; color: #8af7b3; border: 1px solid #8af7b3; cursor: pointer; padding: 4px 8px;">
                📝 _PLANILLAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-mapa" data-action="mapa" data-zona="${claveCanonica}" style="background: #0d1117; color: #ff3366; border: 1px solid #ff3366; cursor: pointer; padding: 4px 8px;">
                🗺️ VER MAPA
            </button>
        `;

        accionesContainer.appendChild(selectoresBar);
        accionesContainer.appendChild(botonesBar);

        // TARJETAS DE PARADAS DRAG & DROP
        const listContainer = document.createElement("div");
        listContainer.className = "paradas-drag-list";
        listContainer.style.padding = "4px";

        paradasZona.forEach((parada, idx) => {
            const rawId = String(parada.id || parada.ssc || `p_${idx}`);
            const numSecuencia = parada.secuenciaZona || idx + 1;
            const card = document.createElement("div");

            card.className = "parada-card item-parada-lista";
            card.setAttribute("draggable", "true");
            card.dataset.id = rawId;
            card.dataset.zona = claveCanonica;

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex:1; padding-right:8px;">
                        <strong style="color: var(--neon-green, #00ff66);">[#${numSecuencia}] ${parada.destinatario || parada.cliente || "Cliente"}</strong> - ${parada.direccion || ""}
                        <div style="font-size: 0.72rem; color: #aaa; margin-top: 2px;">
                            SSC: ${parada.ssc || "N/A"} | Tel: ${parada.telefono || "N/A"} | Cuota: ${parada.cuotaModeradora || "$0"}
                        </div>
                    </div>
                    <div class="btn-group-reorder">
                        <button type="button" class="btn-reorder" data-action="subir" data-id="${rawId}" data-zona="${claveCanonica}">▲</button>
                        <button type="button" class="btn-reorder" data-action="bajar" data-id="${rawId}" data-zona="${claveCanonica}">▼</button>
                        <button type="button" class="btn-reorder" style="border-color: #ffb300; color: #ffb300;" data-action="editar" data-id="${rawId}">✏️</button>
                        <button type="button" class="btn-reorder" style="border-color: #ff3366; color: #ff3366;" data-action="eliminar" data-id="${rawId}">🗑️</button>
                    </div>
                </div>
            `;

            vincularEventosDragDrop(card, claveCanonica);
            listContainer.appendChild(card);
        });

        details.appendChild(summary);
        details.appendChild(accionesContainer);
        details.appendChild(listContainer);
        contenedor.appendChild(details);
    });

    // Delegación global de acciones de botones
    vincularEventosGlobalesAcciones(contenedor);

    console.log("🟢 [RUTAS_UI]: Renderizado dinámico de acordeones completado.");
}

/**
 * Event delegation para acciones de botones globales y reordenamiento manual
 */
function vincularEventosGlobalesAcciones(contenedor) {
    contenedor.onclick = (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const action = btn.dataset.action;
        const zona = btn.dataset.zona;
        const id = btn.dataset.id;

        switch (action) {
            case "iniciar":
                if (typeof window.iniciarRutaZona === "function") window.iniciarRutaZona(zona);
                break;
            case "optimizar":
                if (typeof window.optimizarProximidadZona === "function") window.optimizarProximidadZona(zona);
                break;
            case "planillar":
                if (typeof window.planillarRutaZona === "function") window.planillarRutaZona(zona);
                break;
            case "mapa":
                if (typeof window.verMapaZona === "function") window.verMapaZona(zona);
                break;
            case "subir":
                if (typeof window.moverParadaManual === "function") window.moverParadaManual(id, -1, zona);
                break;
            case "bajar":
                if (typeof window.moverParadaManual === "function") window.moverParadaManual(id, 1, zona);
                break;
            case "editar":
                if (typeof window.editarParadaUI === "function") window.editarParadaUI(id);
                break;
            case "eliminar":
                if (typeof window.eliminarParadaUI === "function") window.eliminarParadaUI(id);
                break;
        }
    };
}

/**
 * Vincula eventos nativos Drag & Drop y Touch para interacción PWA en móviles
 */
function vincularEventosDragDrop(cardElement, zonaNombre) {
    // Eventos Escritorio
    cardElement.addEventListener("dragstart", (e) => {
        itemArrastrado = cardElement;
        cardElement.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", cardElement.dataset.id);
    });

    cardElement.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (cardElement !== itemArrastrado) {
            cardElement.classList.add("drag-over");
        }
    });

    cardElement.addEventListener("dragleave", () => {
        cardElement.classList.remove("drag-over");
    });

    cardElement.addEventListener("drop", async (e) => {
        e.preventDefault();
        cardElement.classList.remove("drag-over");

        if (itemArrastrado && itemArrastrado !== cardElement) {
            const contenedorPadre = cardElement.parentNode;
            const tarjetas = Array.from(contenedorPadre.querySelectorAll(".parada-card"));
            const origenIndex = tarjetas.indexOf(itemArrastrado);
            const destinoIndex = tarjetas.indexOf(cardElement);

            if (origenIndex < destinoIndex) {
                contenedorPadre.insertBefore(itemArrastrado, cardElement.nextSibling);
            } else {
                contenedorPadre.insertBefore(itemArrastrado, cardElement);
            }

            await guardarNuevaSecuenciaZona(contenedorPadre, zonaNombre);
        }
    });

    cardElement.addEventListener("dragend", () => {
        cardElement.classList.remove("dragging");
        itemArrastrado = null;
        document.querySelectorAll(".parada-card").forEach((c) => c.classList.remove("drag-over"));
    });

    // Eventos Táctiles PWA Móvil
    cardElement.addEventListener("touchstart", () => {
        touchElementoInicial = cardElement;
        cardElement.classList.add("dragging");
    }, { passive: true });

    cardElement.addEventListener("touchend", async (e) => {
        cardElement.classList.remove("dragging");
        if (!touchElementoInicial) return;

        const touch = e.changedTouches[0];
        const elementoDestino = document.elementFromPoint(touch.clientX, touch.clientY)?.closest(".parada-card");

        if (elementoDestino && elementoDestino !== touchElementoInicial) {
            const contenedorPadre = cardElement.parentNode;
            const tarjetas = Array.from(contenedorPadre.querySelectorAll(".parada-card"));
            const origenIndex = tarjetas.indexOf(touchElementoInicial);
            const destinoIndex = tarjetas.indexOf(elementoDestino);

            if (origenIndex < destinoIndex) {
                contenedorPadre.insertBefore(touchElementoInicial, elementoDestino.nextSibling);
            } else {
                contenedorPadre.insertBefore(touchElementoInicial, elementoDestino);
            }

            await guardarNuevaSecuenciaZona(contenedorPadre, zonaNombre);
        }
        touchElementoInicial = null;
    });
}

/**
 * Persiste la nueva secuencia atómicamente en IndexedDB tras reordenación manual.
 */
async function guardarNuevaSecuenciaZona(contenedorPadre, zonaNombre) {
    const cards = contenedorPadre.querySelectorAll(".parada-card");
    const targetCanonico = estandarizarZonaCanonica(zonaNombre);

    let todasLasParadas = (await obtenerParadasGuardadas()) || window.__CACHE_PARADAS_MACONDO__ || [];

    const ordenMapa = new Map();
    cards.forEach((card, index) => {
        const id = card.dataset.id;
        const strongEl = card.querySelector("strong");
        if (strongEl) {
            strongEl.textContent = strongEl.textContent.replace(/\[#\d+\]/, `[#${index + 1}]`);
        }
        ordenMapa.set(String(id), index + 1);
    });

    todasLasParadas.forEach((p) => {
        const pId = String(p.id || p.ssc);
        if (obtenerZonaParadaCanonica(p) === targetCanonico && ordenMapa.has(pId)) {
            p.secuenciaZona = ordenMapa.get(pId);
            p.orden = ordenMapa.get(pId);
            p.updated_at = new Date().toISOString();
        }
    });

    await guardarRutaZonificada(todasLasParadas);

    window.__CACHE_PARADAS_MACONDO__ = structuredClone(todasLasParadas);
    window.paradasMemoriaLocal = structuredClone(todasLasParadas);

    console.log(`💾 [LOCAL_FIRST]: Secuencia reordenada guardada para ${targetCanonico}.`);

    if (typeof window.actualizarPuntosEnMapa === "function") {
        window.actualizarPuntosEnMapa(todasLasParadas, 0);
    }
}