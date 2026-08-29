/**
 * Módulo para la gestión del saldo de créditos, billetera y navegación nodal
 */

export function obtenerSaldoCreditos() {
    return parseInt(localStorage.getItem("MACONDO_CREDITOS_BODEGA") || "0", 10);
}

export function actualizarUIBilletera() {
    const creditos = obtenerSaldoCreditos();
    const cop = creditos * 500;
    
    const displayCreditos = document.getElementById("saldo-creditos-display");
    const displayCop = document.getElementById("saldo-cop-display");
    
    if (displayCreditos) displayCreditos.innerText = `${creditos} CR`;
    if (displayCop) displayCop.innerText = `Equivalente a: $${cop.toLocaleString('es-CO')} COP`;
}

export function comprarCreditos(cantidad, precioCop) {
    const saldoActual = obtenerSaldoCreditos();
    const nuevoSaldo = saldoActual + cantidad;
    localStorage.setItem("MACONDO_CREDITOS_BODEGA", nuevoSaldo.toString());
    actualizarUIBilletera();
    alert(`[BILLETERA] Compra completada con éxito.\nSe añadieron ${cantidad} Créditos por $${precioCop.toLocaleString('es-CO')} COP.`);
}

export function verificarAccesoCedulaAlArranque() {
    const cedulaGuardada = localStorage.getItem("MACONDO_MI_CEDULA");
    if (cedulaGuardada) {
        const cedula = JSON.parse(cedulaGuardada);
        
        const txtNodo = document.getElementById("txt-nodo-id");
        const txtFooter = document.getElementById("txt-signature-footer");
        const tituloCentral = document.getElementById("titulo-central-nodo");
        const origenInput = document.getElementById("origen-cliente");

        if (txtNodo) txtNodo.innerText = `[BODEGA_SIGN: ${cedula.id_firma_nodal}]`;
        if (txtFooter) txtFooter.innerText = `CUSTODIO_SIGN: ${cedula.llave_publica_dispositivo.substring(0,25)}...`;
        if (tituloCentral) tituloCentral.innerText = `CONSOLA_BODEGA: ${cedula.nombre.toUpperCase()}`;
        if (origenInput) origenInput.value = cedula.direccion;

        document.getElementById("vista-bloqueo-seguro").style.display = "none";
        document.getElementById("menu-navegacion-principal").style.display = "flex";
        document.getElementById("modulo-operaciones-central").style.display = "block";
        
        actualizarUIBilletera();
        console.log(`>>> [AUTH_OK]: Cédula Bodega ${cedula.id_firma_nodal} validada.`);
    }
}

export function intentarAutenticacionLocalDirecta() {
    const cedulaGuardada = localStorage.getItem("MACONDO_MI_CEDULA");
    if (!cedulaGuardada) {
        alert(">>> RECHAZO_DE_ACCESO NODAL:\n\nNo se detectó ninguna firma en LocalStorage. Cree una Cédula Nodal arriba.");
        return;
    }
    verificarAccesoCedulaAlArranque();
}

export function conmutarPestanaMacondo(idContenedor, botonPresionado) {
    const idReal = idContenedor.toLowerCase();
    document.querySelectorAll(".contenedor-pestana").forEach((c) => c.classList.remove("activa"));
    document.querySelectorAll(".btn-pestana").forEach((b) => b.classList.remove("activa"));

    const pestañaSolicitada = document.getElementById(idReal);
    if (pestañaSolicitada) pestañaSolicitada.classList.add("activa");
    if (botonPresionado) botonPresionado.classList.add("activa");

    if (idReal.includes("monitorear") && typeof window.actualizarPanelRutasUI === "function") {
        window.actualizarPanelRutasUI();
    }
    
    if (idReal.includes("billetera")) {
        actualizarUIBilletera();
    }
}

// Exportar al ámbito global para handlers inline del HTML
window.comprarCreditos = comprarCreditos;
window.intentarAutenticacionLocalDirecta = intentarAutenticacionLocalDirecta;
window.conmutarPestanaMacondo = conmutarPestanaMacondo;