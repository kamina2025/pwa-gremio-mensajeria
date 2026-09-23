/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: FACHADA Y ORQUESTADOR DE IMPORTACIÓN
 * Ubicación: pwa-mensajero/modulos/mensajero-importer.js
 */

import { procesarArchivoTextoCSV } from "./base-de-datos.js";
import { procesarImagenConGemini } from "./procesamiento-datos/ia-gemini.js";
import { fusionarYGuardarParadas } from "./importer/fusionador.js";
import { parsearTextoPlanoWhatsApp, parsearPayloadODocumento } from "./importer/parser-payload.js";
import { 
    dispararRefrescoUI, 
    actualizarEstadoIngestionUI, 
    notificarResultadoImportacion 
} from "./importer/ui-bridge.js";

// Re-exportar para retrocompatibilidad
export { parsearTextoPlanoWhatsApp, parsearPayloadODocumento };

/**
 * Emitir vibración háptica en Android
 */
function emitirHaptico(pattern = 30) {
    if ('vibrate' in navigator) {
        try { navigator.vibrate(pattern); } catch (e) {}
    }
}

/**
 * Carga e importa paradas desde un enlace o texto plano.
 */
export async function cargarRutaDesdeTextoOEnlace(textoEntrada, callbackRefresco) {
    if (!textoEntrada || !textoEntrada.trim()) {
        notificarResultadoImportacion("ALERTA MENSAJERO", "Ingrese un enlace válido o texto de payload.", true);
        return false;
    }

    try {
        const listaParadas = parsearPayloadODocumento(textoEntrada);
        if (!listaParadas || listaParadas.length === 0) {
            throw new Error("No se detectaron paradas o direcciones procesables.");
        }

        const paradasAcumuladas = await fusionarYGuardarParadas(listaParadas);

        notificarResultadoImportacion("RUTA ACTUALIZADA EXITOSAMENTE", `Total de paradas en Hoja de Ruta: ${paradasAcumuladas.length}`);
        dispararRefrescoUI(paradasAcumuladas, callbackRefresco);
        return true;
    } catch (error) {
        notificarResultadoImportacion("ERROR DE IMPORTACIÓN", error.message, true);
        return false;
    }
}

/**
 * ORQUESTADOR DE IMPORTACIÓN MASIVA
 */
export class ImportadorMasivoMensajero {
    constructor() {
        console.log(">>> [IMPORTADOR_MENSAJERO_INIT]: Instanciando subsistema de ingestión masiva Acumulativa...");
    }

    vincularEscuchas() {
        const btnProcesarIA = document.getElementById("btn-procesar-archivo-masivo");
        if (btnProcesarIA) {
            console.log(">>> [IMPORTADOR_LISTENERS]: Botón #btn-procesar-archivo-masivo (IA Cloud) enlazado.");
            btnProcesarIA.removeEventListener("click", this._onProcesarIAClick);
            this._onProcesarIAClick = () => this.ejecutarImportacionArchivo(null, true);
            btnProcesarIA.addEventListener("click", this._onProcesarIAClick);
        }

        const btnProcesarLocal = document.getElementById("btn-procesar-archivo-masivo-local");
        if (btnProcesarLocal) {
            console.log(">>> [IMPORTADOR_LISTENERS]: Botón #btn-procesar-archivo-masivo-local (Sin IA) enlazado.");
            btnProcesarLocal.removeEventListener("click", this._onProcesarLocalClick);
            this._onProcesarLocalClick = () => this.ejecutarImportacionArchivoLocal();
            btnProcesarLocal.addEventListener("click", this._onProcesarLocalClick);
        }
    }

