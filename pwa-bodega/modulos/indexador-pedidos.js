/**
 * PROTOCOLO MACONDO - SUBSISTEMA BODEGA: INDEXADOR DE PUNTOS DE ACOPIO (MODELO CRÉDITOS)
 * Ubicación: pwa-bodega/modulos/indexador-pedidos.js
 */

function simularHashFoto() {
    const inputFoto = document.getElementById("foto-paquete");
    if (inputFoto && inputFoto.files && inputFoto.files[0]) {
        window.hashFotoActual =
            "SHA256:" +
            Math.random().toString(16).substring(2, 10).toUpperCase() +
            "..." +
            Math.random().toString(16).substring(2, 6).toUpperCase();
        const lbl = document.getElementById("txt-hash-foto");
        if (lbl) {
            lbl.innerText = `[INTEGRIDAD_OK] ${window.hashFotoActual}`;
            lbl.style.color = "var(--neon-green)";
        }
    }
}

function agregarPedidoALote(event) {
    event.preventDefault();

    if (!window.hashFotoActual) {
        alert(">>> ERROR CRÍTICO: Debe cargar la fotografía del paquete para calcular su firma de integridad física.");
        return;
    }

    const textoCarga = document.getElementById("carga-detalle").value.trim();
    const pesoEstePedido = typeof window.extraerPesoNumerico === "function" ? window.extraerPesoNumerico(textoCarga) : 1.5;
    const limiteHardware = window.LIMITE_MASA_HARDWARE_MOTO || 15.0;

    if ((window.pesoAcumuladoLote || 0) + pesoEstePedido > limiteHardware) {
        alert(`>>> RECHAZO_DE_CARGA N0DAL:\n\nEl paquete excede el límite de estabilidad seguro restante (${(limiteHardware - (window.pesoAcumuladoLote || 0)).toFixed(1)} kg).`);
        return;
    }

    const idPedido = "#PNT-" + Math.floor(1000 + Math.random() * 9000);
    const nuevoPunto = {
        id: idPedido,
        destinatario: document.getElementById("doc-cliente").value.trim(),
        direccion: document.getElementById("dir-cliente").value.trim(),
        telefono: document.getElementById("tel-cliente").value.trim(),
        carga: textoCarga,
        pesoKg: pesoEstePedido,
        testigoOptico: window.hashFotoActual,
        creditos: 1,
        precioEspecifico: 500 // 1 Crédito = $500 COP comisión API
    };

    if (!window.loteActualPedidos) window.loteActualPedidos = [];
    window.loteActualPedidos.push(nuevoPunto);
    window.pesoAcumuladoLote = (window.pesoAcumuladoLote || 0) + pesoEstePedido;

    if (typeof window.actualizarMonitorMasaUI === "function") {
        window.actualizarMonitorMasaUI();
    }

    const origenInput = document.getElementById("origen-cliente") ? document.getElementById("origen-cliente").value.trim() : "";
    const CONTEXTO_GEOGRAFICO = ", Cali, Colombia";
    let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda") ? origenInput : origenInput + CONTEXTO_GEOGRAFICO;
    let destConContexto = nuevoPunto.direccion.toLowerCase().includes("cali") || nuevoPunto.direccion.toLowerCase().includes("miranda") ? nuevoPunto.direccion : nuevoPunto.direccion + CONTEXTO_GEOGRAFICO;

    // Actualización telemática basada en créditos y puntos de acopio
    if (typeof window.previsualizarRutaInmediata === "function") {
        window.previsualizarRutaInmediata(origConContexto, destConContexto);
    } else if (typeof window.actualizarTableroUI === "function") {
        window.actualizarTableroUI(0, 0, window.loteActualPedidos.length);
    }

    actualizarTablaCola();

    // Resetear campos del formulario
    document.getElementById("doc-cliente").value = "";
    document.getElementById("dir-cliente").value = "";
    document.getElementById("tel-cliente").value = "";
    document.getElementById("carga-detalle").value = "";
    window.hashFotoActual = "";

    const txtHashFoto = document.getElementById("txt-hash-foto");
    if (txtHashFoto) {
        txtHashFoto.innerText = "PENDIENTE: Capturar testigo óptico del paquete...";
        txtHashFoto.style.color = "";
    }
}

