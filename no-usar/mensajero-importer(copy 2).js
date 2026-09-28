/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: IMPORTADOR Y PARSER MULTI-FORMATO (TIRILLAS ACUMULATIVO)
 * Ubicación: pwa-mensajero/modulos/mensajero-importer.js
 * Arquitectura: Local-First Acumulativo con Deduplicación por SSC y Fallback IA Cloud
 */

import { 
    guardarRutaZonificada, 
    obtenerParadasGuardadas 
} from "./mensajero-persistencia.js";
import { procesarArchivoTextoCSV } from "./base-de-datos.js";
import { procesarImagenConGemini } from "./procesamiento-datos/ia-gemini.js";
import { procesarTextoHeuristico } from "./procesamiento-datos/heuristico.js";

/**
 * Normaliza y valida la estructura de cada parada asegurando los campos clave de la tirilla médica.
 *
 * @param {Object} p - Objeto crudo de la parada.
 * @param {number} idx - Índice de la parada en la secuencia.
 * @returns {Object} Parada estructurada y normalizada.
 */
function normalizarParadaTirilla(p, idx) {
    console.log(`>>> [NORMALIZADOR_EVAL]: Evaluando objeto crudo en índice [${idx}]...`, p);

    const paradaNormalizada = {
        id: p.id || `#PNT-${Math.floor(1000 + Math.random() * 9000)}`,
        ssc: p.ssc || p.ssc_no || "N/A",
        destinatario: p.destinatario || p.nombre || p.afiliado || `Cliente ${idx + 1}`,
        direccion: p.direccion || p.direccion_entrega || "Dirección no especificada",
        telefono: p.telefono || "3000000000",
        puntoOrigen: p.puntoOrigen || p.punto_origen || "Cafam Cali Tequendama",
        cuotaModeradora: p.cuotaModeradora || p.cuota_moderadora || "$0",
        carga: p.carga || "Medicamentos Dispensación",
        estado: p.estado || "ASIGNADO",
        lat: p.lat ? parseFloat(p.lat) : null,
        lng: p.lng ? parseFloat(p.lng) : null,
        zonaKey: p.zonaKey || p.zona || null,
        nombreZona: p.nombreZona || null,
        colorZona: p.colorZona || null,
        registroOperaciones: p.registroOperaciones || {}
    };

    console.log(
        `>>> [NORMALIZADOR_TIRILLA]: Parada adaptada -> SSC: ${paradaNormalizada.ssc} | Cliente: ${paradaNormalizada.destinatario}`
    );
    return paradaNormalizada;
}

/**
 * Fusiona las nuevas paradas procesadas con las paradas ya existentes en la base local.
 * Deduplica por el campo SSC (si no es 'N/A' ni 'S/N') para evitar sobreescritura accidental.
 *
 * @param {Array<Object>} nuevasParadasRaw - Paradas recién extraídas de la foto o texto.
 * @returns {Promise<Array<Object>>} Lista total acumulada y unificada.
 */
async function fusionarYGuardarParadas(nuevasParadasRaw) {
    console.log(">>> [IMPORTER_MERGE]: Leyendo paradas existentes en almacenamiento local...");
    const paradasExistentes = (await obtenerParadasGuardadas()) || [];
    
    const nuevasNormalizadas = nuevasParadasRaw.map((p, idx) => 
        normalizarParadaTirilla(p, paradasExistentes.length + idx)
    );

    const listaFusionada = [...paradasExistentes];

    nuevasNormalizadas.forEach(nueva => {
        const existeIndice = listaFusionada.findIndex(p => 
            p.ssc !== "N/A" && 
            p.ssc !== "S/N" && 
            p.ssc.toString().trim() === nueva.ssc.toString().trim()
        );

        if (existeIndice !== -1) {
            console.log(`🔄 [IMPORTER_MERGE_UPDATE]: Actualizando parada existente SSC: ${nueva.ssc}`);
            listaFusionada[existeIndice] = { ...listaFusionada[existeIndice], ...nueva };
        } else {
            console.log(`➕ [IMPORTER_MERGE_ADD]: Agregando nueva parada acumulada SSC: ${nueva.ssc}`);
            listaFusionada.push(nueva);
        }
    });

    console.log(`>>> [IMPORTER_PERSIST]: Guardando un total de ${listaFusionada.length} parada(s) acumuladas en IndexedDB/LocalState.`);
    await guardarRutaZonificada(listaFusionada);
    return listaFusionada;
}