    /**
     * MODO 3: Extracción heurística local sin IA (CSV, Excel, TXT, PDF Local)
     */
    async ejecutarImportacionArchivoLocal(callbackRefresco) {
        console.log(">>> [IMPORTADOR_EXEC_LOCAL]: Disparando extracción local MODO 3 Acumulativa...");
        emitirHaptico(30);

        const inputArchivo = document.getElementById("archivo-base-datos-local") || document.getElementById("archivo-base-datos");
        let listaArchivos = [];

        // Evaluar buffer en memoria o fallback a FileList
        if (typeof window.obtenerLoteFotosActual === "function" && window.obtenerLoteFotosActual().length > 0) {
            listaArchivos = window.obtenerLoteFotosActual();
        } else if (inputArchivo && inputArchivo.files && inputArchivo.files.length > 0) {
            listaArchivos = Array.from(inputArchivo.files);
        }

        if (listaArchivos.length === 0) {
            notificarResultadoImportacion("ALERTA MENSAJERO", "Seleccione uno o varios archivos para la extracción local.", true);
            return;
        }

        const todasLasParadasNuevas = [];

        if (window.visorAnimaciones && typeof window.visorAnimaciones.mostrarModal === "function") {
            window.visorAnimaciones.mostrarModal("EXTRAYENDO DATOS LOCALMENTE", `Procesando ${listaArchivos.length} archivo(s)...`);
        }

        actualizarEstadoIngestionUI(`>>> EXTRAYENDO DATOS LOCALMENTE (0/${listaArchivos.length})...`, "var(--neon-green, #3eb84a)");

        try {
            for (let i = 0; i < listaArchivos.length; i++) {
                const archivo = listaArchivos[i];

                if (window.visorAnimaciones && typeof window.visorAnimaciones.actualizarProgreso === "function") {
                    window.visorAnimaciones.actualizarProgreso(i + 1, listaArchivos.length, `Analizando: ${archivo.name}`);
                }

                try {
                    const puntosExtraidos = await procesarArchivoTextoCSV(archivo);
                    if (puntosExtraidos && puntosExtraidos.length > 0) {
                        puntosExtraidos.forEach((p) => todasLasParadasNuevas.push(p));
                    }
                } catch (errArchivo) {
                    console.warn(`⚠️ [FILE_FAIL_LOCAL]: Error en "${archivo.name}":`, errArchivo.message || errArchivo);
                }
            }

            if (todasLasParadasNuevas.length === 0) {
                actualizarEstadoIngestionUI(">>> ERROR LOCAL: No se extrajeron datos válidos.", "#ff3366");
                throw new Error("No se lograron extraer datos válidos mediante heurística local.");
            }

            const listaTotal = await fusionarYGuardarParadas(todasLasParadasNuevas);

            actualizarEstadoIngestionUI(`>>> ÉXITO LOCAL: ${listaTotal.length} PARADAS EN HOJA DE RUTA`, "var(--neon-green, #00ff66)");

            if (inputArchivo) inputArchivo.value = "";
            if (typeof window.limpiarLoteFotos === "function") window.limpiarLoteFotos();

            emitirHaptico(50);
            dispararRefrescoUI(listaTotal, callbackRefresco);

            notificarResultadoImportacion("EXTRACCIÓN COMPLETA", `Se agregaron paradas localmente. Total en ruta: ${listaTotal.length}`);

        } catch (error) {
            console.error(">>> [IMPORTADOR_LOCAL_FAIL]:", error);
            notificarResultadoImportacion("ERROR PROCESANDO ARCHIVOS LOCALES", error.message, true);
        } finally {
            if (window.visorAnimaciones && typeof window.visorAnimaciones.ocultarModal === "function") {
                window.visorAnimaciones.ocultarModal();
            }
        }
    }

