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
 * Carga e importa paradas a la persistencia local de la PWA desde una URL o cadena de texto.
 */
export function cargarRutaDesdeTextoOEnlace(textoEntrada, callbackRefresco) {
    if (!textoEntrada || !textoEntrada.trim()) {
        alert(">>> ALERTA MENSAJERO: Ingrese un enlace válido o texto de payload.");
        return false;
    }

    try {
        const listaParadas = parsearPayloadODocumento(textoEntrada);
        if (!listaParadas || listaParadas.length === 0) {
            throw new Error("No se detectaron paradas o direcciones procesables.");
        }

        const paradasProcesadas = listaParadas.map((p, idx) => normalizarParadaTirilla(p, idx));
        guardarRutaZonificada(paradasProcesadas);

        alert(`>>> RUTA CARGADA EXITOSAMENTE:\n\nSe importó la entrega para: ${paradasProcesadas[0].destinatario}\nSSC: ${paradasProcesadas[0].ssc}`);
        
        if (typeof callbackRefresco === "function") callbackRefresco(paradasProcesadas);
        return true;

    } catch (error) {
        alert(`>>> ERROR DE IMPORTACIÓN:\n\n${error.message}`);
        return false;
    }
}

/**
 * CLASE ORQUESTADORA DE IMPORTACIÓN MASIVA
 * Administra la ingestión de MODO 1 (IA Cloud) y MODO 3 (Archivos Locales sin IA).
 */
export class ImportadorMasivoMensajero {
    constructor() {
        console.log(">>> [IMPORTADOR_MENSAJERO_INIT]: Instanciando subsistema de ingestión masiva Local-First...");
        this.regexTelefonoBase = /(?:\+?57)?\s*3\d{9}\b/;
    }

    /**
     * Vincula los escuchadores de eventos para los botones de carga.
     */
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
     * MODO 3: Procesa múltiples archivos TXT, CSV, PDF o Excel de forma local sin IA.
     */
    async ejecutarImportacionArchivoLocal(callbackRefresco) {
        console.log(">>> [IMPORTADOR_EXEC_LOCAL]: Disparando extracción local MODO 3 (Sin IA)...");
        const inputArchivo = document.getElementById("archivo-base-datos-local") || document.getElementById("archivo-base-datos");
        const lblEstado = document.getElementById("txt-estado-ingestion");

        if (!inputArchivo || !inputArchivo.files || inputArchivo.files.length === 0) {
            alert(">>> ALERTA MENSAJERO: Seleccione uno o varios archivos para la extracción local.");
            return;
        }

        const listaArchivos = Array.from(inputArchivo.files);
        console.log(`>>> [IMPORTADOR_MASIVO_LOCAL]: Procesando lote de ${listaArchivos.length} archivo(s)...`);

        if (lblEstado) {
            lblEstado.innerText = `>>> EXTRAYENDO DATOS LOCALMENTE (0/${listaArchivos.length})...`;
            lblEstado.style.color = "var(--neon-green, #3eb84a)";
        }

        const todasLasParadas = [];

        for (let i = 0; i < listaArchivos.length; i++) {
            const archivo = listaArchivos[i];
            console.log(`>>> [IMPORTADOR_FILE_INFO ${i + 1}/${listaArchivos.length}]: Nombre: "${archivo.name}", Tipo: "${archivo.type}", Tamaño: ${archivo.size || 0} bytes`);

            try {
                const puntosExtraidos = await procesarArchivoTextoCSV(archivo);
                if (puntosExtraidos && puntosExtraidos.length > 0) {
                    puntosExtraidos.forEach(p => todasLasParadas.push(p));
                    console.log(`✅ [FILE_OK]: ${puntosExtraidos.length} registros extraídos de "${archivo.name}"`);
                }
            } catch (errArchivo) {
                console.warn(`⚠️ [FILE_FAIL_LOCAL]: No se pudo extraer datos de "${archivo.name}":`, errArchivo.message || errArchivo);
            }

            if (lblEstado) {
                lblEstado.innerText = `>>> PROCESANDO ARCHIVOS LOCALES (${i + 1}/${listaArchivos.length})...`;
            }
        }

        if (todasLasParadas.length === 0) {
            if (lblEstado) {
                lblEstado.innerText = `>>> ERROR LOCAL: No se extrajeron datos válidos.`;
                lblEstado.style.color = "#ff3366";
            }
            alert(">>> ERROR PROCESANDO ARCHIVOS LOCALES:\n\nNo se lograron extraer datos válidos mediante heurística local.");
            return;
        }

        const paradasProcesadas = todasLasParadas.map((p, idx) => normalizarParadaTirilla(p, idx));

        console.log(`>>> [IMPORTADOR_PERSIST]: Guardando ${paradasProcesadas.length} tirilla(s) en la base zonificada...`);
        guardarRutaZonificada(paradasProcesadas);

        if (lblEstado) {
            lblEstado.innerText = `>>> ÉXITO LOCAL: ${paradasProcesadas.length} REGISTRO(S) EXTRAÍDO(S) DE ${listaArchivos.length} ARCHIVO(S)`;
            lblEstado.style.color = "var(--neon-green, #00ff66)";
        }

        alert(`>>> EXTRACCIÓN LOCAL EXITOSA:\n\nSe importaron ${paradasProcesadas.length} paradas a partir de ${listaArchivos.length} archivo(s).`);

        if (typeof callbackRefresco === "function") {
            callbackRefresco(paradasProcesadas);
        } else if (typeof window.refrescarConsolaOperacionesUI === "function") {
            window.refrescarConsolaOperacionesUI();
        }
    }

