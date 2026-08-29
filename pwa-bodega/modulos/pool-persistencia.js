/**
 * PROTOCOLO MACONDO - SUBSISTEMA BODEGA: PERSISTENCIA Y RELEVO POR CRÉDITOS
 * Ubicación: pwa-bodega/modulos/pool-persistencia.js
 */

const ENDPOINT_POOL_JSON = "../pool_pedidos.json";
const ENDPOINT_TRANSITO_JSON = "../transito_pedidos.json";
const ENDPOINT_FINALIZADOS_JSON = "../finalizados_pedidos.json";
const ENDPOINT_SAVE_PHP = "../save_pool.php";
window.ENDPOINT_SAVE_PHP = ENDPOINT_SAVE_PHP;

/**
 * CONSUMIDOR MULTI-NIVEL EN DISCO (GET)
 */
async function actualizarPanelRutasUI() {
    const contenedorPendientes = document.getElementById("lista-rutas-pendientes");
    const contenedorTransito = document.getElementById("lista-rutas-transito");
    const contenedorFinalizadas = document.getElementById("lista-rutas-finalizadas");

    if (!contenedorPendientes || !contenedorTransito || !contenedorFinalizadas) return;

    try {
        console.log(">>> [IO_READ]: Sincronizando Ecosistema Bodega...");

        const [resPool, resTransito, resFinalizados] = await Promise.all([
            fetch(ENDPOINT_POOL_JSON, { cache: "no-store" })
                .then((r) => (r.ok ? r.json() : {}))
                .catch(() => ({})),
            fetch(ENDPOINT_TRANSITO_JSON, { cache: "no-store" })
                .then((r) => (r.ok ? r.json() : {}))
                .catch(() => ({})),
            fetch(ENDPOINT_FINALIZADOS_JSON, { cache: "no-store" })
                .then((r) => (r.ok ? r.json() : {}))
                .catch(() => ({}))
        ]);

        const pendientes = Object.keys(resPool).map((key) => ({ id: key, ...resPool[key] }));
        const transito = Object.keys(resTransito).map((key) => ({ id: key, ...resTransito[key] }));
        const finalizadas = Object.keys(resFinalizados).map((key) => ({ id: key, ...resFinalizados[key] }));

        const elPend = document.getElementById("count-pendientes");
        const elTrans = document.getElementById("count-transito");
        const elFin = document.getElementById("count-finalizadas");

        if (elPend) elPend.innerText = pendientes.length;
        if (elTrans) elTrans.innerText = transito.length;
        if (elFin) elFin.innerText = finalizadas.length;

        renderizarColumnaPendientes(contenedorPendientes, pendientes);
        renderizarColumnaTransito(contenedorTransito, transito);
        renderizarColumnaFinalizadas(contenedorFinalizadas, finalizadas);
    } catch (error) {
        console.error(">>> [IO_ERROR]: Error en la sincronización de estados:", error);
    }
}

/**
 * RENDER DE COLUMNA: EN POOL ABIERTA (Adaptado a Créditos/Puntos)
 */
function renderizarColumnaPendientes(contenedor, items) {
    if (items.length === 0) {
        contenedor.innerHTML = `<p style="color:#524359; font-size:0.8rem; text-align:center; margin-top:20px; font-family:monospace;">[BUFFER_VACÍO] No hay ofertas en la pool.</p>`;
        return;
    }
    contenedor.innerHTML = items
        .map(
            (lote) => `
        <div class="tarjeta-lote-pool" style="border: 1px solid var(--neon-amber); background: rgba(12, 8, 15, 0.85); padding:12px; margin-bottom:12px; border-left:4px solid var(--neon-amber); font-size:0.75rem; position:relative;">
            <span style="position:absolute; right:8px; top:8px; color:var(--neon-purple); font-size:0.7rem; font-family:monospace; font-weight:bold;">${lote.id}</span>
            <strong style="color:#fff;">Punto Base: <span style="color:var(--neon-blue);">${lote.destino}</span></strong><br>
            <div style="margin-top:4px; margin-bottom:4px; color:#aaa;">Puntos de Acopio: ${lote.paradas} | Capacidad: ${lote.masaTotal || '0.0 Kg'}</div>
            <div style="color:var(--neon-green); font-family:monospace; margin-bottom:8px;">Tasa API: $${Math.round(lote.tarifa || 0).toLocaleString()} COP (${lote.creditos_devengados || lote.paradas} CR)</div>
            <button type="button" class="btn-terminal btn-cancelar-solicitud" data-id="${lote.id}" onclick="eliminarSolicitudPoolEnDisco('${lote.id}')" style="background:transparent; border:1px solid #ff3366; color:#ff3366; font-size:0.65rem; cursor:pointer; padding:4px; font-family:monospace; width:100%; font-weight:bold;">
                [❌] REVOCAR_OFERTA
            </button>
        </div>
    `
        )
        .join("");
}

