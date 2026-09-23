/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: PARSER DE ARCHIVOS Y BASE DE DATOS LOCAL
 * Ubicación: pwa-mensajero/modulos/base-de-datos.js
 */

import { procesarTextoHeuristico } from "./procesamiento-datos/heuristico.js";

function preprocesarImagenCanvas(archivoImagen) {
    return new Promise((resolve) => {
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

async function convertirImagenATextoLocal(archivoImagen) {
    if (typeof Tesseract === "undefined") {
        throw new Error("La librería de OCR Local (Tesseract.js) no está disponible en el ámbito global.");
    }

    console.log(`>>> [OCR_LOCAL_INIT]: Preprocesando imagen y preparando WASM -> ${archivoImagen.name}`);
    
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
 * Extrae el texto preserving los saltos de línea entre bloques para evitar cadenas unificadas.
 */
async function convertirPdfATextoLocal(archivoPdf) {
    const pdfLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
    if (!pdfLib) {
        throw new Error("La librería PDF.js no está disponible en el ámbito global para procesar PDFs sin IA.");
    }

    console.log(`>>> [PROCESADOR_BD_PDF]: Leyendo buffer binario de PDF -> ${archivoPdf.name}`);
    const arrayBuffer = await archivoPdf.arrayBuffer();
    const pdfDoc = await pdfLib.getDocument({ data: arrayBuffer }).promise;
    
    let textoCompleto = "";
    console.log(`>>> [PROCESADOR_BD_PDF]: Páginas detectadas en el documento -> ${pdfDoc.numPages}`);

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        let lastY = null;
        let pageText = "";

        // Unir cadenas detectando saltos de línea por posición Y
        textContent.items.forEach((item) => {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                pageText += "\n";
            } else if (pageText.length > 0 && !pageText.endsWith("\n")) {
                pageText += " ";
            }
            pageText += item.str;
            lastY = item.transform[5];
        });

        textoCompleto += pageText + "\n";
    }

    console.log(`>>> [PROCESADOR_BD_PDF_SUCCESS]: ${textoCompleto.length} caracteres extraídos del PDF.`);
    return textoCompleto;
}

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
            filaLimpia[keyNorm] = fila[key].toString().trim();
        });

        const ssc = filaLimpia.ssc || filaLimpia["ssc_no"] || "103458";
        const nombre = filaLimpia.nombre || filaLimpia.afiliado || filaLimpia.cliente || filaLimpia.usuario || "";
        const direccion = filaLimpia.direccion || filaLimpia["direccion_entrega"] || filaLimpia.dir || "";
        const telefono = filaLimpia.telefono || filaLimpia.tel || filaLimpia.celular || "";
        const origen = filaLimpia.origen || filaLimpia.punto || "Cafam Tequendama";
        const cuota = filaLimpia.cuota || filaLimpia["cuota_moderadora"] || filaLimpia.copago || "$0";

        if (nombre || direccion || telefono) {
            paradasExtraidas.push({
                ssc: ssc,
                destinatario: nombre || `Cliente ${idx + 1}`,
                direccion: direccion || "Dirección no especificada",
                telefono: telefono || "3000000000",
                puntoOrigen: origen,
                cuotaModeradora: cuota
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

export async function procesarArchivoTextoCSV(archivo) {
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

const NOMBRE_DB = "PWA_Gremio_Mensajeria_DB";
const VERSION_DB = 2;

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