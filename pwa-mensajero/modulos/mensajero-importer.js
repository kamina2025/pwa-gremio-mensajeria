/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: IMPORTADOR Y PARSER MULTI-FORMATO (TIRILLAS)
 * Ubicación: pwa-mensajero/modulos/mensajero-importer.js
 * Arquitectura: Local-First con Parsing Sanitizado, Telemetría Avanzada y Fallback IA Cloud
 */

import { guardarRutaZonificada } from "./mensajero-persistencia.js";
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
        registroOperaciones: p.registroOperaciones || {}
    };

    console.log(`>>> [NORMALIZADOR_TIRILLA]: Parada #${idx + 1} adaptada -> SSC: ${paradaNormalizada.ssc} | Cliente: ${paradaNormalizada.destinatario} | Cuota: ${paradaNormalizada.cuotaModeradora}`);
    return paradaNormalizada;
}

/**
 * Parsea un texto plano estructurado (proveniente de WhatsApp, chat o base de datos)
 * delegando el análisis al motor heurístico local e imprimiendo telemetría detallada.
 * 
 * @param {string} texto - Texto plano recibido.
 * @returns {Array<Object>} Lista de paradas normalizadas.
 */
export function parsearTextoPlanoWhatsApp(texto) {
    console.log(">>> [IMPORTER_PARSE_TEXTO]: Invocando análisis sobre texto plano...");
    if (!texto || typeof texto !== "string") {
        console.warn(">>> [PARSER_LOCAL_WARN]: Texto nulo o inválido recibido en parsearTextoPlanoWhatsApp.");
        return [];
    }

    // Filtro de seguridad: Rechazar si contiene firmas binarias de PDF
    if (texto.includes("%PDF-") || texto.includes("/Root") || texto.includes("endobj")) {
        console.warn(">>> [PARSER_LOCAL_ABORT]: Se detectó código binario PDF en la lectura de texto plano. Abortando.");
        return [];
    }

    // Sanitización ASCII: Eliminar caracteres especiales de control no imprimibles
    const textoLimpio = texto.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, "");
    const lineas = textoLimpio.split(/\r?\n/);
    console.log(`>>> [PARSER_METRICS]: Total de líneas detectadas para análisis heurístico -> ${lineas.length}`);

    let currentSsc = "";
    let currentNombre = "";
    let currentDireccion = "";
    let currentTelefono = "";
    let currentOrigen = "";
    let currentCuota = "";

    const regexTelBase = /(?:(?:\+|00)57)?\s*3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/;

    lineas.forEach((linea, index) => {
        let l = linea.trim();
        if (!l || l.startsWith("🚚") || l.startsWith("%") || l.startsWith("#")) {
            console.log(` -> [HEURISTICO_SKIP]: Línea ${index + 1} ignorada por filtro: "${l}"`);
            return;
        }

        console.log(` -> [HEURISTICO_EVAL_LINEA_${index + 1}]: "${l}"`);

        // Captura Heurística de Campos Específicos
        const matchSsc = l.match(/SSC(?:\s*No\.?)?:?\s*(\d+)/i);
        if (matchSsc) {
            currentSsc = matchSsc[1];
            console.log(`    [MATCH_SSC]: Capturado -> ${currentSsc}`);
        }

        const matchNombre = l.match(/(?:Afiliado|Nombre Cliente|Usuario):?\s*([A-Za-z\s]+)/i);
        if (matchNombre) {
            currentNombre = matchNombre[1].trim();
            console.log(`    [MATCH_NOMBRE]: Capturado -> ${currentNombre}`);
        }

        const matchDireccion = l.match(/(?:Direccion Entrega|Direccion):?\s*([^TEL]+)/i);
        if (matchDireccion) {
            currentDireccion = matchDireccion[1].trim();
            console.log(`    [MATCH_DIRECCION]: Capturado -> ${currentDireccion}`);
        }

        const matchTel = l.match(regexTelBase);
        if (matchTel && matchTel[0]) {
            currentTelefono = matchTel[0].replace(/[\s-]/g, "").trim();
            console.log(`    [MATCH_TEL]: Capturado -> ${currentTelefono}`);
        }

        const matchOrigen = l.match(/(?:Punto Origen|Punto Disp\.?):?\s*([^,]+)/i);
        if (matchOrigen) {
            currentOrigen = matchOrigen[1].trim();
            console.log(`    [MATCH_ORIGEN]: Capturado -> ${currentOrigen}`);
        }

        const matchCuota = l.match(/(?:Cuota Moderadora|CUOTA_M\.?|Copago):?\s*(\$?\s*[\d\.]+)/i);
        if (matchCuota) {
            currentCuota = matchCuota[1];
            console.log(`    [MATCH_CUOTA]: Capturado -> ${currentCuota}`);
        }
    });

    // Fallback de tokenización si no vienen etiquetas formales
    if (!currentDireccion && !currentNombre) {
        console.warn(">>> [HEURISTICO_FALLBACK]: No se hallaron etiquetas estándar. Iniciando tokenización por posición...");
        lineas.forEach((linea, index) => {
            let l = linea.trim();
            if (!l || /^(nombre|direccion|telefono|alias)/i.test(l)) return;

            let tel = "";
            const matchTel = l.match(regexTelBase);
            if (matchTel && matchTel[0]) {
                tel = matchTel[0].replace(/[\s-]/g, "").trim();
                l = l.replace(matchTel[0], "").trim();
            }

            let sinTel = l.replace(/^[•\-\*📍\s\d+\.]+\s*/, "").trim();
            if (!sinTel || /^\d+$/.test(sinTel)) return;

            const partes = sinTel.split(/(?:[,;\t\-]+|\s{2,})/).map(p => p.trim()).filter(Boolean);

            if (partes.length >= 2) {
                currentNombre = partes[0];
                currentDireccion = partes.slice(1).join(" ");
            } else {
                currentDireccion = sinTel;
            }
            if (tel) currentTelefono = tel;
            console.log(`    [FALLBACK_TOKEN]: Procesada línea ${index + 1} -> Cliente: ${currentNombre}, Dir: ${currentDireccion}`);
        });
    }

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
        console.log(`>>> [HEURISTICO_SUCCESS]: Parada estructurada generada con éxito ->`, paradas[0]);
    } else {
        console.warn(">>> [HEURISTICO_EMPTY]: No se pudo extraer ningún campo válido en este bloque de texto.");
    }

    console.log(`>>> [IMPORTER_PARSE_END]: Total de paradas procesadas: ${paradas.length}`);
    return paradas.length > 0 ? paradas : procesarTextoHeuristico(textoLimpio);
}

