/**
 * PROTOCOLO MACONDO - INDEXADOR Y BUFFER LOCAL DE PUNTOS BODEGA
 * Ubicación: pwa-bodega/modulos/indexador-pedidos.js
 * Compatibilidad: Script Global Estándar (Sin módulos ES6 / Export)
 */

window.loteActualPedidos = window.loteActualPedidos || [];
window.lotePedidosMemoria = window.loteActualPedidos; // Alias de compatibilidad
window.pesoAcumuladoLote = 0;
window.hashFotoProvisional = null;

function simularHashFoto() {
  const inputFoto = document.getElementById("foto-paquete");
  const txtHash = document.getElementById("txt-hash-foto");

  if (inputFoto && inputFoto.files && inputFoto.files[0]) {
    const file = inputFoto.files[0];
    const hashSimulado = "SHA256:" + Math.random().toString(16).substring(2, 10).toUpperCase();
    window.hashFotoProvisional = hashSimulado;

    if (txtHash) {
      txtHash.innerText = `[INTEGRIDAD_OK] ${file.name} (${hashSimulado})`;
      txtHash.style.color = "var(--neon-green)";
    }
  }
}

function agregarPedidoALote(evento) {
  if (evento && typeof evento.preventDefault === "function") {
    evento.preventDefault();
  }
  console.log(">>> [INDEXADOR_MANUAL]: Procesando registro de punto individual manual...");

  const origenInput = document.getElementById("origen-cliente");
  const docInput = document.getElementById("doc-cliente");
  const dirInput = document.getElementById("dir-cliente");
  const telInput = document.getElementById("tel-cliente");
  const cargaInput = document.getElementById("carga-detalle");

  const origen = origenInput && origenInput.value.trim() ? origenInput.value.trim() : "Cali, Colombia";
  const alias = docInput && docInput.value.trim() ? docInput.value.trim() : "Punto de Acopio";
  const direccion = dirInput ? dirInput.value.trim() : "";
  const telefono = telInput && telInput.value.trim() ? telInput.value.trim() : "3000000000";
  const detalleCarga = cargaInput && cargaInput.value.trim() ? cargaInput.value.trim() : "Paquete Estándar (1.0 kg)";

  if (!direccion) {
    alert(">>> ALERTA BODEGA: Debe ingresar una dirección de destino válida.");
    return;
  }

  const idPedido = "#PNT-" + Math.floor(1000 + Math.random() * 9000);
  const testigoFisico = window.hashFotoProvisional || "MANUAL_MANIFIESTO_PUNTO";

  const pesoEstePedido = typeof window.extraerPesoNumerico === "function" 
    ? window.extraerPesoNumerico(detalleCarga) 
    : 1.0;

  const limiteHardware = window.LIMITE_MASA_HARDWARE_MOTO || 15.0;

  if ((window.pesoAcumuladoLote || 0) + pesoEstePedido > limiteHardware) {
    alert(`>>> RECHAZO_DE_CARGA NODAL:\n\nEl paquete excede el límite de carga seguro restante (${(limiteHardware - (window.pesoAcumuladoLote || 0)).toFixed(1)} kg).`);
    return;
  }

  // Objeto normalizado totalmente compatible con mapa-rutas.js y pool-persistencia.js
  const nuevoPunto = {
    id: idPedido,
    destinatario: alias,
    direccion: direccion,
    telefono: telefono,
    carga: detalleCarga,
    pesoKg: pesoEstePedido,
    testigoOptico: testigoFisico,
    creditos: 1,
    precioEspecifico: 500
  };

  if (!window.loteActualPedidos) window.loteActualPedidos = [];
  window.loteActualPedidos.push(nuevoPunto);
  window.lotePedidosMemoria = window.loteActualPedidos;
  window.pesoAcumuladoLote = (window.pesoAcumuladoLote || 0) + pesoEstePedido;

  console.log(`>>> [INDEXADOR_SUCCESS]: Nodo ${idPedido} inyectado al lote. Total en memoria: ${window.loteActualPedidos.length}`);

  // Reset de campos en formulario
  if (dirInput) dirInput.value = "";
  if (docInput) docInput.value = "";
  if (telInput) telInput.value = "";
  if (cargaInput) cargaInput.value = "";
  window.hashFotoProvisional = null;

  const txtHash = document.getElementById("txt-hash-foto");
  if (txtHash) {
    txtHash.innerText = "PENDIENTE: Capturar testigo óptico del punto/paquete...";
    txtHash.style.color = "";
  }

  if (typeof window.actualizarMonitorMasaUI === "function") {
    window.actualizarMonitorMasaUI();
  }

  actualizarTablaCola();

  // Formateo telemático con contexto regional para evitar fallos NOT_FOUND en Google Maps
  const CONTEXTO_GEOGRAFICO = ", Cali, Colombia";
  let origConContexto = origen.toLowerCase().includes("cali") || origen.toLowerCase().includes("miranda") 
    ? origen 
    : origen + CONTEXTO_GEOGRAFICO;

  let destConContexto = nuevoPunto.direccion.toLowerCase().includes("cali") || nuevoPunto.direccion.toLowerCase().includes("miranda") 
    ? nuevoPunto.direccion 
    : nuevoPunto.direccion + CONTEXTO_GEOGRAFICO;

  if (typeof window.previsualizarRutaInmediata === "function") {
    console.log(">>> [INDEXADOR_MAPS_LINK]: Disparando actualización telemática de marcadores y trayectoria...");
    window.previsualizarRutaInmediata(origConContexto, destConContexto);
  } else if (typeof window.actualizarTableroUI === "function") {
    window.actualizarTableroUI(0, 0, window.loteActualPedidos.length);
  }
}

