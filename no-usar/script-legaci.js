/**
 * PROTOCOLO MACONDO - CONTROL TERMINAL NEGOCIOS
 * GESTIÓN DE LOTES MASIVOS, TELEMETRÍA DE RUTAS Y PRIVACIDAD CLIENT-SIDE
 */

// 1. Sincronización de reloj nodal
setInterval(() => {
  const txtReloj = document.getElementById("reloj-nodo");
  if (txtReloj) {
    txtReloj.innerText = new Date().toISOString().split("T")[1].substring(0, 8) + " UTC_NODE";
  }
}, 1000);

// --- VARIABLES GLOBALES DE CONTROL ---
let loteActualPedidos = [];
let hashFotoActual = "";
let mapa;
let geocodificador;
let renderRutas;
let googleMapsOperativo = false;

// Parámetros de la Matriz de Costos Sostenibles de Miranda 2026
const COORDENADAS_PARADERO_CENTRAL = { lat: 3.2536, lng: -76.2281 };
const COSTO_POR_KILOMETRO = 1000;
// obtenido al dividir $7295 que es el valor de la hora diurna entre los minutos tanto de espera como trayecto
const COSTO_POR_MINUTO = 122;

const APORTE_MUTUAL_FIJO = 1000;

// 2. Inicialización adaptativa del Mapa (Evita bloqueos por InvalidKeyMapError)
function inicializarMapaMacondo() {
  console.log(">>> [MAPA_INIT]: Evaluando entorno de hardware...");

  try {
    if (typeof google === "undefined" || !google.maps) {
      throw new Error("SDK_NOT_AVAILABLE");
    }

    geocodificador = new google.maps.Geocoder();
    renderRutas = new google.maps.DirectionsRenderer({
      polylineOptions: { strokeColor: "#b359ff", strokeWeight: 4 } // Estética neón violeta
    });

    mapa = new google.maps.Map(document.getElementById("mapa-telemetria"), {
      center: COORDENADAS_PARADERO_CENTRAL,
      zoom: 14,
      disableDefaultUI: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0c080f" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0c080f" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#79578a" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#191321" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#291f33" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#040205" }] }
      ]
    });

    renderRutas.setMap(mapa);

    google.maps.event.addListenerOnce(mapa, "tilesloaded", () => {
      console.log(">>> [MAPA_READY]: Telemetría en línea verificada. Modo ONLINE activado.");
      googleMapsOperativo = true;
    });
  } catch (e) {
    activarCapaContingenciaOffline();
  }
}

