/**
 * PROTOCOLO MACONDO - CARGADOR MODULAR Y REGISTRO SERVICE WORKER
 * Ubicación: pwa-mensajero/app.js
 */

// Registro del Service Worker
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./sw.js")
            .then((reg) => console.log("[SW] Registrado correctamente:", reg.scope))
            .catch((err) => console.error("[SW] Error en registro:", err));
    });
}

// Cargador modular desacoplado (Local-First)
async function cargarModulos() {
    const elementos = document.querySelectorAll("[data-include]");

    const promesas = Array.from(elementos).map(async (el) => {
        const archivo = el.getAttribute("data-include");
        if (!archivo) return;

        try {
            const respuesta = await fetch(archivo);
            if (respuesta.ok) {
                const html = await respuesta.text();
                // Usamos innerHTML para mantener el contenedor con su ID y clases intactas
                el.innerHTML = html;
                el.removeAttribute("data-include"); // Limpiar atributo para evitar re-procesamientos
            } else {
                console.error(`❌ [App]: Error ${respuesta.status} al cargar la vista: ${archivo}`);
                el.innerHTML = `<p class="error-modulo">Error HTTP ${respuesta.status} al cargar la vista ${archivo}</p>`;
            }
        } catch (error) {
            console.error(`❌ [App]: Error de red al obtener el archivo ${archivo}:`, error);
            el.innerHTML = "<!-- Módulo no disponible offline sin caché -->";
        }
    });

    await Promise.all(promesas);

    console.log(" 📢 [App]: Módulos HTML inyectados. Disparando evento 'modulosCargados'...");
    
    // Notificar a script2.js que los módulos dinámicos existen en el DOM
    document.dispatchEvent(new CustomEvent("modulosCargados"));

    // Si la pestaña de perfil ya se encuentra activa, cargar sus datos desde IndexedDB
    if (document.getElementById("pestana-perfil-conductor")?.classList.contains("activa")) {
        if (typeof window.cargarPerfilUI === "function") {
            window.cargarPerfilUI();
        }
    }
}

document.addEventListener("DOMContentLoaded", cargarModulos);