function actualizarTablaCola() {
    const tbody = document.getElementById("cola-pedidos-body");
    const btnPublicar = document.getElementById("btn-publicar");
    if (!tbody) return;

    if (!window.loteActualPedidos || window.loteActualPedidos.length === 0) {
        tbody.innerHTML = `<tr id="fila-vacia"><td colspan="8" style="text-align: center; color: #524359; padding: 20px;">[BUFFER_VACÍO] No hay datos en la cola de salida de bodega.</td></tr>`;
        if (btnPublicar) btnPublicar.disabled = true;
        return;
    }

    tbody.innerHTML = "";

    window.loteActualPedidos.forEach((pedido, indice) => {
        const nuevaFila = document.createElement("tr");
        nuevaFila.id = `fila-nodo-${indice}`;
        const letraParadaActual = String.fromCharCode(65 + indice);

        let opcionesSelector = "";
        window.loteActualPedidos.forEach((_, optIndice) => {
            const letraPosicionOpt = String.fromCharCode(65 + optIndice);
            const seleccionado = optIndice === indice ? "selected" : "";
            opcionesSelector += `<option value="${optIndice}" ${seleccionado}>Mover a Parada ${letraPosicionOpt}</option>`;
        });

        const valorCreditoCOP = 500;
        const costoPuntoCOP = pedido.precioEspecifico || valorCreditoCOP;

        const bloqueModoBodegaHTML = `
            <div class="bloque-soporte-bodega" style="font-size:0.75rem; font-family:monospace; line-height:1.3;">
                <div style="color: var(--neon-blue);"><span style="font-weight:bold;">Soporte Logístico:</span> Activo</div>
                <div style="color: var(--neon-green); font-weight: bold; margin-top: 3px; font-size: 0.7rem;">>>> TASA API: $${costoPuntoCOP.toLocaleString('es-CO')} COP</div>
            </div>`;

        nuevaFila.innerHTML = `
            <td style="color: var(--neon-blue); font-weight: bold; font-family: monospace;">[${letraParadaActual}] ${pedido.id}</td>
            <td>${pedido.destinatario}</td>
            <td>${pedido.direccion}</td>
            <td>${pedido.carga}</td>
            <td style="color: var(--neon-amber); font-family: monospace; font-size: 0.8rem; text-align: center;">
                <span style="color:var(--neon-blue);">1 CRÉDITO</span> <br>
                <span style="color: var(--neon-green); font-weight: bold;">$${costoPuntoCOP.toLocaleString('es-CO')} COP</span>
            </td>
            <td>${bloqueModoBodegaHTML}</td>
            <td>
                <select class="selector-posicion-nodo" data-idx="${indice}" onchange="intercambiarPosicionNodo(this.dataset.idx, this.value)" style="background:#0c080f; color:var(--neon-purple); border:1px solid rgba(138,43,226,0.5); font-family:monospace; font-size:0.7rem; padding:2px;">
                    ${opcionesSelector}
                </select>
            </td>
            <td style="font-size: 0.65rem; color: #79578a; font-family: monospace; word-break: break-all;">${pedido.testigoOptico || "PENDIENTE"}</td>
        `;

        tbody.appendChild(nuevaFila);
    });

    if (btnPublicar) btnPublicar.disabled = false;
}

function intercambiarPosicionNodo(indiceOrigen, indiceDestino) {
    indiceOrigen = parseInt(indiceOrigen, 10);
    indiceDestino = parseInt(indiceDestino, 10);
    if (isNaN(indiceOrigen) || isNaN(indiceDestino) || indiceOrigen === indiceDestino) return;

    const nodoAMover = window.loteActualPedidos.splice(indiceOrigen, 1)[0];
    window.loteActualPedidos.splice(indiceDestino, 0, nodoAMover);

    actualizarTablaCola();

    const origenInput = document.getElementById("origen-cliente") ? document.getElementById("origen-cliente").value.trim() : "";
    const ultimaDireccionLote = window.loteActualPedidos[window.loteActualPedidos.length - 1].direccion;
    const CONTEXTO_GEOGRAFICO = ", Cali, Colombia";

    let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda") ? origenInput : origenInput + CONTEXTO_GEOGRAFICO;
    let destConContexto = ultimaDireccionLote.toLowerCase().includes("cali") || ultimaDireccionLote.toLowerCase().includes("miranda") ? ultimaDireccionLote : ultimaDireccionLote + CONTEXTO_GEOGRAFICO;

    if (typeof window.previsualizarRutaInmediata === "function") {
        window.previsualizarRutaInmediata(origConContexto, destConContexto);
    }
}

async function cerrarLoteYCompilarElRevelo() {
    console.log(">>> [COMPILADOR_BODEGA]: Empaquetando lote inmutable de puntos...");

    try {
        if (!window.loteActualPedidos || window.loteActualPedidos.length === 0) {
            alert("El buffer de bodega está vacío. Indexe puntos de acopio antes de compilar.");
            return;
        }

        window.loteActualPedidos = [];
        if (window.lotePedidosMemoria) window.lotePedidosMemoria = [];
        window.pesoAcumuladoLote = 0;

        if (typeof window.limpiarGraficosDelMapa === "function") {
            window.limpiarGraficosDelMapa();
        }

        if (typeof window.actualizarTableroUI === "function") {
            window.actualizarTableroUI(0, 0, 0);
        }

        actualizarTablaCola();

        console.log(">>> [UI_REFRESH]: Matriz de puntos reseteada a cero.");
        alert("Lote de bodega compilado con éxito. Datos propagados al pool descentralizado.");

    } catch (error) {
        console.error(">>> [COMPILADOR_FAIL]: Error crítico al compilar el lote de bodega.", error);
    }
}

// Inyección al Scope Global
window.simularHashFoto = simularHashFoto;
window.agregarPedidoALote = agregarPedidoALote;
window.actualizarTablaCola = actualizarTablaCola;
window.intercambiarPosicionNodo = intercambiarPosicionNodo;
window.cerrarLoteYCompilarElRevelo = cerrarLoteYCompilarElRevelo;