/**
 * PROTOCOLO MACONDO - MENÚ ORBITAL Y OVERLAY RADIAL CYBERPUNK
 * Ubicación: pwa-mensajero/modulos/mapa/marcadores/mapa-overlay-orbital.js
 * Arquitectura: Google Maps OverlayView / Orbital UI
 */

export function obtenerClaseMenuRadialOverlay() {
    if (window.MenuRadialOverlayClass) {
        return window.MenuRadialOverlayClass;
    }

    if (typeof google === "undefined" || !google.maps || !google.maps.OverlayView) {
        console.error("❌ [MAPA_OVERLAY]: google.maps.OverlayView no está disponible aún.");
        return null;
    }

    class MenuRadialOverlay extends google.maps.OverlayView {
        constructor(posicion, handlers = {}) {
            super();
            this.posicion = posicion;
            this.handlers = handlers; // { onEdit, onSequence, onMove, onCall, onDelete, onCopyGPS, onReport, onExternalNav }
            this.container = null;
            this.injectStyles();
        }

        injectStyles() {
            if (document.getElementById("cyberpunk-orbital-styles")) return;
            const style = document.createElement("style");
            style.id = "cyberpunk-orbital-styles";
            style.textContent = `
                .cyberpunk-cross-menu {
                    position: absolute;
                    width: 150px;
                    height: 150px;
                    transform: translate(-50%, -50%);
                    pointer-events: auto !important;
                    z-index: 99999 !important;
                    touch-action: manipulation;
                }
                .orbital-ring-bg {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 116px;
                    height: 116px;
                    transform: translate(-50%, -50%);
                    border: 1px dashed rgba(0, 229, 255, 0.4);
                    border-radius: 50%;
                    pointer-events: none;
                    box-shadow: 0 0 15px rgba(0, 229, 255, 0.15), inset 0 0 15px rgba(0, 229, 255, 0.15);
                    animation: cyber-pulse-ring 3s infinite linear;
                }
                @keyframes cyber-pulse-ring {
                    0% { transform: translate(-50%, -50%) rotate(0deg); }
                    100% { transform: translate(-50%, -50%) rotate(360deg); }
                }
                .cyber-btn {
                    position: absolute;
                    width: 36px;
                    height: 36px;
                    background: #0d1117;
                    border: 2px solid var(--neon-cyan, #00e5ff);
                    color: var(--neon-cyan, #00e5ff);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Fira Code', monospace;
                    font-size: 13px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 0 8px var(--neon-cyan, #00e5ff), inset 0 0 4px var(--neon-cyan, #00e5ff);
                    transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: transparent;
                    user-select: none;
                }
                .cyber-btn:active, .cyber-btn:hover {
                    background: var(--neon-cyan, #00e5ff);
                    color: #0d1117;
                    box-shadow: 0 0 16px var(--neon-cyan, #00e5ff);
                    transform: scale(1.18);
                }
                .cyber-btn.danger {
                    border-color: #ff3366;
                    color: #ff3366;
                    box-shadow: 0 0 8px #ff3366, inset 0 0 4px #ff3366;
                }
                .cyber-btn.danger:active, .cyber-btn.danger:hover {
                    background: #ff3366;
                    color: #0d1117;
                    box-shadow: 0 0 16px #ff3366;
                }
                .cyber-btn.amber {
                    border-color: #ffb300;
                    color: #ffb300;
                    box-shadow: 0 0 8px #ffb300, inset 0 0 4px #ffb300;
                }
                .cyber-btn.amber:active, .cyber-btn.amber:hover {
                    background: #ffb300;
                    color: #0d1117;
                    box-shadow: 0 0 16px #ffb300;
                }
                .cyber-btn.green {
                    border-color: #39ff14;
                    color: #39ff14;
                    box-shadow: 0 0 8px #39ff14, inset 0 0 4px #39ff14;
                }
                .cyber-btn.green:active, .cyber-btn.green:hover {
                    background: #39ff14;
                    color: #0d1117;
                    box-shadow: 0 0 16px #39ff14;
                }
                .cyber-btn-norte    { top: 17px;  left: 57px; }
                .cyber-btn-noreste  { top: 34px;  left: 98px; }
                .cyber-btn-este     { top: 75px;  left: 115px;}
                .cyber-btn-sudeste  { top: 116px; left: 98px; }
                .cyber-btn-sur      { top: 133px; left: 57px; }
                .cyber-btn-suroeste { top: 116px; left: 16px; }
                .cyber-btn-oeste    { top: 75px;  left: -1px; }
                .cyber-btn-noroeste { top: 34px;  left: 16px; }
            `;
            document.head.appendChild(style);
        }

        onAdd() {
            this.container = document.createElement("div");
            this.container.className = "cyberpunk-cross-menu";
            this.container.innerHTML = `
                <div class="orbital-ring-bg"></div>
                <button type="button" class="cyber-btn cyber-btn-norte" title="Editar Parada (N)" aria-label="Editar">✏️</button>
                <button type="button" class="cyber-btn cyber-btn-noreste amber" title="Subir en Secuencia (NE)" aria-label="Secuencia">▲</button>
                <button type="button" class="cyber-btn cyber-btn-este" title="Mover Punto Geodésico (E)" aria-label="Mover">📍</button>
                <button type="button" class="cyber-btn cyber-btn-sudeste green" title="Llamar Cliente (SE)" aria-label="Llamar">📞</button>
                <button type="button" class="cyber-btn cyber-btn-sur danger" title="Eliminar Parada (S)" aria-label="Eliminar">🗑️</button>
                <button type="button" class="cyber-btn cyber-btn-suroeste" title="Copiar Coordenadas (SO)" aria-label="Copiar">📋</button>
                <button type="button" class="cyber-btn cyber-btn-oeste amber" title="Reportar Novedad / Evidencias (O)" aria-label="Reportar">📷</button>
                <button type="button" class="cyber-btn cyber-btn-noroeste green" title="Viajar con GPS (NO)" aria-label="Viajar">🧭</button>
            `;
            this.attachEvents();
            const panes = this.getPanes();
            if (panes && panes.floatPane) {
                panes.floatPane.appendChild(this.container);
            }
        }

        attachEvents() {
            if (!this.container) return;

            const bindAction = (selector, actionName, handler) => {
                const btn = this.container.querySelector(selector);
                if (btn) {
                    btn.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`📢 [MENU_ORBITAL]: Acción ${actionName} ejecutada`);
                        if (typeof handler === "function") handler();
                        this.cerrar();
                    });
                }
            };

            bindAction(".cyber-btn-norte", "NORTE (Editar)", this.handlers.onEdit);
            bindAction(".cyber-btn-noreste", "NORESTE (Mover Secuencia)", this.handlers.onSequence);
            bindAction(".cyber-btn-este", "ESTE (Mover Punto)", this.handlers.onMove);
            bindAction(".cyber-btn-sudeste", "SUDESTE (Llamar)", this.handlers.onCall);
            bindAction(".cyber-btn-sur", "SUR (Eliminar)", this.handlers.onDelete);
            bindAction(".cyber-btn-suroeste", "SUROESTE (Copiar GPS)", this.handlers.onCopyGPS);
            bindAction(".cyber-btn-oeste", "OESTE (Reportar/Evidencias)", this.handlers.onReport);
            bindAction(".cyber-btn-noroeste", "NOROESTE (Viajar GPS)", this.handlers.onExternalNav);
        }

        draw() {
            const projection = this.getProjection();
            if (!projection) return;
            const point = projection.fromLatLngToDivPixel(this.posicion);
            if (point && this.container) {
                this.container.style.left = `${point.x}px`;
                this.container.style.top = `${point.y}px`;
            }
        }

        cerrar() {
            this.setMap(null);
            if (window.overlayMenuActivo === this) {
                window.overlayMenuActivo = null;
            }
        }

        onRemove() {
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
                this.container = null;
            }
        }
    }

    window.MenuRadialOverlayClass = MenuRadialOverlay;
    return MenuRadialOverlay;
}