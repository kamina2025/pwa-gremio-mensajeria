/**
 * PROTOCOLO MACONDO - GESTOR DE SIDEBAR Y MENÚS
 * Ubicación: pwa-mensajero/modulos/mensajero-sidebar.js
 */

export function inicializarControlSidebar() {
    const dashboard = document.querySelector(".dashboard-container");
    const toggleMenuBtn = document.getElementById("toggle-menu-btn");

    if (toggleMenuBtn && dashboard) {
        toggleMenuBtn.onclick = () => {
            dashboard.classList.toggle("collapsed");
            console.log("🔘 [Sidebar]: Estado 'collapsed' alternado manualmente.");
        };
    }
}

export function manejarClicSubmenu(btnSubmenu) {
    const parentItem = btnSubmenu.closest(".menu-item-has-submenu");
    if (parentItem) {
        const submenusAbiertos = document.querySelectorAll(".menu-item-has-submenu.open");
        submenusAbiertos.forEach((item) => {
            if (item !== parentItem) item.classList.remove("open");
        });
        parentItem.classList.toggle("open");
    }
}

export function manejarNavegacionSidebar(btnNav, callbackCambioPestana) {
    const targetId = btnNav.getAttribute("data-target");
    if (!targetId) return;

    const targetElement = document.getElementById(targetId);
    if (!targetElement) return;

    // Colapsar el sidebar ÚNICAMENTE en pantallas pequeñas (<768px) al navegar
    const dashboardContainer = document.querySelector(".dashboard-container");
    if (dashboardContainer && window.innerWidth < 768) {
        dashboardContainer.classList.add("collapsed");
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