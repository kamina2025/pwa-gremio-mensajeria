/**
 * PROTOCOLO MACONDO - SUBSISTEMA BODEGA: IMPORTADOR MASIVO MULTI-FORMATO
 * Ubicación: modulos/importador-masivo.js
 * Arquitectura: Local-First con Parsing Sanitizado, Fallback IA Cloud Opt-In y Resguardo Telemático
 */

export class ImportadorMasivoBodega {
    constructor() {
        console.log(">>> [IMPORTADOR_INIT]: Instanciando subsistema de ingestión masiva Local-First...");
        // Regexp refinada para detectar números celulares colombianos (con o sin +57)
        this.regexTelefono = /(?:\+?57)?\s*3\d{7,10}\b/g;
    }

    /**
     * Exposición explícita invocada por el Bootstrapper
     * una vez que la estructura DOM ha sido compilada e inyectada exitosamente.
     */
    vincularEscuchas() {
        const btnProcesar = document.getElementById("btn-procesar-archivo-masivo");
        if (btnProcesar) {
            console.log(">>> [IMPORTADOR_LISTENERS]: Botón [⚙️] PROCESAR_DOCUMENTO_Y_EXTRAER_PUNTOS enlazado correctamente.");
            btnProcesar.removeEventListener("click", this._onProcesarClick);
            this._onProcesarClick = () => this.ejecutarImportacion();
            btnProcesar.addEventListener("click", this._onProcesarClick);
        } else {
            console.warn(">>> [IMPORTADOR_WARN]: No se encontró el elemento #btn-procesar-archivo-masivo en el DOM.");
        }
    }

    async ejecutarImportacion() {
        console.log(">>> [IMPORTADOR_EXEC]: Disparando proceso de importación masiva...");
        const inputArchivo = document.getElementById("archivo-base-datos");
        const lblEstado = document.getElementById("txt-estado-ingestion");

        if (!inputArchivo || !inputArchivo.files || inputArchivo.files.length === 0) {
            alert(">>> ALERTA BODEGA: Seleccione un archivo (PDF, TXT, Word o Imagen) antes de procesar.");
            return;
        }

        const archivo = inputArchivo.files[0];
        console.log(`>>> [IMPORTADOR_FILE]: Archivo detectado -> Nombre: "${archivo.name}", Tipo: "${archivo.type}", Tamaño: ${archivo.size || 0} bytes`);

        if (lblEstado) {
            lblEstado.innerText = ">>> EVALUANDO ESTRUCTURA DEL ARCHIVO...";
            lblEstado.style.color = "var(--neon-amber)";
        }

        try {
            let puntosExtraidos = [];
            const esPDF = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
            const esImagen = archivo.type.startsWith("image/");

            // PASO 1: EVALUAR HEURÍSTICA LOCAL EN TEXTO PLANO/CSV/TXT
            if (!esPDF && !esImagen) {
                console.log(">>> [HEURISTICA_LOCAL_INIT]: Archivo de texto/CSV detectado. Ejecutando análisis regex local...");
                const textoLocal = await archivo.text().catch(() => "");
                if (textoLocal && textoLocal.trim().length > 5) {
                    puntosExtraidos = this.parsearTextoPlano(textoLocal);
                }
            } else {
                console.log(">>> [IMPORTADOR_BRANCH]: Archivo binario (PDF/Imagen) detectado. Omitiendo parser local crudo.");
            }

            // PASO 2: SOLICITAR IA CLOUD SI ES PDF/IMAGEN O SI LA HEURÍSTICA LOCAL SALIÓ VACÍA
            if (!puntosExtraidos || puntosExtraidos.length === 0) {
                console.warn(">>> [HEURISTICA_INSUFICIENTE]: Requiere procesamiento multimodal en la Nube.");

                const mensajeConfirmacion = esPDF || esImagen
                    ? `>>> [ASISTENTE BODEGA]: Se detectó un documento (${archivo.name}).\n\n¿Desea enviarlo a la IA Cloud (Gemini) para extraer los destinatarios y direcciones con precisión?`
                    : `>>> [ASISTENTE BODEGA]: No se encontraron datos legibles localmente.\n\n¿Desea intentar la extracción avanzada mediante IA Cloud?`;

                const confirmarUsoIA = confirm(mensajeConfirmacion);

                if (confirmarUsoIA) {
                    if (lblEstado) {
                        lblEstado.innerText = ">>> PROCESANDO CON IA CLOUD (GEMINI)...";
                        lblEstado.style.color = "var(--neon-purple)";
                    }

                    if (window.visorAnimaciones && typeof window.visorAnimaciones.mostrarAnimacionProcesamientoIA === "function") {
                        window.visorAnimaciones.mostrarAnimacionProcesamientoIA(archivo.name || archivo.type);
                    }

                    try {
                        puntosExtraidos = await this.procesarDocumentoConIA(archivo);
                        console.log(">>> [CLOUD_IA_SUCCESS]: Puntos extraídos mediante IA Cloud:", puntosExtraidos);
                    } catch (cloudErr) {
                        console.error(">>> [CLOUD_IA_FAIL]: Error al procesar con IA Cloud:", cloudErr);
                        throw new Error(`Fallo en extracción Cloud: ${cloudErr.message}`);
                    } finally {
                        if (window.visorAnimaciones && typeof window.visorAnimaciones.ocultarModal === "function") {
                            window.visorAnimaciones.ocultarModal();
                        }
                    }
                } else {
                    console.log(">>> [PROCESO_ABORTADO]: Ingestión cancelada por el usuario.");
                    if (lblEstado) {
                        lblEstado.innerText = ">>> PROCESO CANCELADO POR EL USUARIO.";
                        lblEstado.style.color = "#ff3366";
                    }
                    return;
                }
            } else {
                console.log(`>>> [HEURISTICA_LOCAL_SUCCESS]: ${puntosExtraidos.length} registros extraídos exitosamente sin usar la Nube.`);
            }

            if (!puntosExtraidos || puntosExtraidos.length === 0) {
                throw new Error("No se lograron extraer direcciones o destinatarios válidos del archivo.");
            }

            console.log(`>>> [IMPORTADOR_READY]: Total de puntos listos para inyección: ${puntosExtraidos.length}`);
            this.inyectarPuntosEnMatriz(puntosExtraidos);

            if (lblEstado) {
                lblEstado.innerText = `>>> ÉXITO: ${puntosExtraidos.length} PUNTOS EXTRAÍDOS E INYECTADOS AL LOTE.`;
                lblEstado.style.color = "var(--neon-green)";
            }

        } catch (error) {
            console.error(">>> [IMPORTADOR_FAIL]: Error crítico al procesar manifiesto:", error);
            if (lblEstado) {
                lblEstado.innerText = `>>> ERROR: ${error.message}`;
                lblEstado.style.color = "#ff3366";
            }
            alert(`>>> ERROR PROCESANDO ARCHIVO:\n\n${error.message}`);
        }
    }

