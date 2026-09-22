/**
 * PROTOCOLO MACONDO - CONTROLADOR DE UI, ZONIFICACIÓN Y NAVEGACIÓN DE PLANILLAS
 * Ubicación: pwa-mensajero/modulos/planilla/planillas-ui.js
 */

import { obtenerPlanillasReportadas, guardarPlanillaReportada } from './planillas-db.js';
import { exportarYRespaldarPlanillaPDF } from './planillas-pdf-sync.js';
import { obtenerRutaZonificada, guardarRutaZonificada } from '../mensajero-persistencia.js';
import { PALETA_ZONAS, clasificarParadasPorZona, obtenerZonaPorCoordenadas } from '../mapa/mensajero-zonificacion.js';

/**
 * Normaliza cualquier variante de texto (ej: "ZONA NORTE 2", "zona_norte_2", "NORTE 2")
 * a la clave canónica de PALETA_ZONAS (ej: "NORTE-2")
 */
function estandarizarClaveZona(raw) {
    if (!raw) return "GENERAL";
    let texto = String(raw).trim().toUpperCase();

    if (PALETA_ZONAS[texto]) return texto;

    let limpia = texto
        .replace(/^ZONA_?/i, "")
        .replace(/_/g, " ")
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    for (const [key, meta] of Object.entries(PALETA_ZONAS)) {
        const keyLimpia = key.replace(/_/g, " ").replace(/-/g, " ").trim().toUpperCase();
        const labelLimpia = meta.label.replace(/^ZONA\s*/i, "").replace(/_/g, " ").replace(/-/g, " ").trim().toUpperCase();

        if (limpia === keyLimpia || limpia === labelLimpia) {
            return key;
        }
    }

    return "GENERAL";
}

/**
 * Extrae la clave de zona canónica de un objeto parada
 */
function extraerClaveZonaParada(item) {
    if (!item) return "GENERAL";
    let rawVal = item.zonaKey || item.zona || item.zonaNombre || item.nombreZona || (item.properties && item.properties.zona);
    let keyResult = estandarizarClaveZona(rawVal);

    if (keyResult === "GENERAL" && item.lat && item.lng) {
        const zonaGeo = obtenerZonaPorCoordenadas(item.lat, item.lng);
        if (zonaGeo && zonaGeo.properties && zonaGeo.properties.key) {
            keyResult = zonaGeo.properties.key;
        }
    }

    return keyResult;
}

/**
 * Bypass de Única Fuente de Verdad: Lee directamente el JSON zonificado más reciente
 * para evitar estados obsoletos en memoria del módulo de persistencia.
 */
