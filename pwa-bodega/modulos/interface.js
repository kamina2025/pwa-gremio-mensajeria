/**
 * PROTOCOLO MACONDO - PRINCIPAL LOGISTICS CORE INTERFACE ORCHESTRATOR
 * Ubicación: modulos/interface.js
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log(">>> [INTERFACE_INIT]: Inicializando orquestador visual y escuchas tácticas...");

    // 1. Carga inicial de datos persistidos en disco y monitores de masa
    if (typeof window.actualizarPanelRutasUI === "function") {
        window.actualizarPanelRutasUI();
    }
    if (typeof window.actualizarMonitorMasaUI === "function") {
        window.actualizarMonitorMasaUI();
    }

    // 2. Delegación de eventos en caliente: Reordenamiento en selectores de paradas dinámicos
    document.addEventListener("change", (e) => {
        if (e.target && e.target.classList.contains("selector-posicion-nodo")) {
            const idxOrigen = e.target.getAttribute("data-idx");
            const idxDestino = e.target.value;
            
            if (typeof window.intercambiarPosicionNodo === "function") {
                window.intercambiarPosicionNodo(idxOrigen, idxDestino);
            }
        }
    });

    // 3. Delegación de eventos en caliente: Cancelación/Revocación de solicitudes en la pool
    document.addEventListener("click", (e) => {
        const botonCancelar = e.target.closest(".btn-cancelar-solicitud");
        if (botonCancelar) {
            const idLote = botonCancelar.getAttribute("data-id");
            if (idLote && typeof window.eliminarSolicitudPoolEnDisco === "function") {
                window.eliminarSolicitudPoolEnDisco(idLote);
            }
        }
    });

    // 4. Capa de Escucha: Registro y Firma Criptográfica de Identidad Nodal (ECDSA)
    const formIdentidad = document.getElementById("form-registro-nodal");
    if (formIdentidad) {
        formIdentidad.addEventListener("submit", async (e) => {
            e.preventDefault();

            const inputNombre = document.getElementById("reg-nombre");
            const inputTipo = document.getElementById("reg-tipo");
            const inputTelefono = document.getElementById("reg-telefono");
            const inputDireccion = document.getElementById("reg-direccion");
            const inputInvitador = document.getElementById("reg-invitador");

            const nombre = inputNombre ? inputNombre.value.trim() : "";
            const tipo = inputTipo ? inputTipo.value : "NEGOCIO";
            const telefono = inputTelefono ? inputTelefono.value.trim() : "";
            const direccion = inputDireccion ? inputDireccion.value.trim() : "";
            const pgpInvitador = inputInvitador ? inputInvitador.value : "NODO_ORIGEN_LOCAL";

            if (!nombre || !telefono || !direccion) {
                alert(">>> ERROR: Todos los campos del nodo son requeridos para derivar la firma.");
                return;
            }

            // Invocar el motor criptográfico ECDSA local
            if (typeof window.generarNuevaCedulaNodal === "function" && typeof window.registrarCedulaEnDisco === "function") {
                const nuevaCedula = await window.generarNuevaCedulaNodal(nombre, tipo, telefono, direccion, pgpInvitador);

                if (nuevaCedula) {
                    // Registrar asíncronamente en cedulas_registro.json vía puente PHP
                    const exitoDisco = await window.registrarCedulaEnDisco(nuevaCedula);

                    if (exitoDisco) {
                        alert(
                            `>>> CÉDULA NODAL GENERADA CON ÉXITO <<<\n\n` +
                            `ID: ${nuevaCedula.id_firma_nodal}\n` +
                            `Capacidad Inicial: ASINCRÓNICA (Límite: 1 pedido activo)\n\n` +
                            `Las llaves asimétricas ECDSA han sido asentadas en su hardware.`
                        );

                        // Transición atómica de pantalla mediante el hook nativo o global disponible
                        if (typeof window.verificarAccesoCedulaAlArranque === "function") {
                            window.verificarAccesoCedulaAlArranque();
                        } else if (typeof window.inicializarModuloInterfaz === "function") {
                            window.inicializarModuloInterfaz(nuevaCedula);
                        } else {
                            // Fallback de transición directa si el modulo UI no está cargado externamente
                            const vistaBloqueo = document.getElementById("vista-bloqueo-seguro");
                            const menuNav = document.getElementById("menu-navegacion-principal");
                            const moduloOps = document.getElementById("modulo-operaciones-central");

                            if (vistaBloqueo) vistaBloqueo.style.display = "none";
                            if (menuNav) menuNav.style.display = "flex";
                            if (moduloOps) moduloOps.style.display = "block";
                        }
                    }
                }
            } else {
                console.error(">>> [ERROR_CRÍTICO]: El script modulos/cedula-nodal.js no está enlazado en el scope global.");
                alert(">>> ERROR: Subsistema de Cédulas Nodales no disponible.");
            }
        });
    }
});