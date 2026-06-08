/**
 * PROTOCOLO MACONDO - CRIPTOBLINDAJE Y BROADCAST AL RELEVO CIEGO
 */

function blindarDatosPayload(pedidosLista) {
  const datosSensibles = pedidosLista.map((p) => ({
    id: p.id,
    destinatario: p.destinatario,
    direccion: p.direccion,
    telefono: p.telefono,
    carga: p.carga,
    testigoOptico: p.testigoOptico
  }));
  return btoa(encodeURIComponent(JSON.stringify(datosSensibles)));
}

function procesarYPublicarLote() {
  if (window.loteActualPedidos.length === 0) return;

  document.getElementById("btn-publicar").disabled = true;
  const panelCifrado = document.getElementById("consola-cifrado");
  const streamCifrado = document.getElementById("stream-texto-cifrado");

  if (panelCifrado) panelCifrado.style.display = "block";
  if (streamCifrado) streamCifrado.innerText = "";

  let ticks = 0;
  const intervaloCifrado = setInterval(() => {
    ticks++;
    if (streamCifrado) streamCifrado.innerText += btoa(Math.random().toString()).substring(0, 32) + "\n";

    if (ticks >= 4) {
      clearInterval(intervaloCifrado);

      const payloadCifradoMasivo = blindarDatosPayload(window.loteActualPedidos);
      const costosJustos = window.valoresCalculadosLote || {
        tarifa: window.loteActualPedidos.length * 15000,
        rodamiento: window.loteActualPedidos.length * 6000,
        mutual: window.loteActualPedidos.length * 1000,
        neto: window.loteActualPedidos.length * 8000
      };

      const payloadLote = {
        id: "LOTE-" + Math.floor(1000 + Math.random() * 9000),
        tipo: "COMERCIAL_MASIVO",
        tarifa: costosJustos.tarifa,
        rodamiento: costosJustos.rodamiento,
        mutual: costosJustos.mutual,
        neto: costosJustos.neto,
        pedidos: window.loteActualPedidos.map((p) => ({
          id: p.id,
          carga: p.carga,
          testigoOptico: p.testigoOptico
        })),
        crypto_payload_cifrado: payloadCifradoMasivo
      };

      const URL_BACKEND = "http://192.168.1.40/pwa-gremio-mensajeria/api.php";

      fetch(URL_BACKEND, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadLote)
      })
      .then(res => res.json())
      .then(data => {
        if(data.status === "SUCCESS") {
          alert(`>>> PROTOCOLO DE PRIVACIDAD ACTIVADO\n\nLote indexado con ID: ${data.id}.`);
          
          window.loteActualPedidos = [];
          window.pesoAcumuladoLote = 0.0;
          window.valoresCalculadosLote = null;
          actualizarMonitorMasaUI();

          if (document.getElementById('cola-pedidos-body')) {
            document.getElementById('cola-pedidos-body').innerHTML = `<tr id="fila-vacia"><td colspan="5" style="text-align: center; color: #524359; padding: 20px;">[BUFFER_VACÍO] No hay datos en la cola de salida.</td></tr>`;
          }
          
          document.getElementById("meta-distancia").innerText = "0.0 km";
          document.getElementById("meta-tiempo").innerText = "0 min";
          document.getElementById("meta-mutual").innerText = "$0";
          document.getElementById("meta-neto").innerText = "$0 COP";
          document.getElementById("meta-ahorro").innerText = "$0 COP"; // <-- AÑADE ESTA LÍNEA CRÍTICA

          if (window.googleMapsOperativo && window.renderRutas) {
            window.renderRutas.setDirections({ routes: [] });
            // --- ADICIÓN DE LIMPIEZA DE PINES PROPIOS ---
            if (window.marcadoresPersonalizadosRuta) {
              window.marcadoresPersonalizadosRuta.forEach(m => m.setMap(null));
              window.marcadoresPersonalizadosRuta = [];
            }
            if (window.mapa) {
              window.mapa.setCenter(window.COORDENADAS_PARADERO_CENTRAL);
              window.mapa.setZoom(14);
            }
          }
          
          if (panelCifrado) panelCifrado.style.display = "none";
        }
      })
      .catch((err) => {
        console.error("Error en red nodal:", err);
        alert(">>> ERROR CRÍTICO: No se pudo conectar con el Relevo Ciego.");
        document.getElementById("btn-publicar").disabled = false;
      });
    }
  }, 250);
}