/**
 * Procesa una entrada de texto (cadena JSON, URL con payload o texto de WhatsApp)
 * y devuelve un arreglo de paradas estructuradas[cite: 2, 4].
 * 
 * @param {string} entrada - Cadena de entrada bruta.
 * @returns {Array<Object>} Arreglo de datos de paradas.
 */
export function parsearPayloadODocumento(entrada) {
    console.log(">>> [IMPORTER_PAYLOAD_EVAL]: Evaluando tipo de entrada para parsing de datos...");
    if (!entrada || !entrada.trim()) {
        console.warn(">>> [IMPORTER_PAYLOAD_EMPTY]: Se recibió una entrada vacía en el parser.");
        return [];
    }
    
    const entradaLimpia = entrada.trim();
    let listaParadas = [];

    try {
        const matchPayload = entradaLimpia.match(/(?:payload=)([^&\s]+)/);

        if (matchPayload && matchPayload[1]) {
            console.log(">>> [IMPORTER_PAYLOAD_URL]: Parámetro 'payload=' detectado en la cadena. Deserializando URI...");
            const rawDecoded = decodeURIComponent(matchPayload[1]);
            listaParadas = JSON.parse(rawDecoded);
        } else if (entradaLimpia.startsWith("[") || entradaLimpia.startsWith("{")) {
            console.log(">>> [IMPORTER_PAYLOAD_JSON]: Estructura JSON detectada. Decodificando objeto directamente...");
            listaParadas = JSON.parse(entradaLimpia);
        } else {
            console.log(">>> [IMPORTER_PAYLOAD_PLAIN]: Entrada identificada como texto plano. Aplicando heurística local...");
            listaParadas = parsearTextoPlanoWhatsApp(entradaLimpia);
        }

        if (!Array.isArray(listaParadas)) {
            listaParadas = [listaParadas];
        }

        console.log(`>>> [IMPORTER_PAYLOAD_SUCCESS]: ${listaParadas.length} elemento(s) extraído(s) exitosamente.`);
        return listaParadas;
    } catch (err) {
        console.warn(">>> [IMPORTER_PAYLOAD_FAIL]: Falló el parsing estructurado JSON/URL. Reintentando análisis heurístico plano:", err);
        return parsearTextoPlanoWhatsApp(entradaLimpia);
    }
}

