/**
 * PROTOCOLO MACONDO - MESSENGER SUBSYSTEM: PERSISTENCIA NODAL Y RELEVO I/O
 * Ubicación: pwa-mensajero/modulos/mensajero-persistencia.js
 */

// --- CONFIGURACIÓN DE ENDPOINTS DE RED Y DISCO LOCAL ---
const ENDPOINT_POOL = "../pool_pedidos.json";
const ENDPOINT_TRANSITO = "../transito_pedidos.json";
const ENDPOINT_FINALIZADOS = "../finalizados_pedidos.json";
const ENDPOINT_SAVE_PHP = "../save_pool.php";

// --- CLAVES DE ALMACENAMIENTO LOCAL-FIRST ---
const CLAVE_RUTA_ACTIVA = "macondo_mensajero_ruta_activa";
const CLAVE_HISTORIAL_NOVEDADES = "macondo_mensajero_novedades";
const CLAVE_POOL_LOCAL = "MACONDO_POOL";

// =============================================================================
// 1. GESTIÓN Y PERSISTENCIA DE LA MÁQUINA DE ESTADOS LOCAL
// =============================================================================

export function guardarRutaZonificada(ruta) {
    console.log(`>>> [PERSISTENCIA]: Guardando ${ruta.length} parada(s) en la base local.`);
    localStorage.setItem(CLAVE_RUTA_ACTIVA, JSON.stringify(ruta));
}

export function obtenerRutaZonificada() {
    const data = localStorage.getItem(CLAVE_RUTA_ACTIVA);
    return data ? JSON.parse(data) : [];
}

export function actualizarEstadoPedido(idPedido, nuevoEstado, metadataExtra = {}) {
    const ruta = obtenerRutaZonificada();
    const index = ruta.findIndex(p => p.id === idPedido);
    
    if (index !== -1) {
        ruta[index].estado = nuevoEstado;
        ruta[index].ultimaActualizacion = new Date().toISOString();
        
        if (Object.keys(metadataExtra).length > 0) {
            ruta[index].registroOperaciones = {
                ...(ruta[index].registroOperaciones || {}),
                ...metadataExtra
            };
        }
        guardarRutaZonificada(ruta);
    }
    return ruta;
}

export async function capturarCoordenadasGPS() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ lat: 0, lng: 0, error: "Geolocalización no soportada" });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => resolve({ lat: 0, lng: 0, error: err.message }),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

export function convertirArchivoBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

/**
 * Elimina una parada específica de la base local por su ID y actualiza el almacenamiento.
 * 
 * @param {string} idParada - ID de la parada a eliminar.
 * @returns {Array<Object>} Lista de paradas actualizada.
 */
export function eliminarParadaLocal(idParada) {
    console.log(`>>> [PERSISTENCIA]: Eliminando parada local con ID: ${idParada}`);
    let rutaActual = obtenerRutaZonificada();
    rutaActual = rutaActual.filter(p => p.id !== idParada);
    guardarRutaZonificada(rutaActual);
    return rutaActual;
}

/**
 * Purga la totalidad de paradas y datos de ruta de la base de datos local.
 * 
 * @returns {Array} Lista vacía de paradas.
 */
export function borrarRutaCompletaLocal() {
    console.log(">>> [PERSISTENCIA]: Purgando todos los datos de ruta de la base local...");
    localStorage.removeItem(CLAVE_RUTA_ACTIVA);
    guardarRutaZonificada([]);
    return [];
}

// =============================================================================
// 2. SINCRONIZACIÓN Y CONSULTA DE LA POOL ABIERTA (PHP I/O)
// =============================================================================