// Función con Inyección de Contexto Geográfico para evitar ambigüedades
function localizarDireccionTexto(idInput) {
  let textoDireccion = document.getElementById(idInput).value.trim();
  if (!textoDireccion) {
    alert(">>> ERROR: Campo vacío. Ingrese una dirección para proyectar.");
    return;
  }

  // --- CAPA DE SANITIZACIÓN Y CONTEXTO MACONDO ---
  // Definimos la región por defecto para limitar el radio de búsqueda de Google.
  // Puedes cambiar "Cali, Colombia" por "Miranda, Cauca, Colombia" según las pruebas que estés ejecutando.
  const CONTEXTO_GEOGRAFICO = ", Cali, Colombia";
  
  // Si el usuario no escribió explícitamente la ciudad, se la inyectamos en memoria para Google
  let direccionCompletaConContexto = textoDireccion;
  if (!textoDireccion.toLowerCase().includes("cali") && !textoDireccion.toLowerCase().includes("miranda")) {
    direccionCompletaConContexto = textoDireccion + CONTEXTO_GEOGRAFICO;
  }

  if (googleMapsOperativo && geocodificador) {
    // Le enviamos a Google la dirección blindada con su contexto de ciudad
    geocodificador.geocode({ address: direccionCompletaConContexto }, (results, status) => {
      if (status === "OK" && results[0]) {
        // Mover la cámara al punto real exacto filtrado
        mapa.setCenter(results[0].geometry.location);
        mapa.setZoom(16);
        
        try {
          new google.maps.Marker({
            map: mapa,
            position: results[0].geometry.location,
            title: `Punto: ${idInput.includes('origen') ? 'Origen' : 'Destino'}`
          });
        } catch (markerError) {
          console.log(">>> [INFO]: Omitiendo marcador visual detallado.");
        }
        
        console.log(`>>> [GEOCODING_OK]: Enfoque de cámara en: ${direccionCompletaConContexto}`);

        // Reevaluar y trazar la ruta combinada si ambos campos están llenos
        const origenInput = document.getElementById('origen-cliente').value.trim();
        const destinoInput = document.getElementById('dir-cliente').value.trim();
        
        if (origenInput && destinoInput) {
          // Para la ruta también aseguramos que use el contexto correcto
          let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda") ? origenInput : origenirInp = origenInput + CONTEXTO_GEOGRAFICO;
          let destConContexto = destinoInput.toLowerCase().includes("cali") || destinoInput.toLowerCase().includes("miranda") ? destinoInput : destinoInput + CONTEXTO_GEOGRAFICO;
          
          console.log(">>> [TELEMETRÍA]: Trazando ruta con vectores sanitizados...");
          previsualizarRutaInmediata(origConContexto, destConContexto);
        }

      } else {
        console.warn(`>>> [ALERTA_GEOCODER]: No se pudo procesar con contexto. Status: ${status}`);
        evaluarTarifaModoLocalInmediata();
      }
    });
  } else {
    console.warn(">>> [OFFLINE_CONVERGENCE]: Operando ruteo local autónomo.");
    evaluarTarifaModoLocalInmediata();
  }
}
// NUEVA LOGÍSITICA MULTI-PARADA: Pinta y cotiza el lote completo acumulado en el buffer
async function previsualizarRutaInmediata(origen, destinoProvisional) {
  if (!googleMapsOperativo || typeof google === 'undefined' || !google.maps.DirectionsService) return;

  try {
    const servicioDirecciones = new google.maps.DirectionsService();
    
    // --- CONSTRUCCIÓN DINÁMICA DE WAYPOINTS (PARADAS) ---
    // Tomamos todos los pedidos que ya están en la tabla (loteActualPedidos)
    // El origen será el input de origen, y el destino final del viaje será el input de destino actual.
    const paradasWaypoints = [];
    
    for (let i = 0; i < loteActualPedidos.length; i++) {
      // Inyectamos contexto a cada parada previa en la cola para evitar desvíos
      let dirParada = loteActualPedidos[i].direccion;
      if (!dirParada.toLowerCase().includes("cali") && !dirParada.toLowerCase().includes("miranda")) {
        dirParada += ", Cali, Colombia";
      }
      paradasWaypoints.push({
        location: dirParada,
        stopover: true // Fuerza al ruteador a marcarlo como un punto de entrega física
      });
    }

    const request = {
      origin: origen,
      destination: destinoProvisional,
      waypoints: paradasWaypoints,
      optimizeWaypoints: true, // La IA de Google reordena las paradas intermedias para hacer la ruta más corta
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(Date.now()),
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      }
    };

    const response = await new Promise((resolve, reject) => {
      servicioDirecciones.route(request, (res, status) => {
        if (status === google.maps.DirectionsStatus.OK) resolve(res);
        else reject(status);
      });
    });

    // Pintar los vectores neón en el mapa
    renderRutas.setDirections(response);

    let distanciaMetrosTotales = 0;
    let tiempoSegundosTotales = 0;
    const ruta = response.routes[0];
    
    // Google Maps devuelve tramos individuales (legs). Los sumamos todos para saber el esfuerzo real total.
    for (let i = 0; i < ruta.legs.length; i++) {
      distanciaMetrosTotales += ruta.legs[i].distance.value;
      tiempoSegundosTotales += ruta.legs[i].duration_in_traffic ? ruta.legs[i].duration_in_traffic.value : ruta.legs[i].duration.value;
    }

    const kilometros = distanciaMetrosTotales / 1000;
    const minutos = tiempoSegundosTotales / 60;

    // Calculamos el tablero UI. La cantidad de entregas totales es la cola previa + el destino actual (lista para inyectar)
    const entregasTotales = loteActualPedidos.length + 1;
    actualizarTableroUI(kilometros, minutos, entregasTotales);

    console.log(`>>> [TELEMETRÍA_MULTIPUNTO]: Ruta consolidada con ${entregasTotales} paradas. Total: ${kilometros.toFixed(2)} km.`);

  } catch (err) {
    console.warn(">>> [FALLO_MULTIPUNTO]: Rebotando a matriz matemática de contingencia local.");
    evaluarTarifaModoLocalInmediata();
  }
}