/**
 * Carga e importa paradas a la persistencia local de la PWA desde una URL o cadena de texto[cite: 2, 4].
 * 
 * @param {string} textoEntrada - Texto o enlace a procesar.
 * @param {Function} [callbackRefresco] - Función de refresco opcional para la UI.
 * @returns {boolean} Estado de la operación.
 */
export function cargarRutaDesdeTextoOEnlace(textoEntrada, callbackRefresco) {
    console.log(">>> [IMPORTER_CARGAR_RUTA]: Solicitando carga de ruta desde enlace o payload de texto...");
    if (!textoEntrada || !textoEntrada.trim()) {
        console.warn(">>> [IMPORTER_CARGAR_RUTA_WARN]: Intento de carga cancelado por entrada vacía.");
        alert(">>> ALERTA MENSAJERO: Ingrese un enlace válido o texto de payload.");
        return false;
    }

    try {
        const listaParadas = parsearPayloadODocumento(textoEntrada);

        if (!listaParadas || listaParadas.length === 0) {
            throw new Error("No se detectaron paradas o direcciones procesables en el contenido proporcionado.");
        }

        const paradasProcesadas = listaParadas.map((p, idx) => normalizarParadaTirilla(p, idx));

        console.log(">>> [IMPORTER_PERSIST]: Guardando ruta zonificada en la persistencia local...");
        guardarRutaZonificada(paradasProcesadas);

        alert(`>>> RUTA CARGADA EXITOSAMENTE:\n\nSe importó la entrega para: ${paradasProcesadas[0].destinatario}\nSSC: ${paradasProcesadas[0].ssc}`);
        
        if (typeof callbackRefresco === "function") {
            console.log(">>> [IMPORTER_CALLBACK]: Ejecutando callback de refresco de interfaz...");
            callbackRefresco(paradasProcesadas);
        }

        return true;

    } catch (error) {
        console.error(">>> [CARGA_RUTA_FAIL]: Error al importar la ruta:", error);
        alert(`>>> ERROR DE IMPORTACIÓN:\n\n${error.message}`);
        return false;
    }
}

/**
 * CLASE ORQUESTADORA DE IMPORTACIÓN MASIVA
 * Administra la ingestión de MODO 1 (IA Cloud) y MODO 3 (Archivos Locales sin IA)[cite: 4].
 */
export class ImportadorMasivoMensajero {
    constructor() {
        console.log(">>> [IMPORTADOR_MENSAJERO_INIT]: Instanciando subsistema de ingestión masiva Local-First...");
        this.regexTelefonoBase = /(?:\+?57)?\s*3\d{9}\b/;
    }

