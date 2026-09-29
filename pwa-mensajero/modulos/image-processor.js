/**
 * PREPROCESADOR DE IMÁGENES PARA CAPTURA Y OCR EN GEMINI
 * Ubicación: pwa-mensajero/modulos/image-processor.js
 */

/**
 * Convierte una foto capturada por la cámara a formato de "Escáner" (Escala de grises, alto contraste)
 * y ajusta la resolución máxima para optimizar el tokenizaje en Gemini Vision.
 * 
 * @param {HTMLImageElement | Blob | File} fuenteImagen 
 * @param {Object} opciones
 * @param {number} opciones.maxDimension Resolution máxima (default 1024px)
 * @param {number} opciones.contraste Factor de contraste (e.g. 1.2 a 1.5)
 * @returns {Promise<Blob>} Imagen optimizada en formato JPEG comprimido.
 */
export async function optimizarImagenParaGemini(fuenteImagen, opciones = {}) {
    const { maxDimension = 1024, contraste = 1.3 } = opciones;
    console.log(">>> [IMG_PROC_INIT]: Iniciando preprocesamiento de imagen para Gemini...");

    const img = await cargarImagenHtml(fuenteImagen);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Reescalado manteniendo la relación de aspecto para minimizar tokens
    let width = img.width;
    let height = img.height;

    if (width > maxDimension || height > maxDimension) {
        if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
        } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
        }
    }

    canvas.width = width;
    canvas.height = height;

    // Dibujar imagen escalada
    ctx.drawImage(img, 0, 0, width, height);

    // Aplicar transformación a escala de grises y ajuste de contraste (Efecto Escáner)
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Luminancia relativa (Fórmula estándar ITU-R BT.601)
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Ajuste de contraste para resaltar texto
        const grayContrasted = Math.min(255, Math.max(0, (gray - 128) * contraste + 128));

        data[i] = grayContrasted;     // Red
        data[i + 1] = grayContrasted; // Green
        data[i + 2] = grayContrasted; // Blue
    }

    ctx.putImageData(imgData, 0, 0);
    console.log(`>>> [IMG_PROC_OK]: Imagen optimizada. Dimensiones: ${width}x${height}px.`);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
}

function cargarImagenHtml(fuente) {
    return new Promise((resolve, reject) => {
        if (fuente instanceof HTMLImageElement) return resolve(fuente);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = fuente instanceof Blob ? URL.createObjectURL(fuente) : fuente;
    });
}