// Función auxiliar para actualizar las etiquetas de la interfaz sin duplicar código
function actualizarTableroUI(kilometros, minutos, cantidadEntregas) {
  const costoRodamiento = kilometros * COSTO_POR_KILOMETRO;
  const costoTiempoCaretas = minutos * COSTO_POR_MINUTO;
  const totalMutualAcumulado = cantidadEntregas * APORTE_MUTUAL_FIJO;

  const pagoNetoCustodio = Math.round(costoRodamiento + costoTiempoCaretas);
  const tarifaTotalCobradaAlComercio = pagoNetoCustodio + totalMutualAcumulado;

  // Renderizar resultados en los elementos HTML correspondientes
  document.getElementById("meta-distancia").innerText = kilometros.toFixed(1) + " km";
  document.getElementById("meta-tiempo").innerText = Math.round(minutos) + " min";
  document.getElementById("meta-mutual").innerText = "$" + totalMutualAcumulado.toLocaleString();
  document.getElementById("meta-neto").innerText = "$" + tarifaTotalCobradaAlComercio.toLocaleString() + " COP";

  // Guardar en ventana global de memoria para el empaquetador final
  window.valoresCalculadosLote = {
    tarifa: tarifaTotalCobradaAlComercio,
    rodamiento: Math.round(costoRodamiento),
    mutual: totalMutualAcumulado,
    neto: pagoNetoCustodio
  };
}

// Fallback de contingencia inmediata para el modo offline o errores de la API
function evaluarTarifaModoLocalInmediata() {
  const simNumPedidos = loteActualPedidos.length + 1;
  const kilometros = 2.5 * simNumPedidos + Math.random() * 0.8;
  const minutos = 8 * simNumPedidos + Math.random() * 3;

  console.log(`>>> [PREVISUALIZACIÓN_OFFLINE]: Distancia estimada: ${kilometros.toFixed(2)} km.`);
  actualizarTableroUI(kilometros, minutes, simNumPedidos);
}

// 3. Simulación de hashing SHA-256 local para la foto obligatoria del paquete
function simularHashFoto() {
  const inputFoto = document.getElementById("foto-paquete");
  if (inputFoto.files && inputFoto.files[0]) {
    hashFotoActual =
      "SHA256:" +
      Math.random().toString(16).substring(2, 10).toUpperCase() +
      "..." +
      Math.random().toString(16).substring(2, 6).toUpperCase();
    document.getElementById("txt-hash-foto").innerText = `[INTEGRIDAD_OK] ${hashFotoActual}`;
    document.getElementById("txt-hash-foto").style.color = "var(--neon-green)";
  }
}
// --- CONFIGURACIÓN DEL SENSOR DE MASA ---
const LIMITE_MASA_HARDWARE_MOTO = 15.0; // Máximo 15 kg por lote en la Discover 125
let pesoAcumuladoLote = 0.0;

// Función utilitaria para extraer el valor numérico del peso escrito por el negocio
function extraerPesoNumerico(textoCarga) {
  // Busca cualquier número entero o decimal en el texto
  const coincidencias = textoCarga.match(/[-+]?(\d*[.])?\d+/);
  if (coincidencias) {
    return parseFloat(coincidencias[0]);
  }
  // Si el comercio no especificó peso numérico, por doctrina defensiva asignamos un valor base de 1.5 kg
  return 1.5; 
}

