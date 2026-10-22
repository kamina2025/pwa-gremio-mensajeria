/**
 * PROTOCOLO MACONDO - CARGADOR MODULAR Y REGISTRO SERVICE WORKER
 * Ubicación: pwa-mensajero/app.js
 * Arquitectura: Async Local-First (Service Worker + HTML Inserter Recursivo)
 */

// --- 1. REGISTRO DE SERVICE WORKER CON DESVINCULACIÓN DE CACHÉ ---
if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            // updateViaCache: 'none' impide que Chrome mantenga en caché el script sw.js
            const reg = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
            console.log("✅ [SW]: Registrado correctamente en ámbito:", reg.scope);
            
            // Forzar actualización inmediata si el archivo sw.js cambió en el servidor
            await reg.update();
        } catch (err) {
            console.error("❌ [SW]: Error crítico en el registro del Service Worker:", err);
        }
    });
}

// --- 2. CARGADOR MODULAR DESACOPLADO Y RECURSIVO ---
/**
 * Procesa dinámicamente todos los elementos con la etiqueta [data-include]
 * inyectando las vistas HTML de forma recursiva hasta resolver dependencias anidadas.
 */
async function cargarModulos() {
    console.group("🚀 [APP_LOADER]: Procesando inyección de componentes dinámicos...");
    
    let profundidadMax = 5; // Evita bucles infinitos en inclusions circulares
    let elementos = Array.from(document.querySelectorAll("[data-include]"));

    if (elementos.length === 0) {
        console.log("ℹ️ [APP_LOADER]: No se detectaron vistas dinámicas inmediatas.");
    }

    while (elementos.length > 0 && profundidadMax > 0) {
        console.log(`🔄 [APP_LOADER]: Procesando nivel de inyección (${elementos.length} componentes encontrados)`);
        
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
                    console.error(`❌ [APP_LOADER]: Error HTTP ${respuesta.status} al cargar '${archivo}'`);
                    el.innerHTML = `<div class="cyber-alert error-modulo">[ERROR HTTP ${respuesta.status}]: Módulo ${archivo} no disponible</div>`;
                    el.removeAttribute("data-include");
                }
            } catch (error) {
                console.warn(`⚠️ [APP_LOADER]: Modo Offline o fallo de red al cargar '${archivo}':`, error);
                el.innerHTML = `<div class="cyber-alert offline-modulo">[OFFLINE]: Imposible cargar ${archivo}</div>`;
                el.removeAttribute("data-include");
            }
        });

        await Promise.allSettled(tareasInyeccion);
        profundidadMax--;
        // Buscar elementos con data-include que se hayan inyectado dinámicamente
        elementos = Array.from(document.querySelectorAll("[data-include]"));
    }

    console.groupEnd();
    console.log("📢 [APP_LOADER]: Carga de componentes finalizada. Disparando evento 'modulosCargados'.");
    
    // Notificación desacoplada para el orquestador y controladores
    document.dispatchEvent(new CustomEvent("modulosCargados"));
}

// Inicialización
document.addEventListener("DOMContentLoaded", cargarModulos);