/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: PARSER MULTIMODAL DE ARCHIVOS Y BASE DE DATOS LOCAL
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/base-de-datos.js
 * Arquitectura: Async Local-First (Modo 3 Sin IA) / PDF.js Vectorial + OCR Fallback / Tesseract WASM / SheetJS
 */

import { procesarTextoHeuristico } from "./heuristico.js";

/**
 * Preprocesa una imagen aplicando binarización en Canvas para maximizar precisión en OCR Tesseract.
 * 
 * @param {File|Blob|HTMLCanvasElement} archivoImagen 
 * @returns {Promise<Blob>}
 */
function preprocesarImagenCanvas(archivoImagen) {
    return new Promise((resolve) => {
        if (archivoImagen instanceof HTMLCanvasElement) {
            archivoImagen.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
            return;
        }

        const img = new Image();
        const url = URL.createObjectURL(archivoImagen);

        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = img.width;
            canvas.height = img.height;

            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            // Binarización por umbral de luminancia
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const v = avg > 135 ? 255 : 0;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
            }

            ctx.putImageData(imgData, 0, 0);
            canvas.toBlob((blob) => resolve(blob || archivoImagen), "image/jpeg", 0.9);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(archivoImagen);
        };

        img.src = url;
    });
}

/**
 * Reconocimiento óptico de caracteres (OCR) local mediante Tesseract WASM.
 * 
 * @param {File|Blob|HTMLCanvasElement} archivoImagen 
 * @returns {Promise<string>}
 */
async function convertirImagenATextoLocal(archivoImagen) {
    if (typeof Tesseract === "undefined") {
        throw new Error("La librería de OCR Local (Tesseract.js) no está disponible en el ámbito global.");
    }

    const nombreArchivo = archivoImagen.name || "imagen_canvas";
    console.log(`>>> [OCR_LOCAL_INIT]: Preprocesando imagen y preparando WASM -> ${nombreArchivo}`);
    
    let worker = null;
    try {
        const imagenBinarizada = await preprocesarImagenCanvas(archivoImagen);
        worker = await Tesseract.createWorker();
        
        if (typeof worker.loadLanguage === "function") {
            await worker.loadLanguage("spa");
            await worker.initialize("spa");
        }

        const result = await worker.recognize(imagenBinarizada);
        console.log(">>> [OCR_LOCAL_SUCCESS]: Texto extraído ópticamente de la imagen.");
        return result.data && result.data.text ? result.data.text : "";

    } catch (err) {
        console.error(">>> [OCR_LOCAL_FAIL]: Error durante la ejecución de Tesseract WASM:", err);
        return "";
    } finally {
        if (worker && typeof worker.terminate === "function") {
            await worker.terminate();
        }
    }
}

/**
 * Renderiza dinámicamente las páginas de un PDF sobre un Canvas y ejecuta OCR si la extracción vectorial retorna 0 caracteres.
 * 
 * @param {Object} pdfDoc Documento cargado por PDF.js
 * @returns {Promise<string>}
 */
async function realizarOcrEnPaginasPdf(pdfDoc) {
    console.log("⚠️ [PROCESADOR_BD_PDF_OCR]: Texto vectorial insuficiente. Activando renderizado Canvas y OCR WASM...");
    let textoOcrTotal = "";

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.8 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        console.log(`📸 [PROCESADOR_BD_PDF_OCR]: Página ${pageNum} renderizada en Canvas (${canvas.width}x${canvas.height}). Procesando Tesseract...`);

        const textoPagina = await convertirImagenATextoLocal(canvas);
        textoOcrTotal += textoPagina + "\n";
    }

    return textoOcrTotal;
}

/**
 * Extrae iterativamente el texto de un PDF utilizando extracción vectorial o fallback de OCR Canvas.
 * 
 * @param {File|Blob|ArrayBuffer} archivoPdf 
 * @returns {Promise<string>}
 */