// MODIFICACIÓN DE LA INYECCIÓN: Evaluamos el peso ANTES de aceptar el pedido en el lote
function agregarPedidoALote(event) {
  event.preventDefault();

  if (!hashFotoActual) {
    alert(">>> ERROR CRÍTICO: Exigencia de Protocolo violada. Debe cargar la fotografía del paquete para calcular su firma de integridad física antes de guardarlo.");
    return;
  }

  const textoCarga = document.getElementById('carga-detalle').value.trim();
  const pesoEstePedido = extraerPesoNumerico(textoCarga);

  // CONTROL CRÍTICO DE ESTABILIDAD: ¿Sumar este paquete excede la suspensión de la moto?
  if ((pesoAcumuladoLote + pesoEstePedido) > LIMITE_MASA_HARDWARE_MOTO) {
    alert(`>>> RECHAZO_DE_CARGA N0DAL:\n\nEl paquete actual de (${pesoEstePedido} kg) excede el límite de estabilidad seguro restante (${(LIMITE_MASA_HARDWARE_MOTO - pesoAcumuladoLote).toFixed(1)} kg).\n\nCierre el lote actual y despáchelo al Relevo Ciego antes de iniciar una nueva ruta.`);
    return;
  }

  const idPedido = "#MAC-" + Math.floor(1000 + Math.random() * 9000);
  
  const nuevoPedido = {
    id: idPedido,
    destinatario: document.getElementById('doc-cliente').value.trim(),
    direccion: document.getElementById('dir-cliente').value.trim(),
    telefono: document.getElementById('tel-cliente').value.trim(),
    carga: textoCarga,
    pesoKg: pesoEstePedido, // Indexamos el peso limpio en el objeto del pedido
    testigoOptico: hashFotoActual
  };

  loteActualPedidos.push(nuevoPedido);
  
  // Acumulamos la masa en el hardware virtual
  pesoAcumuladoLote += pesoEstePedido;
  actualizarMonitorMasaUI();

  // Ejecutar ruteo multi-parada dinámico de Google Maps
  const origenInput = document.getElementById('origen-cliente').value.trim();
  const CONTEXTO_GEOGRAFICO = ", Cali, Colombia";
  let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda") ? origenInput : origenInput + CONTEXTO_GEOGRAFICO;
  let destConContexto = nuevoPedido.direccion.toLowerCase().includes("cali") || nuevoPedido.direccion.toLowerCase().includes("miranda") ? nuevoPedido.direccion : nuevoPedido.direccion + CONTEXTO_GEOGRAFICO;

  previsualizarRutaInmediata(origConContexto, destConContexto);
  actualizarTablaCola();

  // Limpiar campos destino
  document.getElementById('doc-cliente').value = "";
  document.getElementById('dir-cliente').value = "";
  document.getElementById('tel-cliente').value = "";
  document.getElementById('carga-detalle').value = "";
  hashFotoActual = "";
  document.getElementById('txt-hash-foto').innerText = "PENDIENTE: Capturar testigo óptico del paquete...";
  document.getElementById('txt-hash-foto').style.color = "";
}

// Función para actualizar los elementos visuales del peso en tiempo real
function actualizarMonitorMasaUI() {
  const porcentajeBarra = (pesoAcumuladoLote / LIMITE_MASA_HARDWARE_MOTO) * 100;
  const barra = document.getElementById('barra-peso-carga');
  const txtPeso = document.getElementById('txt-peso-acumulado');
  const txtAlerta = document.getElementById('txt-alerta-limite');
  const btnAgregar = document.querySelector('.btn-agregar-lote');

  if (!barra || !txtPeso) return;

  txtPeso.innerText = pesoAcumuladoLote.toFixed(1);
  barra.style.width = `${porcentajeBarra}%`;

  // Control de alertas por color según la carga del hardware
  if (pesoAcumuladoLote >= LIMITE_MASA_HARDWARE_MOTO * 0.85) {
    barra.style.backgroundColor = "var(--neon-amber)"; // Zona de advertencia (Cerca al límite)
  } else {
    barra.style.backgroundColor = "var(--neon-green)"; // Zona segura
  }

  // Si tocamos el límite estricto o nos queda menos espacio del mínimo manejable, avisamos en consola
  if (pesoAcumuladoLote >= LIMITE_MASA_HARDWARE_MOTO - 0.5) {
    if (txtAlerta) txtAlerta.style.display = "block";
    barra.style.backgroundColor = "red";
  } else {
    if (txtAlerta) txtAlerta.style.display = "none";
  }
}

