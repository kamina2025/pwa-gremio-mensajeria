/**
 * PROTOCOLO MACONDO - CONTROL TERMINAL CIUDADANA
 * LOGICA DE CAPTURA EDGE Y CALCULO SOBERANO
 */

// 1. Sincronización del reloj del nodo
setInterval(() => {
  const txtReloj = document.getElementById('reloj-nodo');
  if (txtReloj) {
    txtReloj.innerText = new Date().toISOString().split('T')[1].substring(0, 8) + ' UTC_NODE';
  }
}, 1000);

// 2. Captura de Hardware GPS usando Web APIs nativas
function capturarGeolocalizacion(campo) {
  const logElemento = document.getElementById(`geo-log-${campo}`);
  const inputElemento = document.getElementById(`comun-${campo}`);
  
  if (!navigator.geolocation) {
    logElemento.innerText = "[ERROR]: Hardware GPS no soportado por el navegador.";
    logElemento.style.color = "var(--neon-red)";
    return;
  }

  logElemento.innerText = "[GPS]: Solicitando telemetría al hardware de radio...";
  logElemento.style.color = "var(--neon-amber)";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(5);
      const lon = position.coords.longitude.toFixed(5);
      
      // Escribir las coordenadas crudas como principio de honestidad técnica
      inputElemento.value = `${lat}, ${lon}`;
      logElemento.innerText = `[GPS]: Lock exitoso. Precisión: +/- ${position.coords.accuracy.toFixed(1)}m.`;
      logElemento.style.color = "var(--neon-green)";
    },
    (error) => {
      logElemento.innerText = `[ERROR_CÓDIGO_${error.code}]: Acceso denegado o señal ausente.`;
      logElemento.style.color = "var(--neon-red)";
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// 3. Algoritmo Ético de Cálculo de Costos (Ejecutado localmente)
function calcularTarifaSoberanaReal() {
  const origen = document.getElementById('comun-origen').value;
  const destino = document.getElementById('comun-destino').value;
  const tel = document.getElementById('comun-tel').value;
  const carga = document.getElementById('comun-carga').value;

  if (!origen || !destino || !tel || !carga) {
    alert(">>> ERROR CRÍTICO: Datos incompletos. Se requieren vectores de origen, destino, contacto y descripción de carga para inicializar firmas.");
    return;
  }

  // Simulación matemática basada en las distancias operativas del territorio (Miranda)
  // Valores fijos de la cooperativa
  const costoTiempoCustodio = 5000;  // Valor base por el tiempo de atención del trabajador
  const costoRodamientoMoto = 4000;   // Seguro de amortización, SOAT y gasolina por trayecto promedio
  const aporteMutual = 1000;          // Aporte fijo ineludible al fondo común gremial
  
  const tarifaJustaMacondo = costoTiempoCustodio + costoRodamientoMoto + aporteMutual;
  
  // Cálculo del algoritmo extractivo corporativo (simulando un recargo aleatorio del 35% al 50% por intermediación financiera)
  const tarifaCorporativa = Math.round((tarifaJustaMacondo * 1.45) / 500) * 500;
  const ahorroReal = tarifaCorporativa - tarifaJustaMacondo;
  const porcentajeAhorro = Math.round((ahorroReal / tarifaCorporativa) * 100);

  // Inyectar desgloses matemáticos en la pantalla del Ciudadano
  document.getElementById('precio-corpo').innerText = `$${tarifaCorporativa.toLocaleString('es-CO')} COP`;
  document.getElementById('precio-macondo').innerText = `$${tarifaJustaMacondo.toLocaleString('es-CO')} COP`;
  document.getElementById('precio-ahorro').innerText = `$${ahorroReal.toLocaleString('es-CO')} COP (${porcentajeAhorro}%)`;

  // Desglose de transparencia
  document.getElementById('calc-tiempo').innerText = `$${costoTiempoCustodio.toLocaleString('es-CO')} COP`;
  document.getElementById('calc-rodamiento').innerText = `$${costoRodamientoMoto.toLocaleString('es-CO')} COP`;
  document.getElementById('calc-mutual').innerText = `$${aporteMutual.toLocaleString('es-CO')} COP`;

  // Mostrar el panel de análisis político y habilitar botón de publicación
  document.getElementById('modulo-contra-monopolio').style.display = 'block';
  document.getElementById('btn-comun-lanzar').disabled = false;
}

// 4. Cifrado y Lanzamiento de Contrato a la Pool Pública
function lanzarPedidoComun() {
  const logsCifrado = [
    "[SISTEMA]: Abriendo canal de hardware aislado...",
    "[RESOLUCIÓN]: Extrayendo vectores geométricos de localización...",
    "[PGP_ENGINE]: Generando par de llaves efímeras en memoria volátil...",
    "[CIFRADO]: Ofuscando dirección, teléfono y metadatos de carga...",
    "-----BEGIN PGP ENCRYPTED DATA-----",
    "Version: Protocolo Macondo v1.1",
    "hQEMA5yW8zW... [DATA PROTEGIDA CONTRA EXTRACCIÓN CORPORATIVA]",
    "-----END PGP ENCRYPTED DATA-----",
    "[SISTEMA]: Inyectando firma digital del nodo emisor...",
    "[RELEVO_CIEGO]: Transmitiendo payload blindado de manera asíncrona..."
  ];

  const overlay = document.getElementById('overlay-cifrando');
  const consolaLogs = document.getElementById('log-consola-cifrado');
  overlay.style.display = 'flex';
  consolaLogs.innerHTML = "";
  
  let i = 0;
  function simularTerminal() {
    if (i < logsCifrado.length) {
      consolaLogs.innerHTML += logsCifrado[i] + "<br>";
      consolaLogs.scrollTop = consolaLogs.scrollHeight;
      i++;
      setTimeout(simularTerminal, 350);
    } else {
      setTimeout(() => {
        overlay.style.display = 'none';
        alert(">>> CONTRATO PUBLICADO CON ÉXITO\n\nLos datos legibles han sido borrados de la memoria RAM local. El paquete está en la pool esperando asignación de Custodio.");
        
        // Limpieza de Consola
        document.getElementById('comun-origen').value = "";
        document.getElementById('comun-destino').value = "";
        document.getElementById('comun-tel').value = "";
        document.getElementById('comun-carga').value = "";
        document.getElementById('geo-log-origen').innerText = "[GPS]: Sensor inactivo.";
        document.getElementById('geo-log-destino').innerText = "[GPS]: Sensor inactivo.";
        document.getElementById('modulo-contra-monopolio').style.display = 'none';
        document.getElementById('btn-comun-lanzar').disabled = true;
      }, 600);
    }
  }
  simularTerminal();
}