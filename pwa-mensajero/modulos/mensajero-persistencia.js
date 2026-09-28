/**
 * PROTOCOLO MACONDO - SUBSISTEMA MENSAJERO: PERSISTENCIA LOCAL-FIRST & RELEVO I/O
 * Ubicación: pwa-mensajero/modulos/mensajero-persistencia.js
 * Arquitectura: Híbrida (IndexedDB + LocalStorage Fallback) con Relevo REST/PHP
 */

import { indexedStore, guardarUltimoEstadoNavegacion, obtenerUltimoEstadoNavegacion } from "./db/indexed-store.js";

// --- CONFIGURACIÓN DE ENDPOINTS DE RED Y DISCO LOCAL ---
const ENDPOINT_POOL = "../pool_pedidos.json";
const ENDPOINT_TRANSITO = "../transito_pedidos.json";
const ENDPOINT_FINALIZADOS = "../finalizados_pedidos.json";
const ENDPOINT_SAVE_PHP = "../save_pool.php";

// --- CLAVES DE ALMACENAMIENTO LOCAL-FIRST ---
const CLAVE_RUTA_ACTIVA = "pwa_mensajero_paradas_zonificadas";
const CLAVE_STORAGE_PARADAS = "macondo_paradas_cache_v1";
const CLAVE_POOL_LOCAL = "MACONDO_POOL";

/**
 * Sincroniza las referencias de la colección de paradas en todas las cachés volátiles de RAM.
 * @param {Array<Object>} paradas 
 */
function actualizarCachesRAMGlobales(paradas = []) {
    if (!Array.isArray(paradas)) return;
    window.__CACHE_PARADAS_MACONDO__ = paradas;
    window.paradasMemoriaLocal = paradas;
    window.paradasRutaActiva = paradas;
    window.pedidosGlobales = paradas;
}

// =============================================================================
// 1. GESTIÓN Y PERSISTENCIA DE LA MÁQUINA DE ESTADOS LOCAL
// =============================================================================

/**
 * Guarda o reemplaza el conjunto de paradas zonificadas en IndexedDB, localStorage y RAM.
 * @param {Array<Object>} ruta - Arreglo de paradas a guardar.
 * @returns {Promise<boolean>}
 */
export async function guardarRutaZonificada(ruta) {
    if (!Array.isArray(ruta)) {
        console.error("❌ [PERSISTENCIA_ERROR]: Se esperaba un arreglo de paradas.");
        return false;
    }

    console.log(`>>> [PERSISTENCIA]: Guardando ${ruta.length} parada(s) en la base local...`);

    // 1. Resguardo inmediato en localStorage y RAM
    try {
        const payloadJson = JSON.stringify(ruta);
        localStorage.setItem(CLAVE_RUTA_ACTIVA, payloadJson);
        localStorage.setItem(CLAVE_STORAGE_PARADAS, payloadJson);
        actualizarCachesRAMGlobales(ruta);
    } catch (errStorage) {
        console.warn("⚠️ [PERSISTENCIA_STORAGE_WARN]: No se pudo escribir en localStorage:", errStorage);
    }

    // 2. Persistencia en IndexedDB vía IndexedStore Singleton
    try {
        if (indexedStore && typeof indexedStore.guardarColeccionParadas === "function") {
            await indexedStore.guardarColeccionParadas(ruta);
            console.log("✅ [PERSISTENCIA_INDEXED_OK]: Ruta sincronizada en IndexedDB.");
        }
    } catch (errIndexed) {
        console.error("❌ [PERSISTENCIA_INDEXED_FAIL]: Falló la escritura en IndexedDB:", errIndexed);
    }

    return true;
}

/**
 * Obtiene la lista actual de paradas guardadas desde IndexedDB o localStorage.
 * @returns {Promise<Array<Object>>}
 */
