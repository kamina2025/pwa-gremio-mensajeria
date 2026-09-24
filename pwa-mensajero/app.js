/**
 * PROTOCOLO MACONDO - CARGADOR MODULAR Y REGISTRO SERVICE WORKER
 * Ubicación: pwa-mensajero/app.js
 * Arquitectura: Async Local-First (Service Worker + HTML Inserter)
 */

// --- 1. REGISTRO DE SERVICE WORKER ---
if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            const reg = await navigator.serviceWorker.register("./sw.js");
            console.log("✅ [SW]: Registrado correctamente en ámbito:", reg.scope);
        } catch (err) {
            console.error("❌ [SW]: Error crítico en el registro del Service Worker:", err);
        }
    });
}

// --- 2. CARGADOR MODULAR DESACOPADO ---
/**
 * Procesa dinámicamente todos los elementos con la etiqueta [data-include]
 * inyectando las vistas HTML y notificando al orquestador al finalizar.
 */
async function cargarModulos() {
    console.group("🚀 [APP_LOADER]: Procesando inyección de componentes dinámicos...");
    const elementos = Array.from(document.querySelectorAll("[data-include]"));

    if (elementos.length === 0) {
        console.log("ℹ️ [APP_LOADER]: No se detectaron vistas dinámicas. Disparando 'modulosCargados'...");
        document.dispatchEvent(new CustomEvent("modulosCargados"));
        console.groupEnd();
        return;
    }

    const tareasInyeccion = elementos.map(async (el) => {
        const archivo = el.getAttribute("data-include");
        if (!archivo) return;

        try {
            const respuesta = await fetch(archivo);
            if (respuesta.ok) {
                const html = await respuesta.text();
                el.innerHTML = html;
                el.removeAttribute("data-include");
                console.log(`✅ [APP_LOADER]: Componente '${archivo}' inyectado correctamente.`);
            } else {
                console.error(`❌ [APP_LOADER]: Error ${respuesta.status} al cargar '${archivo}'`);
                el.innerHTML = `<p class="error-modulo">[ERROR HTTP ${respuesta.status}]: Módulo ${archivo} no disponible</p>`;
            }
        } catch (error) {
            console.warn(`⚠️ [APP_LOADER]: Modo Offline o fallo de red al cargar '${archivo}':`, error);
            el.innerHTML = "<!-- Módulo operando en caché / offline -->";
        }
    });

    await Promise.allSettled(tareasInyeccion);
    console.groupEnd();

    console.log("📢 [APP_LOADER]: Componentes inyectados. Disparando evento 'modulosCargados'.");
    document.dispatchEvent(new CustomEvent("modulosCargados"));

    // Verificar si la pestaña perfil estaba activa para hidratar sus datos
    const pestanaPerfil = document.getElementById("pestana-perfil-conductor");
    if (pestanaPerfil && pestanaPerfil.classList.contains("activa")) {
        if (typeof window.cargarPerfilUI === "function") {
            window.cargarPerfilUI();
        }
    }
}

// Inicialización
document.addEventListener("DOMContentLoaded", cargarModulos);