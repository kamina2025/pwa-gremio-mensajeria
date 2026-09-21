/**
 * PROTOCOLO MACONDO - GENERADOR PDF Y EXPORTACIÓN INDIVIDUAL DE PLANILLA
 * Ubicación: pwa-mensajero/modulos/planilla/planillas-pdf-sync.js
 */

import { obtenerPlanillasReportadas } from './planillas-db.js';
import { obtenerRutaZonificada } from '../mensajero-persistencia.js';

/**
 * Recopila los datos de la planilla y vincula la información exacta de las paradas
 * para garantizar la impresión de destinatario, dirección y teléfono reales.
 * 
 * @param {string|number} idPlanilla ID de la planilla a exportar
 */
export async function exportarYRespaldarPlanillaPDF(idPlanilla) {
    console.log(`📄 [PLANILLA_PDF]: Recopilando datos de la planilla ID -> ${idPlanilla}`);

    try {
        const planillas = await obtenerPlanillasReportadas();
        const planilla = planillas.find(p => String(p.id) === String(idPlanilla));

        if (!planilla) {
            alert("⚠️ [ERROR]: No se encontraron los datos de la planilla seleccionada.");
            return;
        }

        // Crear o reutilizar el contenedor temporal exclusivo para impresión
        let printArea = document.getElementById("area-impresion-planilla-tmp");
        if (!printArea) {
            printArea = document.createElement("div");
            printArea.id = "area-impresion-planilla-tmp";
            printArea.className = "area-impresion-solo-pdf";
            document.body.appendChild(printArea);
        }

        // Lista de SCCs registrada en la planilla
        const listaSccs = planilla.scc ? planilla.scc.split(',').map(s => s.trim()) : [];
        
        // Cargar paradas adjuntas a la planilla o consultar el respaldo de la ruta actual
        let paradasDetalle = planilla.paradas || [];
        if (paradasDetalle.length === 0 && typeof obtenerRutaZonificada === 'function') {
            paradasDetalle = obtenerRutaZonificada() || [];
        }

        // Generación de filas individuales para el PDF
        const filasTablaHtml = listaSccs.map((codigoScc, index) => {
            // Coincidencia exacta por código SCC o ID de parada
            const detalle = paradasDetalle.find(p => 
                String(p.ssc || p.id).trim() === String(codigoScc).trim()
            ) || paradasDetalle[index] || {};

            const destinatario = detalle.destinatario || 'Cliente General';
            const direccion = detalle.direccion || 'Dirección no especificada';
            const telefono = detalle.telefono || 'N/A';
            const cuota = (detalle.cuotaModeradora && detalle.cuotaModeradora !== '$0') 
                ? ` | Cuota: $${detalle.cuotaModeradora}` 
                : '';

            const estadoScc = detalle.estado || planilla.estadoScc || 'Devuelto';
            const fechaHoraNovedad = detalle.registroOperaciones?.fechaHora 
                || (planilla.creadoEn ? new Date(planilla.creadoEn).toLocaleString('es-CO') : new Date().toLocaleString('es-CO'));

            const esEntregado = String(estadoScc).toUpperCase() === 'ENTREGADO' 
                || String(estadoScc).toUpperCase() === 'FINALIZADO';

            return `
                <tr>
                    <td class="col-scc">
                        <strong class="text-scc">${codigoScc}</strong>
                    </td>
                    <td class="col-parada">
                        <div class="destinatario-pdf"><strong>${destinatario}</strong></div>
                        <div class="direccion-pdf">${direccion}</div>
                        <div class="contacto-pdf">Tel: ${telefono}${cuota}</div>
                    </td>
                    <td class="col-novedad">
                        <span class="badge-pdf ${esEntregado ? 'entregado' : 'devuelto'}">
                            ${esEntregado ? 'ENTREGADO' : 'DEVUELTO'}
                        </span>
                        <div class="fecha-hora-pdf">${fechaHoraNovedad}</div>
                    </td>
                </tr>
            `;
        }).join('');

        // Inyección HTML en el contenedor de impresión
        printArea.innerHTML = `
            <div class="hoja-pdf-planilla">
                
                <header class="encabezado-pdf">
                    <h2>PLANILLA DE MENSAJERÍA Y ENTREGA DE PAQUETES</h2>
                    <p>REPORTE DE OPERACIONES Y DISTRIBUCIÓN NODAL</p>
                </header>

                <section class="pdf-datos-mensajero">
                    <div class="item-datos-m">
                        <span class="label-m">MENSAJERO:</span>
                        <strong class="valor-m">${planilla.nombreMensajero || localStorage.getItem("nombreMensajero") || 'kevin'}</strong>
                    </div>
                    <div class="item-datos-m">
                        <span class="label-m">PLACA VEHÍCULO:</span>
                        <strong class="valor-m badge-placa-pdf">${planilla.placaMensajero || localStorage.getItem("placaMensajero") || 'IPX30F'}</strong>
                    </div>
                    <div class="item-datos-m">
                        <span class="label-m">FECHA PLANILLA:</span>
                        <span class="valor-m">${planilla.fecha || new Date().toLocaleDateString('es-CO')}</span>
                    </div>
                    <div class="item-datos-m">
                        <span class="label-m">ID PLANILLA:</span>
                        <span class="valor-m">#PLN-${planilla.id || Date.now()}</span>
                    </div>
                </section>

                <table class="tabla-pdf-export">
                    <thead>
                        <tr>
                            <th style="width: 25%;">SCC / SEGUIMIENTO</th>
                            <th style="width: 45%;">DATOS DE LA PARADA</th>
                            <th style="width: 30%;">NOVEDADES / ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasTablaHtml}
                    </tbody>
                </table>

                <footer class="pie-pdf">
                    <p>Documento oficial de entrega - Generado automáticamente el ${new Date().toLocaleString('es-CO')} via Runner PWA</p>
                </footer>

            </div>
        `;

        // Ejecutar impresión a PDF nativa del navegador
        window.print();

        setTimeout(() => {
            if (printArea) printArea.innerHTML = "";
        }, 1000);

    } catch (error) {
        console.error("❌ [PLANILLA_PDF]: Error procesando exportación PDF:", error);
        alert("❌ Error al recopilar los datos para la exportación.");
    }
}