    parsearTextoPlano(textoBruto) {
        console.log(">>> [PARSER_LOCAL]: Ejecutando análisis de expresiones regulares sobre texto plano...");

        // Filtro de seguridad: Rechazar si contiene firmas binarias de PDF
        if (textoBruto.includes("%PDF-") || textoBruto.includes("/Root") || textoBruto.includes("endobj")) {
            console.warn(">>> [PARSER_LOCAL_ABORT]: Se detectó código binario PDF en la lectura de texto plano. Abortando.");
            return [];
        }

        // Sanitización ASCII: Eliminar caracteres especiales de control (ej: \f Form Feed)
        const textoLimpio = textoBruto.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, "");
        const lineas = textoLimpio.split(/\r?\n/);
        const puntosExtraidos = [];

        lineas.forEach((linea) => {
            let trimmed = linea.trim();
            if (!trimmed || trimmed.startsWith("%") || /^(nombre|direccion|telefono|alias)/i.test(trimmed)) return;

            // 1. Aislamiento y extracción del teléfono
            let telefonoEncontrado = "";
            const matchTel = trimmed.match(this.regexTelefono);

            if (matchTel && matchTel.length > 0) {
                telefonoEncontrado = matchTel[0].replace(/\s+/g, "").trim();
                trimmed = trimmed.replace(matchTel[0], "").trim();
            }

            // Sanitizar cualquier remanente numérico suelto al final de la línea
            const matchNumericoFinal = trimmed.match(/\s*\b\d{7,11}\b\s*$/);
            if (matchNumericoFinal) {
                if (!telefonoEncontrado) {
                    telefonoEncontrado = matchNumericoFinal[0].trim();
                }
                trimmed = trimmed.replace(/\s*\b\d{7,11}\b\s*$/, "").trim();
            }

            if (!telefonoEncontrado) {
                telefonoEncontrado = "3000000000";
            }

            if (!trimmed || /^\d+$/.test(trimmed)) return;

            let destinatario = "Destinatario Acopio";
            let direccion = "Dirección no especificada";

            // 2. Tokenizar cadena residual (Nombre + Dirección)
            const partes = trimmed.split(/[,;\t]+|\s{2,}/).map(p => p.trim()).filter(Boolean);

            if (partes.length >= 2) {
                destinatario = partes[0];
                direccion = partes.slice(1).join(" ");
            } else {
                const palabras = trimmed.split(/\s+/);
                if (palabras.length >= 2) {
                    destinatario = palabras[0];
                    direccion = palabras.slice(1).join(" ");
                } else {
                    direccion = trimmed;
                }
            }

            puntosExtraidos.push({
                destinatario: destinatario.trim(),
                direccion: direccion.trim(),
                telefono: telefonoEncontrado,
                carga: "Paquete Estándar (1.0 kg)"
            });
        });

