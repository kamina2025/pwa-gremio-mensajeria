/**
 * PROTOCOLO MACONDO - PRINCIPAL LOGISTICS CORE INTERFACE ORCHESTRATOR
 * Ubicación: modulos/interface.js
 */

// Orquestación y Delegación de Eventos en Caliente
document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.actualizarPanelRutasUI === "function") window.actualizarPanelRutasUI();
    if (typeof window.actualizarMonitorMasaUI === "function") window.actualizarMonitorMasaUI();

    // Capturar reordenamiento en selectores de paradas dinámicos
    document.addEventListener("change", (e) => {
        if (e.target.classList.contains("selector-posicion-nodo")) {
            const idxOrigen = e.target.getAttribute("data-idx");
            if (typeof window.intercambiarPosicionNodo === "function") {
                window.intercambiarPosicionNodo(idxOrigen, e.target.value);
            }
        }
    });

    // Capturar cancelación de lotes en la pool sin romper scopes
    document.addEventListener("click", (e) => {
        const botonCancelar = e.target.closest(".btn-cancelar-solicitud");
        if (botonCancelar) {
            const idLote = botonCancelar.getAttribute("data-id");
            if (typeof window.eliminarSolicitudPoolEnDisco === "function") {
                window.eliminarSolicitudPoolEnDisco(idLote);
            }
        }
    });
});
/**
 * CAPA DE ESCUCHA: MANEJADOR DE SOBERANÍA CRIPTOGRÁFICA DE IDENTIDAD
 */
document.addEventListener("DOMContentLoaded", () => {
    const formIdentidad = document.getElementById("form-registro-nodal");
    if (formIdentidad) {
        formIdentidad.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById("reg-nombre").value.trim();
            const tipo = document.getElementById("reg-tipo").value;
            const telefono = document.getElementById("reg-telefono").value.trim();
            const direccion = document.getElementById("reg-direccion").value.trim();
            const pgpInvitador = document.getElementById("reg-invitador").value;

            if (!nombre || !telefono || !direccion) {
                alert(">>> ERROR: Todos los campos del nodo son requeridos para derivar la firma.");
                return;
            }

            // 1. Invocar el motor criptográfico ECDSA local
            if (typeof window.generarNuevaCedulaNodal === "function" && typeof window.registrarCedulaEnDisco === "function") {
                const nuevaCedula = await window.generarNuevaCedulaNodal(nombre, tipo, telefono, direccion, pgpInvitador);
                
                if (nuevaCedula) {
                    // 2. Registrar asíncronamente en el Blind Relay cedulas_registro.json
                    const exitoDisco = await window.registrarCedulaEnDisco(nuevaCedula);
                    if (exitoDisco) {
                        alert(`>>> CÉDULA NODAL GENERADA CON ÉXITO <<<\n\nID: ${nuevaCedula.id_firma_nodal}\nCapacidad Inicial: ASINCRÓNICA (Límite: 1 pedido activo)\n\nLas llaves asimétricas han sido inyectadas en el chasis de su navegador.`);
                        
                        // Invocar la función nativa del HTML para abrir la consola automáticamente
                        if (typeof verificarAccesoCedulaAlArranque === "function") {
                            verificarAccesoCedulaAlArranque();
                        }
                    }
                }
            } else {
                console.error(">>> [ERROR]: El script modulos/cedula-nodal.js no se ha cargado correctamente.");
            }
        });
    }
});