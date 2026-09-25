/**
 * PROTOCOLO MACONDO - MÓDULO DE RENDERIZADO DE UI ACORDEONES Y DRAG & DROP
 * Ubicación: pwa-mensajero/modulos/rutas/rutas-ui-acordeon.js
 * Arquitectura: Async Local-First / Cyberpunk UI / Clustering & Subgrupos
 */

import { obtenerParadasGuardadas, guardarRutaZonificada } from "../mensajero-persistencia.js";
import { estandarizarZonaCanonica, obtenerZonaParadaCanonica } from "../mapa/zonificacion/estandar-zonas.js";

let itemArrastrado = null;
let touchElementoInicial = null;

/**
 * Renderiza la UI de acordeones por zona incorporando clustering, subgrupos por dirección y acciones fijas.
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

    // Sincronización inmediata de cachés RAM
    window.__CACHE_PARADAS_MACONDO__ = structuredClone(listaPedidos);
    window.paradasMemoriaLocal = structuredClone(listaPedidos);
    window.paradasRutaActiva = structuredClone(listaPedidos);

    contenedor.innerHTML = "";

    if (!Array.isArray(listaPedidos) || listaPedidos.length === 0) {
        contenedor.innerHTML = `<p style="text-align:center; color:#aaa; font-family:monospace; padding:15px;">[SISTEMA]: No hay paradas en la ruta activa.</p>`;
        return;
    }

    // Agrupar pedidos estrictamente por la clave canónica de zona
    const zonasMap = {};
    listaPedidos.forEach((ped) => {
        const claveCanonica = obtenerZonaParadaCanonica(ped) || "GENERAL";
        if (!zonasMap[claveCanonica]) zonasMap[claveCanonica] = [];
        zonasMap[claveCanonica].push(ped);
    });

    Object.entries(zonasMap).forEach(([claveCanonica, paradasZona]) => {
        // Ordenar paradas por secuencia de zona
        paradasZona.sort((a, b) => (a.secuenciaZona || a.secuencia || 0) - (b.secuenciaZona || b.secuencia || 0));

        const totalParadas = paradasZona.length;
        const colorHex = paradasZona[0]?.colorZona || "#00E5FF";
        const nombreZonaDisplay = `ZONA ${claveCanonica}`;

        const details = document.createElement("details");
        details.className = "cyber-accordion";
        details.style.cssText = `border: 1px solid ${colorHex}; margin-bottom: 12px; background: #0d1117; border-radius: 6px; padding: 6px;`;
        details.open = true;

        const summary = document.createElement("summary");
        summary.className = "cyber-summary";
        summary.style.cssText = `border-left: 4px solid ${colorHex}; padding: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: #161b22;`;
        summary.innerHTML = `
            <span style="color: ${colorHex}; font-weight: bold; font-family: monospace;">▼ ${nombreZonaDisplay} (${totalParadas} Paradas)</span>
            <span class="badge-zone" style="background-color: ${colorHex}; color: #0d1117; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.75rem;">${claveCanonica}</span>
        `;

        // BARRA DE ACCIONES DE ZONA CON SELECTORES DE PUNTO INICIAL Y FINAL
        const accionesContainer = document.createElement("div");
        accionesContainer.className = "zona-acciones-container";
        accionesContainer.style.cssText = "background: #080b10; border-bottom: 1px solid #30363d; padding: 8px; margin-top: 6px; margin-bottom: 8px;";

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

        selectInicio.add(new Option("-- Automático (Por Posición) --", ""));
        selectFin.add(new Option("-- Automático (Por Posición) --", ""));

        let inicioPersistido = null;
        let finPersistido = null;

        paradasZona.forEach((p) => {
            const pId = String(p.id || p.scc || p.ssc);
            const pNombre = p.destinatario || p.cliente || `Parada #${p.secuenciaZona || p.secuencia}`;
            
            selectInicio.add(new Option(`[#${p.secuenciaZona || p.secuencia}] ${pNombre}`, pId));
            selectFin.add(new Option(`[#${p.secuenciaZona || p.secuencia}] ${pNombre}`, pId));

            if (p.esInicioZona) inicioPersistido = pId;
            if (p.esFinZona) finPersistido = pId;
        });

        if (inicioPersistido) selectInicio.value = inicioPersistido;
        if (finPersistido) selectFin.value = finPersistido;

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
            <button type="button" class="btn-zona-action btn-zona-iniciar" data-action="iniciar" data-zona="${claveCanonica}" style="background: #0d1117; color: #00e5ff; border: 1px solid #00e5ff; font-weight: bold; cursor: pointer; padding: 4px 8px; border-radius: 4px;">
                ► _INICIAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-optimizar" data-action="optimizar" data-zona="${claveCanonica}" style="background: #0d1117; color: #ffb300; border: 1px solid #ffb300; font-weight: bold; cursor: pointer; padding: 4px 8px; border-radius: 4px;">
                ⚡ OPTIMIZAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-planillar" data-action="planillar" data-zona="${claveCanonica}" style="background: #0d1117; color: #8af7b3; border: 1px solid #8af7b3; cursor: pointer; padding: 4px 8px; border-radius: 4px;">
                📝 _PLANILLAR
            </button>
            <button type="button" class="btn-zona-action btn-zona-mapa" data-action="mapa" data-zona="${claveCanonica}" style="background: #0d1117; color: #ff3366; border: 1px solid #ff3366; cursor: pointer; padding: 4px 8px; border-radius: 4px;">
                🗺️ VER MAPA
            </button>
        `;

        accionesContainer.appendChild(selectoresBar);
        accionesContainer.appendChild(botonesBar);

        // CONTENEDOR DE PARADAS CON CLUSTERING Y DRAG & DROP
        const listContainer = document.createElement("div");
        listContainer.className = "paradas-drag-list";
        listContainer.style.padding = "4px";

        let ultimoGrupoRenderizado = null;

        paradasZona.forEach((parada, idx) => {
            const rawId = String(parada.id || parada.scc || parada.ssc || `p_${idx}`);
            const numSecuencia = parada.secuenciaZona || parada.secuencia || idx + 1;

            // Renderizar encabezado divisor de Bucle/Clúster
            if (parada.grupoId && parada.grupoId !== ultimoGrupoRenderizado) {
                ultimoGrupoRenderizado = parada.grupoId;
                const divisorGrupo = document.createElement("div");
                divisorGrupo.className = "divisor-cluster-header";
                divisorGrupo.style.cssText = "background: rgba(0, 229, 255, 0.12); border-left: 4px solid #00e5ff; color: #00e5ff; font-weight: bold; font-family: monospace; font-size: 0.78rem; padding: 4px 8px; margin: 8px 0 4px 0; border-radius: 2px;";
                divisorGrupo.innerHTML = `⚡ BUCLE / CLUSTER: ${parada.grupoId}`;
                listContainer.appendChild(divisorGrupo);
            }

            const card = document.createElement("div");
            card.className = "parada-card item-parada-lista";
            card.setAttribute("draggable", "true");
            card.dataset.id = rawId;
            card.dataset.zona = claveCanonica;
            card.style.cssText = "background: #161b22; border: 1px solid #30363d; margin-bottom: 6px; padding: 8px; border-radius: 4px; transition: border-color 0.2s;";

            const badgeSubgrupo = parada.subgrupoId ? `<span style="background: #ff3366; color: #fff; padding: 1px 5px; border-radius: 3px; font-size: 0.68rem; font-weight: bold; margin-left: 6px;">${parada.subgrupoId}</span>` : "";

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex:1; padding-right:8px;">
                        <strong style="color: #00ff66;">[#${numSecuencia}] ${parada.destinatario || parada.cliente || "Cliente"}</strong> ${badgeSubgrupo}
                        <div style="color: #c9d1d9; font-size: 0.8rem; margin-top: 2px;">📍 ${parada.direccion || "Sin Dirección"}</div>
                        <div style="font-size: 0.72rem; color: #8b949e; margin-top: 2px;">
                            SCC: <span style="color: #00e5ff;">${parada.scc || parada.ssc || "N/A"}</span> | Tel: ${parada.telefono || "N/A"} | Estado: <span style="color:#7ee787;">${parada.causal || "PENDIENTE"}</span>
                        </div>
                    </div>
                    <div class="btn-group-reorder" style="display:flex; gap:3px;">
                        <button type="button" class="btn-reorder" data-action="subir" data-id="${rawId}" data-zona="${claveCanonica}" style="background:#0d1117; color:#fff; border:1px solid #30363d; cursor:pointer; padding:2px 6px; border-radius:3px;">▲</button>
                        <button type="button" class="btn-reorder" data-action="bajar" data-id="${rawId}" data-zona="${claveCanonica}" style="background:#0d1117; color:#fff; border:1px solid #30363d; cursor:pointer; padding:2px 6px; border-radius:3px;">▼</button>
                        <button type="button" class="btn-reorder" style="background:#0d1117; border-color: #ffb300; color: #ffb300; cursor:pointer; padding:2px 6px; border-radius:3px;" data-action="editar" data-id="${rawId}">✏️</button>
                        <button type="button" class="btn-reorder" style="background:#0d1117; border-color: #ff3366; color: #ff3366; cursor:pointer; padding:2px 6px; border-radius:3px;" data-action="eliminar" data-id="${rawId}">🗑️</button>
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

    vincularEventosGlobalesAcciones(contenedor);
    console.log("🟢 [RUTAS_UI]: Renderizado dinámico de acordeones completado.");
}

/**
 * Event delegation para acciones de botones globales y reordenamiento manual.
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
 * Vincula eventos nativos Drag & Drop y Touch para interacción PWA en móviles.
 */
