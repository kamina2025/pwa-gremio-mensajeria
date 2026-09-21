/**
 * PROTOCOLO MACONDO - CONTROLADOR DE UI Y NAVEGACIÓN DE PLANILLAS
 * Ubicación: pwa-mensajero/modulos/planillas-ui.js
 */

import { obtenerPlanillasReportadas } from './planillas-db.js';
import { exportarYRespaldarPlanillaPDF } from './planillas-pdf-sync.js';

/**
 * Conmuta entre las pestañas internas de la vista de planillas
 * @param {string} tabId - ID de la pestaña de destino
 */
export function cambiarPestanaPlanillas(tabId) {
    console.log(` 📋 [PLANILLAS]: Alternando pestaña a -> #${tabId}`);
    const contenedorPlanillas = document.getElementById('pestana-notificaciones-planillas');
    if (!contenedorPlanillas) return;

    // Actualizar estados visuales de los botones
    const btns = contenedorPlanillas.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Actualizar visualización del contenido
    const contents = contenedorPlanillas.querySelectorAll('.tab-content');
    contents.forEach(content => {
        if (content.id === tabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Cargar datos si se entra a la pestaña de reportes
    if (tabId === 'tab-planillas-reportadas') {
        cargarPlanillasReportadasUI();
    }
}

/**
 * Carga e inyecta la lista de planillas almacenadas localmente
 */
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
                    <button class="cyber-btn-sm btn-exportar-planilla" data-id="${p.id}">
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

// Exposición global para interoperabilidad
window.cambiarPestanaPlanillas = cambiarPestanaPlanillas;
window.cargarPlanillasReportadasUI = cargarPlanillasReportadasUI;
window.exportarPlanillaEvent = function(id) {
    exportarYRespaldarPlanillaPDF(id);
};