    /**
     * MODO 1: Procesa múltiples fotografías o documentos mediante la API de Gemini Cloud en bucle aislado.
     */
    async ejecutarImportacionArchivo(callbackRefresco, forzarIA = false) {
        console.log(">>> [IMPORTADOR_EXEC_IA]: Disparando proceso masivo MODO 1 (IA Cloud / Híbrido)...");
        const inputArchivo = document.getElementById("archivo-base-datos") || document.getElementById("archivo-base-datos-local");
        const lblEstado = document.getElementById("txt-estado-ingestion");

        if (!inputArchivo || !inputArchivo.files || inputArchivo.files.length === 0) {
            alert(">>> ALERTA MENSAJERO: Seleccione una o varias tirillas / fotografías.");
            return;
        }

        const listaArchivos = Array.from(inputArchivo.files);
        console.log(`🚀 [IMPORTADOR_MASIVO_IA]: Iniciando procesamiento masivo de ${listaArchivos.length} archivo(s)...`);

        const paradasAcumuladas = [];

        if (window.visorAnimaciones && typeof window.visorAnimaciones.mostrarAnimacionProcesamientoIA === "function") {
            window.visorAnimaciones.mostrarAnimacionProcesamientoIA(`Lote Masivo (${listaArchivos.length} archivos)`);
        }

        try {
            for (let i = 0; i < listaArchivos.length; i++) {
                const archivo = listaArchivos[i];
                console.log(`\n📄 [IMPORTADOR_FILE ${i + 1}/${listaArchivos.length}]: Nombre: "${archivo.name}", Tipo: "${archivo.type}", Tamaño: ${archivo.size || 0} bytes`);

                if (lblEstado) {
                    lblEstado.innerText = `>>> PROCESANDO ARCHIVO ${i + 1} DE ${listaArchivos.length}...`;
                    lblEstado.style.color = "var(--neon-purple, #b359ff)";
                }

                try {
                    let puntosExtraidos = [];
                    const esPDF = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
                    const esImagen = archivo.type.startsWith("image/");

                    if (!esPDF && !esImagen && !forzarIA) {
                        console.log(`>>> [HEURISTICA_LOCAL_INIT]: Archivo plano detectado (#${i + 1}). Procesando localmente...`);
                        puntosExtraidos = await procesarArchivoTextoCSV(archivo);
                    }

                    if (!puntosExtraidos || puntosExtraidos.length === 0) {
                        console.log(`>>> [IMPORTADOR_IA_REQ]: Solicitando análisis Cloud para archivo #${i + 1}...`);
                        puntosExtraidos = await procesarImagenConGemini(archivo);
                    }

                    if (Array.isArray(puntosExtraidos) && puntosExtraidos.length > 0) {
                        puntosExtraidos.forEach(p => paradasAcumuladas.push(p));
                        console.log(`✅ [CLOUD_IA_SUCCESS]: Archivo #${i + 1} ("${archivo.name}") procesado -> ${puntosExtraidos.length} registro(s).`);
                    } else {
                        console.warn(`⚠️ [CLOUD_IA_EMPTY]: No se obtuvieron datos válidos del archivo #${i + 1} ("${archivo.name}").`);
                    }

                } catch (errArchivo) {
                    console.error(`❌ [IMPORTADOR_FILE_FAIL]: Error en archivo #${i + 1} ("${archivo.name}"):`, errArchivo.message || errArchivo);
                }
            }

            if (paradasAcumuladas.length === 0) {
                throw new Error("No se lograron extraer datos válidos de ninguno de los archivos seleccionados.");
            }

            const paradasProcesadas = paradasAcumuladas.map((p, idx) => normalizarParadaTirilla(p, idx));

            console.log(`>>> [IMPORTADOR_PERSIST]: Guardando ${paradasProcesadas.length} parada(s) acumuladas en almacenamiento local...`);
            guardarRutaZonificada(paradasProcesadas);

            if (lblEstado) {
                lblEstado.innerText = `>>> ÉXITO: ${paradasProcesadas.length} TIRILLA(S) PROCESADA(S) DE ${listaArchivos.length} ARCHIVO(S)`;
                lblEstado.style.color = "var(--neon-green, #00ff66)";
            }

            alert(`>>> TIRILLAS PROCESADAS EXITOSAMENTE:\n\nTotal paradas extraídas: ${paradasProcesadas.length}\nArchivos procesados: ${listaArchivos.length}`);

            if (typeof callbackRefresco === "function") {
                console.log(">>> [IMPORTADOR_REFRESH]: Invocando callback de refresco proporcionado...");
                callbackRefresco(paradasProcesadas);
            } else if (typeof window.refrescarConsolaOperacionesUI === "function") {
                console.log(">>> [IMPORTADOR_UI_GLOBAL]: Invocando refrescarConsolaOperacionesUI() tras completar lote masivo...");
                window.refrescarConsolaOperacionesUI();
            }

        } catch (error) {
            console.error(">>> [IMPORTADOR_FAIL]: Error crítico durante la importación masiva:", error);
            if (lblEstado) {
                lblEstado.innerText = `>>> ERROR: ${error.message}`;
                lblEstado.style.color = "#ff3366";
            }
            alert(`>>> ERROR PROCESANDO ARCHIVOS:\n\n${error.message}`);
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
    console.log(">>> [IMPORTER_BINDINGS]: Exponiendo funciones del importador al objeto window global.");
    window.cargarRutaDesdeTextoOEnlace = cargarRutaDesdeTextoOEnlace;
    window.parsearTextoPlanoWhatsApp = parsearTextoPlanoWhatsApp;
    window.parsearPayloadODocumento = parsearPayloadODocumento;
    window.ImportadorMasivoMensajero = importadorMensajero;
    window.ejecutarProcesamientoIaCloud = () => importadorMensajero.ejecutarImportacionArchivo();
    window.ejecutarProcesamientoLocalSinIa = () => importadorMensajero.ejecutarImportacionArchivoLocal();
}