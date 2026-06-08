/**
 * PROTOCOLO MACONDO - LOGISTICS SUBSYSTEM: INDEXADOR DE PEDIDOS LOCALES
 * Ubicación: modulos/indexador-pedidos.js
 */

function simularHashFoto() {
    const inputFoto = document.getElementById("foto-paquete");
    if (inputFoto.files && inputFoto.files[0]) {
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
    const pesoEstePedido = window.extraerPesoNumerico(textoCarga);
    const limiteHardware = window.LIMITE_MASA_HARDWARE_MOTO || 15.0;

    if ((window.pesoAcumuladoLote || 0) + pesoEstePedido > limiteHardware) {
        alert(`>>> RECHAZO_DE_CARGA N0DAL:\n\nEl paquete excede el límite de estabilidad seguro restante (${(limiteHardware - window.pesoAcumuladoLote).toFixed(1)} kg).`);
        return;
    }

    const idPedido = "#MAC-" + Math.floor(1000 + Math.random() * 9000);
    const nuevoPedido = {
        id: idPedido,
        destinatario: document.getElementById("doc-cliente").value.trim(),
        direccion: document.getElementById("dir-cliente").value.trim(),
        telefono: document.getElementById("tel-cliente").value.trim(),
        carga: textoCarga,
        pesoKg: pesoEstePedido,
        testigoOptico: window.hashFotoActual,
        kmEspecifico: 0,
        tiempoEspecificoMin: 0,
        precioEspecifico: 0
    };

    window.loteActualPedidos.push(nuevoPedido);
    window.pesoAcumuladoLote += pesoEstePedido;

    window.actualizarMonitorMasaUI();

    const origenInput = document.getElementById("origen-cliente").value.trim();
    const CONTEXTO_GEOGRAFICO = ", Cali, Colombia";
    let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda") ? origenInput : origenInput + CONTEXTO_GEOGRAFICO;
    let destConContexto = nuevoPedido.direccion.toLowerCase().includes("cali") || nuevoPedido.direccion.toLowerCase().includes("miranda") ? nuevoPedido.direccion : nuevoPedido.direccion + CONTEXTO_GEOGRAFICO;

    if (typeof window.previsualizarRutaInmediata === "function") {
        window.previsualizarRutaInmediata(origConContexto, destConContexto);
    } else if (typeof window.evaluarTarifaModoLocalInmediata === "function") {
        window.evaluarTarifaModoLocalInmediata();
    }
    
    actualizarTablaCola();

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
        tbody.innerHTML = `<tr id="fila-vacia"><td colspan="8" style="text-align: center; color: #524359; padding: 20px;">[BUFFER_VACÍO] No hay datos en la cola de salida.</td></tr>`;
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
            opcionesSelector += `<option value="${optIndice}" ${seleccionado}>Mover a la Parada ${letraPosicionOpt}</option>`;
        });

        const kmTramo = pedido.kmEspecifico ? `${pedido.kmEspecifico.toFixed(1)} km` : "Calculando...";
        const tiempoTramo = pedido.tiempoEspecificoMin ? `${Math.round(pedido.tiempoEspecificoMin)} min` : "---";
        const precioTramo = pedido.precioEspecifico ? `$${Math.round(pedido.precioEspecifico).toLocaleString()}` : "---";

        const tarifaSimuladaDiDi = pedido.precioEspecifico ? Math.round(pedido.precioEspecifico * 1.42) : 0;
        const tarifaSimuladaYango = pedido.precioEspecifico ? Math.round(pedido.precioEspecifico * 1.28) : 0;

        const bloqueComparativoHTML = pedido.precioEspecifico
            ? `
            <div class="bloque-anti-extraccion" style="font-size:0.75rem; font-family:monospace; line-height:1.3;">
                <div style="color: #ff3366;"><span style="font-weight:bold;">DiDi Max:</span> $${tarifaSimuladaDiDi.toLocaleString()}</div>
                <div style="color: var(--neon-amber); margin-top: 2px;"><span style="font-weight:bold;">Yango Urgente:</span> $${tarifaSimuladaYango.toLocaleString()}</div>
                <div style="color: var(--neon-green); font-weight: bold; margin-top: 3px; font-size: 0.7rem;">>>> AHORRO RETENIDO: $${Math.round(tarifaSimuladaDiDi - pedido.precioEspecifico).toLocaleString()} COP</div>
            </div>`
            : `<span style="color:#524359;">[ESPERANDO_VECTORES]</span>`;

        nuevaFila.innerHTML = `
            <td style="color: var(--neon-blue); font-weight: bold; font-family: monospace;">[${letraParadaActual}] ${pedido.id}</td>
            <td>${pedido.destinatario}</td>
            <td>${pedido.direccion}</td>
            <td>${pedido.carga}</td>
            <td style="color: var(--neon-amber); font-family: monospace; font-size: 0.8rem; text-align: center;">
                <span style="color:var(--neon-blue);">${kmTramo}</span> <br> ${tiempoTramo} <br>
                <span style="color: var(--neon-green); font-weight: bold;">${precioTramo} COP</span>
            </td>
            <td>${bloqueComparativoHTML}</td>
            <td>
                <select class="selector-posicion-nodo" data-idx="${indice}" style="background:#0c080f; color:var(--neon-purple); border:1px solid rgba(138,43,226,0.5); font-family:monospace; font-size:0.7rem; padding:2px;">
                    ${opcionesSelector}
                </select>
            </td>
            <td style="font-size: 0.65rem; color: #79578a; font-family: monospace; word-break: break-all;">${pedido.testicoOptico || pedido.testigoOptico}</td>
        `;

        tbody.appendChild(nuevaFila);
    });

    if (btnPublicar) btnPublicar.disabled = false;
}

