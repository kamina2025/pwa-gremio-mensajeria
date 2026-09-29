/**
 * PROTOCOLO MACONDO - GENERADOR Y SINCRONIZADOR DE PLANILLAS EN PDF
 * Ubicación: pwa-mensajero/modulos/planilla/planillas-pdf-sync.js
 * Arquitectura: Vanilla JS ES6+ / Local-First / Cyberpunk PDF Generation
 */

import { IndexedStore } from '../db/indexed-store.js';
import { obtenerRutaZonificada, obtenerParadasGuardadas } from '../mensajero-persistencia.js';

const dbStore = new IndexedStore();

/**
 * Recupera una colección de datos de forma ultra-segura probando múltiples firmas de la API o memoria RAM.
 * @param {string} nombreAlmacen - Nombre de la tienda ('planillas', 'paradas_rutas', etc.)
 * @returns {Promise<Array<Object>>}
 */
async function obtenerColeccionSegura(nombreAlmacen) {
  try {
    // 1. Probar vía capa de persistencia estandarizada
    if (typeof obtenerParadasGuardadas === "function") {
      const res = await obtenerParadasGuardadas(nombreAlmacen);
      if (Array.isArray(res) && res.length > 0) return res;
    }

    // 2. Probar dinámicamente según los métodos expuestos por IndexedStore
    if (dbStore) {
      if (typeof dbStore.obtenerParadasGuardadas === "function") {
        const res = await dbStore.obtenerParadasGuardadas(nombreAlmacen);
        if (Array.isArray(res) && res.length > 0) return res;
      } else if (typeof dbStore.obtenerColeccion === "function") {
        const res = await dbStore.obtenerColeccion(nombreAlmacen);
        if (Array.isArray(res) && res.length > 0) return res;
      } else if (typeof dbStore.obtenerParadas === "function") {
        const res = await dbStore.obtenerParadas(nombreAlmacen);
        if (Array.isArray(res) && res.length > 0) return res;
      }
    }
  } catch (e) {
    console.warn(`⚠️ [PDF_SYNC]: Error leyendo almacén '${nombreAlmacen}' en IndexedDB:`, e);
  }

  // 3. Fallbacks a memorias globales en RAM
  if (nombreAlmacen === 'planillas') {
    return window.__CACHE_PLANILLAS_MACONDO__ || window.planillasMemoriaLocal || [];
  }
  return window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || window.pedidosGlobales || [];
}

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

  try {
    if (typeof window.html2canvas === 'undefined') {
      console.warn("⚠️ [PDF_SYNC]: html2canvas no detectado. Cargando dinámicamente...");
      await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }

    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
      console.warn("⚠️ [PDF_SYNC]: jsPDF no detectado. Cargando dinámicamente...");
      await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
  } catch (err) {
    console.warn("⚠️ [PDF_SYNC]: Fallo en descarga de CDN de PDF. Se recurrirá a impresión nativa.", err);
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
 * Normaliza y formatea la marca de tiempo a un estándar legible.
 * @param {string} timestampIso 
 * @returns {string}
 */
function formatearFechaHora(timestampIso) {
  if (!timestampIso) return new Date().toLocaleString('es-CO');
  try {
    const fecha = new Date(timestampIso);
    return isNaN(fecha.getTime()) ? timestampIso : fecha.toLocaleString('es-CO');
  } catch (e) {
    return new Date().toLocaleString('es-CO');
  }
}

/**
 * Compila y exporta la planilla en PDF de forma continua y resiliente.
 * @param {string|number} idPlanilla 
 * @param {Object|null} [planillaDirecta=null] 
 * @param {Object} [opcionesImpresion={}] 
 */
export async function exportarYRespaldarPlanillaPDF(idPlanilla, planillaDirecta = null, opcionesImpresion = {}) {
  console.log(`📄 [PLANILLA_PDF]: Recopilando datos de la planilla ID -> ${idPlanilla}`);

  const config = {
    margenMm: opcionesImpresion.margenMm !== undefined ? opcionesImpresion.margenMm : 10,
    paddingCeldaPx: opcionesImpresion.paddingCeldaPx || 6,
    forzarUnaPagina: opcionesImpresion.forzarUnaPagina || false
  };

  try {
    // 1. Obtener planilla desde la RAM directa o consulta segura a almacenamiento
    let planilla = planillaDirecta;

    if (!planilla) {
      const planillasGuardadas = await obtenerColeccionSegura('planillas');
      planilla = planillasGuardadas.find(p => String(p.id).trim() === String(idPlanilla).trim());
    }

    if (!planilla) {
      console.error(`❌ [PLANILLA_PDF]: No se encontraron datos para la planilla ID -> ${idPlanilla}`);
      alert("⚠️ [ERROR]: No se encontraron los datos de la planilla seleccionada.");
      return;
    }

    console.log("📊 [PLANILLA_PDF]: Planilla localizada correctamente para procesar PDF:", planilla);

    const paradasActualizadasRuta = await obtenerColeccionSegura('paradas_rutas');
    const listaSccs = planilla.scc ? planilla.scc.split(',').map(s => s.trim()) : [];

    let paradasBase = planilla.paradas || [];
    if (paradasBase.length === 0 && typeof obtenerRutaZonificada === 'function') {
      paradasBase = obtenerRutaZonificada() || [];
    }

    // 2. Preparar el contenedor invisible de renderizado
    let printArea = document.getElementById("pdf-export-container");
    if (!printArea) {
      printArea = document.createElement("div");
      printArea.id = "pdf-export-container";
      document.body.appendChild(printArea);
    }

    printArea.style.cssText = `
      position: absolute; 
      top: -9999px; 
      left: -9999px; 
      width: 794px; 
      background-color: #ffffff !important; 
      color: #000000 !important; 
      color-scheme: light; 
      visibility: visible; 
      display: block;
      box-sizing: border-box;
      padding: ${config.margenMm}mm;
      font-family: Arial, Helvetica, sans-serif;
    `;

    // 3. Renderizar filas continuas
    const filasTablaHtml = listaSccs.map((codigoScc, index) => {
      const matchRuta = paradasActualizadasRuta.find(p => String(p.ssc || p.id).trim() === String(codigoScc).trim());
      const matchPlanilla = paradasBase.find(p => String(p.ssc || p.id).trim() === String(codigoScc).trim()) || paradasBase[index] || {};
      const detalle = matchRuta ? { ...matchPlanilla, ...matchRuta } : matchPlanilla;

      const destinatario = (detalle.destinatario && !detalle.destinatario.includes('Cliente ')) 
        ? detalle.destinatario 
        : (detalle.nombre || 'Cliente General');

      const direccion = detalle.direccion || detalle.dir || 'Dirección no especificada';
      const telefono = detalle.telefono || detalle.tel || 'N/A';
      const estadoScc = (detalle.estado || planilla.estadoScc || 'PENDIENTE').toUpperCase();
      const timestamp = detalle.updated_at || detalle.registroOperaciones?.fechaHora || planilla.creadoEn;
      const fechaHoraFormateada = formatearFechaHora(timestamp);

      const lat = detalle.lat || detalle.latitud;
      const lng = detalle.lng || detalle.longitud;
      const tieneGps = lat && lng;

      const esEntregado = estadoScc === 'ENTREGADO' || estadoScc === 'FINALIZADO';
      const esDevuelto = estadoScc === 'NO ENTREGADO' || estadoScc === 'DEVUELTO';

      let colorEstado = '#f57c00';
      if (esEntregado) colorEstado = '#2e7d32';
      if (esDevuelto) colorEstado = '#c62828';

      return `
        <tr class="fila-parada-pdf" style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: ${config.paddingCeldaPx}px; border: 1px solid #ddd; vertical-align: top;">
            <strong>${codigoScc}</strong>
            <div style="font-size: 0.72em; color: #666; margin-top: 2px;">Stop #${index + 1}</div>
          </td>
          <td style="padding: ${config.paddingCeldaPx}px; border: 1px solid #ddd; vertical-align: top;">
            <div style="font-weight: bold; color: #111;">${destinatario}</div>
            <div style="font-size: 0.83em; color: #333; margin-top: 2px;">📍 ${direccion}</div>
            <div style="font-size: 0.78em; color: #555; margin-top: 2px;">📞 Tel: ${telefono}</div>
            ${tieneGps ? `<div style="font-size: 0.72em; color: #777; margin-top: 2px;">🌐 GPS: ${parseFloat(lat).toFixed(5)},${parseFloat(lng).toFixed(5)}</div>` : ''}
          </td>
          <td style="padding: ${config.paddingCeldaPx}px; border: 1px solid #ddd; text-align: center; vertical-align: top;">
            <span style="font-weight: bold; color: ${colorEstado}; display: block; text-transform: uppercase;">
              ${estadoScc}
            </span>
            <div style="font-size: 0.75em; color: #555; margin-top: 2px;">🕒 ${fechaHoraFormateada}</div>
            ${detalle.causal ? `<div style="font-size: 0.72em; color: #c62828; margin-top: 2px;">Notas: ${detalle.causal}</div>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    printArea.innerHTML = `
      <div style="background: #ffffff; color: #000000;">
        <header style="border-bottom: 2px solid #000000; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="margin: 0; font-size: 1.2rem; font-weight: bold; letter-spacing: 0.5px;">PLANILLA DE MENSAJERÍA Y DISTRIBUCIÓN NODAL</h2>
            <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #555;">REPORTE DE TRAZABILIDAD Y OPERACIONES EN CAMPO (LOCAL-FIRST)</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.88rem; font-weight: bold; color: #000;">#PLN-${planilla.id || Date.now()}</div>
            <div style="font-size: 0.75rem; color: #666;">Exportado: ${new Date().toLocaleDateString('es-CO')}</div>
          </div>
        </header>

        <section style="display: flex; justify-content: space-between; background: #f8f9fa; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 12px; font-size: 0.82rem;">
          <div><span>MENSAJERO:</span> <strong>${planilla.nombreMensajero || localStorage.getItem("nombreMensajero") || 'Asignado'}</strong></div>
          <div><span>FECHA PLANILLA:</span> <strong>${planilla.fecha || new Date().toLocaleDateString('es-CO')}</strong></div>
          <div><span>TOTAL PARADAS:</span> <strong>${listaSccs.length}</strong></div>
        </section>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; background: #ffffff;">
          <thead>
            <tr style="background: #e9ecef; color: #212529;">
              <th style="width: 22%; padding: 6px; border: 1px solid #dee2e6; text-align: left;">SCC / STOP</th>
              <th style="width: 48%; padding: 6px; border: 1px solid #dee2e6; text-align: left;">DATOS DE ENTREGA & UBICACIÓN</th>
              <th style="width: 30%; padding: 6px; border: 1px solid #dee2e6; text-align: center;">ESTADO & TRAZABILIDAD</th>
            </tr>
          </thead>
          <tbody>
            ${filasTablaHtml}
          </tbody>
        </table>

        <footer style="margin-top: 16px; border-top: 1px dashed #ccc; padding-top: 8px; font-size: 0.7rem; color: #777; display: flex; justify-content: space-between;">
          <span>Certificado Digital Inmutable PWA Mensajero</span>
          <span>Sincronización Local-First OK</span>
        </footer>
      </div>
    `;

    await precargarRecursosLienzo(printArea);
    await asegurarDependenciasPDF();

    const tieneHtml2Canvas = typeof window.html2canvas !== 'undefined';
    const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;

    if (!tieneHtml2Canvas || !jsPDFClass) {
      console.warn("⚠️ [PDF_SYNC]: Librerías gráficas no disponibles. Recurriendo a fallback de ventana nativa...");
      generarPdfFallbackVentana(printArea.innerHTML, planilla.id);
      return;
    }

    await new Promise(r => setTimeout(r, 150));

    // 4. Captura del Canvas con escalado 2x
    const canvas = await window.html2canvas(printArea, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDFClass('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();   // 210 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Altura de una página A4 expresada en píxeles de Canvas
    const pageHeightCanvas = (canvasWidth * pdfHeight) / pdfWidth;

    if (config.forzarUnaPagina || canvasHeight <= pageHeightCanvas) {
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, (canvasHeight * pdfWidth) / canvasWidth);
    } else {
      // 5. Algoritmo de Slicing Limpio por bordes de filas (Row-Bound Slicing)
      const filasDOM = Array.from(printArea.querySelectorAll('.fila-parada-pdf'));
      const areaRect = printArea.getBoundingClientRect();

      let currentCanvasY = 0;
      let pageNumber = 0;

      while (currentCanvasY < canvasHeight) {
        let nextCutCanvasY = currentCanvasY + pageHeightCanvas;

        if (nextCutCanvasY >= canvasHeight) {
          nextCutCanvasY = canvasHeight;
        } else {
          for (const fila of filasDOM) {
            const filaRect = fila.getBoundingClientRect();
            const filaTopCanvas = ((filaRect.top - areaRect.top) / areaRect.height) * canvasHeight;
            const filaBottomCanvas = ((filaRect.bottom - areaRect.top) / areaRect.height) * canvasHeight;

            if (filaTopCanvas < nextCutCanvasY && filaBottomCanvas > nextCutCanvasY) {
              if (filaTopCanvas > currentCanvasY) {
                nextCutCanvasY = filaTopCanvas;
              }
              break;
            }
          }
        }

        const sliceHeightCanvas = nextCutCanvasY - currentCanvasY;
        if (sliceHeightCanvas <= 0) break;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvasWidth;
        pageCanvas.height = sliceHeightCanvas;

        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasWidth, sliceHeightCanvas);

        ctx.drawImage(
          canvas,
          0, currentCanvasY, canvasWidth, sliceHeightCanvas,
          0, 0, canvasWidth, sliceHeightCanvas
        );

        const imgDataSlice = pageCanvas.toDataURL('image/jpeg', 0.95);
        const slicePdfHeight = (sliceHeightCanvas * pdfWidth) / canvasWidth;

        if (pageNumber > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgDataSlice, 'JPEG', 0, 0, pdfWidth, slicePdfHeight);

        currentCanvasY = nextCutCanvasY;
        pageNumber++;
      }
    }

    const pdfBlob = pdf.output('blob');

    // 6. Resguardo de Blob de PDF si el método existe en dbStore
    if (dbStore && typeof dbStore.guardarPdfBlob === "function") {
      await dbStore.guardarPdfBlob(planilla.id || Date.now(), pdfBlob);
    }

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

    console.log("✅ [PLANILLA_PDF]: PDF paginado y exportado correctamente con bordes limpios.");

  } catch (error) {
    console.error("❌ [PLANILLA_PDF]: Error procesando exportación PDF:", error);
    alert(`❌ Error al generar el PDF de la planilla: ${error.message || error}`);
  }
}

/**
 * Fallback de impresión utilizando la ventana del navegador.
 * @param {string} htmlContent 
 * @param {string|number} idPlanilla 
 */
function generarPdfFallbackVentana(htmlContent, idPlanilla) {
  const windowPrint = window.open('', '_blank');
  if (!windowPrint) {
    alert("⚠️ Habilite las ventanas emergentes para imprimir la planilla.");
    return;
  }

  windowPrint.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Planilla #${idPlanilla}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = function() { window.print(); window.close(); };
      </script>
    </body>
    </html>
  `);
  windowPrint.document.close();
}

// BINDING GLOBAL
if (typeof window !== "undefined") {
  window.exportarYRespaldarPlanillaPDF = exportarYRespaldarPlanillaPDF;
}