/**
 * Invoca el refresco dinámico de la interfaz en cascada.
 */
function dispararRefrescoUI(listaParadasActualizada, callbackRefresco) {
    if (typeof callbackRefresco === "function") {
        callbackRefresco(listaParadasActualizada);
    } else if (typeof window.refrescarConsolaOperaciones === "function") {
        window.refrescarConsolaOperaciones();
    } else if (typeof window.refrescarUI === "function") {
        window.refrescarUI();
    } else if (typeof window.renderizarConsolaOperaciones === "function") {
        window.renderizarConsolaOperaciones(listaParadasActualizada, 0, 0);
    }
}

/**
 * Parsea un texto plano estructurado (proveniente de WhatsApp, chat o base de datos).
 */
export function parsearTextoPlanoWhatsApp(texto) {
    console.log(">>> [IMPORTER_PARSE_TEXTO]: Invocando análisis sobre texto plano...");
    if (!texto || typeof texto !== "string") {
        console.warn(">>> [PARSER_LOCAL_WARN]: Texto nulo o inválido recibido en parsearTextoPlanoWhatsApp.");
        return [];
    }

    if (texto.includes("%PDF-") || texto.includes("/Root") || texto.includes("endobj")) {
        console.warn(">>> [PARSER_LOCAL_ABORT]: Se detectó código binario PDF en la lectura de texto plano. Abortando.");
        return [];
    }

    const textoLimpio = texto.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, "");
    const lineas = textoLimpio.split(/\r?\n/);

    let currentSsc = "";
    let currentNombre = "";
    let currentDireccion = "";
    let currentTelefono = "";
    let currentOrigen = "";
    let currentCuota = "";

    const regexTelBase = /(?:(?:\+|00)57)?\s*3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/;

    lineas.forEach((linea) => {
        let l = linea.trim();
        if (!l || l.startsWith("🚚") || l.startsWith("%") || l.startsWith("#")) return;

        const matchSsc = l.match(/SSC(?:\s*No\.?)?:?\s*(\d+)/i);
        if (matchSsc) currentSsc = matchSsc[1];

        const matchNombre = l.match(/(?:Afiliado|Nombre Cliente|Usuario):?\s*([A-Za-z\s]+)/i);
        if (matchNombre) currentNombre = matchNombre[1].trim();

        const matchDireccion = l.match(/(?:Direccion Entrega|Direccion):?\s*([^TEL]+)/i);
        if (matchDireccion) currentDireccion = matchDireccion[1].trim();

        const matchTel = l.match(regexTelBase);
        if (matchTel && matchTel[0]) currentTelefono = matchTel[0].replace(/[\s-]/g, "").trim();

        const matchOrigen = l.match(/(?:Punto Origen|Punto Disp\.?):?\s*([^,]+)/i);
        if (matchOrigen) currentOrigen = matchOrigen[1].trim();

        const matchCuota = l.match(/(?:Cuota Moderadora|CUOTA_M\.?|Copago):?\s*(\$?\s*[\d\.]+)/i);
        if (matchCuota) currentCuota = matchCuota[1];
    });

    const paradas = [];
    if (currentDireccion || currentNombre || currentTelefono) {
        paradas.push({
            ssc: currentSsc || "103458",
            destinatario: currentNombre || "Cliente General",
            direccion: currentDireccion || "Dirección no especificada",
            telefono: currentTelefono || "3000000000",
            puntoOrigen: currentOrigen || "Cafam Cali Tequendama",
            cuotaModeradora: currentCuota || "$0"
        });
    }

    return paradas.length > 0 ? paradas : procesarTextoHeuristico(textoLimpio);
}

/**
 * Procesa una entrada de texto (cadena JSON, URL con payload o texto de WhatsApp).
 */
