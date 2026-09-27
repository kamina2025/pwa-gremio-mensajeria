// Ruta: pwa-mensajero/modulos/planilla/planillas-ui.js
/**
 * PROTOCOLO MACONDO - CONTROLADOR DE UI, ZONIFICACIÓN Y NAVEGACIÓN DE PLANILLAS
 * Ubicación: pwa-mensajero/modulos/planilla/planillas-ui.js
 * Arquitectura: Vanilla JS ES6+ / Local-First / Cyberpunk UI
 */

import { IndexedStore } from '../db/indexed-store.js';
import { exportarYRespaldarPlanillaPDF } from './planillas-pdf-sync.js';
import { PALETA_ZONAS, obtenerZonaPorCoordenadas } from '../mapa/zonificacion/mensajero-zonificacion.js';

// Instancia única de la capa de persistencia local
const dbStore = new IndexedStore();

/**
 * Normaliza cualquier variante de texto (ej: "ZONA NORTE 2", "zona_norte_2", "NORTE 2")
 * a la clave canónica de PALETA_ZONAS (ej: "NORTE-2")
 * @param {string} raw 
 * @returns {string}
 */
export function estandarizarClaveZona(raw) {
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
 * @param {Object} item 
 * @returns {string}
 */
export function extraerClaveZonaParada(item) {
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
 * Recupera la colección de paradas directamente desde la tienda 'paradas_rutas' en IndexedDB.
 * @returns {Promise<Array<Object>>}
 */
async function obtenerParadasRutaSegura() {
  try {
    const paradas = await dbStore.obtenerParadas('paradas_rutas');
    if (Array.isArray(paradas) && paradas.length > 0) {
      return paradas;
    }
  } catch (e) {
    console.warn("⚠️ [PLANILLAS]: Error consultando paradas_rutas en IndexedDB:", e);
  }
  return [];
}

/**
 * Conmuta entre las pestañas internas de la vista de planillas
 * @param {string} tabId 
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
 * Renderiza dinámicamente las zonas desglosadas en la pestaña GENERAR PLANILLA
 * @param {string|null} [zonaFiltro=null] 
 */
export async function renderizarModuloPlanillas(zonaFiltro = null) {
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

  // Lectura directa desde IndexedDB Local-First
  const paradas = await obtenerParadasRutaSegura();

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
      <button class="cyber-btn-sm" style="background:${metaZona.color}; color:#000; font-weight:bold; border:none; padding:6px 14px; cursor:pointer; border-radius:3px; min-height:36px;" onclick="window.confirmarYGenerarPlanillaZona('${cKey}')">
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
          <div style="color:#aaa; font-size:0.75rem;">📍 ${p.direccion || p.dir || 'Sin dirección'} | Tel: ${p.telefono || p.tel || 'N/A'}</div>
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

/**
 * Calcula el total de cuotas moderadoras recopiladas en un grupo de paradas.
 * @param {Array<Object>} items 
 * @returns {number}
 */
function calcularTotalCuotas(items) {
  return items.reduce((acc, curr) => {
    const montoRaw = curr.cuotaModeradora || curr.cuota || '0';
    const monto = parseInt(String(montoRaw).replace(/[^0-9]/g, ''), 10) || 0;
    return acc + monto;
  }, 0);
}

/**
 * Despliega un modal interactivo para que el usuario configure márgenes y densidad antes de generar el PDF.
 * @param {string|number} idPlanilla 
 * @param {Object} [planillaDirecta=null] 
 */
export function abrirModalOpcionesImpresion(idPlanilla, planillaDirecta = null) {
  let modalExistente = document.getElementById("modal-opciones-pdf");
  if (modalExistente) modalExistente.remove();

  const modalHTML = `
    <div id="modal-opciones-pdf" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 7, 15, 0.85); backdrop-filter: blur(5px); z-index: 99999; display: flex; align-items: center; justify-content: center; font-family: 'Fira Code', monospace;">
      <div style="background: #0d1117; border: 2px solid #00e5ff; box-shadow: 0 0 20px rgba(0,229,255,0.3); border-radius: 8px; width: 90%; max-width: 420px; padding: 20px; color: #e6edf3;">
        <h3 style="color: #00e5ff; margin-top: 0; font-size: 1rem; border-bottom: 1px solid #30363d; padding-bottom: 8px;">⚙️ CONFIGURACIÓN DE IMPRESIÓN PDF</h3>
        
        <form id="form-opciones-pdf" style="display: flex; flex-direction: column; gap: 12px; margin-top: 15px;">
          <div>
            <label style="font-size: 0.8rem; color: #ffb300; display: block; margin-bottom: 4px;">📐 MÁRGENES DE PÁGINA (A4):</label>
            <select id="pdf-opcion-margen" style="width: 100%; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 8px; border-radius: 4px; font-size: 0.85rem;">
              <option value="10" selected>Normal (10 mm)</option>
              <option value="5">Estrecho (5 mm)</option>
              <option value="15">Amplio (15 mm)</option>
            </select>
          </div>

          <div>
            <label style="font-size: 0.8rem; color: #ffb300; display: block; margin-bottom: 4px;">↕️ DENSIDAD / ESPACIADO DE TABLA:</label>
            <select id="pdf-opcion-padding" style="width: 100%; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 8px; border-radius: 4px; font-size: 0.85rem;">
              <option value="6" selected>Estándar (6px)</option>
              <option value="4">Compacto (4px - Recomendado muchas paradas)</option>
              <option value="8">Amplio (8px)</option>
            </select>
          </div>

          <div>
            <label style="font-size: 0.8rem; color: #ffb300; display: block; margin-bottom: 4px;">📄 MODALIDAD DE PAGINACIÓN:</label>
            <select id="pdf-opcion-paginacion" style="width: 100%; background: #161b22; border: 1px solid #30363d; color: #fff; padding: 8px; border-radius: 4px; font-size: 0.85rem;">
              <option value="auto" selected>Multipágina Auto (Multi-hoja A4)</option>
              <option value="forzar">Ajustar a 1 Sola Hoja (Compactar)</option>
            </select>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button type="button" id="btn-cancelar-pdf-opciones" style="flex: 1; background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 10px; border-radius: 4px; font-weight: bold; cursor: pointer;">CANCELAR</button>
            <button type="submit" style="flex: 1; background: #00e5ff; border: none; color: #05070f; padding: 10px; border-radius: 4px; font-weight: bold; cursor: pointer;">DESCARGAR PDF</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modalElem = document.getElementById("modal-opciones-pdf");
  document.getElementById("btn-cancelar-pdf-opciones").onclick = () => modalElem.remove();

  document.getElementById("form-opciones-pdf").onsubmit = (e) => {
    e.preventDefault();
    const margenMm = parseInt(document.getElementById("pdf-opcion-margen").value, 10);
    const paddingCeldaPx = parseInt(document.getElementById("pdf-opcion-padding").value, 10);
    const forzarUnaPagina = document.getElementById("pdf-opcion-paginacion").value === "forzar";

    modalElem.remove();

    exportarYRespaldarPlanillaPDF(idPlanilla, planillaDirecta, {
      margenMm,
      paddingCeldaPx,
      forzarUnaPagina
    });
  };
}

/**
 * Procesa y registra atómicamente la planilla para la clave de zona especificada.
 * @param {string} zonaInput 
 */
window.confirmarYGenerarPlanillaZona = async function (zonaInput) {
  const claveObjetivo = estandarizarClaveZona(zonaInput);
  const metaZona = PALETA_ZONAS[claveObjetivo] || PALETA_ZONAS["GENERAL"];

  console.group(`📄 [PLANILLA_GENERATE]: Procesando planilla para zona -> ${claveObjetivo}`);

  const paradas = await obtenerParadasRutaSegura();
  const paradasZona = paradas.filter(p => extraerClaveZonaParada(p) === claveObjetivo);

  if (paradasZona.length === 0) {
    alert("⚠️ No hay envíos asignados a esta zona.");
    console.groupEnd();
    return;
  }

  const idPlanilla = String(Date.now());
  const sccCadena = paradasZona.map(p => String(p.ssc || p.id).trim()).join(', ');

  const nuevaPlanilla = {
    id: idPlanilla,
    scc: sccCadena,
    fecha: new Date().toLocaleDateString('es-CO'),
    creadoEn: new Date().toISOString(),
    estadoScc: 'En Tramite',
    zona: metaZona.label,
    zonaKey: claveObjetivo,
    paradas: paradasZona,
    nombreMensajero: localStorage.getItem("nombreMensajero") || 'Asignado',
    placaMensajero: localStorage.getItem("placaMensajero") || 'IPX30F',
    updated_at: new Date().toISOString()
  };

  try {
    // 1. Persistencia atómica asegurada en IndexedDB
    await dbStore.actualizarParada(nuevaPlanilla, 'planillas');
    console.log(`💾 Planilla registrada correctamente con ID: ${idPlanilla}`);

    // 2. Desplegar modal interactivo de configuración de impresión enviando respaldo en RAM
    abrirModalOpcionesImpresion(idPlanilla, nuevaPlanilla);
  } catch (err) {
    console.error("❌ Error guardando y generando planilla:", err);
    alert("❌ Error procesando la planilla de la zona.");
  }
  console.groupEnd();
};

/**
 * Carga e inyecta la lista de planillas reportadas guardadas en IndexedDB.
 */
export async function cargarPlanillasReportadasUI() {
  console.log("🔍 [PLANILLAS]: Escaneando planillas reportadas...");
  const tbody = document.getElementById('tabla-planillas-reportadas-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: #00e5ff; padding: 15px;">🔍 Escaneando registros locales en IndexedDB...</td></tr>';

  try {
    const planillas = await dbStore.obtenerParadas('planillas');

    if (!planillas || planillas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: #8b949e; padding: 15px;">No hay planillas reportadas guardadas.</td></tr>';
      return;
    }

    tbody.innerHTML = planillas.map(p => `
      <tr id="planilla-card-${p.id}" style="border-bottom: 1px solid #21262d;">
        <td style="padding: 10px;"><strong class="text-neon" style="color: #00e5ff;">${p.scc || 'N/A'}</strong></td>
        <td style="padding: 10px; color: #c9d1d9;">${p.fecha || new Date().toLocaleDateString('es-CO')}</td>
        <td style="padding: 10px;">
          <span class="badge" style="padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.75rem; background: ${p.estadoScc === 'Entregado' ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 51, 102, 0.15)'}; color: ${p.estadoScc === 'Entregado' ? '#39ff14' : '#ff3366'}; border: 1px solid ${p.estadoScc === 'Entregado' ? '#39ff14' : '#ff3366'};">
            ${p.estadoScc || 'Devuelto'}
          </span>
        </td>
        <td style="padding: 10px;">
          <button class="cyber-btn-sm btn-exportar-planilla" style="background: #00e5ff; color: #05070f; border: none; padding: 6px 12px; font-weight: bold; border-radius: 4px; cursor: pointer;" onclick="window.exportarPlanillaEvent('${p.id}')">
            📄 Exportar PDF
          </button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error("❌ [PLANILLAS]: Error cargando planillas locales:", err);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger" style="color: #ff3366; padding: 15px;">Error al cargar datos locales de IndexedDB.</td></tr>';
  }
}

// BINDINGS GLOBALES EN WINDOW
if (typeof window !== "undefined") {
  window.cambiarPestanaPlanillas = cambiarPestanaPlanillas;
  window.cargarPlanillasReportadasUI = cargarPlanillasReportadasUI;
  window.renderizarModuloPlanillas = renderizarModuloPlanillas;
  window.abrirModalOpcionesImpresion = abrirModalOpcionesImpresion;
  window.exportarPlanillaEvent = function (id) {
    abrirModalOpcionesImpresion(id);
  };
}