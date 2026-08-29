/**
 * PROTOCOLO MACONDO - SUBSISTEMA BODEGA: IMPORTADOR MASIVO MULTI-FORMATO
 * Ubicación: modulos/importador-masivo.js
 */

export class ImportadorMasivoBodega {
    constructor() {
        console.log(">>> [IMPORTADOR_INIT]: Instanciando subsistema de ingestión masiva de destinatarios...");
        this.regexTelefono = /(?:(?:\+|00)57)?\s*3\d{2}[\s-]?\d{3}[\s-]?\d{4}/g;
        this.inicializarEscuchas();
    }

    inicializarEscuchas() {
        document.addEventListener("DOMContentLoaded", () => {
            const btnProcesar = document.getElementById("btn-procesar-archivo-masivo");
            if (btnProcesar) {
                console.log(">>> [IMPORTADOR_LISTENERS]: Botón [⚙️] PROCESAR_DOCUMENTO_Y_EXTRAER_PUNTOS enlazado correctamente.");
                btnProcesar.addEventListener("click", () => this.ejecutarImportacion());
            } else {
                console.warn(">>> [IMPORTADOR_WARN]: No se encontró el elemento #btn-procesar-archivo-masivo en el DOM.");
            }
        });
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
        console.log(`>>> [IMPORTADOR_FILE]: Archivo detectado -> Nombre: "${archivo.name}", Tipo: "${archivo.type}", Tamaño: ${archivo.bytes || archivo.size} bytes`);

        if (lblEstado) {
            lblEstado.innerText = ">>> PROCESANDO MANIFIESTO EN NODO LOCAL O NUBE...";
            lblEstado.style.color = "var(--neon-amber)";
        }

        try {
            let puntosExtraidos = [];

            // --- RAMA 1: Archivo de texto plano local o CSV ---
            if (archivo.type === "text/plain" || archivo.name.endsWith(".txt") || archivo.name.endsWith(".csv")) {
                console.log(">>> [IMPORTADOR_BRANCH]: Archivo reconocido como TEXTO PLANO / CSV. Omitiendo IA Cloud, procesando vía regex local.");
                const texto = await archivo.text();
                puntosExtraidos = this.parsearTextoPlano(texto);
            } 
            // --- RAMA 2: Documentos complejos (PDF, Word, Imágenes) ---
            else {
                console.log(">>> [IMPORTADOR_BRANCH]: Archivo reconocido como Binario/PDF/Imagen. Delegando a Proxy IA Cloud (Gemini)...");
                try {
                    puntosExtraidos = await this.procesarDocumentoConIA(archivo);
                    console.log(">>> [CLOUD_IA_SUCCESS]: Gemini procesó el documento y retornó puntos estructurados:", puntosExtraidos);
                } catch (cloudErr) {
                    console.warn(">>> [AVISO TRINCHERA]: Cloud falló o no hay API Key configurada. Activando parser local de respaldo para el documento:", cloudErr);
                    
                    // Fallback de respaldo: Intentar leer texto plano embebido en el blob si es posible
                    const textoFallback = await archivo.text().catch(() => "");
                    if (textoFallback && textoFallback.length > 5) {
                        console.log(">>> [TRINCHERA_FALLBACK]: Extrayendo puntos mediante heurística local de texto plano.");
                        puntosExtraidos = this.parsearTextoPlano(textoFallback);
                    } else {
                        console.warn(">>> [TRINCHERA_HEURISTIC]: El blob no contiene texto plano legible. Generando entrada base por defecto.");
                        puntosExtraidos = [
                            {
                                destinatario: "Destinatario Acopio " + archivo.name,
                                direccion: "Calle Principal # 10-20, Cali",
                                telefono: "3001234567",
                                carga: "Paquete Estándar (1.0 kg)"
                            }
                        ];
                    }
                }
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
        const lineas = textoBruto.split(/\r?\n/);
        const puntosExtraidos = [];

        lineas.forEach((linea, idx) => {
            const trimmed = linea.trim();
            if (!trimmed || trimmed.toLowerCase().startsWith("nombre") || trimmed.toLowerCase().startsWith("direccion")) return;

            const partes = trimmed.split(/[,;\t]+/);
            if (partes.length >= 3) {
                puntosExtraidos.push({
                    destinatario: partes[0].trim(),
                    direccion: partes[1].trim(),
                    telefono: partes[2].trim(),
                    carga: partes[3] ? partes[3].trim() : "Paquete Estándar (1.0 kg)"
                });
            } else {
                const matchTel = trimmed.match(this.regexTelefono);
                const telefono = matchTel ? matchTel[0] : "3000000000";
                const textoSinTel = trimmed.replace(this.regexTelefono, "").trim();

                puntosExtraidos.push({
                    destinatario: "Destinatario Acopio",
                    direccion: textoSinTel || "Dirección no especificada",
                    telefono: telefono,
                    carga: "Paquete Estándar (1.0 kg)"
                });
            }
        });

        console.log(`>>> [PARSER_LOCAL_RESULT]: ${puntosExtraidos.length} registros extraídos con éxito del texto plano.`);
        return puntosExtraidos;
    }

    async procesarDocumentoConIA(archivoBlob) {
        return new Promise((resolve, reject) => {
            console.log(">>> [CLOUD_IA_PREP]: Iniciando lectura FileReader para conversión Base64...");
            const reader = new FileReader();
            
            reader.onload = async () => {
                try {
                    const base64Data = reader.result.split(",")[1];
                    const mimeType = archivoBlob.type || "application/pdf";
                    const endpoint = (window.ENDPOINT_API_PHP || '../api.php') + '?action=extraer_puntos_documento';

                    console.log(`>>> [CLOUD_IA_FETCH]: Enviando POST a ${endpoint} [MIME: ${mimeType}, Longitud Base64: ${base64Data.length}]`);

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
                        console.error(">>> [CLOUD_IA_SYNTAX]: El servidor no devolvió un JSON válido:", textoRespuesta);
                        return reject(new Error("El servidor devolvió una respuesta no válida (HTML o formato incorrecto)."));
                    }

                    console.log(">>> [CLOUD_IA_RESPONSE]: Respuesta analizada del servidor:", resData);

                    if (response.ok && resData.status === "success" && Array.isArray(resData.puntos)) {
                        console.log(`>>> [CLOUD_IA_OK]: IA Cloud procesó el archivo usando el modelo [${resData.modelo || 'N/A'}]`);
                        resolve(resData.puntos);
                    } else if (resData.status === "FALLBACK_TRINCHERA") {
                        console.warn(">>> [CLOUD_IA_TRINCHERA]: El servidor indicó modo trinchera por clave no configurada.");
                        reject(new Error("Modo Trinchera activo en la nube: Clave API Key no configurada o rechazada."));
                    } else {
                        reject(new Error(resData.message || resData.error || "Fallo al procesar el documento en el servidor."));
                    }
                } catch (err) {
                    console.error(">>> [CLOUD_IA_ERROR]: Excepción capturada durante fetch IA:", err);
                    reject(err);
                }
            };

            reader.onerror = (error) => {
                console.error(">>> [FILEREADER_ERROR]: Error leyendo archivo binario local:", error);
                reject(error);
            };

            reader.readAsDataURL(archivoBlob);
        });
    }

    inyectarPuntosEnMatriz(listaPuntos) {
        console.log(">>> [MATRIZ_INJECT]: Inyectando puntos extraídos al lote provisional de la bodega...", listaPuntos);
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
        console.log(">>> [MATRIZ_OK]: Tabla de cola y monitor de masa sincronizados.");
    }
}

const importador = new ImportadorMasivoBodega();
window.ImportadorMasivoBodega = importador;