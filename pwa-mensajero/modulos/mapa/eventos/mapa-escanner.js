/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE ESCÁNER DE CÓDIGOS SCC POR CÁMARA
 * Ubicación: pwa-mensajero/modulos/mapa/eventos/mapa-escanner.js
 * Arquitectura: BarcodeDetector API / MediaDevices / WebRTC Fallback
 */

let mediaStreamCamara = null;
let animFrameScanner = null;

export const mapaEscanner = {
    inicializar(callbackCodigoDetectado) {
        const btnEscanear = document.getElementById('btn-escanear-scc');
        const btnCerrarScanner = document.getElementById('btn-cerrar-escanner');

        if (btnEscanear) {
            btnEscanear.onclick = (e) => {
                e.preventDefault();
                this.iniciarEscanerCamaraSCC(callbackCodigoDetectado);
            };
        }

        if (btnCerrarScanner) {
            btnCerrarScanner.onclick = () => {
                this.detenerEscanerCamaraSCC();
            };
        }
    },

    async iniciarEscanerCamaraSCC(callbackCodigoDetectado) {
        const modal = document.getElementById("contenedor-escanner-modal");
        const video = document.getElementById("video-preview-escanner");
        const txtStatus = document.getElementById("status-escanner-texto");

        if (!modal || !video) return;
        modal.style.display = "flex";

        const esContextoSeguro = window.isSecureContext || window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

        if (!esContextoSeguro) {
            console.warn("⚠️ [ESCÁNER_WARN]: Acceso a cámara restringido por contexto HTTP inseguro.");
            if (txtStatus) {
                txtStatus.innerHTML = `⚠️ <b>Contexto HTTP Inseguro</b><br>Android requiere HTTPS para la cámara.`;
            }
            return;
        }

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
            if (txtStatus) txtStatus.textContent = "❌ Navegador no soporta captura de video.";
            return;
        }

        if (txtStatus) txtStatus.textContent = "⏳ Solicitando acceso a la cámara...";

        const perfilesCamara = [
            { video: { facingMode: { ideal: "environment" } } },
            { video: { facingMode: "environment" } },
            { video: true }
        ];

        let streamObtenido = null;
        let ultimoError = null;

        for (const constraints of perfilesCamara) {
            try {
                streamObtenido = await navigator.mediaDevices.getUserMedia(constraints);
                if (streamObtenido) break;
            } catch (err) {
                ultimoError = err;
            }
        }

        if (!streamObtenido) {
            if (txtStatus) {
                txtStatus.textContent = `❌ ERROR DE ACCESO A CÁMARA (${ultimoError?.name || "Desconocido"}).`;
            }
            return;
        }

        mediaStreamCamara = streamObtenido;
        video.srcObject = mediaStreamCamara;
        video.setAttribute("playsinline", "true");
        video.play();

        if (txtStatus) txtStatus.textContent = "🔍 Apunte la cámara hacia el código de barras o QR...";

        if ("BarcodeDetector" in window) {
            try {
                const detector = new BarcodeDetector({ formats: ["code_128", "qr_code", "ean_13", "code_39"] });
                const escaneoLoop = async () => {
                    if (!mediaStreamCamara) return;
                    try {
                        const barcodes = await detector.detect(video);
                        if (barcodes.length > 0) {
                            const codigoEscaneado = barcodes[0].rawValue;
                            console.log("📷 [ESCÁNER_SCC_OK]: Código capturado:", codigoEscaneado);
                            
                            this.detenerEscanerCamaraSCC();

                            if (typeof callbackCodigoDetectado === "function") {
                                callbackCodigoDetectado(codigoEscaneado);
                            }
                            return;
                        }
                    } catch (err) {
                        // Reintento silencioso en el siguiente frame
                    }
                    animFrameScanner = requestAnimationFrame(escaneoLoop);
                };
                animFrameScanner = requestAnimationFrame(escaneoLoop);
            } catch (errDet) {
                console.warn("⚠️ [ESCÁNER_SCC]: BarcodeDetector no pudo instanciarse:", errDet);
            }
        } else {
            if (txtStatus) txtStatus.textContent = "⚠️ Escáner de hardware no soportado en este navegador.";
        }
    },

    detenerEscanerCamaraSCC() {
        const modal = document.getElementById("contenedor-escanner-modal");
        if (modal) modal.style.display = "none";

        if (animFrameScanner) cancelAnimationFrame(animFrameScanner);

        if (mediaStreamCamara) {
            mediaStreamCamara.getTracks().forEach(track => {
                track.stop();
                console.log("📷 [ESCÁNER_SCC]: Track de cámara liberado.");
            });
            mediaStreamCamara = null;
        }
    }
};