export async function sincronizarYRenderizarPool() {
    const contenedor = document.getElementById("pool-pedidos-dinamico");
    if (!contenedor) return;

    let poolRaw = {};
    const estaOnline = window.estaOnline !== undefined ? window.estaOnline : navigator.onLine;

    if (estaOnline) {
        try {
            const response = await fetch(ENDPOINT_POOL, { cache: "no-store" });
            if (response.ok) {
                poolRaw = await response.json();
                localStorage.setItem(CLAVE_POOL_LOCAL, JSON.stringify(poolRaw));
            } else {
                throw new Error("Respuesta de red no válida");
            }
        } catch (error) {
            console.warn(">>> [RED]: Relevo inaccesible. Conmutando a buffer LocalStorage.", error);
            poolRaw = JSON.parse(localStorage.getItem(CLAVE_POOL_LOCAL)) || {};
        }
    } else {
        poolRaw = JSON.parse(localStorage.getItem(CLAVE_POOL_LOCAL)) || {};
    }

    const lotesConvertidos = Object.values(poolRaw);
    contenedor.innerHTML = "";

    const disponibles = lotesConvertidos.filter(lote => lote && (lote.estado === "POOL_DISPONIBLE" || !lote.estado));

    if (disponibles.length === 0) {
        contenedor.innerHTML = `<div class="panel-maquina" style="text-align:center;color:var(--text-muted)">[POOL_IDLE] No hay contratos disponibles en la red local.</div>`;
        return;
    }

    disponibles.forEach((lote) => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "panel-maquina tarjeta-pedido";
        tarjeta.innerHTML = `
            <div class="header-status">
                <span style="color: var(--crypto-secure, #00ff66);">[ID: ${lote.id || '#MAC'}]</span>
                <span style="color: var(--text-primary, #fff);">[PARADAS: ${lote.paradas || (lote.puntos ? lote.puntos.length : 1)}]</span>
            </div>
            <div style="font-family:monospace; font-size:0.8rem; margin: 8px 0; color:#bbb;">
                • Frente Logístico: <span style="color:var(--crypto-secure, #00ff66);">${lote.destino || lote.direccion || "Cali"}</span><br>
                • Masa Chasis: ${lote.masaTotal || "1.5 kg"}<br>
                • Valor Retenido: <span style="color:var(--crypto-secure, #00ff66); font-weight:bold;">$${Math.round(lote.tarifa || 0).toLocaleString()} COP</span>
            </div>
            <button class="btn-terminal btn-crypto" onclick="procesarCustodiaEnServidor('${lote.id}', ${JSON.stringify(lote).replace(/"/g, '&quot;')})">
                EXECUTE_CUSTODY_ASIGNATION
            </button>
        `;
        contenedor.appendChild(tarjeta);
    });
}

// =============================================================================
// 3. CONMUTADOR DE CUSTODIA E INGESTIÓN DE ENTRADA EN TRÁNSITO
// =============================================================================

export async function procesarCustodiaEnServidor(idLote, loteObjeto) {
    const estaOnline = window.estaOnline !== undefined ? window.estaOnline : navigator.onLine;
    if (!estaOnline) return true;

    try {
        const resPoolGet = await fetch(ENDPOINT_POOL, { cache: "no-store" });
        let poolCompleta = resPoolGet.ok ? await resPoolGet.json() : {};
        delete poolCompleta[idLote];

        await fetch(ENDPOINT_SAVE_PHP, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Target-File": "pool_pedidos.json" },
            body: JSON.stringify(poolCompleta)
        });

        const resTransitoGet = await fetch(ENDPOINT_TRANSITO, { cache: "no-store" })
            .then(r => r.ok ? r.json() : {})
            .catch(() => ({}));

        loteObjeto.estado = "TRANSITO";
        loteObjeto.transportador = "Unidad Discover 125 (Custodio)";
        loteObjeto.fechaTransito = new Date().toISOString();
        resTransitoGet[idLote] = loteObjeto;

        await fetch(ENDPOINT_SAVE_PHP, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Target-File": "transito_pedidos.json" },
            body: JSON.stringify(resTransitoGet)
        });

        console.log(`>>> [SYSTEM_IO]: Lote ${idLote} migrado exitosamente de Pool a Tránsito.`);
        
        sincronizarYRenderizarPool();
        sincronizarYRenderizarTransito();
        return true;
    } catch (e) {
        console.error(">>> [IO_WRITE_ERROR]: Caída de sincronización de archivos físicos PHP.", e);
        return false;
    }
}

// =============================================================================
// 4. RENDIMIENTO Y VISUALIZACIÓN DE PEDIDOS EN TRÁNSITO
// =============================================================================