    /**
     * Vincula los escuchadores de eventos para los botones de carga de MODO 1 y MODO 3[cite: 2, 4].
     */
    vincularEscuchas() {
        // MODO 1: Extracción Multimodal con IA Cloud (Gemini API)[cite: 2, 4]
        const btnProcesarIA = document.getElementById("btn-procesar-archivo-masivo");
        if (btnProcesarIA) {
            console.log(">>> [IMPORTADOR_LISTENERS]: Botón #btn-procesar-archivo-masivo (IA Cloud) enlazado correctamente.");
            btnProcesarIA.removeEventListener("click", this._onProcesarIAClick);
            this._onProcesarIAClick = () => this.ejecutarImportacionArchivo(null, true);
            btnProcesarIA.addEventListener("click", this._onProcesarIAClick);
        } else {
            console.warn(">>> [IMPORTADOR_WARN]: No se encontró el botón #btn-procesar-archivo-masivo en el DOM.");
        }

        // MODO 3: Extracción Local Heurística sin IA[cite: 2, 4]
        const btnProcesarLocal = document.getElementById("btn-procesar-archivo-masivo-local");
        if (btnProcesarLocal) {
            console.log(">>> [IMPORTADOR_LISTENERS]: Botón #btn-procesar-archivo-masivo-local (Sin IA) enlazado correctamente.");
            btnProcesarLocal.removeEventListener("click", this._onProcesarLocalClick);
            this._onProcesarLocalClick = () => this.ejecutarImportacionArchivoLocal();
            btnProcesarLocal.addEventListener("click", this._onProcesarLocalClick);
        } else {
            console.warn(">>> [IMPORTADOR_WARN]: No se encontró el botón #btn-procesar-archivo-masivo-local en el DOM.");
        }
    }

    /**
     * MODO 3: Procesa archivos TXT, CSV, PDF o Excel de forma local sin invocar endpoints de la Nube[cite: 2, 4].
     */
    async ejecutarImportacionArchivoLocal(callbackRefresco) {
        console.log(">>> [IMPORTADOR_EXEC_LOCAL]: Disparando extracción local MODO 3 (Sin IA)...");
        const inputArchivo = document.getElementById("archivo-base-datos-local");
        const lblEstado = document.getElementById("txt-estado-ingestion");

        if (!inputArchivo || !inputArchivo.files || inputArchivo.files.length === 0) {
            console.warn(">>> [IMPORTADOR_FILE_WARN]: No se seleccionó ningún archivo local para MODO 3.");
            alert(">>> ALERTA MENSAJERO: Seleccione un archivo TXT, CSV, PDF o Excel para la extracción local.");
            return;
        }

        const archivo = inputArchivo.files[0];
        console.log(`>>> [IMPORTADOR_FILE_INFO]: Archivo detectado -> Nombre: "${archivo.name}", Tipo: "${archivo.type}", Tamaño: ${archivo.size || 0} bytes`);

        if (lblEstado) {
            lblEstado.innerText = ">>> EXTRAYENDO DATOS LOCALMENTE (MODO 3)...";
            lblEstado.style.color = "var(--neon-green, #3eb84a)";
        }

        try {
            const puntosExtraidos = await procesarArchivoTextoCSV(archivo);
            console.log(">>> [IMPORTADOR_RESULT_LOCAL]: Registros extraídos localmente sin IA:", puntosExtraidos);

            if (!puntosExtraidos || puntosExtraidos.length === 0) {
                throw new Error("No se lograron extraer datos válidos mediante la heurística local.");
            }

            const paradasProcesadas = puntosExtraidos.map((p, idx) => normalizarParadaTirilla(p, idx));

            console.log(">>> [IMPORTADOR_PERSIST]: Guardando tirillas locales en la persistencia zonificada...");
            guardarRutaZonificada(paradasProcesadas);

            if (lblEstado) {
                lblEstado.innerText = `>>> ÉXITO LOCAL: ${paradasProcesadas.length} REGISTRO(S) EXTRAÍDO(S)`;
                lblEstado.style.color = "var(--neon-green, #00ff66)";
            }

            alert(`>>> EXTRACCIÓN LOCAL EXITOSA:\n\nSe importaron ${paradasProcesadas.length} paradas sin uso de IA Cloud.`);

            if (typeof callbackRefresco === "function") {
                callbackRefresco(paradasProcesadas);
            } else if (typeof window.refrescarConsolaOperacionesUI === "function") {
                window.refrescarConsolaOperacionesUI();
            }

        } catch (error) {
            console.error(">>> [IMPORTADOR_FAIL_LOCAL]: Error en extracción local MODO 3:", error);
            if (lblEstado) {
                lblEstado.innerText = `>>> ERROR LOCAL: ${error.message}`;
                lblEstado.style.color = "#ff3366";
            }
            alert(`>>> ERROR PROCESANDO ARCHIVO LOCAL:\n\n${error.message}`);
        }
    }

