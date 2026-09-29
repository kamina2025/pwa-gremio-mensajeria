/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: SUITE DE PRUEBAS DE AGENTE Y CAPTURA
 * Ubicación: pwa-mensajero/tests/test-ai-agent.js
 */

import { procesarCargaConAI, ejecutarHeuristicaTrinchera } from '../modulos/ai-agent.js';
import { optimizarImagenParaGemini } from '../modulos/image-processor.js';

/**
 * 1. PRUEBA DE OPTIMIZACIÓN DE RUTA (LOTE DE PRUEBA EN CALI)
 */
export async function probarOptimizacionRuta() {
    console.log(">>> [TEST_START]: Ejecutando prueba de optimización de datos...");

    const lotePrueba = [
        { ssc: "1001", destinatario: "Carlos Pérez", direccion: "Calle 5 # 38-25, Cali", telefono: "3001234567", puntoOrigen: "Sede Centro", cuotaModeradora: 4000 },
        { ssc: "1002", destinatario: "María Gómez", direccion: "Carrera 100 # 11-60, Cali", telefono: "3109876543", puntoOrigen: "Sede Norte", cuotaModeradora: 0 },
        { ssc: "1003", destinatario: "Jorge Ruiz", direccion: "Calle 9 # 44-05, Cali", telefono: "3205551234", puntoOrigen: "Sede Centro", cuotaModeradora: 12000 }
    ];

    console.time(">>> [TEST_TIMER] Tiempo de procesamiento");
    const resultado = await procesarCargaConAI(lotePrueba);
    console.timeEnd(">>> [TEST_TIMER] Tiempo de procesamiento");

    console.log(">>> [TEST_RESULT] Resultado final recibido:", resultado);

    if (Array.isArray(resultado) && resultado.length === lotePrueba.length) {
        console.log(">>> [TEST_SUCCESS]: La estructura del arreglo preserva el número de paradas.");
    } else {
        console.error(">>> [TEST_ERROR]: Falló la integridad del lote devuelto.");
    }
}

/**
 * 2. PRUEBA DE PREPROCESAMIENTO DE IMAGEN (EFECTO ESCÁNER / BINARIZACIÓN)
 * 
 * @param {HTMLInputElement} inputElement - Elemento <input type="file">
 */
export async function probarPreprocesamientoImagen(inputElement) {
    if (!inputElement.files || inputElement.files.length === 0) {
        console.warn(">>> [TEST_WARN]: Selecciona un archivo de imagen primero.");
        return;
    }

    const archivoFoto = inputElement.files[0];
    console.log(`>>> [TEST_IMG_INIT]: Procesando foto original: ${archivoFoto.name} (${(archivoFoto.size / 1024).toFixed(2)} KB)`);

    try {
        const blobOptimizado = await optimizarImagenParaGemini(archivoFoto, {
            maxDimension: 1024,
            contraste: 1.4
        });

        console.log(`>>> [TEST_IMG_SUCCESS]: Imagen tipo escáner lista (${(blobOptimizado.size / 1024).toFixed(2)} KB).`);

        // Generar vista previa gráfica en el DOM para inspección visual
        const urlVisual = URL.createObjectURL(blobOptimizado);
        let imgPreview = document.getElementById("preview-escanner-test");
        if (!imgPreview) {
            imgPreview = document.createElement("img");
            imgPreview.id = "preview-escanner-test";
            imgPreview.style.maxWidth = "300px";
            imgPreview.style.border = "2px solid #00ff00";
            document.body.appendChild(imgPreview);
        }
        imgPreview.src = urlVisual;

    } catch (err) {
        console.error(">>> [TEST_IMG_ERROR]: Error procesando la imagen:", err);
    }
}

// Registro global para pruebas directas en la consola DevTools
if (typeof window !== "undefined") {
    window.probarOptimizacionRuta = probarOptimizacionRuta;
    window.probarPreprocesamientoImagen = probarPreprocesamientoImagen;
}