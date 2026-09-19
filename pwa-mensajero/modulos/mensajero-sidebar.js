/**
 * PROTOCOLO MACONDO - GESTOR DE SIDEBAR Y MENÚS
 * Ubicación: pwa-mensajero/modulos/mensajero-sidebar.js
 */

/**
 * Cierra todos los subménús desplegados actualmente en el sidebar.
 */
export function cerrarTodosLosSubmenus() {
    const submenusAbiertos = document.querySelectorAll(".menu-item-has-submenu.open");
    submenusAbiertos.forEach((item) => item.classList.remove("open"));
}

export function inicializarControlSidebar() {
    const dashboard = document.querySelector(".dashboard-container");
    const toggleMenuBtn = document.getElementById("toggle-menu-btn");

    if (toggleMenuBtn && dashboard) {
        toggleMenuBtn.onclick = (e) => {
            e.stopPropagation();
            const estaColapsando = !dashboard.classList.contains("collapsed");
            dashboard.classList.toggle("collapsed");

            // Si se colapsa/cierra el sidebar, cerramos todos los subménús abiertos
            if (estaColapsando) {
                cerrarTodosLosSubmenus();
            }

            console.log("🔘 [Sidebar]: Estado 'collapsed' alternado manualmente.");
        };
    }
}

export function manejarClicSubmenu(btnSubmenu, event = null) {
    if (event) {
        event.stopPropagation(); // Previene la propagación indeseada del evento
    }

    const parentItem = btnSubmenu.closest(".menu-item-has-submenu");
    if (parentItem) {
        const estaAbierto = parentItem.classList.contains("open");

        // Cierra los demás subménús que no sean el actual
        cerrarTodosLosSubmenus();

        // Alterna el estado del actual
        if (!estaAbierto) {
            parentItem.classList.add("open");
        }
    }
}

export function manejarNavegacionSidebar(btnNav, callbackCambioPestana) {
    const targetId = btnNav.getAttribute("data-target");
    if (!targetId) return;

    const targetElement = document.getElementById(targetId);
    if (!targetElement) return;

    // Colapsar el sidebar y cerrar subménús en pantallas pequeñas (<768px) al navegar
    const dashboardContainer = document.querySelector(".dashboard-container");
    if (dashboardContainer && window.innerWidth < 768) {
        dashboardContainer.classList.add("collapsed");
        cerrarTodosLosSubmenus();
    }

    if (targetElement.classList.contains("modal-overlay")) {
        targetElement.classList.add("activo");
    } else if (targetElement.classList.contains("contenedor-pestana")) {
        document.querySelectorAll(".contenedor-pestana").forEach((p) => p.classList.remove("activa"));
        document.querySelectorAll(".sidebar .nav-btn").forEach((b) => b.classList.remove("active"));

        targetElement.classList.add("activa");
        btnNav.classList.add("active");

        if (typeof callbackCambioPestana === "function") {
            callbackCambioPestana(targetId);
        }
    }
}