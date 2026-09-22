/**
 * PROTOCOLO MACONDO - VISOR DE ANIMACIONES Y MODAL DE PROGRESO (IA / LOCAL)
 * Ubicación: pwa-mensajero/modulos/visor-animaciones.js
 */

export class VisorAnimacionesProgreso {
    constructor() {
        this.modalId = "modal-progreso-ingestion";
        this.asegurarEstructuraDOM();
    }

    /**
     * Construye e inyecta dinámicamente el modal en el DOM si no existe.
     */
    asegurarEstructuraDOM() {
        if (document.getElementById(this.modalId)) return;

        const modalHTML = `
        <div id="${this.modalId}" class="modal-progreso-overlay" style="display: none;">
            <div class="modal-progreso-card">
                <div class="progreso-spinner-container">
                    <div class="cyber-spinner"></div>
                    <div class="cyber-icon-center">🤖</div>
                </div>
                <h3 id="txt-progreso-titulo" class="progreso-titulo">PROCESANDO ARCHIVOS</h3>
                <p id="txt-progreso-subtitulo" class="progreso-subtitulo">Iniciando motor Local-First / IA Cloud...</p>
                
                <div class="progreso-bar-track">
                    <div id="progreso-bar-fill" class="progreso-bar-fill" style="width: 0%;"></div>
                </div>

                <div class="progreso-stats">
                    <span id="txt-progreso-conteo">0/0 Archivos</span>
                    <span id="txt-progreso-porcentaje">0%</span>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalHTML);
        this.inyectarEstilosCSS();
    }

    /**
     * Inyecta los estilos neón/ciberpunk para la animación.
     */
    inyectarEstilosCSS() {
        if (document.getElementById("styles-visor-animaciones")) return;

        const style = document.createElement("style");
        style.id = "styles-visor-animaciones";
        style.textContent = `
            .modal-progreso-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 12, 18, 0.85);
                backdrop-filter: blur(8px);
                z-index: 99999;
                display: flex; align-items: center; justify-content: center;
                font-family: system-ui, -apple-system, sans-serif;
            }
            .modal-progreso-card {
                background: #121824;
                border: 1px solid #00E5FF;
                box-shadow: 0 0 25px rgba(0, 229, 255, 0.3);
                border-radius: 12px;
                padding: 24px; width: 90%; max-width: 400px;
                text-align: center; color: #E0E6ED;
            }
            .progreso-spinner-container {
                position: relative; width: 70px; height: 70px; margin: 0 auto 16px auto;
            }
            .cyber-spinner {
                width: 100%; height: 100%;
                border: 4px solid rgba(0, 229, 255, 0.15);
                border-top: 4px solid #00E5FF;
                border-right: 4px solid #B359FF;
                border-radius: 50%;
                animation: spinCyber 1s linear infinite;
            }
            .cyber-icon-center {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%); font-size: 24px;
            }
            @keyframes spinCyber {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .progreso-titulo {
                margin: 0 0 8px 0; font-size: 1.1rem; color: #00E5FF; letter-spacing: 1px;
            }
            .progreso-subtitulo {
                margin: 0 0 16px 0; font-size: 0.85rem; color: #94A3B8;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .progreso-bar-track {
                width: 100%; height: 8px; background: #1E293B; border-radius: 4px; overflow: hidden; margin-bottom: 8px;
            }
            .progreso-bar-fill {
                height: 100%; background: linear-gradient(90deg, #00E5FF, #B359FF);
                transition: width 0.3s ease;
            }
            .progreso-stats {
                display: flex; justify-content: space-between; font-size: 0.8rem; color: #94A3B8; font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Muestra el modal con la información inicial.
     */
    mostrarModal(titulo = "PROCESANDO ARCHIVOS", subtitulo = "Inicializando...") {
        this.asegurarEstructuraDOM();
        const overlay = document.getElementById(this.modalId);
        document.getElementById("txt-progreso-titulo").innerText = titulo;
        document.getElementById("txt-progreso-subtitulo").innerText = subtitulo;
        this.actualizarProgreso(0, 100, "0/0 Archivos");
        overlay.style.display = "flex";
    }

    /**
     * Actualiza la barra de progreso y las métricas.
     */
    actualizarProgreso(actual, total, subtextoInfo = "") {
        const overlay = document.getElementById(this.modalId);
        if (!overlay || overlay.style.display === "none") return;

        const pct = Math.round((actual / total) * 100) || 0;
        document.getElementById("progreso-bar-fill").style.width = `${pct}%`;
        document.getElementById("txt-progreso-porcentaje").innerText = `${pct}%`;
        document.getElementById("txt-progreso-conteo").innerText = `${actual}/${total} Archivos`;

        if (subtextoInfo) {
            document.getElementById("txt-progreso-subtitulo").innerText = subtextoInfo;
        }
    }

    /**
     * Oculta el modal de progreso.
     */
    ocultarModal() {
        const overlay = document.getElementById(this.modalId);
        if (overlay) {
            overlay.style.display = "none";
        }
    }
}

// Exportar instancia global
export const visorAnimaciones = new VisorAnimacionesProgreso();
if (typeof window !== "undefined") {
    window.visorAnimaciones = visorAnimaciones;
}