function obtenerRutaZonificadaSegura() {
    try {
        const cache = localStorage.getItem("ruta_zonificada");
        if (cache) {
            const parsed = JSON.parse(cache);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch(e) {
        console.warn("⚠️ [PLANILLAS]: Error leyendo ruta_zonificada de localStorage", e);
    }
    
    // Fallback al módulo de persistencia si el localStorage falla
    return (typeof obtenerRutaZonificada === 'function') ? obtenerRutaZonificada() : [];
}

/**
 * Conmuta entre las pestañas internas de la vista de planillas
 */
export function cambiarPestanaPlanillas(tabId) {
    console.log(`📋 [PLANILLAS]: Alternando pestaña a -> #${tabId}`);
    const contenedorPlanillas = document.getElementById('pestana-notificaciones-planillas') || document.body;

    const btns = contenedorPlanillas.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const contents = contenedorPlanillas.querySelectorAll('.tab-content');
    contents.forEach(content => {
        if (content.id === tabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    if (tabId === 'tab-generar-planilla') {
        renderizarModuloPlanillas();
    } else if (tabId === 'tab-planillas-reportadas') {
        cargarPlanillasReportadasUI();
    }
}

/**
 * Renderiza dinámicamente las zonas desglosadas en la pestaña _GENERAR_PLANILLA
 */
export function renderizarModuloPlanillas(zonaFiltro = null) {
    console.group("📝 [PLANILLAS_UI]: Renderizando módulo de generación por zonas");
    
    const contenedor = document.getElementById("contenedor-planillado-zonas");
    if (!contenedor) {
        console.warn("⚠️ [PLANILLAS_UI]: No se encontró '#contenedor-planillado-zonas' en el DOM.");
        console.groupEnd();
        return;
    }

    const zonaSeleccionadaRaw = zonaFiltro || 
                                localStorage.getItem("zona_planillar_activa") || 
                                localStorage.getItem("zona_activa_operacion") || 
                                localStorage.getItem("zona_activa_planillado");

    const claveDestacada = estandarizarClaveZona(zonaSeleccionadaRaw);
    
    // Usamos el bypass para evadir la memoria obsoleta
    let paradas = obtenerRutaZonificadaSegura();

    if (!paradas || paradas.length === 0) {
        contenedor.innerHTML = `
            <div class="panel-maquina text-center" style="padding: 20px; color: #888;">
                ⚠️ No hay envíos o paradas zonificadas disponibles en la base de datos local.
            </div>`;
        console.groupEnd();
        return;
    }

    const gruposZona = {};
    paradas.forEach((item) => {
        const cKey = extraerClaveZonaParada(item);
        if (!gruposZona[cKey]) {
            gruposZona[cKey] = [];
        }
        gruposZona[cKey].push(item);
    });

    contenedor.innerHTML = "";

    Object.entries(gruposZona).forEach(([cKey, itemsGrupo]) => {
        const metaZona = PALETA_ZONAS[cKey] || PALETA_ZONAS["GENERAL"];
        const esZonaDestacada = (claveDestacada && claveDestacada !== "GENERAL" && cKey === claveDestacada);

        const details = document.createElement("details");
        details.className = "cyber-accordion";
        details.style.cssText = `background:#0d1117; border:1px solid ${metaZona.color}; margin-bottom:12px; border-radius:4px; overflow:hidden;`;
        details.open = esZonaDestacada || !claveDestacada || claveDestacada === "GENERAL";

        const summary = document.createElement("summary");
        summary.className = "cyber-summary";
        summary.style.cssText = `padding:10px 14px; background:#161b22; color:${metaZona.color}; font-weight:bold; cursor:pointer; display:flex; justify-content:space-between; align-items:center;`;
        summary.innerHTML = `
            <span>▼ ${metaZona.label} (${itemsGrupo.length} Envíos)</span>
            <span class="badge-zone" style="background:${metaZona.color}22; border:1px solid ${metaZona.color}; color:${metaZona.color}; font-size:0.75rem; padding:2px 8px; border-radius:3px;">
                ${cKey}
            </span>
        `;

        const actionBar = document.createElement("div");
        actionBar.style.cssText = "padding:8px 12px; background:#080b10; border-bottom:1px solid #21262d; display:flex; justify-content:space-between; align-items:center;";
        actionBar.innerHTML = `
            <span style="font-size:0.8rem; color:#aaa;">Total Cuotas: <strong style="color:var(--neon-amber, #ffaa00);">$${calcularTotalCuotas(itemsGrupo)}</strong></span>
            <button class="cyber-btn-sm" style="background:${metaZona.color}; color:#000; font-weight:bold; border:none; padding:4px 12px; cursor:pointer; border-radius:3px;" onclick="window.confirmarYGenerarPlanillaZona('${cKey}')">
                📄 GENERAR PDF PLANILLA
            </button>
        `;

        const listContainer = document.createElement("div");
        listContainer.style.cssText = "padding:8px; display:flex; flex-direction:column; gap:6px; background:#05070f;";

        itemsGrupo.forEach((p, idx) => {
            const card = document.createElement("div");
            card.style.cssText = `background:#0c080f; border:1px solid #291f33; padding:8px; font-size:0.8rem; border-radius:3px; display:flex; justify-content:space-between; align-items:center;`;
            card.innerHTML = `
                <div>
                    <div><strong style="color:${metaZona.color};">[#${idx + 1}] SSC: ${p.ssc || p.id || 'N/A'}</strong> - ${p.destinatario || p.cliente || 'Cliente'}</div>
                    <div style="color:#aaa; font-size:0.75rem;">📍 ${p.direccion || 'Sin dirección'} | Tel: ${p.telefono || 'N/A'}</div>
                </div>
                <div style="color:var(--neon-amber, #ffaa00); font-weight:bold; font-size:0.8rem;">
                    ${p.cuotaModeradora || p.cuota || '$0'}
                </div>
            `;
            listContainer.appendChild(card);
        });

        details.appendChild(summary);
        details.appendChild(actionBar);
        details.appendChild(listContainer);
        contenedor.appendChild(details);
    });

    console.log("✅ [PLANILLAS_UI]: Módulo desglosado y sincronizado correctamente con PALETA_ZONAS.");
    console.groupEnd();
}

function calcularTotalCuotas(items) {
    return items.reduce((acc, curr) => {
        const montoRaw = curr.cuotaModeradora || curr.cuota || '0';
        const monto = parseInt(String(montoRaw).replace(/[^0-9]/g, ''), 10) || 0;
        return acc + monto;
    }, 0);
}

/**
 * Procesa y registra la planilla para la clave de zona especificada
 */
window.confirmarYGenerarPlanillaZona = async function(zonaInput) {
    const claveObjetivo = estandarizarClaveZona(zonaInput);
    console.group(`📄 [PLANILLA_GENERATE]: Procesando planilla para zona -> ${claveObjetivo}`);

    // Usamos el bypass para filtrar sobre la data real
    const paradas = obtenerRutaZonificadaSegura();
    const paradasZona = paradas.filter(p => extraerClaveZonaParada(p) === claveObjetivo);

    if (paradasZona.length === 0) {
        alert("⚠️ No hay envíos asignados a esta zona.");
        console.groupEnd();
        return;
    }

    const metaZona = PALETA_ZONAS[claveObjetivo] || PALETA_ZONAS["GENERAL"];
    const sccCadena = paradasZona.map(p => p.ssc || p.id).join(', ');

    const nuevaPlanilla = {
        id: Date.now(),
        scc: sccCadena,
        fecha: new Date().toLocaleDateString('es-CO'),
        creadoEn: new Date().toISOString(),
        estadoScc: 'Entregado',
        zona: metaZona.label,
        zonaKey: claveObjetivo,
        paradas: paradasZona,
        nombreMensajero: localStorage.getItem("nombreMensajero") || 'Kevin',
        placaMensajero: localStorage.getItem("placaMensajero") || 'IPX30F'
    };

    try {
        const idGenerado = await guardarPlanillaReportada(nuevaPlanilla);
        console.log(`💾 Planilla registrada correctamente con ID: ${idGenerado}`);
        await exportarYRespaldarPlanillaPDF(nuevaPlanilla.id);
    } catch (err) {
        console.error("❌ Error guardando y generando planilla:", err);
        alert("❌ Error procesando la planilla de la zona.");
    }
    console.groupEnd();
};

export async function cargarPlanillasReportadasUI() {
    console.log("🔍 [PLANILLAS]: Escaneando planillas reportadas...");
    const tbody = document.getElementById('tabla-planillas-reportadas-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center">🔍 Escaneando registros locales...</td></tr>';

    try {
        const planillas = await obtenerPlanillasReportadas();

        if (!planillas || planillas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay planillas reportadas guardadas.</td></tr>';
            return;
        }

        tbody.innerHTML = planillas.map(p => `
            <tr id="planilla-card-${p.id}">
                <td><strong class="text-neon">${p.scc || 'N/A'}</strong></td>
                <td>${p.fecha || new Date().toLocaleDateString()}</td>
                <td>
                    <span class="badge ${p.estadoScc === 'Entregado' ? 'badge-success' : 'badge-danger'}">
                        ${p.estadoScc || 'Devuelto'}
                    </span>
                </td>
                <td>
                    <button class="cyber-btn-sm btn-exportar-planilla" onclick="window.exportarPlanillaEvent('${p.id}')">
                        📄 Exportar PDF
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("❌ [PLANILLAS]: Error cargando planillas locales:", err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar datos locales.</td></tr>';
    }
}

// Exposición global al objeto window
window.cambiarPestanaPlanillas = cambiarPestanaPlanillas;
window.cargarPlanillasReportadasUI = cargarPlanillasReportadasUI;
window.renderizarModuloPlanillas = renderizarModuloPlanillas;
window.exportarPlanillaEvent = function(id) {
    exportarYRespaldarPlanillaPDF(id);
};