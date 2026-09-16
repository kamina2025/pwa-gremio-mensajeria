/**
 * PROTOCOLO MACONDO - CONTROLADOR DE INSTALACIÓN PWA
 * Ubicación: pwa-mensajero/modulos/mensajero-pwa.js
 */

let deferredPrompt = null;

export function inicializarEventosPWA() {
    const installBtn = document.getElementById("install-btn");

    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log("📲 [PWA]: Evento 'beforeinstallprompt' capturado.");

        if (installBtn) {
            installBtn.style.display = "inline-block";
        }
    });

    if (installBtn) {
        installBtn.addEventListener("click", async () => {
            if (!deferredPrompt) return;

            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`👤 [PWA]: Elección del usuario: ${outcome}`);

            deferredPrompt = null;
            installBtn.style.display = "none";
        });
    }

    window.addEventListener("appinstalled", () => {
        console.log("🎉 [PWA]: Aplicación instalada con éxito.");
        deferredPrompt = null;
        if (installBtn) installBtn.style.display = "none";
    });
}