function renderizarColumnaTransito(contenedor, items) {
    if (items.length === 0) {
        contenedor.innerHTML = `<p style="color:#434b59; font-size:0.8rem; text-align:center; margin-top:20px; font-family:monospace;">[RELEVOS_VACÍOS] Ningún Custodio en ruta.</p>`;
        return;
    }
    contenedor.innerHTML = items
        .map(
            (lote) => `
        <div class="tarjeta-lote-transito" style="border: 1px solid var(--neon-blue); background: rgba(12, 8, 15, 0.85); padding:12px; margin-bottom:12px; border-left:4px solid var(--neon-blue); font-size:0.75rem; position:relative;">
            <span style="position:absolute; right:8px; top:8px; color:#888; font-size:0.7rem; font-family:monospace;">${lote.id}</span>
            <strong style="color:#fff;">Unidad Activa: <span style="color:var(--neon-blue);">${lote.transportador || "Custodio Autónomo"}</span></strong><br>
            <div style="margin-top:4px; color:#bbb;">Vector Acopio: ${lote.destino}</div>
            <div style="color:#777; font-size:0.65rem; margin-top:4px; font-family:monospace;">⚡ TRANSMITIENDO TELEMETRÍA GPS</div>
        </div>
    `
        )
        .join("");
}

function renderizarColumnaFinalizadas(contenedor, items) {
    if (items.length === 0) {
        contenedor.innerHTML = `<p style="color:#395942; font-size:0.8rem; text-align:center; margin-top:20px; font-family:monospace;">[CICLO_VACÍO] No hay puntos procesados.</p>`;
        return;
    }
    contenedor.innerHTML = items
        .map(
            (lote) => `
        <div class="tarjeta-lote-finalizado" style="border: 1px solid rgba(40, 167, 69, 0.3); background: rgba(12, 8, 15, 0.9); padding:12px; margin-bottom:12px; border-left:4px solid var(--neon-green); font-size:0.75rem; position:relative; opacity:0.85;">
            <span style="position:absolute; right:8px; top:8px; color:#666; font-size:0.7rem; font-family:monospace;">${lote.id}</span>
            <strong style="color:var(--neon-green);">✔ PUNTO LIQUIDADO</strong><br>
            <div style="margin-top:4px; color:#888;">Nodal Final: ${lote.destino}</div>
            <div style="color:var(--neon-green); font-size:0.6rem; text-transform:uppercase; font-family:monospace; margin-top:2px;">• Créditos Debitados de Billetera</div>
        </div>
    `
        )
        .join("");
}

async function guardarMatrizEnDisco(nuevaPoolCompleta) {
    try {
        const respuesta = await fetch(ENDPOINT_SAVE_PHP, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(nuevaPoolCompleta)
        });
        if (!respuesta.ok) throw new Error("Descriptor de archivos local rechazó la inyección.");
        await actualizarPanelRutasUI();
    } catch (error) {
        console.error(">>> [IO_WRITE_ERROR]: Impedimento de escritura física.", error);
    }
}

async function eliminarSolicitudPoolEnDisco(idLote) {
    const confirmacion = confirm(
        `>>> ALERTA BODEGA:\n\n¿Desea revocar el lote ${idLote} del pool y remover sus puntos de acopio?`
    );
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(ENDPOINT_POOL_JSON, { cache: "no-store" });
        let poolData = await respuesta.json();

        if (poolData[idLote]) {
            delete poolData[idLote];
            await guardarMatrizEnDisco(poolData);
            alert(`>>> OCURRENCIA_PURGADA:\n\nEl lote ${idLote} fue removido exitosamente.`);
        } else {
            alert(">>> ERROR: El vector no existe o ya fue tomado.");
            await actualizarPanelRutasUI();
        }
    } catch (e) {
        console.error("Fallo revocando lote de bodega.", e);
    }
}

/**
 * COMPILACIÓN Y PUBLICACIÓN DE PUNTOS BODEGA
 * Descuenta los créditos de LocalStorage y envía la estructura a pool_pedidos.json
 */