export async function sincronizarYRenderizarTransito() {
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
            <div class="panel-maquina tarjeta-pedido" style="border-color: var(--neon-blue, #00e5ff); box-shadow: 0 0 10px rgba(0,229,255,0.1);">
                <div class="header-status">
                    <span style="color: var(--neon-blue, #00e5ff);">[EN_MOTO: ${lote.id}]</span>
                    <span style="color: #fff;">${lote.destino || lote.direccion || "Zona Asignada"}</span>
                </div>
                <div style="font-family:monospace; font-size:0.75rem; margin:6px 0; color:#aaa;">
                    • Paradas en curso: ${lote.paradas || (lote.puntos ? lote.puntos.length : 1)}<br>
                    • Masa Acumulada: ${lote.masaTotal || "1.5 kg"}<br>
                    • Ganancia Retenida: <span style="color:var(--crypto-secure, #00ff66); font-weight:bold;">$${Math.round(lote.neto || lote.tarifa || 0).toLocaleString()} COP</span>
                </div>
                <button class="btn-terminal" onclick="liquidarEntregaEnAsfalto('${lote.id}')" style="border-color: var(--crypto-secure, #00ff66); color: var(--crypto-secure, #00ff66); width: 100%; font-weight: bold; margin-top: 4px;">
                    [✅] CONFIRMAR_ENTREGA_Y_LIQUIDAR_BONO
                </button>
            </div>
        `).join("");
    } catch (e) {
        console.error("Fallo leyendo el archivo de tránsito", e);
    }
}

// =============================================================================
// 5. LIQUIDACIÓN DE ENTREGA Y CIERRE DE REDENCIÓN EN DISCO
// =============================================================================

export async function liquidarEntregaEnAsfalto(idLote) {
    const confirmar = confirm(`>>> PROTOCOLO DE REDENCIÓN:\n\n¿Confirma la entrega física de todas las paradas del ${idLote} y la liberación de los fondos mutuos?`);
    if (!confirmar) return;

    try {
        const resTransito = await fetch(ENDPOINT_TRANSITO, { cache: "no-store" });
        let transitoData = await resTransito.json();
        const loteALiquidar = transitoData[idLote];
        delete transitoData[idLote];

        await fetch(ENDPOINT_SAVE_PHP, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Target-File": "transito_pedidos.json" },
            body: JSON.stringify(transitoData)
        });

        const resFinalizados = await fetch(ENDPOINT_FINALIZADOS, { cache: "no-store" })
            .then(r => r.ok ? r.json() : {})
            .catch(() => ({}));

        if (loteALiquidar) {
            loteALiquidar.estado = "FINALIZADA";
            loteALiquidar.fechaFinalizacion = new Date().toISOString();
            resFinalizados[idLote] = loteALiquidar;

            await fetch(ENDPOINT_SAVE_PHP, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Target-File": "finalizados_pedidos.json" },
                body: JSON.stringify(resFinalizados)
            });
        }

        alert(`>>> REDENCIÓN EXITOSA:\n\nEl lote ${idLote} pasó a canje consolidado. Fondos inyectados a su billetera.`);
        sincronizarYRenderizarTransito();
    } catch (e) {
        console.error("Error liquidando entrega:", e);
    }
}

// =============================================================================
// BINDINGS DEFENSIVOS EN EL ÁMBITO GLOBAL (WINDOW)
// =============================================================================

if (typeof window !== "undefined") {
    window.guardarRutaZonificada = guardarRutaZonificada;
    window.obtenerRutaZonificada = obtenerRutaZonificada;
    window.actualizarEstadoPedido = actualizarEstadoPedido;
    window.capturarCoordenadasGPS = capturarCoordenadasGPS;
    window.convertirArchivoBase64 = convertirArchivoBase64;
    window.eliminarParadaLocal = eliminarParadaLocal;
    window.borrarRutaCompletaLocal = borrarRutaCompletaLocal;
    window.sincronizarYRenderizarPool = sincronizarYRenderizarPool;
    window.procesarCustodiaEnServidor = procesarCustodiaEnServidor;
    window.sincronizarYRenderizarTransito = sincronizarYRenderizarTransito;
    window.liquidarEntregaEnAsfalto = liquidarEntregaEnAsfalto;
}