    /**
     * MODO 1: Procesa fotografías o documentos mediante la API de Gemini Cloud[cite: 2, 4].
     */
    async ejecutarImportacionArchivo(callbackRefresco, forzarIA = false) {
        console.log(">>> [IMPORTADOR_EXEC_IA]: Disparando proceso MODO 1 (IA Cloud / Híbrido)...");
        const inputArchivo = document.getElementById("archivo-base-datos");
        const lblEstado = document.getElementById("txt-estado-ingestion");

        if (!inputArchivo || !inputArchivo.files || inputArchivo.files.length === 0) {
            console.warn(">>> [IMPORTADOR_FILE_WARN]: No se seleccionó ningún archivo de origen.");
            alert(">>> ALERTA MENSAJERO: Seleccione la fotografía, PDF o archivo de la tirilla médica.");
            return;
        }

        const archivo = inputArchivo.files[0];
        console.log(`>>> [IMPORTADOR_FILE_INFO]: Archivo detectado -> Nombre: "${archivo.name}", Tipo: "${archivo.type}", Tamaño: ${archivo.size || 0} bytes`);

        if (lblEstado) {
            lblEstado.innerText = ">>> EVALUANDO ESTRUCTURA DE ARCHIVO...";
            lblEstado.style.color = "var(--neon-amber, #ffaa00)";
        }

        try {
            let puntosExtraidos = [];
            const esPDF = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
            const esImagen = archivo.type.startsWith("image/");

            // Evaluación defensiva previa en texto/CSV local si no se fuerza la IA Cloud[cite: 2, 4]
            if (!esPDF && !esImagen && !forzarIA) {
                console.log(">>> [HEURISTICA_LOCAL_INIT]: Archivo de texto plano/CSV detectado en Modo 1. Procesando localmente...");
                puntosExtraidos = await procesarArchivoTextoCSV(archivo);
            } else {
                console.log(">>> [IMPORTADOR_BRANCH]: Archivo binario (PDF/Fotografía) detectado. Preparando derivación a IA Cloud[cite: 1, 2].");
            }

            // Invocación a Gemini Cloud si es imagen/PDF o si el parser previo arrojó vacío[cite: 2, 4]
            if (!puntosExtraidos || puntosExtraidos.length === 0) {
                console.log(">>> [IMPORTADOR_IA_REQ]: Requiere análisis mediante la API de Gemini Cloud[cite: 1].");

                if (lblEstado) {
                    lblEstado.innerText = ">>> EVALUANDO TIRILLA CON IA CLOUD (GEMINI)...";
                    lblEstado.style.color = "var(--neon-purple, #b359ff)";
                }

                if (window.visorAnimaciones && typeof window.visorAnimaciones.mostrarAnimacionProcesamientoIA === "function") {
                    console.log(">>> [IMPORTADOR_ANIM]: Activando visor modal de procesamiento con IA...");
                    window.visorAnimaciones.mostrarAnimacionProcesamientoIA(archivo.name || archivo.type);
                }

                try {
                    puntosExtraidos = await procesarImagenConGemini(archivo);
                    console.log(">>> [CLOUD_IA_SUCCESS]: Puntos extraídos mediante Gemini Cloud:", puntosExtraidos);
                } catch (cloudErr) {
                    console.error(">>> [CLOUD_IA_FAIL]: Error al procesar la tirilla con Gemini Cloud:", cloudErr);
                    throw new Error(`Fallo en extracción Cloud: ${cloudErr.message}`);
                } finally {
                    if (window.visorAnimaciones && typeof window.visorAnimaciones.ocultarModal === "function") {
                        window.visorAnimaciones.ocultarModal();
                    }
                }
            } else {
                console.log(`>>> [HEURISTICA_LOCAL_SUCCESS]: ${puntosExtraidos.length} registro(s) procesado(s) sin requerir IA Cloud.`);
            }

            if (!puntosExtraidos || puntosExtraidos.length === 0) {
                throw new Error("No se lograron extraer los 6 datos clave de la tirilla o documento.");
            }

            const paradasProcesadas = puntosExtraidos.map((p, idx) => normalizarParadaTirilla(p, idx));

            console.log(">>> [IMPORTADOR_PERSIST]: Guardando tirillas procesadas en almacenamiento zonificado...");
            guardarRutaZonificada(paradasProcesadas);

            if (lblEstado) {
                lblEstado.innerText = `>>> ÉXITO: ${paradasProcesadas.length} TIRILLA(S) LEÍDA(S)`;
                lblEstado.style.color = "var(--neon-green, #00ff66)";
            }

            alert(`>>> TIRILLA PROCESADA EXITOSAMENTE:\n\nSSC: ${paradasProcesadas[0].ssc}\nCliente: ${paradasProcesadas[0].destinatario}\nCuota Moderadora: ${paradasProcesadas[0].cuotaModeradora}`);

            if (typeof callbackRefresco === "function") {
                console.log(">>> [IMPORTADOR_REFRESH]: Invocando callback de refresco proporcionado...");
                callbackRefresco(paradasProcesadas);
            } else if (typeof window.refrescarConsolaOperacionesUI === "function") {
                console.log(">>> [IMPORTADOR_UI_GLOBAL]: Invocando refrescarConsolaOperacionesUI() en el ámbito global...");
                window.refrescarConsolaOperacionesUI();
            }

        } catch (error) {
            console.error(">>> [IMPORTADOR_FAIL]: Error crítico al procesar tirilla:", error);
            if (lblEstado) {
                lblEstado.innerText = `>>> ERROR: ${error.message}`;
                lblEstado.style.color = "#ff3366";
            }
            alert(`>>> ERROR PROCESANDO ARCHIVO:\n\n${error.message}`);
        }
    }
}

// INSTANCIACIÓN Y BINDINGS DE SEGURIDAD AL OBJETO GLOBAL WINDOW[cite: 2, 4]
const importadorMensajero = new ImportadorMasivoMensajero();

if (typeof window !== "undefined") {
    console.log(">>> [IMPORTER_BINDINGS]: Exponiendo funciones del importador al objeto window global.");
    window.cargarRutaDesdeTextoOEnlace = cargarRutaDesdeTextoOEnlace;
    window.parsearTextoPlanoWhatsApp = parsearTextoPlanoWhatsApp;
    window.parsearPayloadODocumento = parsearPayloadODocumento;
    window.ImportadorMasivoMensajero = importadorMensajero;
    window.ejecutarProcesamientoIaCloud = () => importadorMensajero.ejecutarImportacionArchivo();
    window.ejecutarProcesamientoLocalSinIa = () => importadorMensajero.ejecutarImportacionArchivoLocal();
}