export async function convertirPdfATextoLocal(archivoPdf) {
    const pdfLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
    if (!pdfLib) {
        throw new Error("La librería PDF.js no está disponible en el ámbito global para procesar PDFs sin IA.");
    }

    const nombreArchivo = archivoPdf.name || "documento.pdf";
    console.log(`>>> [PROCESADOR_BD_PDF]: Leyendo buffer binario de PDF -> ${nombreArchivo}`);
    
    let arrayBuffer = archivoPdf;
    if (archivoPdf instanceof File || archivoPdf instanceof Blob) {
        arrayBuffer = await archivoPdf.arrayBuffer();
    }

    let pdfDoc = null;
    try {
        const loadingTask = pdfLib.getDocument({ data: arrayBuffer });
        pdfDoc = await loadingTask.promise;
    } catch (pdfErr) {
        console.warn("⚠️ [PROCESADOR_BD_PDF_WARN]: Error en el motor de lectura PDF. Reintentando apertura defensiva...", pdfErr);
        const loadingTaskFallback = pdfLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        pdfDoc = await loadingTaskFallback.promise;
    }
    
    let textoCompleto = "";
    console.log(`>>> [PROCESADOR_BD_PDF]: Páginas detectadas en el documento -> ${pdfDoc.numPages}`);

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        let lastY = null;
        let pageText = "";

        // Pasada 1: Recorrido posicional y acumulación de tokens
        textContent.items.forEach((item) => {
            if (!item || typeof item.str !== "string") return;

            const str = item.str;
            const currentY = (item.transform && item.transform.length >= 6) ? item.transform[5] : null;

            if (currentY !== null && lastY !== null && Math.abs(currentY - lastY) > 4) {
                pageText += "\n";
            } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
                pageText += " ";
            }

            pageText += str;
            if (currentY !== null) lastY = currentY;
        });

        // Pasada 2: Extracción secuencial directa si no hubo diferencias Y
        if (pageText.trim().length === 0 && textContent.items.length > 0) {
            pageText = textContent.items.map(it => it.str || "").join(" ");
        }

        textoCompleto += pageText + "\n";
    }

    // Pasada 3: Fallback a OCR WASM si la extracción vectorial no obtuvo texto útil
    if (textoCompleto.trim().length < 20) {
        console.warn(`⚠️ [PROCESADOR_BD_PDF_WARN]: Extracción vectorial incompleta (${textoCompleto.trim().length} caracteres). Ejecutando Fallback a OCR...`);
        textoCompleto = await realizarOcrEnPaginasPdf(pdfDoc);
    }

    const totalCaracteres = textoCompleto.trim().length;
    console.log(`>>> [PROCESADOR_BD_PDF_SUCCESS]: ${totalCaracteres} caracteres extraídos del PDF.`);
    
    return textoCompleto;
}

/**
 * Procesa planillas de cálculo Excel (XLSX / XLS) o archivos CSV delimitados.
 * 
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Array<Object>}
 */
function procesarWorkbookExcel(arrayBuffer) {
    if (typeof XLSX === "undefined") {
        throw new Error("La librería SheetJS (XLSX) no está disponible en el ámbito global.");
    }

    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const primeraHojaNombre = workbook.SheetNames[0];
    const hoja = workbook.Sheets[primeraHojaNombre];

    const filasJson = XLSX.utils.sheet_to_json(hoja, { defval: "" });
    console.log(`>>> [PROCESADOR_BD_XLSX]: ${filasJson.length} fila(s) extraída(s) desde la hoja de cálculo.`);

    if (filasJson.length === 0) return [];

    const paradasExtraidas = [];

    filasJson.forEach((fila, idx) => {
        const filaLimpia = {};
        Object.keys(fila).forEach(key => {
            const keyNorm = key.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            filaLimpia[keyNorm] = String(fila[key] || "").trim();
        });

        const ssc = filaLimpia.ssc || filaLimpia.scc || filaLimpia["ssc_no"] || filaLimpia.id || `1034${idx + 1}`;
        const nombre = filaLimpia.nombre || filaLimpia.destinatario || filaLimpia.afiliado || filaLimpia.cliente || filaLimpia.usuario || "";
        const direccion = filaLimpia.direccion || filaLimpia["direccion_entrega"] || filaLimpia.dir || "";
        const telefono = filaLimpia.telefono || filaLimpia.tel || filaLimpia.celular || "";
        const origen = filaLimpia.origen || filaLimpia.punto || "Cafam Tequendama";
        const cuota = filaLimpia.cuota || filaLimpia["cuota_moderadora"] || filaLimpia.copago || "$0";
        
        const lat = parseFloat(filaLimpia.lat || filaLimpia.latitud || 0);
        const lng = parseFloat(filaLimpia.lng || filaLimpia.longitud || 0);

        if (nombre || direccion || telefono) {
            paradasExtraidas.push({
                id: ssc,
                ssc: ssc,
                scc: ssc,
                destinatario: nombre || `Cliente ${idx + 1}`,
                cliente: nombre || `Cliente ${idx + 1}`,
                direccion: direccion || "Dirección no especificada",
                dir: direccion || "Dirección no especificada",
                telefono: telefono || "3000000000",
                puntoOrigen: origen,
                cuotaModeradora: cuota,
                lat: !isNaN(lat) && lat !== 0 ? lat : null,
                lng: !isNaN(lng) && lng !== 0 ? lng : null,
                estado: "ASIGNADO",
                status: "asignado"
            });
        }
    });

    if (paradasExtraidas.length === 0) {
        console.log(">>> [PROCESADOR_BD_XLSX_FALLBACK]: No se hallaron cabeceras estándar. Procesando como texto tabulado...");
        const textoTabular = XLSX.utils.sheet_to_txt(hoja);
        return procesarTextoHeuristico(textoTabular);
    }

    return paradasExtraidas;
}