    /**
     * MODO 1: Procesamiento por Lote con IA Cloud (Gemini / OCR)
     */
    async ejecutarImportacionArchivo(callbackRefresco, forzarIA = true) {
        console.log(">>> [IMPORTADOR_EXEC_IA]: Disparando proceso acumulativo MODO 1 (IA Cloud)...");
        emitirHaptico(30);

        const inputArchivo = document.getElementById("archivo-base-datos") || document.getElementById("archivo-base-datos-local");
        let listaArchivos = [];

        // Prioridad 1: Lote acumulado en memoria
        if (typeof window.obtenerLoteFotosActual === "function" && window.obtenerLoteFotosActual().length > 0) {
            listaArchivos = window.obtenerLoteFotosActual();
            console.log(`📸 [IMPORTADOR_IA]: Obtenido lote acumulado de ${listaArchivos.length} foto(s).`);
        } 
        // Prioridad 2: Archivos seleccionados en el input file
        else if (inputArchivo && inputArchivo.files && inputArchivo.files.length > 0) {
            listaArchivos = Array.from(inputArchivo.files);
        }

        if (listaArchivos.length === 0) {
            notificarResultadoImportacion("ALERTA MENSAJERO", "Seleccione o tome al menos una fotografía de la tirilla.", true);
            return;
        }

        const paradasNuevasLote = [];

        if (window.visorAnimaciones && typeof window.visorAnimaciones.mostrarModal === "function") {
            window.visorAnimaciones.mostrarModal("EXTRAYENDO CON IA CLOUD", `Analizando lote de ${listaArchivos.length} foto(s)...`);
        }

        try {
            for (let i = 0; i < listaArchivos.length; i++) {
                const archivo = listaArchivos[i];

                if (window.visorAnimaciones && typeof window.visorAnimaciones.actualizarProgreso === "function") {
                    window.visorAnimaciones.actualizarProgreso(i, listaArchivos.length, `Analizando tirilla ${i + 1} de ${listaArchivos.length}: ${archivo.name}`);
                }

                try {
                    let puntosExtraidos = [];
                    const esPDF = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
                    const esImagen = archivo.type.startsWith("image/");

                    if (!esPDF && !esImagen && !forzarIA) {
                        puntosExtraidos = await procesarArchivoTextoCSV(archivo);
                    }

                    if (!puntosExtraidos || puntosExtraidos.length === 0) {
                        puntosExtraidos = await procesarImagenConGemini(archivo);
                    }

                    if (Array.isArray(puntosExtraidos) && puntosExtraidos.length > 0) {
                        puntosExtraidos.forEach((p) => paradasNuevasLote.push(p));
                    }
                } catch (errArchivo) {
                    console.error(`❌ Error procesando archivo "${archivo.name}":`, errArchivo);
                }
            }

            if (paradasNuevasLote.length === 0) {
                throw new Error("No se lograron extraer datos válidos de las fotografías seleccionadas.");
            }

            if (window.visorAnimaciones && typeof window.visorAnimaciones.actualizarProgreso === "function") {
                window.visorAnimaciones.actualizarProgreso(listaArchivos.length, listaArchivos.length, "Fusionando paradas en la Hoja de Ruta...");
            }

            const listaTotalActualizada = await fusionarYGuardarParadas(paradasNuevasLote);

            actualizarEstadoIngestionUI(`>>> ÉXITO: ${listaTotalActualizada.length} PARADA(S) EN HOJA DE RUTA`, "var(--neon-green, #00ff66)");

            if (inputArchivo) inputArchivo.value = "";
            if (typeof window.limpiarLoteFotos === "function") window.limpiarLoteFotos();

            emitirHaptico([40, 30, 40]);
            dispararRefrescoUI(listaTotalActualizada, callbackRefresco);

            notificarResultadoImportacion("PROCESO DE IA COMPLETADO", `Se extrajeron ${paradasNuevasLote.length} datos. Total en ruta: ${listaTotalActualizada.length}`);

        } catch (error) {
            console.error(">>> [IMPORTADOR_FAIL]: Error en importación acumulativa:", error);
            actualizarEstadoIngestionUI(`>>> ERROR: ${error.message}`, "#ff3366");
            notificarResultadoImportacion("ERROR AGREGANDO PARADAS", error.message, true);
        } finally {
            if (window.visorAnimaciones && typeof window.visorAnimaciones.ocultarModal === "function") {
                window.visorAnimaciones.ocultarModal();
            }
        }
    }
}

// BINDINGS AL OBJETO GLOBAL WINDOW
const importadorMensajero = new ImportadorMasivoMensajero();

if (typeof window !== "undefined") {
    console.log(">>> [IMPORTER_BINDINGS]: Exponiendo funciones del importador acumulativo al objeto window global.");
    window.cargarRutaDesdeTextoOEnlace = cargarRutaDesdeTextoOEnlace;
    window.parsearTextoPlanoWhatsApp = parsearTextoPlanoWhatsApp;
    window.parsearPayloadODocumento = parsearPayloadODocumento;
    window.ImportadorMasivoMensajero = importadorMensajero;
    window.ejecutarProcesamientoIaCloud = (cb) => importadorMensajero.ejecutarImportacionArchivo(cb, true);
    window.ejecutarProcesamientoLocalSinIa = (cb) => importadorMensajero.ejecutarImportacionArchivoLocal(cb);
}