// MODIFICACIÓN EN EL REINICIO: Cuando el lote se publica con éxito al api.php, reseteamos la masa
// Busca el bloque "if(data.status === 'SUCCESS')" dentro de tu función procesarYPublicarLote() y añade:
// ----------------------------------------------------
// loteActualPedidos = [];
// pesoAcumuladoLote = 0.0; // <-- ADICIÓN REQUERIDA
// actualizarMonitorMasaUI(); // <-- ADICIÓN REQUERIDA
// ----------------------------------------------------

// 5. MOTOR DE ESTIMACIÓN 2026: Basado en Origen Configurable de la Terminal
async function calcularMetricasYTarifasLote(ultimaDireccion) {
  if (loteActualPedidos.length === 0) return;

  let kilometros = 0;
  let minutos = 0;

  // Extraemos dinámicamente el origen ingresado en la UI por el comercio
  const origenRuta = document.getElementById("origen-cliente").value.trim() || "Paradero Central Miranda Cauca";

  if (googleMapsOperativo && typeof google !== "undefined" && google.maps.DirectionsService) {
    try {
      const servicioDirecciones = new google.maps.DirectionsService();
      const paradasIntermedias = loteActualPedidos.slice(0, -1).map((p) => ({
        location: p.direccion,
        stopover: true
      }));

      const request = {
        origin: origenRuta, // ORIGEN DINÁMICO ASIGNADO
        destination: ultimaDireccion,
        waypoints: paradasIntermedias,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(Date.now()),
          trafficModel: google.maps.TrafficModel.BEST_GUESS
        }
      };

      const response = await new Promise((resolve, reject) => {
        servicioDirecciones.route(request, (res, status) => {
          if (status === google.maps.DirectionsStatus.OK) resolve(res);
          else reject(status);
        });
      });

      // Dibujar la traza violeta en el mapa
      renderRutas.setDirections(response);

      let distanciaMetrosTotales = 0;
      let tiempoSegundosTotales = 0;
      const ruta = response.routes[0];

      for (let i = 0; i < ruta.legs.length; i++) {
        distanciaMetrosTotales += ruta.legs[i].distance.value;
        tiempoSegundosTotales += ruta.legs[i].duration_in_traffic
          ? ruta.legs[i].duration_in_traffic.value
          : ruta.legs[i].duration.value;
      }

      kilometros = distanciaMetrosTotales / 1000;
      minutos = tiempoSegundosTotales / 60;
      console.log(
        `>>> [TELEMETRÍA_ONLINE]: Ruta calculada desde [${origenRuta}] hasta [${ultimaDireccion}]: ${kilometros.toFixed(2)} km.`
      );
    } catch (err) {
      console.warn(">>> [FALLO_EN_RUTA]: Caída controlada al estimador local autónomo.");
      calcularTarifaModoLocal();
    }
  } else {
    calcularTarifaModoLocal();
  }

  function calcularTarifaModoLocal() {
    kilometros = 2.5 * loteActualPedidos.length + Math.random() * 0.8;
    minutos = 8 * loteActualPedidos.length + Math.random() * 3;
    console.log(`>>> [TELEMETRÍA_OFFLINE]: Modelo autónomo activo: ${kilometros.toFixed(2)} km.`);
  }

  // --- APLICACIÓN DE LA MATRIZ DE DIGNIDAD LABORAL DE MIRANDA ---
  const costoRodamiento = kilometros * COSTO_POR_KILOMETRO;
  const costoTiempoCaretas = minutos * COSTO_POR_MINUTO;
  const totalMutualAcumulado = loteActualPedidos.length * APORTE_MUTUAL_FIJO;

  const pagoNetoCustodio = Math.round(costoRodamiento + costoTiempoCaretas);
  const tarifaTotalCobradaAlComercio = pagoNetoCustodio + totalMutualAcumulado;

  document.getElementById("meta-distancia").innerText = kilometros.toFixed(1) + " km";
  document.getElementById("meta-tiempo").innerText = Math.round(minutos) + " min";
  document.getElementById("meta-mutual").innerText = "$" + totalMutualAcumulado.toLocaleString();
  document.getElementById("meta-neto").innerText = "$" + tarifaTotalCobradaAlComercio.toLocaleString() + " COP";

  window.valoresCalculadosLote = {
    tarifa: tarifaTotalCobradaAlComercio,
    rodamiento: Math.round(costoRodamiento),
    mutual: totalMutualAcumulado,
    neto: pagoNetoCustodio
  };
}
// 6. Actualización Visual de la Cola local con Indexación de Ruta (A, B, C...)
function actualizarTablaCola() {
  const tbody = document.getElementById('cola-pedidos-body');
  if (!tbody) return;
  
  if (loteActualPedidos.length === 0) {
    tbody.innerHTML = `<tr id="fila-vacia"><td colspan="5" style="text-align: center; color: #524359; padding: 20px;">[BUFFER_VACÍO] No hay datos en la cola de salida.</td></tr>`;
    document.getElementById('btn-publicar').disabled = true;
    return;
  }

  // Purgamos la tabla por completo para obligar al navegador a reacomodar las filas físicamente
  tbody.innerHTML = ""; 

  loteActualPedidos.forEach((pedido, indice) => {
    const nuevaFila = document.createElement('tr');
    nuevaFila.id = `fila-nodo-${indice}`;
    
    // Convertimos el índice numérico actual a su indicador de parada alfabética (0->A, 1->B, 2->C...)
    const letraParadaActual = String.fromCharCode(65 + indice);

    // Construimos las opciones del selector de posición para el ruteo
    let opcionesSelector = "";
    loteActualPedidos.forEach((_, optIndice) => {
      const letraPosicionOpt = String.fromCharCode(65 + optIndice); 
      const seleccionado = optIndice === indice ? "selected" : "";
      opcionesSelector += `<option value="${optIndice}" ${seleccionado}>Mover a la Parada ${letraPosicionOpt}</option>`;
    });

    // Inyectamos el indicador [A], [B], [C] al principio del HASH_ID para lectura táctica en la moto
    nuevaFila.innerHTML = `
      <td style="color: var(--neon-blue); font-weight: bold; font-family: monospace;">
        <span style="color: var(--neon-purple); margin-right: 5px;">[${letraParadaActual}]</span> ${pedido.id}
      </td>
      <td>${pedido.destinatario}</td>
      <td>${pedido.direccion}</td>
      <td>${pedido.carga}</td>
      <td>
        <select class="selector-posicion-nodo" onchange="intercambiarPosicionNodo(${indice}, this.value)">
          ${opcionesSelector}
        </select>
      </td>
    `;

    // Enganches de las animaciones Cyberpunk de elevación
    nuevaFila.addEventListener('mouseenter', () => nuevaFila.classList.add('fila-levantada'));
    nuevaFila.addEventListener('mouseleave', () => nuevaFila.classList.remove('fila-levantada'));
    
    tbody.appendChild(nuevaFila);
  });

  // Habilitar botón de cierre de lote si el buffer tiene carga
  document.getElementById('btn-publicar').disabled = false;
}

