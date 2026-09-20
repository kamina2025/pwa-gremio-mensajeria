/**
 * PROTOCOLO MACONDO - GENERADOR PDF Y RESPALDO DRIVE/WEBTORRENT
 * Ubicación: pwa-mensajero/modulos/planillas-pdf-sync.js
 */

/**
 * Exporta una planilla específica a formato PDF y la sincroniza con el nodo remoto / nube.
 * @param {string|number} planillaId 
 */
export async function exportarYRespaldarPlanillaPDF(planillaId) {
    console.log(`⚡ [Nodo Sync]: Iniciando exportación de Planilla #${planillaId}...`);

    try {
        const elementoDOM = document.getElementById(`planilla-card-${planillaId}`) || document.body;
        
        // Configuración para html2pdf
        const opciones = {
            margin:       10,
            filename:     `planilla_${planillaId}_${Date.now()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (window.html2pdf) {
            const pdfBlob = await window.html2pdf().set(opciones).from(elementoDOM).output('blob');
            
            // Descarga local
            const downloadUrl = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = opciones.filename;
            a.click();

            // Sincronización a Drive / Nodo WebTorrent / API REST
            await respaldarEnNubeNodo(pdfBlob, opciones.filename);
        } else {
            window.print();
        }
    } catch (error) {
        console.error("❌ [Nodo Sync]: Error al generar o respaldar PDF:", error);
    }
}

/**
 * Envía el archivo PDF generado hacia Google Drive o Nodo WebTorrent
 */
async function respaldarEnNubeNodo(blob, nombreArchivo) {
    const formData = new FormData();
    formData.append("pdf", blob, nombreArchivo);

    try {
        const respuesta = await fetch('/api/v1/respaldo-nodo-drive.php', {
            method: 'POST',
            body: formData
        });
        
        if (respuesta.ok) {
            console.log("☁️ [Nodo WebTorrent/Drive]: PDF respaldado con éxito en la nube.");
        }
    } catch (err) {
        console.warn("📡 [Local-First]: Sin conexión a nube. Se completará al resincronizar.", err);
    }
}