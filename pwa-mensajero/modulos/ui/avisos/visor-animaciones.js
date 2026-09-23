/**
 * PROTOCOLO MACONDO - VISOR DE ANIMACIONES Y MODALES DE PROGRESO
 * Ubicación: pwa-mensajero/modulos/ui/avisos/visor-animaciones.js
 */

export class VisorAnimacionesProgreso {
    constructor() {
        this.overlayId = "cyber-modal-overlay";
        this.cardId = "cyber-modal-card";
        this.toastContainerId = "cyber-toast-container";
        this.avisosActivos = new Map();
        
        console.log("🚀 [VisorAnimaciones] Módulo de avisos inicializado en pwa-mensajero/modulos/ui/avisos/");
        this.asegurarEstructuraDOM();
    }

    emitirHaptico(pattern = 50) {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                console.warn('[VisorAnimaciones] Vibración háptica bloqueada por la política del navegador:', e);
            }
        }
    }

    asegurarEstructuraDOM() {
        if (!document.getElementById(this.toastContainerId)) {
            const toastContainer = document.createElement('div');
            toastContainer.id = this.toastContainerId;
            toastContainer.className = 'cyber-toast-container';
            toastContainer.setAttribute('aria-live', 'polite');
            toastContainer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(toastContainer);
        }

        if (!document.getElementById(this.overlayId)) {
            const overlay = document.createElement('div');
            overlay.id = this.overlayId;
            overlay.className = 'cyber-modal-overlay hidden';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `<div class="cyber-modal-card" id="${this.cardId}"></div>`;
            document.body.appendChild(overlay);
        }
    }

    mostrarModal(titulo = "PROCESANDO ARCHIVOS", subtitulo = "Iniciando motor Local-First / IA...") {
        console.log(`[VisorAnimaciones] Abriendo Modal Principal: "${titulo}"`);
        this.asegurarEstructuraDOM();

        const overlay = document.getElementById(this.overlayId);
        const card = document.getElementById(this.cardId);

        if (!overlay || !card) return;

        card.innerHTML = `
            <div class="progreso-spinner-container" style="position: relative; width: 70px; height: 70px; margin: 0 auto 16px auto;">
                <div class="cyber-spinner" style="width: 100%; height: 100%; border: 4px solid rgba(0, 229, 255, 0.15); border-top: 4px solid #00e5ff; border-right: 4px solid #ff3366; border-radius: 50%; animation: spinCyber 1s linear infinite;"></div>
                <div class="cyber-icon-center" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;">🤖</div>
            </div>
            <h3 id="txt-progreso-titulo" class="progreso-titulo" style="margin: 0 0 8px 0; font-size: 1.1rem; color: #00e5ff; letter-spacing: 1px; font-family: monospace;">${titulo}</h3>
            <p id="txt-progreso-subtitulo" class="progreso-subtitulo" style="margin: 0 0 16px 0; font-size: 0.85rem; color: #a3b1c2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${subtitulo}</p>
            
            <div class="progreso-bar-track" style="width: 100%; height: 8px; background: #30363d; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                <div id="progreso-bar-fill" class="progreso-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00e5ff, #39ff14); transition: width 0.3s ease;"></div>
            </div>

            <div class="progreso-stats" style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #a3b1c2; font-weight: bold; font-family: monospace;">
                <span id="txt-progreso-conteo">0/0 Archivos</span>
                <span id="txt-progreso-porcentaje">0%</span>
            </div>
        `;

        overlay.classList.remove('hidden');
        this.emitirHaptico(30);
    }

    actualizarProgreso(actual, total, subtextoInfo = "") {
        const overlay = document.getElementById(this.overlayId);
        if (!overlay || overlay.classList.contains('hidden')) return;

        const pct = Math.min(100, Math.max(0, Math.round((actual / total) * 100) || 0));
        console.log(`[VisorAnimaciones] Progreso Modal: ${pct}% (${actual}/${total})`);

        const fillEl = document.getElementById("progreso-bar-fill");
        const pctEl = document.getElementById("txt-progreso-porcentaje");
        const conteoEl = document.getElementById("txt-progreso-conteo");
        const subtituloEl = document.getElementById("txt-progreso-subtitulo");

        if (fillEl) fillEl.style.width = `${pct}%`;
        if (pctEl) pctEl.innerText = `${pct}%`;
        if (conteoEl) conteoEl.innerText = `${actual}/${total} Archivos`;
        if (subtextoInfo && subtituloEl) subtituloEl.innerText = subtextoInfo;
    }

    ocultarModal() {
        console.log("[VisorAnimaciones] Ocultando Modal Principal.");
        const overlay = document.getElementById(this.overlayId);
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    mostrarAvisoProceso({
        id,
        titulo = 'Procesando Tarea...',
        mensaje = '',
        estado = 'procesando',
        progreso = 0,
        acciones = []
    }) {
        console.log(`[VisorAnimaciones] Toast Aviso [${id}] - Estado: ${estado}`);
        this.asegurarEstructuraDOM();

        const container = document.getElementById(this.toastContainerId);
        let toastEl = document.getElementById(`toast-proc-${id}`);

        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.id = `toast-proc-${id}`;
            toastEl.className = `cyber-toast toast-${estado}`;
            container.appendChild(toastEl);
        } else {
            toastEl.className = `cyber-toast toast-${estado}`;
        }

        if (estado === 'error') this.emitirHaptico([100, 50, 100]);
        if (estado === 'exito') this.emitirHaptico(40);

        toastEl.innerHTML = `
            <div class="cyber-toast-header">
                <span>${titulo}</span>
                <span class="cyber-pct">${Math.round(progreso)}%</span>
            </div>
            <div class="cyber-toast-body">${mensaje}</div>
            <div class="cyber-progress-bar-bg">
                <div class="cyber-progress-bar-fill" style="width: ${Math.min(100, Math.max(0, progreso))}%;"></div>
            </div>
            <div class="cyber-toast-actions" id="actions-${id}"></div>
        `;

        const actionsContainer = toastEl.querySelector(`#actions-${id}`);
        if (acciones.length > 0 && actionsContainer) {
            acciones.forEach((act) => {
                const btn = document.createElement('button');
                btn.className = `cyber-btn-touch ${act.clase || ''}`;
                btn.innerText = act.texto;
                btn.addEventListener('click', (e) => {
                    this.emitirHaptico(30);
                    act.accion(id, e);
                });
                actionsContainer.appendChild(btn);
            });
        }

        this.avisosActivos.set(id, { element: toastEl, progreso, estado });
    }

    actualizarProgresoProceso(id, progreso, mensaje = null, nuevoEstado = null) {
        console.log(`[VisorAnimaciones] Actualizando Toast [${id}]: ${progreso}%`);
        const toastEl = document.getElementById(`toast-proc-${id}`);

        if (!toastEl) return;

        if (nuevoEstado) {
            toastEl.className = `cyber-toast toast-${nuevoEstado}`;
            if (nuevoEstado === 'error') this.emitirHaptico([100, 50, 100]);
        }

        const fillEl = toastEl.querySelector('.cyber-progress-bar-fill');
        const pctEl = toastEl.querySelector('.cyber-pct');
        const bodyEl = toastEl.querySelector('.cyber-toast-body');

        if (fillEl) fillEl.style.width = `${Math.min(100, Math.max(0, progreso))}%`;
        if (pctEl) pctEl.innerText = `${Math.round(progreso)}%`;
        if (mensaje && bodyEl) bodyEl.innerText = mensaje;
    }

    cerrarAvisoProceso(id, delayMs = 0) {
        console.log(`[VisorAnimaciones] Cierre programado de Toast [${id}] en ${delayMs}ms`);
        setTimeout(() => {
            const toastEl = document.getElementById(`toast-proc-${id}`);
            if (toastEl) {
                toastEl.style.opacity = '0';
                toastEl.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    toastEl.remove();
                    this.avisosActivos.delete(id);
                }, 300);
            }
        }, delayMs);
    }
}

export const visorAnimaciones = new VisorAnimacionesProgreso();

if (typeof window !== "undefined") {
    window.visorAnimaciones = visorAnimaciones;
    window.mostrarAvisoProceso = (config) => visorAnimaciones.mostrarAvisoProceso(config);
    window.actualizarProgresoProceso = (id, pct, msg, est) => visorAnimaciones.actualizarProgresoProceso(id, pct, msg, est);
    window.cerrarAvisoProceso = (id, delay) => visorAnimaciones.cerrarAvisoProceso(id, delay);
}