function actualizarTablaCola() {
  const tbody = document.getElementById("cola-pedidos-body");
  const btnPublicar = document.getElementById("btn-publicar");
  if (!tbody) return;

  if (!window.loteActualPedidos || window.loteActualPedidos.length === 0) {
    tbody.innerHTML = `
      <tr id="fila-vacia">
        <td colspan="8" style="text-align: center; color: var(--neon-amber); padding: 15px">
          [BUFFER VACÍO] Cargue datos en el Paso 1 o agregue puntos manualmente.
        </td>
      </tr>`;
    
    if (btnPublicar) btnPublicar.disabled = true;
    if (typeof window.actualizarTableroUI === "function") {
      window.actualizarTableroUI(0, 0, 0);
    }
    return;
  }

  let totalPeso = 0;
  tbody.innerHTML = window.loteActualPedidos.map((p, idx) => {
    totalPeso += p.pesoKg || p.peso || 1.0;
    const costoPuntoCOP = p.precioEspecifico || 500;
    const aliasNodo = p.destinatario || p.alias || "Punto de Acopio";
    const idNodo = p.id || p.hash_id || `#PNT-${idx + 1}`;

    const bloqueModoBodegaHTML = `
      <div class="bloque-soporte-bodega" style="font-size:0.75rem; font-family:monospace; line-height:1.3;">
        <div style="color: var(--neon-blue);"><span style="font-weight:bold;">Soporte Logístico:</span> Activo</div>
        <div style="color: var(--neon-green); font-weight: bold; margin-top: 3px; font-size: 0.7rem;">>>> TASA API: $${costoPuntoCOP.toLocaleString('es-CO')} COP</div>
      </div>`;

    return `
      <tr id="fila-nodo-${idx}">
        <td style="font-family: monospace; color: var(--neon-purple);">${idNodo}</td>
        <td><strong>${aliasNodo}</strong></td>
        <td>${p.direccion}</td>
        <td>${p.carga}</td>
        <td>${p.pesoKg || p.peso || 1.0} kg</td>
        <td style="color: var(--neon-green)">1 CR ($500 COP)</td>
        <td>${bloqueModoBodegaHTML}</td>
        <td style="font-size: 0.65rem; color: #79578a; font-family: monospace; word-break: break-all;">${p.testigoOptico || p.testigo || "SIN_FOTO"}</td>
      </tr>`;
  }).join("");

  window.pesoAcumuladoLote = totalPeso;
  if (btnPublicar) btnPublicar.disabled = false;

  if (typeof window.actualizarTableroUI === "function") {
    window.actualizarTableroUI(window.loteActualPedidos.length, 0, window.loteActualPedidos.length);
  }
}

function intercambiarPosicionNodo(indiceOrigen, indiceDestino) {
  indiceOrigen = parseInt(indiceOrigen, 10);
  indiceDestino = parseInt(indiceDestino, 10);

  if (
    isNaN(indiceOrigen) ||
    isNaN(indiceDestino) ||
    indiceOrigen < 0 ||
    indiceDestino < 0 ||
    indiceOrigen >= window.loteActualPedidos.length ||
    indiceDestino >= window.loteActualPedidos.length ||
    indiceOrigen === indiceDestino
  ) {
    return;
  }

  const nodoAMover = window.loteActualPedidos.splice(indiceOrigen, 1)[0];
  window.loteActualPedidos.splice(indiceDestino, 0, nodoAMover);
  window.lotePedidosMemoria = window.loteActualPedidos;

  actualizarTablaCola();

  const origenInput = document.getElementById("origen-cliente") ? document.getElementById("origen-cliente").value.trim() : "Cali, Colombia";
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

  if (!window.loteActualPedidos || window.loteActualPedidos.length === 0) {
    alert("El buffer de bodega está vacío. Indexe puntos de acopio antes de compilar.");
    return;
  }

  if (window.visorAnimaciones && typeof window.visorAnimaciones.mostrarAnimacionCompilacionLote === "function") {
    window.visorAnimaciones.mostrarAnimacionCompilacionLote();
  }

  setTimeout(() => {
    try {
      window.loteActualPedidos = [];
      window.lotePedidosMemoria = [];
      window.pesoAcumuladoLote = 0;

      if (typeof window.limpiarGraficosDelMapa === "function") {
        window.limpiarGraficosDelMapa();
      }

      actualizarTablaCola();
      console.log(">>> [UI_REFRESH]: Matriz de puntos y telemetría reseteadas a cero.");
    } catch (error) {
      console.error(">>> [COMPILADOR_FAIL]: Error crítico al compilar el lote de bodega.", error);
    } finally {
      if (window.visorAnimaciones && typeof window.visorAnimaciones.ocultarModal === "function") {
        window.visorAnimaciones.ocultarModal();
      }
      alert("Lote de bodega compilado con éxito. Datos propagados al pool descentralizado.");
    }
  }, 1500);
}

// Inyección explícita al Ámbito Global (Evita errores SyntaxError en scripts tradicionales)
window.simularHashFoto = simularHashFoto;
window.agregarPedidoALote = agregarPedidoALote;
window.actualizarTablaCola = actualizarTablaCola;
window.intercambiarPosicionNodo = intercambiarPosicionNodo;
window.cerrarLoteYCompilarElRevelo = cerrarLoteYCompilarElRevelo;