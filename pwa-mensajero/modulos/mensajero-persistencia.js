/**
 * PROTOCOLO MACONDO - MESSENGER SUBSYSTEM: CONTROL DE RELEVOS REALES PHP I/O
 * Ubicación: pwa-mensajero/modulos/mensajero-persistencia.js
 */
const ENDPOINT_POOL = "http://localhost/pwa-gremio-mensajeria/pool_pedidos.json";
const ENDPOINT_TRANSITO = "http://localhost/pwa-gremio-mensajeria/transito_pedidos.json";
const ENDPOINT_FINALIZADOS = "http://localhost/pwa-gremio-mensajeria/finalizados_pedidos.json";
const ENDPOINT_SAVE_PHP = "http://localhost/pwa-gremio-mensajeria/save_pool.php";

/**
 * 1. CONSULTA EL RELEVO CIEGO Y RENDERIZA LOS LOTES DISPONIBLES
 */
async function sincronizarYRenderizarPool() {
    const contenedor = document.getElementById("pool-pedidos-dinamico");
    if (!contenedor) return;

    let poolRaw = {};

    if (window.estaOnline) {
        try {
            const response = await fetch(ENDPOINT_POOL, { cache: "no-store" });
            if (response.ok) {
                poolRaw = await response.json();
                localStorage.setItem("MACONDO_POOL", JSON.stringify(poolRaw));
            }
        } catch (error) {
            console.warn(">>> [RED]: Relevo inaccesible. Conmutando a buffer LocalStorage.");
            poolRaw = JSON.parse(localStorage.getItem("MACONDO_POOL")) || {};
        }
    } else {
        poolRaw = JSON.parse(localStorage.getItem("MACONDO_POOL")) || {};
    }

    const lotesConvertidos = Object.values(poolRaw);
    contenedor.innerHTML = "";

    // Filtrar estrictamente ofertas en pool abierta disponibles
    const disponibles = lotesConvertidos.filter(lote => lote && lote.estado === "POOL_DISPONIBLE");

    if (disponibles.length === 0) {
        contenedor.innerHTML = `<div class="panel-maquina" style="text-align:center;color:var(--text-muted)">[POOL_IDLE] No hay contratos disponibles en la red local.</div>`;
        return;
    }

    disponibles.forEach((lote) => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "panel-maquina tarjeta-pedido";
        tarjeta.innerHTML = `
            <div class="header-status">
                <span style="color: var(--crypto-secure);">[ID: ${lote.id}]</span>
                <span style="color: var(--text-primary);">[PARADAS: ${lote.paradas}]</span>
            </div>
            <div style="font-family:monospace; font-size:0.8rem; margin: 8px 0; color:#bbb;">
                • Frente Logístico: <span style="color:var(--crypto-secure);">${lote.destino}</span><br>
                • Masa Chasis: ${lote.masaTotal || "1.5 kg"}<br>
                • Valor Retenido: <span style="color:var(--crypto-secure); font-weight:bold;">$${Math.round(lote.tarifa || 0).toLocaleString()} COP</span>
            </div>
            <button class="btn-terminal btn-crypto" onclick="ejecutarCustodia('${lote.id}')">EXECUTE_CUSTODY_ASIGNATION</button>
        `;
        contenedor.appendChild(tarjeta);
    });
}

/**
 * 2. CONMUTADOR I/O ASÍNCRONO DE ENTRADA EN CUSTODIA (PHP MULTI-FILE)
 */
async function procesarCustodiaEnServidor(idLote, loteObjeto, nuevaTransaccion) {
    if (!window.estaOnline) return true;

    try {
        // STEP 1: Jalar la pool completa del disco, remover la propiedad del lote tomado y re-escribir pool_pedidos.json
        const resPoolGet = await fetch(ENDPOINT_POOL, { cache: "no-store" });
        let poolCompleta = await resPoolGet.json();
        delete poolCompleta[idLote];
        
        await fetch(ENDPOINT_SAVE_PHP, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Target-File": "pool_pedidos.json" },
            body: JSON.stringify(poolCompleta)
        });

        // STEP 2: Jalar transito_pedidos.json, inyectar el lote modificado con el estado TRANSITO y guardar
        const resTransitoGet = await fetch(ENDPOINT_TRANSITO, { cache: "no-store" }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
        loteObjeto.estado = "TRANSITO";
        loteObjeto.transportador = "Unidad Discover 125 (Custodio #12)";
        resTransitoGet[idLote] = loteObjeto;

        await fetch(ENDPOINT_SAVE_PHP, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Target-File": "transito_pedidos.json" },
            body: JSON.stringify(resTransitoGet)
        });

        console.log(`>>> [SYSTEM_IO]: Lote ${idLote} migrado exitosamente de la Pool Abierta a Tránsito.`);
        return true;
    } catch (e) {
        console.error(">>> [IO_WRITE_ERROR]: Caída de sincronización de archivos físicos.", e);
        return false;
    }
}