        console.log(`>>> [PARSER_LOCAL_RESULT]: ${puntosExtraidos.length} registros estructurados localmente.`);
        return puntosExtraidos;
    }

    async procesarDocumentoConIA(archivoBlob) {
        return new Promise((resolve, reject) => {
            console.log(">>> [CLOUD_IA_PREP]: Convirtiendo binario a Base64...");
            const reader = new FileReader();

            reader.onload = async () => {
                try {
                    const base64Data = reader.result.split(",")[1];
                    const mimeType = archivoBlob.type || "application/pdf";
                    const endpoint = (window.ENDPOINT_API_PHP || '../api.php') + '?action=extraer_puntos_documento';

                    console.log(`>>> [CLOUD_IA_FETCH]: Enviando POST a ${endpoint} [MIME: ${mimeType}]`);

                    const response = await fetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            mime_type: mimeType,
                            file_data: base64Data
                        })
                    });

                    const textoRespuesta = await response.text();
                    let resData;
                    try {
                        resData = JSON.parse(textoRespuesta);
                    } catch (e) {
                        console.error(">>> [CLOUD_IA_SYNTAX]: Respuesta no válida del servidor:", textoRespuesta);
                        return reject(new Error("Respuesta no válida del backend."));
                    }

                    if (response.ok && resData.status === "success" && Array.isArray(resData.puntos)) {
                        console.log(`>>> [CLOUD_IA_OK]: IA Cloud extrajo ${resData.puntos.length} puntos con el modelo [${resData.modelo || 'Gemini'}]`);
                        resolve(resData.puntos);
                    } else {
                        reject(new Error(resData.message || resData.error || "Fallo al procesar el documento en la nube."));
                    }
                } catch (err) {
                    console.error(">>> [CLOUD_IA_ERROR]: Error de comunicación:", err);
                    reject(err);
                }
            };

            reader.onerror = (error) => {
                console.error(">>> [FILEREADER_ERROR]: Error al leer archivo:", error);
                reject(error);
            };

            reader.readAsDataURL(archivoBlob);
        });
    }

    inyectarPuntosEnMatriz(listaPuntos) {
        console.log(">>> [MATRIZ_INJECT]: Inyectando puntos extraídos al lote provisional...", listaPuntos);
        if (!window.loteActualPedidos) window.loteActualPedidos = [];

        listaPuntos.forEach((p) => {
            const idPedido = "#PNT-" + Math.floor(1000 + Math.random() * 9000);
            const pesoEstePedido = typeof window.extraerPesoNumerico === "function" ? window.extraerPesoNumerico(p.carga || "1.0") : 1.0;

            const nuevoPunto = {
                id: idPedido,
                destinatario: p.destinatario || "Destinatario Acopio",
                direccion: p.direccion || "Cali",
                telefono: p.telefono || "3000000000",
                carga: p.carga || "Paquete Estándar (1.0 kg)",
                pesoKg: pesoEstePedido,
                testigoOptico: "MASIVO_MANIFIESTO_DOC",
                creditos: 1,
                precioEspecifico: 500
            };

            window.loteActualPedidos.push(nuevoPunto);
            window.pesoAcumuladoLote = (window.pesoAcumuladoLote || 0) + pesoEstePedido;
        });

        if (typeof window.actualizarMonitorMasaUI === "function") {
            window.actualizarMonitorMasaUI();
        }

        if (typeof window.actualizarTablaCola === "function") {
            window.actualizarTablaCola();
        }

        // Disparador de enrutamiento y telemetría en mapa
        const elOrigen = document.getElementById("origen-cliente");
        const origenInput = elOrigen && elOrigen.value.trim() ? elOrigen.value.trim() : "Cali, Colombia";
        const ultimaDireccion = window.loteActualPedidos[window.loteActualPedidos.length - 1].direccion;

        const CONTEXTO = ", Cali, Colombia";
        let origConContexto = origenInput.toLowerCase().includes("cali") ? origenInput : origenInput + CONTEXTO;
        let destConContexto = ultimaDireccion.toLowerCase().includes("cali")
            ? ultimaDireccion
            : ultimaDireccion + CONTEXTO;

        if (typeof window.previsualizarRutaInmediata === "function") {
            console.log(">>> [MATRIZ_MAPS_LINK]: Proyectando vectores del lote masivo en el mapa...");
            window.previsualizarRutaInmediata(origConContexto, destConContexto);
        }

        console.log(">>> [MATRIZ_OK]: Tabla de cola, monitor de masa y mapa telemático sincronizados.");
    }
}

const importador = new ImportadorMasivoBodega();
window.ImportadorMasivoBodega = importador;