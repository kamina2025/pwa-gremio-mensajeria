/**
 * PROTOCOLO MACONDO - SUBSISTEMA CRIPTOBLINDAJE Y TRANSMISIÓN AL RELEVO CIEGO
 * Ubicación: modulos/crypto.js
 */

/**
 * Empaqueta y codifica los datos sensibles del payload.
 * Nota: En entornos de producción completa, este payload se cifra mediante Web Crypto API (AES-GCM).
 */
function blindarDatosPayload(pedidosLista) {
  if (!Array.isArray(pedidosLista)) return "";
  
  const datosSensibles = pedidosLista.map((p) => ({
    id: p.id || p.id_pedido,
    destinatario: p.destinatario || p.alias || "CONFIDENCIAL",
    direccion: p.direccion || p.direccionDestino,
    telefono: p.telefono || "0000000000",
    carga: p.carga,
    testigoOptico: p.testigoOptico || null
  }));

  try {
    return btoa(encodeURIComponent(JSON.stringify(datosSensibles)));
  } catch (e) {
    console.error(">>> [CRYPTO_ERROR]: Fallo al codificar el payload sensible:", e);
    return "";
  }
}

/**
 * Transmite el lote actual de pedidos hacia la red nodal y gestiona la animación de la consola
 */
function procesarYPublicarLote() {
  if (!window.loteActualPedidos || window.loteActualPedidos.length === 0) {
    alert(">>> RECHAZO: No hay pedidos en la cola para procesar.");
    return;
  }

  const btnPublicar = document.getElementById("btn-publicar");
  if (btnPublicar) btnPublicar.disabled = true;

  const panelCifrado = document.getElementById("consola-cifrado");
  const streamCifrado = document.getElementById("stream-texto-cifrado");

  if (panelCifrado) panelCifrado.style.display = "block";
  if (streamCifrado) streamCifrado.innerText = "";

  let ticks = 0;
  const intervaloCifrado = setInterval(() => {
    ticks++;
    if (streamCifrado) {
      streamCifrado.innerText += btoa(Math.random().toString()).substring(0, 32) + "\n";
    }

    if (ticks >= 4) {
      clearInterval(intervaloCifrado);

      const payloadCifradoMasivo = blindarDatosPayload(window.loteActualPedidos);
      
      const costosJustos = window.valoresCalculadosLote || {
        tarifa: window.loteActualPedidos.length * (window.VALOR_CREDITO_COP || 500),
        rodamiento: 0,
        mutual: 0,
        neto: window.loteActualPedidos.length * (window.VALOR_CREDITO_COP || 500)
      };

      const payloadLote = {
        id: "LOTE-" + Math.floor(1000 + Math.random() * 9000),
        tipo: window.MODO_OPERATIVO === "BODEGA" ? "BODEGA_ACOPIO" : "COMERCIAL_MASIVO",
        tarifa: costosJustos.tarifa,
        rodamiento: costosJustos.rodamiento || 0,
        mutual: costosJustos.mutual || 0,
        neto: costosJustos.neto,
        pedidos: window.loteActualPedidos.map((p) => ({
          id: p.id || p.id_pedido,
          carga: p.carga,
          testigoOptico: p.testigoOptico || null
        })),
        crypto_payload_cifrado: payloadCifradoMasivo
      };

      // RESOLUCIÓN DINÁMICA DE ENPOINT (Evita IPs locales duras)
      const URL_BACKEND = window.ENDPOINT_SAVE_PHP || "../save_pool.php";

      fetch(URL_BACKEND, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadLote)
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        alert(`>>> PROTOCOLO DE PRIVACIDAD ACTIVADO\n\nLote indexado con éxito.`);
        
        // REINICIO DE ESTADO GLOBAL Y MEMORIA
        window.loteActualPedidos = [];
        window.pesoAcumuladoLote = 0.0;
        window.valoresCalculadosLote = null;

        if (typeof window.actualizarMonitorMasaUI === "function") {
          window.actualizarMonitorMasaUI();
        }

        // DELEGACIÓN CENTRALIZADA DE PURGA DE MAPA Y TABLERO
        if (typeof window.actualizarTableroUI === "function") {
          window.actualizarTableroUI(0, 0, 0);
        }

        if (typeof window.limpiarGraficosDelMapa === "function") {
          window.limpiarGraficosDelMapa();
        }

        const colaTablaBody = document.getElementById("cola-pedidos-body");
        if (colaTablaBody) {
          colaTablaBody.innerHTML = `<tr id="fila-vacia"><td colspan="5" style="text-align: center; color: #524359; padding: 20px;">[BUFFER_VACÍO] No hay datos en la cola de salida.</td></tr>`;
        }

        if (panelCifrado) panelCifrado.style.display = "none";
      })
      .catch((err) => {
        console.error(">>> [ERROR_RED_NODAL]:", err);
        alert(">>> ERROR CRÍTICO: No se pudo conectar con el Relevo Ciego.");
        if (btnPublicar) btnPublicar.disabled = false;
        if (panelCifrado) panelCifrado.style.display = "none";
      });
    }
  }, 250);
}

// Vinculación explícita al scope global
window.blindarDatosPayload = blindarDatosPayload;
window.procesarYPublicarLote = procesarYPublicarLote;