/**
 * Función unificada de ingestión de archivos (PDF, XLSX, CSV, PNG, JPG).
 * 
 * @param {File} archivo 
 * @returns {Promise<Array<Object>>}
 */
export async function procesarArchivoTextoCSV(archivo) {
    if (!archivo) return [];

    console.log(`>>> [PROCESADOR_BD]: Leyendo contenido de archivo -> ${archivo.name} (${archivo.type})`);
    
    try {
        let paradas = [];
        const nombreLower = archivo.name.toLowerCase();
        
        const esExcel = nombreLower.endsWith(".xlsx") || 
                        nombreLower.endsWith(".xls") || 
                        archivo.type.includes("spreadsheetml") || 
                        archivo.type.includes("excel");

        const esPdf = nombreLower.endsWith(".pdf") || archivo.type === "application/pdf";
        const esImagen = archivo.type.startsWith("image/");

        if (esExcel) {
            console.log(">>> [PROCESADOR_BD_XLSX]: Invocando parser binario SheetJS...");
            const buffer = await archivo.arrayBuffer();
            paradas = procesarWorkbookExcel(buffer);
        } else if (esPdf) {
            console.log(">>> [PROCESADOR_BD_PDF]: PDF detectado en MODO 3. Decodificando con PDF.js local...");
            const textoPdf = await convertirPdfATextoLocal(archivo);
            paradas = procesarTextoHeuristico(textoPdf);
        } else if (esImagen) {
            console.log(">>> [PROCESADOR_BD_IMG]: Fotografía detectada en MODO 3. Ejecutando OCR WASM local...");
            const textoExtraido = await convertirImagenATextoLocal(archivo);
            paradas = procesarTextoHeuristico(textoExtraido);
        } else {
            console.log(">>> [PROCESADOR_BD_TXT]: Leyendo archivo de texto plano / CSV...");
            let textoBruto = await archivo.text();
            
            if (textoBruto.includes("%PDF-") || textoBruto.includes("/Root")) {
                console.warn(">>> [PROCESADOR_BD_WARN]: Se detectó firma PDF binaria en lectura plana. Redirigiendo a parser PDF...");
                const textoPdf = await convertirPdfATextoLocal(archivo);
                paradas = procesarTextoHeuristico(textoPdf);
            } else {
                paradas = procesarTextoHeuristico(textoBruto);
            }
        }

        console.log(`>>> [PROCESADOR_BD_SUCCESS]: ${paradas.length} registro(s) procesado(s) exitosamente desde ${archivo.name}.`);
        return paradas;

    } catch (error) {
        console.error(">>> [PROCESADOR_BD_FAIL]: Error crítico al procesar archivo de datos:", error);
        throw error;
    }
}

// Configuración de la base de datos IndexedDB local de la PWA
const NOMBRE_DB = "PWA_Gremio_Mensajeria_DB";
const VERSION_DB = 2;

/**
 * Retorna la instancia activa de IndexedDB.
 * 
 * @returns {Promise<IDBDatabase>}
 */
export function obtenerDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(NOMBRE_DB, VERSION_DB);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains("planillas")) {
                db.createObjectStore("planillas", { keyPath: "id", autoIncrement: true });
            }

            if (!db.objectStoreNames.contains("rutas")) {
                db.createObjectStore("rutas", { keyPath: "id" });
            }

            if (!db.objectStoreNames.contains("perfil_conductor")) {
                db.createObjectStore("perfil_conductor", { keyPath: "id" });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("❌ [IndexedDB]: Error abriendo la base de datos:", event.target.error);
            reject(event.target.error);
        };
    });
}

// Bindings globales inmediatos
if (typeof window !== "undefined") {
    window.convertirPdfATextoLocal = convertirPdfATextoLocal;
    window.procesarArchivoTextoCSV = procesarArchivoTextoCSV;
    window.obtenerDB = obtenerDB;
}