export function parsearPayloadODocumento(entrada) {
    if (!entrada || !entrada.trim()) return [];
    const entradaLimpia = entrada.trim();
    let listaParadas = [];

    try {
        const matchPayload = entradaLimpia.match(/(?:payload=)([^&\s]+)/);
        if (matchPayload && matchPayload[1]) {
            listaParadas = JSON.parse(decodeURIComponent(matchPayload[1]));
        } else if (entradaLimpia.startsWith("[") || entradaLimpia.startsWith("{")) {
            listaParadas = JSON.parse(entradaLimpia);
        } else {
            listaParadas = parsearTextoPlanoWhatsApp(entradaLimpia);
        }

        if (!Array.isArray(listaParadas)) listaParadas = [listaParadas];
        return listaParadas;
    } catch (err) {
        return parsearTextoPlanoWhatsApp(entradaLimpia);
    }
}

/**
 * Carga e importa paradas a la persistencia local de la PWA desde una URL o cadena de texto de forma acumulativa.
 */
export async function cargarRutaDesdeTextoOEnlace(textoEntrada, callbackRefresco) {
    if (!textoEntrada || !textoEntrada.trim()) {
        alert(">>> ALERTA MENSAJERO: Ingrese un enlace válido o texto de payload.");
        return false;
    }

    try {
        const listaParadas = parsearPayloadODocumento(textoEntrada);
        if (!listaParadas || listaParadas.length === 0) {
            throw new Error("No se detectaron paradas o direcciones procesables.");
        }

        const paradasAcumuladas = await fusionarYGuardarParadas(listaParadas);

        alert(
            `>>> RUTA ACTUALIZADA EXITOSAMENTE:\n\nTotal de paradas en Hoja de Ruta: ${paradasAcumuladas.length}`
        );

        dispararRefrescoUI(paradasAcumuladas, callbackRefresco);
        return true;
    } catch (error) {
        alert(`>>> ERROR DE IMPORTACIÓN:\n\n${error.message}`);
        return false;
    }
}

/**
 * CLASE ORQUESTADORA DE IMPORTACIÓN MASIVA
 * Administra la ingestión de MODO 1 (IA Cloud) y MODO 3 (Archivos Locales sin IA) en formato acumulativo.
 */
export class ImportadorMasivoMensajero {
    constructor() {
        console.log(">>> [IMPORTADOR_MENSAJERO_INIT]: Instanciando subsistema de ingestión masiva Acumulativa...");
        this.regexTelefonoBase = /(?:\+?57)?\s*3\d{9}\b/;
    }

    vincularEscuchas() {
        const btnProcesarIA = document.getElementById("btn-procesar-archivo-masivo");
        if (btnProcesarIA) {
            console.log(">>> [IMPORTADOR_LISTENERS]: Botón #btn-procesar-archivo-masivo (IA Cloud) enlazado correctamente.");
            btnProcesarIA.removeEventListener("click", this._onProcesarIAClick);
            this._onProcesarIAClick = () => this.ejecutarImportacionArchivo(null, true);
            btnProcesarIA.addEventListener("click", this._onProcesarIAClick);
        }

        const btnProcesarLocal = document.getElementById("btn-procesar-archivo-masivo-local");
        if (btnProcesarLocal) {
            console.log(">>> [IMPORTADOR_LISTENERS]: Botón #btn-procesar-archivo-masivo-local (Sin IA) enlazado correctamente.");
            btnProcesarLocal.removeEventListener("click", this._onProcesarLocalClick);
            this._onProcesarLocalClick = () => this.ejecutarImportacionArchivoLocal();
            btnProcesarLocal.addEventListener("click", this._onProcesarLocalClick);
        }
    }

