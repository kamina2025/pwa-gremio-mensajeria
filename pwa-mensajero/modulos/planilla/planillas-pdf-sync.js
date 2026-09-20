/**
 * PROTOCOLO MACONDO - GENERADOR PDF Y EXPORTACIÓN INDIVIDUAL DE PLANILLA
 * Ubicación: pwa-mensajero/modulos/planillas-pdf-sync.js
 */

import { obtenerPlanillasReportadas } from './planillas-db.js';

/**
 * Recopila los datos de la celda/registro específico y genera un documento PDF organizado.
 * @param {string|number} idPlanilla ID de la planilla a exportar
 */
export async function exportarYRespaldarPlanillaPDF(idPlanilla) {
    console.log(`📄 [PLANILLA_PDF]: Recopilando datos de la planilla ID -> ${idPlanilla}`);

    try {
        const planillas = await obtenerPlanillasReportadas();
        // Buscar únicamente el registro de la celda/fila seleccionada
        const planilla = planillas.find(p => String(p.id) === String(idPlanilla));

        if (!planilla) {
            alert("⚠️ [ERROR]: No se encontraron los datos de la planilla seleccionada.");
            return;
        }

        // Crear contenedor temporal exclusivo para la impresión
        let printArea = document.getElementById("area-impresion-planilla-tmp");
        if (!printArea) {
            printArea = document.createElement("div");
            printArea.id = "area-impresion-planilla-tmp";
            printArea.className = "area-impresion-solo-pdf";
            document.body.appendChild(printArea);
        }

        // Inyectar la estructura organizada de la tabla únicamente con los datos de esta planilla
        printArea.innerHTML = `
            <div class="hoja-pdf-planilla">
                <header class="encabezado-pdf">
                    <h2>PLANILLA DE MENSAJERÍA Y ENTREGA</h2>
                    <p><strong>REPORTE INDIVIDUAL - SISTEMA RUNNER</strong></p>
                </header>
                
                <table class="tabla-pdf-export">
                    <thead>
                        <tr>
                            <th>SCC / SEGUIMIENTO</th>
                            <th>FECHA</th>
                            <th>MENSAJERO</th>
                            <th>PLACA</th>
                            <th>ESTADO SCC</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>${planilla.scc || 'N/A'}</strong></td>
                            <td>${planilla.fecha || new Date().toLocaleDateString()}</td>
                            <td>${planilla.nombreMensajero || 'Mensajero Acreditado'}</td>
                            <td>${planilla.placaMensajero || 'N/A'}</td>
                            <td>
                                <span class="badge-pdf ${planilla.estadoScc === 'Entregado' ? 'entregado' : 'devuelto'}">
                                    ${planilla.estadoScc || 'Devuelto'}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <footer class="pie-pdf">
                    <p>Documento generado el ${new Date().toLocaleString()} - Generado por Runner PWA</p>
                </footer>
            </div>
        `;

        // Ejecutar diálogo de impresión/PDF del navegador
        window.print();

        // Limpiar el área temporal después de imprimir
        setTimeout(() => {
            if (printArea) printArea.innerHTML = "";
        }, 1000);

    } catch (error) {
        console.error("❌ [PLANILLA_PDF]: Error procesando exportación PDF:", error);
        alert("❌ Error al recopilar los datos para la exportación.");
    }
}