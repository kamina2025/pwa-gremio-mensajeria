/**
 * PROTOCOLO MACONDO - PERSISTENCE SUBSYSTEM: MULTI-FILE RELAY SYSTEM I/O
 * Ubicación: modulos/pool-persistencia.js
 */
const ENDPOINT_POOL_JSON = "../pool_pedidos.json";
const ENDPOINT_TRANSITO_JSON = "../transito_pedidos.json";
const ENDPOINT_FINALIZADOS_JSON = "../finalizados_pedidos.json";
const ENDPOINT_SAVE_PHP = "../save_pool.php";
window.ENDPOINT_SAVE_PHP = ENDPOINT_SAVE_PHP; // <--- Añade esta asignación si no la tienes
/**
 * CONSUMIDOR MULTI-NIVEL EN DISCO (GET)
 * Ejecuta lecturas en paralelo de los tres estados del asfalto local
 */
async function actualizarPanelRutasUI() {
    const contenedorPendientes = document.getElementById("lista-rutas-pendientes");
    const contenedorTransito = document.getElementById("lista-rutas-transito");
    const contenedorFinalizadas = document.getElementById("lista-rutas-finalizadas");

    if (!contenedorPendientes || !contenedorTransito || !contenedorFinalizadas) return;

    try {
        console.log(">>> [IO_READ]: Sincronizando Ecosistema de Tres Estados...");

        // Peticiones asíncronas simultáneas para evitar bloqueos de hardware
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

        // Transformar los tres objetos indexados a arrays legibles por la interfaz
        const pendientes = Object.keys(resPool).map((key) => ({ id: key, ...resPool[key] }));
        const transito = Object.keys(resTransito).map((key) => ({ id: key, ...resTransito[key] }));
        const finalizadas = Object.keys(resFinalizados).map((key) => ({ id: key, ...resFinalizados[key] }));

        // Sincronizar contadores de las insignias superiores de la consola
        document.getElementById("count-pendientes").innerText = pendientes.length;
        document.getElementById("count-transito").innerText = transito.length;
        document.getElementById("count-finalizadas").innerText = finalizadas.length;

        // Renderizado atómico segregado por responsabilidades
        renderizarColumnaPendientes(contenedorPendientes, pendientes);
        renderizarColumnaTransito(contenedorTransito, transito);
        renderizarColumnaFinalizadas(contenedorFinalizadas, finalizadas);
    } catch (error) {
        console.error(">>> [IO_ERROR]: Quiebre en el colector multi-archivo de la PWA:", error);
    }
}

/**
 * RENDER DE COLUMNA: EN POOL ABIERTA
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
            <strong style="color:#fff;">Destino: <span style="color:var(--neon-blue);">${lote.destino}</span></strong><br>
            <div style="margin-top:4px; margin-bottom:4px; color:#aaa;">Paradas fijadas: ${lote.paradas} | Peso: ${lote.masaTotal}</div>
            <div style="color:var(--neon-green); font-family:monospace; margin-bottom:8px;">Custodio Neto: $${Math.round(lote.neto || 0).toLocaleString()} COP</div>
            <button type="button" class="btn-terminal btn-cancelar-solicitud" data-id="${lote.id}" style="background:transparent; border:1px solid #ff3366; color:#ff3366; font-size:0.65rem; cursor:pointer; padding:4px; font-family:monospace; width:100%; font-weight:bold;">
                [❌] REVOCAR_OFERTA
            </button>
        </div>
    `
        )
        .join("");
}

/**
 * RENDER DE COLUMNA: EN TRÁNSITO (ASFALTO)
 */
function renderizarColumnaTransito(contenedor, items) {
    if (items.length === 0) {
        contenedor.innerHTML = `<p style="color:#434b59; font-size:0.8rem; text-align:center; margin-top:20px; font-family:monospace;">[RELEVOS_VACÍOS] Ningún Custodio reportando ruta.</p>`;
        return;
    }
    contenedor.innerHTML = items
        .map(
            (lote) => `
        <div class="tarjeta-lote-transito" style="border: 1px solid var(--neon-blue); background: rgba(12, 8, 15, 0.85); padding:12px; margin-bottom:12px; border-left:4px solid var(--neon-blue); font-size:0.75rem; position:relative;">
            <span style="position:absolute; right:8px; top:8px; color:#888; font-size:0.7rem; font-family:monospace;">${lote.id}</span>
            <strong style="color:#fff;">Unidad Activa: <span style="color:var(--neon-blue);">${lote.transportador || "Custodio Autónomo"}</span></strong><br>
            <div style="margin-top:4px; color:#bbb;">Frente de Entrega: ${lote.destino}</div>
            <div style="color:#777; font-size:0.65rem; margin-top:4px; font-family:monospace;">⚡ TRANSMITIENDO COORDENADAS GPS</div>
        </div>
    `
        )
        .join("");
}

