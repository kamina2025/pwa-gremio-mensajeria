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
        try {
            const respuesta = await fetch(archivo);
            if (respuesta.ok) {
                const html = await respuesta.text();
                // Usamos innerHTML para no destruir el contenedor <section id="..."> y sus clases
                el.innerHTML = html;
            } else {
                console.error(`Error 404 al cargar la vista: ${archivo}`);
                el.innerHTML = "<p>Error al cargar el módulo.</p>";
            }
        } catch (error) {
            console.error(`[App] Error al obtener el archivo ${archivo}:`, error);
            el.innerHTML = "<!-- Módulo no disponible offline -->";
        }
    });

    await Promise.all(promesas);

    // Notificar eventos al DOM cuando los componentes dinámicos existan
    document.dispatchEvent(new CustomEvent("modulosCargados"));
}

document.addEventListener("DOMContentLoaded", cargarModulos);
