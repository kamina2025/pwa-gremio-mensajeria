/**
 * PROTOCOLO MACONDO - COMPONENTE DE ANIMACIONES Y MODALES SKEUOMÓRFICOS
 * Ubicación: modulos/visor-animaciones.js
 */

class VisorAnimacionesMacondo {
    constructor() {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => this.crearEstructuraModal());
        } else {
            this.crearEstructuraModal();
        }
    }

    crearEstructuraModal() {
        if (document.getElementById("modal-animacion-macondo")) return;

        const modalContainer = document.createElement("div");
        modalContainer.id = "modal-animacion-macondo";
        modalContainer.className = "modal-overlay-macondo";

        modalContainer.innerHTML = `
            <div class="visor-retrofuturista">
                <div id="modal-titulo-estado" style="font-weight:bold; font-size:0.85rem; letter-spacing:1px; color:var(--neon-blue);">
                    >>> INICIALIZANDO CANAL TELEMÁTICO...
                </div>
                
                <div class="contenedor-animacion-ia" id="contenedor-grafico-animado">
                    <!-- Contenido dinámico inyectado por JS -->
                </div>

                <div id="modal-subtexto-estado" style="font-size:0.75rem; color:var(--text-white); font-family:monospace;">
                    Estableciendo handshake con la red...
                </div>
            </div>
        `;

        document.body.appendChild(modalContainer);
    }

    /**
     * Muestra animación de transmisión IA distinguiendo el tipo de documento (Foto o PDF)
     */
    mostrarAnimacionProcesamientoIA(nombreOTipoArchivo = "") {
        this.crearEstructuraModal(); // Asegura la existencia del modal en el DOM

        const modal = document.getElementById("modal-animacion-macondo");
        const titulo = document.getElementById("modal-titulo-estado");
        const subtexto = document.getElementById("modal-subtexto-estado");
        const grafico = document.getElementById("contenedor-grafico-animado");

        const esPdf = nombreOTipoArchivo.toLowerCase().includes("pdf");
        const iconoTipo = esPdf ? "📄 MANIFIESTO PDF" : "🖼️ FOTO DE TIRILLA / VOUCHER";

        if (titulo) titulo.innerText = ">>> TRANSMITIENDO ARCHIVO A MOTOR GEMINI IA...";
        if (subtexto) subtexto.innerText = `Analizando estructura óptica de ${iconoTipo}...`;

        if (grafico) {
            grafico.innerHTML = `
                <div class="icono-archivo-animado">${esPdf ? '📄' : '🖼️'}</div>
                <div style="color:var(--neon-blue); font-size:1.2rem;">➔</div>
                <svg class="robot-lector-svg" viewBox="0 0 24 24">
                    <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H17A2,2 0 0,1 19,9V19A2,2 0 0,1 17,21H7A2,2 0 0,1 5,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7,9V19H17V9H7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H15V17H9V15Z"/>
                </svg>
            `;
        }

        if (modal) modal.classList.add("activo");
    }

    /**
     * Muestra la animación del plano/mapa doblándose al compilar o despachar
     */
    mostrarAnimacionCompilacionLote() {
        this.crearEstructuraModal(); // Asegura la existencia del modal en el DOM

        const modal = document.getElementById("modal-animacion-macondo");
        const titulo = document.getElementById("modal-titulo-estado");
        const subtexto = document.getElementById("modal-subtexto-estado");
        const grafico = document.getElementById("contenedor-grafico-animado");

        if (titulo) titulo.innerText = ">>> PLEGANDO PLANO DE RUTA Y COMPILANDO RELEVO...";
        if (subtexto) subtexto.innerText = "Empaquetando buffer de entregas y transmitiendo al servidor...";

        if (grafico) {
            grafico.innerHTML = `
                <div class="animacion-mapa-plegable"></div>
            `;
        }

        if (modal) modal.classList.add("activo");
    }

    ocultarModal() {
        const modal = document.getElementById("modal-animacion-macondo");
        if (modal) modal.classList.remove("activo");
    }
}

// Inicialización global e inyección inmediata
window.visorAnimaciones = new VisorAnimacionesMacondo();