/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: PARSER DE ARCHIVOS Y BASE DE DATOS LOCAL
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/base-de-datos.js
 * Función: Parsea TXT, CSV, Excel (XLSX/XLS) y Fotografías (vía OCR WASM Tesseract) sin consumir IA Cloud.
 */

import { procesarTextoHeuristico } from "./heuristico.js";

/**
 * Aplica binarización y filtro de contraste sobre Canvas antes de enviar la imagen a Tesseract.
 * 
 * @param {File|Blob} archivoImagen 
 * @returns {Promise<Blob>}
 */
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

            // Escala de grises y binarización por umbral (Thresholding)
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
 * Convierte una imagen a texto plano utilizando Tesseract.js con inicialización explícita de WASM.
 * 
 * @param {File} archivoImagen 
 * @returns {Promise<string>}
 */
async function convertirImagenATextoLocal(archivoImagen) {
    if (typeof Tesseract === "undefined") {
        throw new Error("La librería de OCR Local (Tesseract.js) no está disponible en el ámbito global.");
    }

    console.log(`>>> [OCR_LOCAL_INIT]: Preprocesando imagen y preparando WASM -> ${archivoImagen.name}`);
    
    let worker = null;
    try {
        const imagenBinarizada = await preprocesarImagenCanvas(archivoImagen);
        
        // Inicialización robusta compatible con Tesseract.js v2/v4/v5
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
 * Convierte una hoja de cálculo Excel (ArrayBuffer) en una lista de paradas normalizadas.
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

/**
 * Lee y procesa un archivo subido (TXT, CSV, XLSX o Imagen/Foto) extrayendo las paradas estructuradas.
 * 
 * @param {File} archivo - Archivo seleccionado en el DOM.
 * @returns {Promise<Array<Object>>} Promesa con la lista de paradas procesadas.
 */
export async function procesarArchivoTextoCSV(archivo) {
    console.log(`>>> [PROCESADOR_BD]: Leyendo contenido de archivo -> ${archivo.name} (${archivo.type})`);
    
    try {
        let paradas = [];
        const esExcel = archivo.name.toLowerCase().endsWith(".xlsx") || 
                        archivo.name.toLowerCase().endsWith(".xls") || 
                        archivo.type.includes("spreadsheetml") || 
                        archivo.type.includes("excel");

        const esImagen = archivo.type.startsWith("image/");

        if (esExcel) {
            console.log(">>> [PROCESADOR_BD_XLSX]: Invocando parser binario SheetJS...");
            const buffer = await archivo.arrayBuffer();
            paradas = procesarWorkbookExcel(buffer);
        } else if (esImagen) {
            console.log(">>> [PROCESADOR_BD_IMG]: Fotografía detectada en MODO 3. Ejecutando OCR WASM local...");
            const textoExtraido = await convertirImagenATextoLocal(archivo);
            paradas = procesarTextoHeuristico(textoExtraido);
        } else {
            console.log(">>> [PROCESADOR_BD_TXT]: Leyendo archivo de texto plano / CSV...");
            let textoBruto = await archivo.text();
            
            if (textoBruto.includes("%PDF-") || textoBruto.includes("/Root")) {
                console.warn(">>> [PROCESADOR_BD_WARN]: Se detectó firma PDF binaria en lectura plana. Abortando.");
                return [];
            }

            paradas = procesarTextoHeuristico(textoBruto);
        }

        console.log(`>>> [PROCESADOR_BD_SUCCESS]: ${paradas.length} registro(s) procesado(s) exitosamente desde ${archivo.name}.`);
        return paradas;

    } catch (error) {
        console.error(">>> [PROCESADOR_BD_FAIL]: Error crítico al procesar archivo de datos:", error);
        throw error;
    }
}
/**
 * PROTOCOLO MACONDO - BASE DE DATOS LOCAL (INDEXEDDB)
 * Ubicación: pwa-mensajero/modulos/procesamiento-datos/base-de-datos.js
 */

const NOMBRE_DB = "PWA_Gremio_Mensajeria_DB";
const VERSION_DB = 1;

/**
 * Abre o inicializa la base de datos IndexedDB local.
 * @returns {Promise<IDBDatabase>} Instancia de la base de datos abierta.
 */
export function obtenerDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(NOMBRE_DB, VERSION_DB);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Creación del objectStore para 'planillas'
            if (!db.objectStoreNames.contains("planillas")) {
                db.createObjectStore("planillas", { keyPath: "id", autoIncrement: true });
            }

            // Creación del objectStore para 'rutas'
            if (!db.objectStoreNames.contains("rutas")) {
                db.createObjectStore("rutas", { keyPath: "id" });
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