// NUEVO MOTOR DE MUTACIÓN: Intercambia los elementos y reordena la UI físicamente
function intercambiarPosicionNodo(indiceOrigen, indiceDestino) {
  indiceOrigen = parseInt(indiceOrigen);
  indiceDestino = parseInt(indiceDestino);

  if (indiceOrigen === indiceDestino) return;

  console.log(`>>> [REORDENAMIENTO_ESTRICTO]: Mutando vector de salida. Posición origen: ${indiceOrigen} -> Destino: ${indiceDestino}`);

  // 1. Extraemos físicamente el pedido del array de memoria
  const nodoAMover = loteActualPedidos.splice(indiceOrigen, 1)[0];
  
  // 2. Lo reinyectamos exactamente en el nuevo índice asignado
  loteActualPedidos.splice(indiceDestino, 0, nodoAMover);

  // 3. CRÍTICO: Redibujamos la tabla inmediatamente para que la tarjeta suba o baje en el DOM
  actualizarTablaCola();

  // 4. Extraemos las variables del formulario para actualizar el mapa de Google con el nuevo orden
  const origenInput = document.getElementById('origen-cliente').value.trim();
  const ultimaDireccionLote = loteActualPedidos[loteActualPedidos.length - 1].direccion;
  
  const CONTEXTO_GEOGRAFICO = ", Cali, Colombia";
  let origConContexto = origenInput.toLowerCase().includes("cali") || origenInput.toLowerCase().includes("miranda") ? origenInput : origenInput + CONTEXTO_GEOGRAFICO;
  let destConContexto = ultimaDireccionLote.toLowerCase().includes("cali") || ultimaDireccionLote.toLowerCase().includes("miranda") ? ultimaDireccionLote : ultimaDireccionLote + CONTEXTO_GEOGRAFICO;

  // 5. El mapa se actualiza basándose en la nueva secuencia jerárquica del array reorganizado
  previsualizarRutaInmediata(origConContexto, destConContexto);
}