function vincularEventosDragDrop(cardElement, zonaNombre) {
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
 * Persiste la nueva secuencia atómicamente en IndexedDB y recalcula los clústeres visuales.
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
        const pId = String(p.id || p.scc || p.ssc);
        if (obtenerZonaParadaCanonica(p) === targetCanonico && ordenMapa.has(pId)) {
            const nuevaSec = ordenMapa.get(pId);
            p.secuenciaZona = nuevaSec;
            p.secuencia = nuevaSec;
            p.orden = nuevaSec;
            
            // Re-asignación dinámica de grupoId en bloques de 4 para reordenamiento manual
            const numGrupo = Math.ceil(nuevaSec / 4);
            p.grupoId = `GRUPO-${numGrupo.toString().padStart(2, "0")}`;
            p.updated_at = new Date().toISOString();
        }
    });

    // Ordenamiento global sincronizado
    todasLasParadas.sort((a, b) => (a.secuenciaZona || a.secuencia || 0) - (b.secuenciaZona || b.secuencia || 0));

    await guardarRutaZonificada(todasLasParadas);

    window.__CACHE_PARADAS_MACONDO__ = structuredClone(todasLasParadas);
    window.paradasMemoriaLocal = structuredClone(todasLasParadas);
    window.paradasRutaActiva = structuredClone(todasLasParadas);

    console.log(`💾 [LOCAL_FIRST]: Secuencia reordenada guardada para ${targetCanonico}.`);

    // Refrescar mapa y UI
    if (typeof window.trazarPolilineaRuta === "function") {
        window.trazarPolilineaRuta(todasLasParadas, targetCanonico);
    } else if (typeof window.actualizarPuntosEnMapa === "function") {
        window.actualizarPuntosEnMapa(todasLasParadas, 0);
    }

    await renderizarParadasZonificadasUI(todasLasParadas);
}

// BINDING GLOBAL
window.renderizarParadasZonificadasUI = renderizarParadasZonificadasUI;