/**
 * RENDER DE COLUMNA: REDENCIÓN FINALIZADA
 */
function renderizarColumnaFinalizadas(contenedor, items) {
    if (items.length === 0) {
        contenedor.innerHTML = `<p style="color:#395942; font-size:0.8rem; text-align:center; margin-top:20px; font-family:monospace;">[CICLO_VACÍO] No hay canjes liquidados.</p>`;
        return;
    }
    contenedor.innerHTML = items
        .map(
            (lote) => `
        <div class="tarjeta-lote-finalizado" style="border: 1px solid rgba(40, 167, 69, 0.3); background: rgba(12, 8, 15, 0.9); padding:12px; margin-bottom:12px; border-left:4px solid var(--neon-green); font-size:0.75rem; position:relative; opacity:0.85;">
            <span style="position:absolute; right:8px; top:8px; color:#666; font-size:0.7rem; font-family:monospace;">${lote.id}</span>
            <strong style="color:var(--neon-green);">✔ CANJE EFECTUADO</strong><br>
            <div style="margin-top:4px; color:#888;">Destino Final: ${lote.destino} | Masa Liberada: ${lote.masaTotal}</div>
            <div style="color:var(--neon-green); font-size:0.6rem; text-transform:uppercase; font-family:monospace; margin-top:2px;">• Balance Contable Mutual Sincronizado</div>
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
        `>>> ALERTA DE SEGURIDAD N0DAL:\n\n¿Desea revocar la oferta ${idLote} del Blind Relay y purgar sus datos en disco?`
    );
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(ENDPOINT_POOL_JSON, { cache: "no-store" });
        let poolData = await respuesta.json();

        if (poolData[idLote]) {
            delete poolData[idLote];
            await guardarMatrizEnDisco(poolData);
            alert(`>>> SECRETO_PURGAD0:\n\nLa solicitud ${idLote} fue purgada del Relevo con éxito.`);
        } else {
            alert(">>> ERROR: El vector ya fue tomado por una unidad o no existe.");
            await actualizarPanelRutasUI();
        }
    } catch (e) {
        console.error("Fallo revocando vector logístico.", e);
    }
}

async function registrarLoteDespachadoEnPool() {
    // 1. Validar si hay tramos cargados antes de activar el hardware
    if (!window.loteActualPedidos || window.loteActualPedidos.length === 0) return;

    const idLote = "LOTE-" + Math.floor(1000 + Math.random() * 9000);
    const primeraDireccion = window.loteActualPedidos[0].direccion;
    const destinoCorto = primeraDireccion.split(",")[0].substring(0, 25);

    // Clonación limpia de sub-pedidos
    const subPedidosClonados = window.loteActualPedidos.map((p) => ({
        id: p.id,
        carga: p.carga,
        testigoOptico: p.testigoOptico
    }));

    // Construcción del bloque plano para el Relevo Ciego
    const nuevoLoteObjeto = {
        id: idLote,
        tipo: "COMERCIAL_MASIVO",
        tarifa: window.valoresCalculadosLote.tarifa,
        rodamiento: window.valoresCalculadosLote.rodamiento,
        mutual: window.valoresCalculadosLote.mutual,
        neto: window.valoresCalculadosLote.neto,
        destino: destinoCorto || "Ruta Local Cali",
        paradas: window.loteActualPedidos.length,
        masaTotal: window.pesoAcumuladoLote.toFixed(1) + " Kg",
        pedidos: subPedidosClonados,
        timestamp_relevo: Math.floor(Date.now() / 1000),
        estado: "POOL_DISPONIBLE"
    };

    try {
        // 2. Persistencia en el Pool de Pedidos JSON
        const respuesta = await fetch(ENDPOINT_POOL_JSON, { cache: "no-store" });
        let poolData = respuesta.ok ? await respuesta.json() : {};
        if (typeof poolData !== "object" || Array.isArray(poolData)) poolData = {};

        // ... [Tu código de persistencia existente] ...
        poolData[idLote] = nuevoLoteObjeto;
        await guardarMatrizEnDisco(poolData);
        console.log(`>>> [LINKAGE]: Lote ${idLote} inyectado como objeto plano en pool_pedidos.json`);

        // =========================================================================
        // >>> [PARCHE DE PURGA TOTAL DEL TABLERO TÁCTICO - PROTOCOLO MACONDO] <<<
        // =========================================================================

        // 1. Vaciar buffers y destructores de memoria interna inmediatamente
        window.loteActualPedidos = [];
        if (window.lotePedidosMemoria) window.lotePedidosMemoria = [];

        // Resetear acumuladores numéricos globales
        window.pesoAcumuladoLote = 0;
        if (window.valoresCalculadosLote) {
            window.valoresCalculadosLote = { tarifa: 0, rodamiento: 0, mutual: 0, neto: 0 };
        }

        // 2. Limpieza Absoluta de la Matriz de Despacho (Tablas/Listas) en el DOM
        const idsMatricesPedidos = ["tabla-pedidos-indexados", "contenedor-pedidos", "lista-pedidos", "cuerpo-matriz"];
        idsMatricesPedidos.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName === "TBODY" || el.tagName === "TABLE") {
                    el.innerHTML = ""; // Desvanece las filas de los pedidos procesados
                } else {
                    el.innerHTML =
                        '<p class="text-mute" style="padding:15px; text-align:center;">[TERMINAL_LISTA]: Esperando nuevos tramos operativos...</p>';
                }
            }
        });

        // 3. Purga del Monitor de Masa Total (Peso en Kg)
        // Busca los IDs reales con los que imprimes el peso acumulado del lote en tu HTML
        const idsMonitoresMasa = ["masa-total", "peso-lote", "txt-masa-total"];
        idsMonitoresMasa.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.innerText = "0.0 Kg"; // Devuelve el chasis de carga a cero
            }
        });

        // 4. Purga del Tablero de Estabilidad Financiera (Tarifas, Rodamiento, Mutual, Neto)
        // Busca los IDs reales con los que muestras los valores calculados en tu interfaz
        const componentesFinancieros = [
            { id: "tarifa-total", def: "$0 COP" },
            { id: "txt-tarifa", def: "$0 COP" },
            { id: "rodamiento-total", def: "$0 COP" },
            { id: "txt-rodamiento", def: "$0 COP" },
            { id: "mutual-total", def: "$0 COP" },
            { id: "txt-mutual", def: "$0 COP" },
            { id: "neto-total", def: "$0 COP" },
            { id: "txt-neto", def: "$0 COP" },
            { id: "distancia-total", def: "0.0 Km" }, // Si muestras los kilómetros totales de la ruta
            { id: "tiempo-total", def: "0 min" } // Si muestras el tiempo total en tráfico
        ];

        componentesFinancieros.forEach((comp) => {
            const el = document.getElementById(comp.id);
            if (el) {
                el.innerText = comp.def; // Resetea los contadores de rentabilidad y dignidad laboral
            }
        });

        // 5. Forzar actualización si manejas un método de renderizado centralizado
        if (typeof window.actualizarTableroUI === "function") {
            // Le pasamos valores en cero absolutos para que re-dibuje el estado neutral
            window.actualizarTableroUI(0, 0, 0, null);
        } else if (typeof window.actualizarInterfaz === "function") {
            window.actualizarInterfaz();
        }

        // 6. Ejecutar la limpieza gráfica del mapa (Que ya te funciona al pelo)
        if (typeof window.limpiarGraficosDelMapa === "function") {
            window.limpiarGraficosDelMapa();
        }

        // 7. Bloquear botón de publicación hasta que entre un nuevo pedido base
        const btnPublicar = document.getElementById("btn-publicar");
        if (btnPublicar) {
            btnPublicar.disabled = true;
        }

        console.log(">>> [UI_REFRESH]: Matriz de despacho, monitor de masa y estabilidad purgados por completo.");
        alert(`Lote ${idLote} compilado con éxito. Terminal Macondo restaurada a estado neutral.`);
        // =========================================================================
    } catch (e) {
        console.error(">>> [LINKAGE_FAIL]: Fallo inyectando bloque en el pool local.", e);
        alert("Error de hardware al escribir en pool_pedidos.json");
    }
}

// Inyección limpia al Scope Global (Sin palabras 'export')
window.actualizarPanelRutasUI = actualizarPanelRutasUI;
window.eliminarSolicitudPoolEnDisco = eliminarSolicitudPoolEnDisco;
window.registrarLoteDespachadoEnPool = registrarLoteDespachadoEnPool;
