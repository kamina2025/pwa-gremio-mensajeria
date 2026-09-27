// Ruta: pwa-mensajero/modulos/planilla/planillas-pdf-sync.js

import { obtenerPlanillasReportadas } from './planillas-db.js';
import { obtenerRutaZonificada } from '../mensajero-persistencia.js';
import { IndexedStore } from '../db/indexed-store.js';

const dbStore = new IndexedStore();

/**
 * Garantiza que las dependencias requeridas (html2canvas y jsPDF) estén disponibles en el DOM.
 * @returns {Promise<void>}
 */
async function asegurarDependenciasPDF() {
    const cargarScript = (url) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`No se pudo cargar la librería desde ${url}`));
        document.head.appendChild(script);
    });

    if (typeof window.html2canvas === 'undefined') {
        console.warn("⚠️ [PDF_SYNC]: html2canvas no detectado. Cargando dinámicamente...");
        await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }

    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
        console.warn("⚠️ [PDF_SYNC]: jsPDF no detectado. Cargando dinámicamente...");
        await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
}

/**
 * Espera a que las fuentes e imágenes del contenedor se descodifiquen en la GPU.
 * @param {HTMLElement} contenedor 
 */
async function precargarRecursosLienzo(contenedor) {
    if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
    }

    const imagenes = Array.from(contenedor.querySelectorAll('img'));
    const promesas = imagenes.map((img) => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            if (typeof img.decode === 'function') {
                img.decode().then(resolve).catch(resolve);
            }
        });
    });

    await Promise.all(promesas);
}

/**
 * Compila y exporta la planilla en PDF optimizado para Android.
 * @param {string|number} idPlanilla 
 */
export async function exportarYRespaldarPlanillaPDF(idPlanilla) {
    console.log(`📄 [PLANILLA_PDF]: Recopilando datos de la planilla ID -> ${idPlanilla}`);

    try {
        await asegurarDependenciasPDF();

        const planillas = await obtenerPlanillasReportadas();
        const planilla = planillas.find(p => String(p.id) === String(idPlanilla));

        if (!planilla) {
            alert("⚠️ [ERROR]: No se encontraron los datos de la planilla seleccionada.");
            return;
        }

        let printArea = document.getElementById("pdf-export-container");
        if (!printArea) {
            printArea = document.createElement("div");
            printArea.id = "pdf-export-container";
            printArea.style.cssText = "position: absolute; top: -9999px; left: -9999px; width: 800px; min-height: 1130px; background-color: #ffffff !important; color: #000000 !important; color-scheme: light; visibility: visible; display: block;";
            document.body.appendChild(printArea);
        }

        const listaSccs = planilla.scc ? planilla.scc.split(',').map(s => s.trim()) : [];
        let paradasDetalle = planilla.paradas || [];
        if (paradasDetalle.length === 0 && typeof obtenerRutaZonificada === 'function') {
            paradasDetalle = obtenerRutaZonificada() || [];
        }

        const filasTablaHtml = listaSccs.map((codigoScc, index) => {
            const detalle = paradasDetalle.find(p => String(p.ssc || p.id).trim() === String(codigoScc).trim()) || paradasDetalle[index] || {};
            const destinatario = (detalle.destinatario && !detalle.destinatario.includes('Cliente ')) ? detalle.destinatario : (detalle.nombre || 'Cliente General');
            const direccion = detalle.direccion || 'Dirección no especificada';
            const telefono = detalle.telefono || '3000000000';
            const estadoScc = detalle.estado || planilla.estadoScc || 'DEVUELTO';
            const fechaHoraNovedad = detalle.registroOperaciones?.fechaHora || (planilla.creadoEn ? new Date(planilla.creadoEn).toLocaleString('es-CO') : new Date().toLocaleString('es-CO'));
            const esEntregado = String(estadoScc).toUpperCase() === 'ENTREGADO' || String(estadoScc).toUpperCase() === 'FINALIZADO';

            return `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;"><strong>${codigoScc}</strong></td>
                    <td style="padding: 8px; border: 1px solid #ddd;">
                        <div>| ${destinatario}</div>
                        <div style="font-size: 0.85em; color: #555;">${direccion}</div>
                        <div style="font-size: 0.8em; color: #777;">Tel: ${telefono}</div>
                    </td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                        <span style="font-weight: bold; color: ${esEntregado ? '#2e7d32' : '#c62828'};">
                            ${esEntregado ? 'ENTREGADO' : 'DEVUELTO'}
                        </span>
                        <div style="font-size: 0.75em; color: #666;">${fechaHoraNovedad}</div>
                    </td>
                </tr>
            `;
        }).join('');

        printArea.innerHTML = `
            <div style="padding: 20px; background: #ffffff; color: #000000; font-family: Arial, sans-serif;">
                <header style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                    <h2 style="margin: 0; font-size: 1.2rem;">PLANILLA DE MENSAJERÍA Y ENTREGA DE PAQUETES</h2>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #444;">REPORTE DE OPERACIONES Y DISTRIBUCIÓN NODAL</p>
                </header>
                <section style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 0.85rem;">
                    <div><span>MENSAJERO:</span> <strong>${planilla.nombreMensajero || localStorage.getItem("nombreMensajero") || 'Kevin'}</strong></div>
                    <div><span>FECHA:</span> <span>${planilla.fecha || new Date().toLocaleDateString('es-CO')}</span></div>
                    <div><span>ID:</span> <span>#PLN-${planilla.id || Date.now()}</span></div>
                </section>
                <table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead>
                        <tr style="background: #f2f2f2;">
                            <th style="width: 25%; padding: 8px; border: 1px solid #ddd; text-align: left;">SCC</th>
                            <th style="width: 45%; padding: 8px; border: 1px solid #ddd; text-align: left;">DATOS DE ENTREGA</th>
                            <th style="width: 30%; padding: 8px; border: 1px solid #ddd; text-align: center;">ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>${filasTablaHtml}</tbody>
                </table>
            </div>
        `;

        await precargarRecursosLienzo(printArea);
        await new Promise(r => setTimeout(r, 150));

        const canvas = await window.html2canvas(printArea, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        const jsPDFClass = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
        const pdf = new jsPDFClass('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        const pdfBlob = pdf.output('blob');

        await dbStore.guardarPdfBlob(planilla.id || Date.now(), pdfBlob);

        const blobUrl = URL.createObjectURL(pdfBlob);
        const enlace = document.createElement('a');
        enlace.href = blobUrl;
        enlace.download = `Planilla_${planilla.id || Date.now()}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();

        setTimeout(() => {
            document.body.removeChild(enlace);
            URL.revokeObjectURL(blobUrl);
            printArea.innerHTML = "";
        }, 1000);

        console.log("✅ [PLANILLA_PDF]: PDF generado y respaldado con éxito.");
    } catch (error) {
        console.error("❌ [PLANILLA_PDF]: Error procesando exportación PDF:", error);
        alert(`❌ Error al generar el PDF de la planilla: ${error.message || error}`);
    }
}