    /**
     * MODO 3: Procesa múltiples archivos TXT, CSV, PDF o Excel de forma local sin IA (Acumulativo).
     */
    async ejecutarImportacionArchivoLocal(callbackRefresco) {
        console.log(">>> [IMPORTADOR_EXEC_LOCAL]: Disparando extracción local MODO 3 Acumulativa...");
        const inputArchivo =
            document.getElementById("archivo-base-datos-local") || document.getElementById("archivo-base-datos");
        const lblEstado = document.getElementById("txt-estado-ingestion");

        if (!inputArchivo || !inputArchivo.files || inputArchivo.files.length === 0) {
            alert(">>> ALERTA MENSAJERO: Seleccione uno o varios archivos para la extracción local.");
            return;
        }

        const listaArchivos = Array.from(inputArchivo.files);
        const todasLasParadasNuevas = [];

        if (lblEstado) {
            lblEstado.innerText = `>>> EXTRAYENDO DATOS LOCALMENTE (0/${listaArchivos.length})...`;
            lblEstado.style.color = "var(--neon-green, #3eb84a)";
        }

        for (let i = 0; i < listaArchivos.length; i++) {
            const archivo = listaArchivos[i];
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
            if (lblEstado) {
                lblEstado.innerText = `>>> ERROR LOCAL: No se extrajeron datos válidos.`;
                lblEstado.style.color = "#ff3366";
            }
            alert(">>> ERROR PROCESANDO ARCHIVOS LOCALES:\n\nNo se lograron extraer datos válidos mediante heurística local.");
            return;
        }

        // Fusionar paradas nuevas con las existentes en IndexedDB
        const listaTotal = await fusionarYGuardarParadas(todasLasParadasNuevas);

        if (lblEstado) {
            lblEstado.innerText = `>>> ÉXITO LOCAL: ${listaTotal.length} PARADAS EN HOJA DE RUTA`;
            lblEstado.style.color = "var(--neon-green, #00ff66)";
        }

        inputArchivo.value = ""; // Limpiar input para permitir capturas subsecuentes

        dispararRefrescoUI(listaTotal, callbackRefresco);
    }

    /**
     * MODO 1: Procesa fotografías o documentos mediante la API de Gemini Cloud sin borrar las paradas previas.
     */
    async ejecutarImportacionArchivo(callbackRefresco, forzarIA = false) {
        console.log(">>> [IMPORTADOR_EXEC_IA]: Disparando proceso acumulativo MODO 1 (IA Cloud)...");
        const inputArchivo =
            document.getElementById("archivo-base-datos") || document.getElementById("archivo-base-datos-local");
        const lblEstado = document.getElementById("txt-estado-ingestion");

        if (!inputArchivo || !inputArchivo.files || inputArchivo.files.length === 0) {
            alert(">>> ALERTA MENSAJERO: Seleccione o tome la fotografía de la tirilla.");
            return;
        }

        const listaArchivos = Array.from(inputArchivo.files);
        const paradasNuevasLote = [];

        if (window.visorAnimaciones && typeof window.visorAnimaciones.mostrarModal === "function") {
            window.visorAnimaciones.mostrarModal("EXTRAYENDO CON IA CLOUD", `Analizando ${listaArchivos.length} foto(s)...`);
        }

        try {
            for (let i = 0; i < listaArchivos.length; i++) {
                const archivo = listaArchivos[i];
                console.log(`📄 [IMPORTADOR_FILE ${i + 1}/${listaArchivos.length}]: ${archivo.name}`);

                if (window.visorAnimaciones && typeof window.visorAnimaciones.actualizarProgreso === "function") {
                    window.visorAnimaciones.actualizarProgreso(i, listaArchivos.length, `Analizando: ${archivo.name}`);
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
                    console.error(`❌ Error en archivo "${archivo.name}":`, errArchivo);
                }
            }

            if (paradasNuevasLote.length === 0) {
                throw new Error("No se lograron extraer datos válidos de las fotografías seleccionadas.");
            }

            // Fusión acumulativa con las paradas existentes de la foto 1
            const listaTotalActualizada = await fusionarYGuardarParadas(paradasNuevasLote);

            if (lblEstado) {
                lblEstado.innerText = `>>> ÉXITO: ${listaTotalActualizada.length} PARADA(S) EN HOJA DE RUTA`;
                lblEstado.style.color = "var(--neon-green, #00ff66)";
            }

            inputArchivo.value = ""; // Limpiar input para permitir tomar otra foto consecutiva

            dispararRefrescoUI(listaTotalActualizada, callbackRefresco);

        } catch (error) {
            console.error(">>> [IMPORTADOR_FAIL]: Error en importación acumulativa:", error);
            if (lblEstado) {
                lblEstado.innerText = `>>> ERROR: ${error.message}`;
                lblEstado.style.color = "#ff3366";
            }
            alert(`>>> ERROR AGREGANDO PARADA:\n\n${error.message}`);
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
    window.ejecutarProcesamientoIaCloud = () => importadorMensajero.ejecutarImportacionArchivo();
    window.ejecutarProcesamientoLocalSinIa = () => importadorMensajero.ejecutarImportacionArchivoLocal();
}