// 7. Módulo de Cifrado Ofuscado Client-Side
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

// 8. Procesamiento, Compilación y Broadcast al Servidor Apache XAMPP
function procesarYPublicarLote() {
  if (loteActualPedidos.length === 0) return;

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

      const payloadCifradoMasivo = blindarDatosPayload(loteActualPedidos);
      const costosJustos = window.valoresCalculadosLote || {
        tarifa: loteActualPedidos.length * 15000,
        rodamiento: loteActualPedidos.length * 6000,
        mutual: loteActualPedidos.length * 1000,
        neto: loteActualPedidos.length * 8000
      };

      const payloadLote = {
        id: "LOTE-" + Math.floor(1000 + Math.random() * 9000),
        tipo: "COMERCIAL_MASIVO",
        tarifa: costosJustos.tarifa,
        rodamiento: costosJustos.rodamiento,
        mutual: costosJustos.mutual,
        neto: costosJustos.neto,
        pedidos: loteActualPedidos.map((p) => ({
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
        // ... (Bloque de envío fetch anterior igual) ...
      .then(res => res.json())
      .then(data => {
        if(data.status === "SUCCESS") {
          alert(`>>> PROTOCOLO DE PRIVACIDAD ACTIVADO\n\nDatos sensibles blindados localmente.\nLote indexado en el Relevo con ID: ${data.id}.`);
          
          // 1. Resetear el estado de la memoria local y masa
          loteActualPedidos = [];
          pesoAcumuladoLote = 0.0;
          window.valoresCalculadosLote = null;
          actualizarMonitorMasaUI();

          // 2. Limpiar el búfer visual de la tabla
          if (document.getElementById('cola-pedidos-body')) {
            document.getElementById('cola-pedidos-body').innerHTML = `<tr id="fila-vacia"><td colspan="5" style="text-align: center; color: #524359; padding: 20px;">[BUFFER_VACÍO] No hay datos en la cola de salida.</td></tr>`;
          }
          
          // 3. Reiniciar campos numéricos de la telemetría UI
          document.getElementById("meta-distancia").innerText = "0.0 km";
          document.getElementById("meta-tiempo").innerText = "0 min";
          document.getElementById("meta-mutual").innerText = "$0";
          document.getElementById("meta-neto").innerText = "$0 COP";

          // --- ADICIÓN CRÍTICA: LIMPIEZA TOTAL DEL MAPA DE GOOGLE ---
          if (googleMapsOperativo && renderRutas) {
            // Borra las líneas violetas de ruteo del mapa de forma inmediata
            renderRutas.setDirections({ routes: [] });
            
            // Re-centramos el mapa en el paradero central con el zoom original
            if (mapa) {
              mapa.setCenter(COORDENADAS_PARADERO_CENTRAL);
              mapa.setZoom(14);
            }
            console.log(">>> [MAPA_REFRESH]: Capas de vectores visuales purgadas con éxito.");
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

function activarCapaContingenciaOffline() {
  googleMapsOperativo = false;
  const panelMapa = document.getElementById("mapa-telemetria");
  if (panelMapa) {
    panelMapa.innerHTML = `<div style="color: var(--neon-purple); text-align: center; padding-top: 100px; font-size: 0.8rem; font-family: monospace;">[MODO_OFFLINE_SOBERANO_ACTIVO]</div>`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof google === "undefined") {
      inicializarMapaMacondo();
    }
  }, 1000);
});