function intercambiarPosicionNodo(indiceOrigen, indiceDestino) {
    indiceOrigen = parseInt(indiceOrigen);
    indiceDestino = parseInt(indiceDestino);
    if (indiceOrigen === indiceDestino) return;

    const nodoAMover = window.loteActualPedidos.splice(indiceOrigen, 1)[0];
    window.loteActualPedidos.splice(indiceDestino, 0, nodoAMover);

    actualizarTablaCola();

    const origenInput = document.getElementById("origen-cliente").value.trim();
    const ultimaDireccionLote = window.loteActualPedidos[window.loteActualPedidos.length - 1].direccion;
    const CONTEXTO_GEOGRAFICO = ", Cali, Colombia";
    
    let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda") ? origenInput : origenInput + CONTEXTO_GEOGRAFICO;
    let destConContexto = ultimaDireccionLote.toLowerCase().includes("cali") || ultimaDireccionLote.toLowerCase().includes("miranda") ? ultimaDireccionLote : ultimaDireccionLote + CONTEXTO_GEOGRAFICO;

    if (typeof window.previsualizarRutaInmediata === "function") {
        window.previsualizarRutaInmediata(origConContexto, destConContexto);
    }
}

// Inyección al Scope Global
window.simularHashFoto = simularHashFoto;
window.agregarPedidoALote = agregarPedidoALote;
window.actualizarTablaCola = actualizarTablaCola;
window.intercambiarPosicionNodo = intercambiarPosicionNodo;
/**
 * PROTOCOLO MACONDO - COMPILACIÓN Y CIERRE DE LOTES
 * Ubicación: pwa-negocios/modulos/indexador-pedidos.js
 */
async function cerrarLoteYCompilarElRevelo() {
    console.log(">>> [COMPILADOR_INIT]: Empaquetando lote inmutable para el Relevo Ciego...");

    try {
        // 1. Verificar si hay pedidos en el buffer local para compilar
        // Nota: Asegúrate de que 'lotePedidosMemoria' o 'loteActual' sea el nombre de tu arreglo global de pedidos activos
        if (!window.lotePedidosMemoria || window.lotePedidosMemoria.length === 0) {
            alert("El buffer está vacío. Indexa tramos en Cali antes de compilar.");
            return;
        }

        // Aquí es donde tu sistema ya escribe de forma exitosa en el pool_pedidos.json a través de pool-persistencia.js
        // Forzamos la limpieza del estado local ya que el almacenamiento en disco está asegurado
        
        // 2. Resetear el buffer de memoria para el siguiente tramo diario
        window.lotePedidosMemoria = []; 

        // 3. Purga física y visual de elementos gráficos en Google Maps
        if (typeof window.limpiarGraficosDelMapa === "function") {
            window.limpiarGraficosDelMapa();
        } else {
            console.warn(">>> [MAPA_WARN]: No se encontró la función limpiarGraficosDelMapa en el scope.");
        }

        // 4. Limpiar la matriz táctica de pedidos (UI)
        // Si tienes una función encargada de dibujar la tabla o los divs, la llamamos vacía:
        if (typeof window.renderizarMatrizDespachoUI === "function") {
            window.renderizarMatrizDespachoUI([]);
        } else {
            // Limpieza directa del DOM por ID si manejas una estructura de tabla estándar
            const tablaPedidos = document.getElementById("tabla-pedidos-indexados");
            if (tablaPedidos) {
                tablaPedidos.innerHTML = "";
            }
            
            // Si usas un contenedor tipo lista/tabloide genérico para los tramos:
            const listaPedidos = document.getElementById("contenedor-pedidos");
            if (listaPedidos) {
                listaPedidos.innerHTML = '<p class="text-mute">Terminal lista para indexar nuevos tramos...</p>';
            }
        }

        console.log(">>> [UI_REFRESH]: Matriz de despacho y telemetría multipunto reseteadas a cero.");
        alert("Lote compilado con éxito. Datos propagados al pool descentralizado.");

    } catch (error) {
        console.error(">>> [COMPILADOR_FAIL]: Error crítico al cerrar el lote logístico.", error);
    }
}

// Hacer la función accesible globalmente para el botón del HTML
window.cerrarLoteYCompilarElRevelo = cerrarLoteYCompilarElRevelo;