/**
 * 3. RECONOCE Y REDIBUJA EL PANEL DE PEDIDOS EN TRÁNSITO
 */
async function sincronizarYRenderizarTransito() {
    const contenedor = document.getElementById("transito-pedidos-dinamico");
    if (!contenedor) return;

    try {
        const response = await fetch(ENDPOINT_TRANSITO, { cache: "no-store" });
        if (!response.ok) return;

        const transitoRaw = await response.json();
        const lotes = Object.values(transitoRaw);

        if (lotes.length === 0) {
            contenedor.innerHTML = `<div class="panel-maquina" style="text-align:center;color:var(--text-muted)">[CONTRATO_VACÍO] No tiene vectores en tránsito sobre el asfalto.</div>`;
            return;
        }

        contenedor.innerHTML = lotes.map(lote => `
            <div class="panel-maquina tarjeta-pedido" style="border-color: var(--neon-blue); box-shadow: 0 0 10px rgba(0,123,255,0.1);">
                <div class="header-status">
                    <span style="color: var(--neon-blue);">[EN_MOTO: ${lote.id}]</span>
                    <span style="color: #fff;">${lote.destino}</span>
                </div>
                <div style="font-family:monospace; font-size:0.75rem; margin:6px 0; color:#aaa;">
                    • Paradas en curso: ${lote.paradas}<br>
                    • Masa Acumulada: ${lote.masaTotal}<br>
                    • Ganancia Retenida: <span style="color:var(--crypto-secure); font-weight:bold;">$${Math.round(lote.neto || 0).toLocaleString()} COP</span>
                </div>
                <button class="btn-terminal" onclick="liquidarEntregaEnAsfalto('${lote.id}')" style="border-color: var(--crypto-secure); color: var(--crypto-secure); width: 100%; font-weight: bold; margin-top: 4px;">
                    [✅] CONFIRMAR_ENTREGA_Y_LIQUIDAR_BONO
                </button>
            </div>
        `).join("");
    } catch (e) {
        console.error("Fallo leyendo el archivo de tránsito", e);
    }
}

/**
 * 4. COMPONE LA MUTACIÓN FINAL: DE TRANSITO A REDENCIÓN FINALIZADA
 */
async function liquidarEntregaEnAsfalto(idLote) {
    const confirmar = confirm(`>>> PROTOCOLO DE REDENCIÓN:\n\n¿Confirma la entrega física de todas las paradas del ${idLote} y la liberación de los fondos mutuos?`);
    if (!confirmar) return;

    try {
        // 1. Quitar de transito_pedidos.json
        const resTransito = await fetch(ENDPOINT_TRANSITO, { cache: "no-store" });
        let transitoData = await resTransito.json();
        const loteALiquidar = transitoData[idLote];
        delete transitoData[idLote];

        await fetch(ENDPOINT_SAVE_PHP, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Target-File": "transito_pedidos.json" },
            body: JSON.stringify(transitoData)
        });

        // 2. Mover a finalizados_pedidos.json
        const resFinalizados = await fetch(ENDPOINT_FINALIZADOS, { cache: "no-store" }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
        loteALiquidar.estado = "FINALIZADA";
        resFinalizados[idLote] = loteALiquidar;

        await fetch(ENDPOINT_SAVE_PHP, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Target-File": "finalizados_pedidos.json" },
            body: JSON.stringify(resFinalizados)
        });

        alert(`>>> REDENCIÓN EXITOSA:\n\nEl lote ${idLote} pasó a canje consolidado. Fondos inyectados a su billetera.`);
        sincronizarYRenderizarTransito();
    } catch (e) {
        console.error("Error liquidando entrega:", e);
    }
}

// Inyección limpia y ordenada al Scope Global para el orquestador
window.sincronizarYRenderizarPool = sincronizarYRenderizarPool;
window.procesarCustodiaEnServidor = procesarCustodiaEnServidor;
window.sincronizarYRenderizarTransito = sincronizarYRenderizarTransito;
window.liquidarEntregaEnAsfalto = liquidarEntregaEnAsfalto;