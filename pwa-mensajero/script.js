/**
 * PROTOCOLO MACONDO - PRINCIPAL CORE TERMINAL ORCHESTRATOR
 * Ubicación: pwa-mensajero/script.js
 */

// Inicialización de Estados de Hardware Globales
window.estaOnline = true;
window.contratoActivoActual = "#NINGUNO";
window.loteActualPedidos = [];
window.pesoAcumuladoLote = 0;

// Inicialización del Ledger en LocalStorage si está vacío
if (!localStorage.getItem("MACONDO_LEDGER")) {
  const historialBase = [
    { timestamp: "03-06 14:22", id: "#LOTE-8819", tarifa: 15000, rodamiento: 6000, mutual: 1000, neto: 8000 },
    { timestamp: "03-06 15:40", id: "#LOTE-8820", tarifa: 22000, rodamiento: 9000, mutual: 1000, neto: 12000 }
  ];
  localStorage.setItem("MACONDO_LEDGER", JSON.stringify(historialBase));
}

// Manejador del Despacho y Descifrado Criptográfico Táctico
async function ejecutarCustodia(idPedido) {
  const panelCifrado = document.getElementById("pantalla-cifrado");
  const logBox = document.getElementById("logCripto");
  if (panelCifrado) panelCifrado.style.display = "block";
  if (logBox) logBox.innerHTML = `[SISTEMA]: Inicializando derivación de llaves para ${idPedido}...<br>`;

  let poolCached = JSON.parse(localStorage.getItem("MACONDO_POOL")) || {};
  let ledger = JSON.parse(localStorage.getItem("MACONDO_LEDGER")) || [];

  if (!poolCached[idPedido]) {
    if (logBox)
      logBox.innerHTML += `<span style="color:var(--amber-alert)">[ERROR]: Lote no detectado en caché.</span><br>`;
    setTimeout(() => {
      if (panelCifrado) panelCifrado.style.display = "none";
    }, 1500);
    return;
  }

  const loteDestino = poolCached[idPedido];
  if (logBox) logBox.innerHTML += `[CRIPTOCUENTA]: Calculando llave privada local PGP_KEY...<br>`;

  // Invocar el descifrador táctico aislado en su módulo
  const datosRevelados = window.descifrarPayloadLocal(loteDestino.crypto_payload_cifrado);
  if (datosRevelados && logBox) {
    logBox.innerHTML += `<span style="color:var(--text-primary)">[REVELADO]: Direcciones vectoriales descifradas con éxito.</span><br>`;
  }

  const ahora = new Date();
  const timestampStr = `${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")} ${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

  const nuevaTransaccion = {
    timestamp: timestampStr,
    id: loteDestino.id,
    tarifa: loteDestino.tarifa || 15000,
    rodamiento: loteDestino.rodamiento || 6000,
    mutual: loteDestino.mutual || 1000,
    neto: loteDestino.neto || 8000
  };

  // Migración Física de Archivos en Disco PHP
  if (logBox) logBox.innerHTML += `[RED]: Transmitiendo mutación a transito_pedidos.json...<br>`;
  const exitoEscritura = await window.procesarCustodiaEnServidor(idPedido, loteDestino, nuevaTransaccion);

  if (exitoEscritura) {
    ledger.unshift(nuevaTransaccion);
    localStorage.setItem("MACONDO_LEDGER", JSON.stringify(ledger));
    window.contratoActivoActual = idPedido;
    if (logBox)
      logBox.innerHTML += `<span style="color:var(--crypto-secure)">[ÉXITO]: Relevo Ciego en XAMPP notificado.</span><br>`;
  }

  setTimeout(() => {
    if (panelCifrado) panelCifrado.style.display = "none";
    if (datosRevelados) {
      const rutaTexto = datosRevelados
        .map(
          (p) => `• Destinatario: ${p.destinatario}\n  Dirección Vectorial: ${p.direccion}\n  Contacto: ${p.telefono}`
        )
        .join("\n\n");
      alert(`>>> DIRECCIÓN DE DESPACHO DESCIFRADA <<<\n\n${rutaTexto}`);
    }
    window.sincronizarYRenderizarPool();
  }, 2000);
}

// Vinculación global de la función táctica para dispararse desde el HTML dinámico
window.ejecutarCustodia = ejecutarCustodia;

// Enrutador de Módulos Superior
document.addEventListener("DOMContentLoaded", () => {
  window.sincronizarYRenderizarPool();

  document.querySelectorAll(".menu-terminal .btn-terminal").forEach((boton) => {
    boton.addEventListener("click", (e) => {
      const targetBtn = e.target.closest(".btn-terminal");
      if (!targetBtn) return;

      document.querySelectorAll(".menu-terminal .btn-terminal").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".modulo-vista").forEach((m) => (m.style.display = "none"));

      targetBtn.classList.add("active");
      const moduloId = targetBtn.getAttribute("data-mod");
      document.getElementById(`mod-${moduloId}`).style.display = "block";

      // ... dentro de document.addEventListener("DOMContentLoaded", () => { ...
      if (moduloId === "tabloide") window.sincronizarYRenderizarPool();
      if (moduloId === "en-transito") window.sincronizarYRenderizarTransito(); // <--- AÑADE ESTA LÍNEA
      if (moduloId === "justicia") window.cargarModuloJusticia();
      if (moduloId === "billetera") window.calcularYRenderizarLibro();
    });
  });
});