export async function obtenerParadasGuardadas() {
    try {
        if (indexedStore && typeof indexedStore.obtenerParadas === "function") {
            const registros = await indexedStore.obtenerParadas();
            if (Array.isArray(registros) && registros.length > 0) {
                actualizarCachesRAMGlobales(registros);
                return registros;
            }
        } else if (indexedStore && typeof indexedStore._execTx === "function") {
            const registros = await indexedStore._execTx('paradas_rutas', 'readonly', (store) => {
                return new Promise((resolve, reject) => {
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
            });
            if (Array.isArray(registros) && registros.length > 0) {
                actualizarCachesRAMGlobales(registros);
                return registros;
            }
        }
    } catch (err) {
        console.warn("⚠️ [PERSISTENCIA_WARN]: Falló la lectura de IndexedDB. Conmutando a localStorage:", err.message || err);
    }

    const resultadoFallback = obtenerParadasLocalStorage();
    actualizarCachesRAMGlobales(resultadoFallback);
    return resultadoFallback;
}

/**
 * Alias de compatibilidad para obtener la ruta zonificada.
 */
export async function obtenerRutaZonificada() {
    return await obtenerParadasGuardadas();
}

/**
 * Lee directamente del respaldo en localStorage o memoria.
 */
function obtenerParadasLocalStorage() {
    try {
        const data = localStorage.getItem(CLAVE_RUTA_ACTIVA) || localStorage.getItem(CLAVE_STORAGE_PARADAS);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("❌ [PERSISTENCIA_ERROR]: Error leyendo de localStorage:", e);
    }
    return window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];
}

/**
 * Actualiza el estado y metadatos de un pedido específico.
 * @param {string|number} idPedido 
 * @param {string} nuevoEstado 
 * @param {Object} metadataExtra 
 */
export async function actualizarEstadoPedido(idPedido, nuevoEstado, metadataExtra = {}) {
    const ruta = await obtenerParadasGuardadas();
    const index = ruta.findIndex(p => String(p.id || p.ssc) === String(idPedido));

    if (index !== -1) {
        ruta[index].estado = nuevoEstado;
        ruta[index].ultimaActualizacion = new Date().toISOString();

        if (Object.keys(metadataExtra).length > 0) {
            ruta[index].registroOperaciones = {
                ...(ruta[index].registroOperaciones || {}),
                ...metadataExtra
            };
        }

        try {
            if (indexedStore && typeof indexedStore.actualizarParada === "function") {
                await indexedStore.actualizarParada(ruta[index]);
            }
        } catch (e) {
            console.warn("⚠️ [PERSISTENCIA]: No se pudo actualizar parada individual en IndexedDB:", e);
        }

        await guardarRutaZonificada(ruta);
    }
    return ruta;
}

/**
 * Elimina una parada específica de la base local por su ID.
 * @param {string|number} idParada 
 */
export async function eliminarParadaLocal(idParada) {
    console.log(`>>> [PERSISTENCIA]: Eliminando parada local con ID: ${idParada}`);
    try {
        if (indexedStore && typeof indexedStore.eliminarParada === "function") {
            await indexedStore.eliminarParada(idParada);
        }
    } catch (e) {
        console.warn("⚠️ Error eliminando parada individual de IndexedDB:", e);
    }

    let rutaActual = await obtenerParadasGuardadas();
    rutaActual = rutaActual.filter(p => String(p.id || p.ssc) !== String(idParada));
    await guardarRutaZonificada(rutaActual);
    return rutaActual;
}

/**
 * Purga la totalidad de paradas y datos de ruta de la base de datos local.
 */
export async function borrarRutaCompletaLocal() {
    console.log(">>> [PERSISTENCIA]: Purgando todos los datos de ruta de la base local...");
    localStorage.removeItem(CLAVE_RUTA_ACTIVA);
    localStorage.removeItem(CLAVE_STORAGE_PARADAS);
    actualizarCachesRAMGlobales([]);

    try {
        if (indexedStore && typeof indexedStore.limpiarStore === "function") {
            await indexedStore.limpiarStore('paradas_rutas');
        }
    } catch (e) {
        console.warn("⚠️ Error purgando IndexedDB:", e);
    }

    return [];
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

    const lotesConvertidos = Object.values(poolRaw || {});
    contenedor.innerHTML = "";

    const disponibles = lotesConvertidos.filter(lote => lote && (lote.estado === "POOL_DISPONIBLE" || !lote.estado));

    if (disponibles.length === 0) {
        contenedor.innerHTML = `<div class="panel-maquina" style="text-align:center;color:var(--text-muted)">[POOL_IDLE] No hay contratos disponibles en la red local.</div>`;
        return;
    }

    disponibles.forEach((lote) => {
        const tarjeta = document.createElement("div");
        tarjeta.className = "panel-maquina tarjeta-pedido";
        const loteEscapado = JSON.stringify(lote).replace(/'/g, "&#39;").replace(/"/g, "&quot;");

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
            <button class="btn-terminal btn-crypto" onclick="procesarCustodiaEnServidor('${lote.id}', ${loteEscapado})">
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
        const lotes = Object.values(transitoRaw || {});

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
    window.obtenerParadasGuardadas = obtenerParadasGuardadas;
    window.obtenerParadasLocalStorage = obtenerParadasLocalStorage;
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
    window.guardarUltimoEstadoNavegacion = guardarUltimoEstadoNavegacion;
    window.obtenerUltimoEstadoNavegacion = obtenerUltimoEstadoNavegacion;
}