async function registrarLoteDespachadoEnPool() {
    if (!window.loteActualPedidos || window.loteActualPedidos.length === 0) {
        alert(">>> ACCIÓN_RECHAZADA: Inyecte al menos un punto de acopio al lote.");
        return;
    }

    const cantidadPuntos = window.loteActualPedidos.length;
    const costoCreditosRequeridos = cantidadPuntos; // 1 punto = 1 crédito ($500 COP)
    const saldoCreditosActual = parseInt(localStorage.getItem("MACONDO_CREDITOS_BODEGA") || "0", 10);

    // VALIDACIÓN DE SALDO EN BILLETERA
    if (saldoCreditosActual < costoCreditosRequeridos) {
        alert(
            `>>> CRÉDITOS INSUFICIENTES:\n\n` +
            `Requiere: ${costoCreditosRequeridos} CR ($${(costoCreditosRequeridos * 500).toLocaleString('es-CO')} COP)\n` +
            `Saldo Actual: ${saldoCreditosActual} CR\n\n` +
            `Diríjase a la pestaña [03] BILLETERA_NODAL para adquirir un paquete de créditos.`
        );
        return;
    }

    // Extracción de datos telemáticos de la UI con fallbacks seguros
    const metricasCalculadas = window.valoresCalculadosLote || {};
    const tarifaLote = metricasCalculadas.tarifa || (cantidadPuntos * 500);
    const netoLote = metricasCalculadas.neto || (cantidadPuntos * 500);

    const idLote = "LOTE-BDG-" + Math.floor(1000 + Math.random() * 9000);
    const primeraDireccion = window.loteActualPedidos[0].direccion || window.loteActualPedidos[0].direccionDestino || "Punto Central";
    const destinoCorto = primeraDireccion.split(",")[0].substring(0, 25);

    const subPedidosClonados = window.loteActualPedidos.map((p) => ({
        id: p.id || "PNT-" + Date.now().toString(36),
        alias: p.destinatario || p.alias || "Punto Acopio",
        direccion: p.direccion || p.direccionDestino || "Cali",
        carga: p.carga || "Paquete Estándar",
        testigoOptico: p.testigoOptico || null
    }));

    const nuevoLoteObjeto = {
        id: idLote,
        tipo: "BODEGA_ACOPIO_PUNTOS",
        tarifa: tarifaLote,
        creditos_devengados: costoCreditosRequeridos,
        neto: netoLote,
        destino: destinoCorto,
        paradas: cantidadPuntos,
        masaTotal: (window.pesoAcumuladoLote || 0).toFixed(1) + " Kg",
        pedidos: subPedidosClonados,
        timestamp_relevo: Math.floor(Date.now() / 1000),
        estado: "POOL_DISPONIBLE"
    };

    try {
        const respuesta = await fetch(ENDPOINT_POOL_JSON, { cache: "no-store" });
        let poolData = respuesta.ok ? await respuesta.json() : {};
        if (typeof poolData !== "object" || Array.isArray(poolData) || poolData === null) poolData = {};

        poolData[idLote] = nuevoLoteObjeto;
        await guardarMatrizEnDisco(poolData);

        // DEBITAR CRÉDITOS DE LA BILLETERA NODAL DE BODEGA
        const nuevoSaldoBilletera = saldoCreditosActual - costoCreditosRequeridos;
        localStorage.setItem("MACONDO_CREDITOS_BODEGA", nuevoSaldoBilletera.toString());

        if (typeof window.actualizarUIBilletera === "function") {
            window.actualizarUIBilletera();
        }

        // PURGA ABSOLUTA DE CONTADORES Y MEMORIA DEL LOTE PROVISIONAL
        window.loteActualPedidos = [];
        if (window.lotePedidosMemoria) window.lotePedidosMemoria = [];

        window.pesoAcumuladoLote = 0;
        window.valoresCalculadosLote = { tarifa: 0, creditosTotal: 0, neto: 0, minutosTotales: 0 };

        // Limpiar filas de la tabla provisoria
        const colaTablaBody = document.getElementById("cola-pedidos-body");
        if (colaTablaBody) colaTablaBody.innerHTML = "";

        // Resetear monitor de masa acumulada
        const txtMasa = document.getElementById("txt-peso-acumulado");
        const barraMasa = document.getElementById("barra-peso-carga");
        if (txtMasa) txtMasa.innerText = "0.0";
        if (barraMasa) barraMasa.style.width = "0%";

        // Resetear tablero telemático visual de Créditos
        if (typeof window.actualizarTableroUI === "function") {
            window.actualizarTableroUI(0, 0, 0);
        }

        // Limpiar polígonos y pins en el mapa
        if (typeof window.limpiarGraficosDelMapa === "function") {
            window.limpiarGraficosDelMapa();
        }

        // Deshabilitar botón de compilación hasta inyectar nuevos puntos
        const btnPublicar = document.getElementById("btn-publicar");
        if (btnPublicar) btnPublicar.disabled = true;

        console.log(`>>> [BODEGA_OK]: Lote ${idLote} compilado. Se debitaron ${costoCreditosRequeridos} CR.`);
        alert(`>>> LOTE COMPILADO Y PUBLICADO EN POOL:\n\nLote ID: ${idLote}\nCréditos Debitados: ${costoCreditosRequeridos} CR\nNuevo Saldo Disponible: ${nuevoSaldoBilletera} CR`);
    } catch (e) {
        console.error(">>> [LINKAGE_FAIL]: Error al registrar lote de bodega en el pool.", e);
        alert("Fallo de hardware/comunicación al escribir en pool_pedidos.json");
    }
}

// Inyección limpia al Scope Global
window.actualizarPanelRutasUI = actualizarPanelRutasUI;
window.eliminarSolicitudPoolEnDisco = eliminarSolicitudPoolEnDisco;
window.registrarLoteDespachadoEnPool = registrarLoteDespachadoEnPool;