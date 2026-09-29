/**
 * PROTOCOLO MACONDO - SUBSISTEMA RENDERIZADOR DE INTERFAZ OPERACIONAL (TIRILLAS & ZONAS)
 * Ubicación: pwa-mensajero/modulos/mensajero-ui.js
 * Fachada principal modularizada y desacoplada para la consola operacional y modales PWA
 */

import { renderizarParadasZonificadasUI } from "./rutas/rutas-ui-acordeon.js";
import { guardarRutaZonificada, obtenerParadasGuardadas } from "./mensajero-persistencia.js";

// =========================================================================
// SECCIÓN 1: INMUNIZACIÓN ESTÁTICA, PRECARGA Y GESTIÓN DE MODALES UI
// =========================================================================

/**
 * Sanitiza y limita el tamaño de textos de las paradas provenientes de IA o APIs externas
 * para evitar colapsos visuales o desbordamientos del layout.
 * @param {string} val 
 * @param {number} maxLen 
 * @returns {string}
 */
function sanitizarTextoInmune(val, maxLen = 150) {
    if (!val) return "";
    const str = String(val).trim();
    if (str.length > maxLen) {
        console.warn(`🛡️ [MENSAJERO_UI]: Texto recortado por superar el límite de inmunidad (${str.length} > ${maxLen} caracteres)`);
        return str.substring(0, maxLen) + "...";
    }
    return str;
}

/**
 * Normaliza un identificador de parada eliminando prefijos (#, PNT-, etc.).
 * @param {string|number} id 
 * @returns {string}
 */
function normalizarIdParada(id) {
    if (!id) return "";
    return String(id).replace(/^[#PNT-]+/i, '').trim();
}

/**
 * Búsqueda exhaustiva de elementos input/textarea/select dentro del modal de gestión manual.
 * @param {Array<string>} claves 
 * @returns {HTMLElement|null}
 */
function obtenerElementoInputMulti(claves) {
    const modalEl = document.getElementById('modal-gestion-parada') || document.getElementById('modal-formulario-parada') || document.getElementById('modal-editar-parada');
    const contexto = modalEl || document;

    for (const clave of claves) {
        let el = contexto.querySelector(`#${clave}`) || document.getElementById(clave);
        if (el) return el;

        el = contexto.querySelector(`[name="${clave}"]`);
        if (el) return el;

        el = contexto.querySelector(`.${clave}`);
        if (el) return el;

        const inputs = contexto.querySelectorAll("input, textarea, select");
        for (const input of inputs) {
            const ph = (input.placeholder || "").toLowerCase();
            const idLow = (input.id || "").toLowerCase();
            const nameLow = (input.name || "").toLowerCase();
            const claveLow = clave.toLowerCase();

            if (idLow.includes(claveLow) || nameLow.includes(claveLow) || ph.includes(claveLow)) {
                return input;
            }
        }
    }
    return null;
}

/**
 * Precarga de forma resiliente los valores de la parada en el modal de gestión manual.
 * @param {Object|string} paradaOId 
 */
export function precargarFormularioParadaUI(paradaOId) {
    if (!paradaOId) return;

    let parada = paradaOId;

    if (typeof paradaOId === "string" || typeof paradaOId === "number") {
        const cleanTarget = normalizarIdParada(paradaOId);
        const listaRAM = window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || window.paradasRutaActiva || [];
        parada = listaRAM.find(p => p && normalizarIdParada(p.id || p.ssc || p.scc) === cleanTarget);
    }

    if (!parada || typeof parada !== "object") {
        console.warn(`⚠️ [MENSAJERO_UI]: No se pudo localizar el objeto de la parada para precargar:`, paradaOId);
        return;
    }

    console.log("📝 [MENSAJERO_UI]: Precargando datos sanitizados en el formulario modal de parada:", parada);

    const setValMulti = (selectores, valor) => {
        const input = obtenerElementoInputMulti(selectores);
        if (input) {
            input.value = (valor !== undefined && valor !== null) ? valor : "";
        }
    };

    const idReal = normalizarIdParada(parada.id || parada.ssc || parada.scc || "");

    setValMulti(["input-parada-id", "input-id-parada", "input-id", "id_parada", "id"], idReal);
    setValMulti(["input-parada-cliente", "input-destinatario", "input-cliente", "destinatario", "cliente", "nombre", "nombre_cliente"], sanitizarTextoInmune(parada.destinatario || parada.cliente || parada.nombre_cliente || "", 100));
    setValMulti(["input-parada-direccion", "input-direccion", "input-direccion-entrega", "direccion", "dir"], sanitizarTextoInmune(parada.direccion || parada.dir || "", 150));
    setValMulti(["input-parada-telefono", "input-telefono", "input-telefono-contacto", "telefono", "tel"], sanitizarTextoInmune(parada.telefono || parada.tel || "", 30));
    setValMulti(["input-parada-ssc", "input-ssc", "input-scc", "input-guia", "ssc", "scc", "guia"], sanitizarTextoInmune(parada.ssc || parada.scc || idReal, 50));
    setValMulti(["input-parada-cuota", "input-cuota", "input-copago", "cuotaModeradora", "copago", "cuota"], sanitizarTextoInmune(parada.cuotaModeradora || parada.copago || "", 30));
    setValMulti(["input-parada-observaciones", "input-observaciones", "input-notas", "observaciones", "notas"], sanitizarTextoInmune(parada.observaciones || parada.notas || "", 200));
    setValMulti(["input-parada-zona", "input-zona", "zona"], sanitizarTextoInmune(parada.zona || parada.zonaCanonika || "GENERAL", 40));

    const modalEl = document.getElementById('modal-gestion-parada') || document.getElementById('modal-formulario-parada') || document.getElementById('modal-editar-parada');
    const formModal = modalEl ? (modalEl.querySelector("form") || modalEl) : null;
    if (formModal) {
        formModal.dataset.modo = "edicion";
        formModal.dataset.editId = idReal;
    }
}

/**
 * Limpia los campos del formulario modal y restablece MODO CREACIÓN.
 */
export function limpiarFormularioParadaUI() {
    console.log("🧹 [MENSAJERO_UI]: Restableciendo formulario modal a modo creación.");
    const modalEl = document.getElementById('modal-gestion-parada') || document.getElementById('modal-formulario-parada') || document.getElementById('modal-editar-parada');
    const formModal = modalEl ? (modalEl.querySelector("form") || modalEl) : null;
    
    if (formModal) {
        if (typeof formModal.reset === "function") formModal.reset();
        delete formModal.dataset.modo;
        delete formModal.dataset.editId;
    }

    const clearMulti = (selectores) => {
        const input = obtenerElementoInputMulti(selectores);
        if (input) input.value = "";
    };

    clearMulti(["input-parada-id", "input-id-parada", "input-id", "id"]);
    clearMulti(["input-parada-cliente", "input-destinatario", "input-cliente", "destinatario", "cliente"]);
    clearMulti(["input-parada-direccion", "input-direccion", "direccion", "dir"]);
    clearMulti(["input-parada-telefono", "input-telefono", "telefono", "tel"]);
    clearMulti(["input-parada-ssc", "input-ssc", "input-scc", "input-guia", "ssc"]);
    clearMulti(["input-parada-cuota", "input-cuota", "input-copago", "cuota"]);
    clearMulti(["input-parada-observaciones", "input-observaciones", "observaciones", "notas"]);
    clearMulti(["input-parada-zona", "input-zona", "zona"]);
}

/**
 * Extrae los valores del modal y actualiza/crea la parada en IndexedDB y RAMs.
 */
export async function guardarParadaManualUI() {
    console.log("💾 [MENSAJERO_UI]: Procesando guardado de parada desde ventana modal...");

    const modalEl = document.getElementById('modal-gestion-parada') || document.getElementById('modal-formulario-parada') || document.getElementById('modal-editar-parada');
    const formModal = modalEl ? (modalEl.querySelector("form") || modalEl) : null;

    const modo = formModal ? formModal.dataset.modo : null;
    const editIdOriginal = formModal ? formModal.dataset.editId : null;
    const esModoEdicion = modo === "edicion";

    const getValMulti = (selectores) => {
        const input = obtenerElementoInputMulti(selectores);
        return input ? input.value.trim() : "";
    };

    const idInput = sanitizarTextoInmune(getValMulti(["input-parada-id", "input-id-parada", "input-id", "id"]) || editIdOriginal, 50);
    const clienteVal = sanitizarTextoInmune(getValMulti(["input-parada-cliente", "input-destinatario", "input-cliente", "destinatario", "cliente", "nombre"]), 100);
    const direccionVal = sanitizarTextoInmune(getValMulti(["input-parada-direccion", "input-direccion", "input-direccion-entrega", "direccion", "dir"]), 150);
    const telefonoVal = sanitizarTextoInmune(getValMulti(["input-parada-telefono", "input-telefono", "input-telefono-contacto", "telefono", "tel"]), 30);
    const sscVal = sanitizarTextoInmune(getValMulti(["input-parada-ssc", "input-ssc", "input-scc", "input-guia", "ssc", "scc"]), 50);
    const cuotaVal = sanitizarTextoInmune(getValMulti(["input-parada-cuota", "input-cuota", "input-copago", "cuotaModeradora", "cuota"]), 30);
    const observacionesVal = sanitizarTextoInmune(getValMulti(["input-parada-observaciones", "input-observaciones", "input-notas", "observaciones", "notas"]), 200);
    const zonaVal = sanitizarTextoInmune(getValMulti(["input-parada-zona", "input-zona", "zona"]) || "GENERAL", 40);

    let todasLasParadas = (await obtenerParadasGuardadas()) || window.__CACHE_PARADAS_MACONDO__ || window.paradasMemoriaLocal || [];

    const normEditId = normalizarIdParada(editIdOriginal || idInput);
    const idxExistente = todasLasParadas.findIndex(p => p && normalizarIdParada(p.id || p.ssc || p.scc) === normEditId);

    if (esModoEdicion && idxExistente !== -1) {
        console.log(`✏️ [MENSAJERO_UI]: Actualizando parada ID '${todasLasParadas[idxExistente].id}' en índice [${idxExistente}]`);
        
        const objetivo = todasLasParadas[idxExistente];
        if (clienteVal) {
            objetivo.destinatario = clienteVal;
            objetivo.cliente = clienteVal;
            objetivo.nombre_cliente = clienteVal;
        }
        if (direccionVal) {
            objetivo.direccion = direccionVal;
            objetivo.dir = direccionVal;
        }
        if (telefonoVal) {
            objetivo.telefono = telefonoVal;
            objetivo.tel = telefonoVal;
        }
        if (sscVal) {
            objetivo.ssc = sscVal;
            objetivo.scc = sscVal;
        }
        if (cuotaVal) {
            objetivo.cuotaModeradora = cuotaVal;
            objetivo.copago = cuotaVal;
        }
        if (observacionesVal) {
            objetivo.observaciones = observacionesVal;
            objetivo.notas = observacionesVal;
        }
        objetivo.zona = zonaVal || objetivo.zona;
        objetivo.updated_at = new Date().toISOString();

        if (dbStore && typeof dbStore.actualizarParada === "function") {
            try {
                await dbStore.actualizarParada(objetivo);
            } catch (err) {
                console.warn("⚠️ [MENSAJERO_UI]: Error al actualizar parada en IndexedDB direct Store:", err);
            }
        }

    } else {
        const nuevoId = idInput || `PNT-${Math.floor(1000 + Math.random() * 9000)}`;
        console.log(`➕ [MENSAJERO_UI]: Creando nueva parada sanitizada con ID '${nuevoId}'`);

        const nuevaParada = {
            id: nuevoId,
            ssc: sscVal || nuevoId,
            scc: sscVal || nuevoId,
            destinatario: clienteVal || "Cliente Nuevo",
            cliente: clienteVal || "Cliente Nuevo",
            nombre_cliente: clienteVal || "Cliente Nuevo",
            direccion: direccionVal || "Sin Dirección",
            dir: direccionVal || "Sin Dirección",
            telefono: telefonoVal || "",
            tel: telefonoVal || "",
            cuotaModeradora: cuotaVal || "",
            copago: cuotaVal || "",
            observaciones: observacionesVal || "",
            notas: observacionesVal || "",
            zona: zonaVal,
            secuencia: todasLasParadas.length + 1,
            secuenciaZona: todasLasParadas.length + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        todasLasParadas.push(nuevaParada);
    }

    await guardarRutaZonificada(todasLasParadas);
    sincronizarMemoriasGlobales(todasLasParadas);
    await renderizarConsolaOperaciones(todasLasParadas, 0, 0);

    limpiarFormularioParadaUI();
    console.log("✅ [MENSAJERO_UI]: Operación de guardado modal completada de forma segura.");
}

(function inmunizarModalesUIGlobales() {
    window.mostrarModalImportarRutaUI = function () {
        console.log("🖥️ [UI_MODAL]: Abriendo modal de importación de ruta.");
        const modal = document.getElementById('modal-importar-ruta');
        if (modal) {
            if (typeof modal.showModal === "function") {
                modal.showModal();
            } else {
                modal.style.display = "block";
            }
        } else {
            console.warn("⚠️ [UI_MODAL]: Elemento #modal-importar-ruta no disponible en el DOM.");
        }
    };

    window.cerrarModalImportarRutaUI = function () {
        console.log("🖥️ [UI_MODAL]: Cerrando modal de importación de ruta.");
        const modal = document.getElementById('modal-importar-ruta');
        if (modal) {
            if (typeof modal.close === "function") {
                modal.close();
            } else {
                modal.style.display = "none";
            }
        }
    };

    window.ejecutarImportacionYRutaUI = async function () {
        console.log("⚡ [UI_MODAL]: Ejecutando importación manual de ruta.");
        if (typeof window.procesarCargaManualEnlace === "function") {
            await window.procesarCargaManualEnlace();
        } else {
            console.warn("⚠️ [UI_MODAL]: La función 'procesarCargaManualEnlace' no está definida globalmente.");
        }
        window.cerrarModalImportarRutaUI();
    };

    window.mostrarModalGestionParadaUI = function (datosParada = null) {
        console.log("✏️️ [UI_MODAL]: Abriendo modal de gestión/creación de parada.");
        const modal = document.getElementById('modal-gestion-parada') || document.getElementById('modal-formulario-parada') || document.getElementById('modal-editar-parada');
        
        if (modal) {
            if (datosParada) {
                precargarFormularioParadaUI(datosParada);
            } else {
                limpiarFormularioParadaUI();
            }

            if (typeof modal.showModal === "function") {
                modal.showModal();
            } else {
                modal.style.display = "flex";
                modal.classList.add("active", "show");
                modal.classList.remove("is-hidden", "hidden");
            }
        } else {
            console.warn("⚠️ [UI_MODAL]: Elemento modal de gestión de parada no disponible en el DOM.");
        }
    };

    window.cerrarModalGestionParadaUI = function () {
        console.log("✏️ [UI_MODAL]: Cerrando modal de gestión de parada.");
        limpiarFormularioParadaUI();
        const modal = document.getElementById('modal-gestion-parada') || document.getElementById('modal-formulario-parada') || document.getElementById('modal-editar-parada');
        if (modal) {
            if (typeof modal.close === "function") {
                modal.close();
            } else {
                modal.style.display = "none";
                modal.classList.remove("active", "show");
            }
        }
    };

    window.guardarYcerrarParadaManualUI = async function () {
        console.log("💾 [UI_MODAL]: Guardando parada desde ventana modal.");
        await guardarParadaManualUI();
        window.cerrarModalGestionParadaUI();
    };

    window.precargarFormularioParadaUI = precargarFormularioParadaUI;
    window.limpiarFormularioParadaUI = limpiarFormularioParadaUI;
    window.guardarParadaManualUI = guardarParadaManualUI;
    window.abrirModalEditarParada = window.mostrarModalGestionParadaUI;
    window.prepararEdicionParadaUI = window.mostrarModalGestionParadaUI;

    console.log("🟢 [MENSAJERO_UI]: Modales de UI e interfaces emergentes vinculados a window correctamente.");
})();

// =========================================================================
// SECCIÓN 2: CONTROL DE ESTADO LOCAL Y MÓDULOS DEPENDIENTES
// =========================================================================

let actualizarPuntosEnMapaFn = null;
let enfocarZonaEnMapaFn = null;
let PALETA_ZONAS_REF = { GENERAL: { color: "#00e5ff", label: "GENERAL" } };
let dbStore = null;
let renderizarTarjetaActivaUIFn = null;
let vincularDragDropUIFn = null;
let ejecutarZonificacionAutomaticaUIFn = null;
let moverParadaSecuenciaUIFn = null;

let paradasMemoriaLocal = [];

function compararIdsParada(idA, idB) {
    if (!idA || !idB) return false;
    return normalizarIdParada(idA) === normalizarIdParada(idB);
}

async function cargarModulosDependientes() {
    console.log("🔄 [MENSAJERO_UI]: Iniciando carga asíncrona de dependencias modulares...");
    try {
        const mapaVisor = await import("./mapa/mapa-visor.js").catch(() => ({}));
        actualizarPuntosEnMapaFn = mapaVisor.actualizarPuntosEnMapa || null;
        enfocarZonaEnMapaFn = mapaVisor.enfocarZonaEnMapa || null;

        const zonif = await import("./mapa/zonificacion/mensajero-zonificacion.js").catch(() => ({}));
        PALETA_ZONAS_REF = zonif.PALETA_ZONAS || window.PALETA_ZONAS || PALETA_ZONAS_REF;

        const storeMod = await import("./db/indexed-store.js").catch(() => ({}));
        if (storeMod.IndexedStore) {
            dbStore = new storeMod.IndexedStore();
            console.log("💾 [MENSAJERO_UI]: Instancia de IndexedStore lista.");
        }

        const uiTarjeta = await import("./ui/ui-tarjeta-activa.js").catch(() => ({}));
        renderizarTarjetaActivaUIFn = uiTarjeta.renderizarTarjetaActivaUI || null;

        const dndMod = await import("./ui/ui-dnd-persistencia.js").catch(() => ({}));
        vincularDragDropUIFn = dndMod.vincularDragDropUI || null;

        const zonifMaint = await import("./ui/ui-zonificacion-mantenimiento.js").catch(() => ({}));
        ejecutarZonificacionAutomaticaUIFn = zonifMaint.ejecutarZonificacionAutomaticaUI || null;
        moverParadaSecuenciaUIFn = zonifMaint.moverParadaSecuenciaUI || null;

        console.log("✅ [MENSAJERO_UI]: Módulos dependientes cargados e integrados correctamente.");
    } catch (e) {
        console.warn("⚠️ [MENSAJERO_UI]: Carga diferida de módulos requerida:", e);
    }
}

cargarModulosDependientes();

function resolverFn(fnModulo, nombreGlobal) {
    if (typeof fnModulo === "function") return fnModulo;
    if (typeof window[nombreGlobal] === "function") return window[nombreGlobal];
    return null;
}

function sincronizarMemoriasGlobales(listaActualizada) {
    const sanitizada = (Array.isArray(listaActualizada) ? listaActualizada : []).map(p => {
        if (!p || typeof p !== "object") return p;
        return {
            ...p,
            destinatario: sanitizarTextoInmune(p.destinatario || p.cliente || p.nombre_cliente || "", 100),
            cliente: sanitizarTextoInmune(p.cliente || p.destinatario || "", 100),
            direccion: sanitizarTextoInmune(p.direccion || p.dir || "", 150),
            dir: sanitizarTextoInmune(p.dir || p.direccion || "", 150),
            observaciones: sanitizarTextoInmune(p.observaciones || p.notas || "", 200)
        };
    });

    paradasMemoriaLocal = [...sanitizada];
    window.__CACHE_PARADAS_MACONDO__ = [...paradasMemoriaLocal];
    window.paradasMemoriaLocal = [...paradasMemoriaLocal];
    window.paradasRutaActiva = [...paradasMemoriaLocal];
    window.pedidosGlobales = [...paradasMemoriaLocal];

    try {
        localStorage.setItem("ruta_zonificada", JSON.stringify(paradasMemoriaLocal));
    } catch (e) {
        console.warn("⚠️ [MENSAJERO_UI]: Fallo al escribir en LocalStorage:", e);
    }
}

export function emitirHaptico(pattern = 30) {
    if (typeof navigator !== "undefined" && 'vibrate' in navigator) {
        try { 
            navigator.vibrate(pattern);
            console.log(`📳 [HAPTIC]: Vibración háptica emitida (${JSON.stringify(pattern)}ms)`);
        } catch (e) {
            console.warn("⚠️ [HAPTIC]: Vibración no soportada o denegada por navegador:", e);
        }
    }
}

// =========================================================================
// SECCIÓN 3: FUNCIONES DE RENDERIZADO DE CONSOLA Y ACCIONES OPERATIVAS
// =========================================================================

export async function renderizarConsolaOperaciones(listaPedidos, indiceActivo = 0, llamadasRealizadas = 0) {
    console.group("🖥️ [MENSAJERO_UI]: Renderizando Consola de Operaciones");
    
    sincronizarMemoriasGlobales(listaPedidos);
    console.log(`📊 Paradas totales recibidas: ${paradasMemoriaLocal.length} | Ítem Activo: Índice ${indiceActivo}`);

    const contenedorActivo = document.getElementById("contenedor-tarjeta-activa");
    const txtTotal = document.getElementById("txt-total-paradas");

    if (txtTotal) txtTotal.innerText = `${paradasMemoriaLocal.length} PARADAS`;

    console.log("🗺️ [MENSAJERO_UI]: Notificando al visor de mapa para actualizar waypoints...");
    const fnActualizarMapa = resolverFn(actualizarPuntosEnMapaFn, "actualizarPuntosEnMapa");
    if (fnActualizarMapa) {
        fnActualizarMapa(paradasMemoriaLocal, indiceActivo);
    }

    if (paradasMemoriaLocal.length === 0) {
        console.warn("⚠️ [MENSAJERO_UI]: La lista de pedidos está vacía. Mostrando estado [SIN_RUTA].");
        const fnTarjetaActiva = resolverFn(renderizarTarjetaActivaUIFn, "renderizarTarjetaActivaUI");
        if (contenedorActivo && fnTarjetaActiva) {
            fnTarjetaActiva(contenedorActivo, null, 0, 0);
        }
        
        const fnAcordeon = resolverFn(renderizarParadasZonificadasUI, "renderizarParadasZonificadasUI");
        if (fnAcordeon) {
            await fnAcordeon([]);
        }
        console.groupEnd();
        return;
    }

    const pedido = paradasMemoriaLocal[indiceActivo] || paradasMemoriaLocal[0];

    const fnTarjetaActiva = resolverFn(renderizarTarjetaActivaUIFn, "renderizarTarjetaActivaUI");
    if (contenedorActivo && fnTarjetaActiva) {
        console.log(`🎯 [MENSAJERO_UI]: Renderizando Tarjeta Activa -> ID: ${pedido.id || pedido.ssc || 'N/A'}`);
        fnTarjetaActiva(contenedorActivo, pedido, indiceActivo, llamadasRealizadas);
    } else if (!contenedorActivo) {
        console.log("ℹ️ [MENSAJERO_UI]: Vista Activa sin `#contenedor-tarjeta-activa`. Omitiendo renderizado de tarjeta estática.");
    }

    console.log("📋 [MENSAJERO_UI]: Delegando construcción de acordeones a 'rutas-ui-acordeon.js'...");
    const fnAcordeon = resolverFn(renderizarParadasZonificadasUI, "renderizarParadasZonificadasUI");
    if (fnAcordeon) {
        await fnAcordeon(paradasMemoriaLocal);
    }

    console.log("✅ [MENSAJERO_UI]: Consola de operaciones renderizada exitosamente.");
    console.groupEnd();
}

export function refrescarConsolaOperaciones() {
    console.log("🔄 [MENSAJERO_UI]: Refrescando consola con datos en memoria local...");
    renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
}

export async function ejecutarZonificacionAutomatica() {
    console.log("⚡ [MENSAJERO_UI]: Solicitando zonificación automática...");
    emitirHaptico(30);
    const zonifFn = resolverFn(ejecutarZonificacionAutomaticaUIFn, "ejecutarZonificacionAutomaticaUI");
    if (typeof zonifFn === "function") {
        const resultado = await zonifFn(paradasMemoriaLocal, (p) => renderizarConsolaOperaciones(p, 0, 0));
        sincronizarMemoriasGlobales(resultado);
        if (typeof guardarRutaZonificada === "function") {
            await guardarRutaZonificada(resultado);
        }
        console.log("✅ [MENSAJERO_UI]: Zonificación automática completada y persistida.");
    } else {
        console.warn("⚠️ [MENSAJERO_UI]: Función 'ejecutarZonificacionAutomatica' no disponible.");
    }
}

export async function moverParadaSecuencia(idParada, delta) {
    console.log(`↕️️ [MENSAJERO_UI]: Moviendo secuencia de parada ID '${idParada}' (delta: ${delta})...`);
    emitirHaptico(20);
    const moverFn = resolverFn(moverParadaSecuenciaUIFn, "moverParadaSecuenciaUI");
    if (typeof moverFn === "function") {
        await moverFn(paradasMemoriaLocal, idParada, delta, (p) => renderizarConsolaOperaciones(p, 0, 0));
    } else {
        console.warn("⚠️ [MENSAJERO_UI]: Función 'moverParadaSecuencia' no disponible.");
    }
}

export function activarEdicionParadaUI(e, idx) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    console.log(`✏️ [MENSAJERO_UI]: Activando modo edición en interfaz para índice -> ${idx}`);
    emitirHaptico(20);
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'none';
    if (edicion) edicion.style.display = 'flex';
}

export function cancelarEdicionParadaUI(e, idx) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    console.log(`↩️ [MENSAJERO_UI]: Cancelando edición para índice -> ${idx}`);
    emitirHaptico(20);
    const lectura = document.getElementById(`vista-lectura-${idx}`);
    const edicion = document.getElementById(`vista-edicion-${idx}`);
    if (lectura) lectura.style.display = 'flex';
    if (edicion) edicion.style.display = 'none';
}

export async function guardarEdicionParadaUI(e, idx) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    console.log(`💾 [MENSAJERO_UI]: Guardando edición realizada en índice -> ${idx}`);
    emitirHaptico(40);
    
    if (paradasMemoriaLocal[idx]) {
        paradasMemoriaLocal[idx].destinatario = sanitizarTextoInmune(document.getElementById(`input-edit-destinatario-${idx}`)?.value || paradasMemoriaLocal[idx].destinatario, 100);
        paradasMemoriaLocal[idx].cliente = paradasMemoriaLocal[idx].destinatario;
        paradasMemoriaLocal[idx].telefono = sanitizarTextoInmune(document.getElementById(`input-edit-telefono-${idx}`)?.value || paradasMemoriaLocal[idx].telefono, 30);
        paradasMemoriaLocal[idx].tel = paradasMemoriaLocal[idx].telefono;
        paradasMemoriaLocal[idx].direccion = sanitizarTextoInmune(document.getElementById(`input-edit-direccion-${idx}`)?.value || paradasMemoriaLocal[idx].direccion, 150);
        paradasMemoriaLocal[idx].dir = paradasMemoriaLocal[idx].direccion;
        paradasMemoriaLocal[idx].ssc = sanitizarTextoInmune(document.getElementById(`input-edit-ssc-${idx}`)?.value || paradasMemoriaLocal[idx].ssc, 50);
        paradasMemoriaLocal[idx].cuotaModeradora = sanitizarTextoInmune(document.getElementById(`input-edit-cuota-${idx}`)?.value || paradasMemoriaLocal[idx].cuotaModeradora, 30);
        paradasMemoriaLocal[idx].updated_at = new Date().toISOString();

        console.log(`📝 [MENSAJERO_UI]: Datos actualizados -> ${paradasMemoriaLocal[idx].destinatario} | ${paradasMemoriaLocal[idx].direccion}`);

        if (dbStore && typeof dbStore.actualizarParada === "function") {
            try {
                console.log("💾 [MENSAJERO_UI]: Persistiendo cambios en IndexedDB...");
                await dbStore.actualizarParada(paradasMemoriaLocal[idx]);
            } catch (err) {
                console.warn("⚠️ [MENSAJERO_UI]: Error guardando en IndexedDB:", err);
            }
        }

        if (typeof guardarRutaZonificada === "function") {
            await guardarRutaZonificada(paradasMemoriaLocal);
        }

        sincronizarMemoriasGlobales(paradasMemoriaLocal);
        console.log("✅ [MENSAJERO_UI]: Cambios guardados en LocalStorage/IndexedDB/RAM. Refrescando UI...");
        renderizarConsolaOperaciones(paradasMemoriaLocal, 0, 0);
    } else {
        console.error(`❌ [MENSAJERO_UI]: No se encontró la parada en memoria para el índice -> ${idx}`);
    }
}

export async function eliminarParadaUI(e, idxOId) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    
    let target = idxOId;
    if (typeof e === "number" || typeof e === "string") {
        target = e;
    }

    console.log(`🗑️ [MENSAJERO_UI]: Solicitud para eliminar parada -> ${target}`);
    emitirHaptico([50, 30, 50]);
    
    if (typeof window !== "undefined" && window.confirm && !confirm("¿Desea eliminar esta parada de la ruta?")) {
        console.log("❌ [MENSAJERO_UI]: Eliminación cancelada por el usuario.");
        return;
    }

    let paradaRemovida = null;
    let paradasRestantes = [];

    if (typeof target === "number" && target >= 0 && target < paradasMemoriaLocal.length) {
        paradaRemovida = paradasMemoriaLocal[target];
        paradasRestantes = paradasMemoriaLocal.filter((_, i) => i !== target);
    } else {
        paradasRestantes = paradasMemoriaLocal.filter(p => {
            if (p && compararIdsParada(p.id || p.ssc, target)) {
                paradaRemovida = p;
                return false;
            }
            return true;
        });
    }

    if (paradaRemovida) {
        console.log("🗑️ [MENSAJERO_UI]: Parada removida de memoria local:", paradaRemovida);
    } else {
        console.warn(`⚠️️ [MENSAJERO_UI]: No se pudo encontrar la parada con identificador: ${target}`);
    }

    console.log("🔢 [MENSAJERO_UI]: Re-secuenciando paradas restantes...");
    paradasRestantes.forEach((p, idx) => {
        p.secuencia = idx + 1;
        p.secuenciaZona = idx + 1;
        p.orden = idx + 1;
        p.updated_at = new Date().toISOString();
    });

    try {
        if (paradaRemovida && paradaRemovida.id && dbStore && typeof dbStore.eliminarParada === "function") {
            console.log(`💾 [MENSAJERO_UI]: Purgando registro ID '${paradaRemovida.id}' de IndexedDB...`);
            await dbStore.eliminarParada(paradaRemovida.id, "paradas_rutas");
            await dbStore.eliminarParada(paradaRemovida.id, "rutas_zonificadas").catch(() => {});
        }

        if (typeof guardarRutaZonificada === "function") {
            await guardarRutaZonificada(paradasRestantes);
            console.log("💾 [MENSAJERO_UI]: Snapshot reducida persistida en IndexedDB.");
        }
    } catch (err) {
        console.warn("⚠️ [MENSAJERO_UI]: Error actualizando la persistencia local:", err);
    }

    sincronizarMemoriasGlobales(paradasRestantes);
    console.log("✅ [MENSAJERO_UI]: Parada eliminada y consola refrescada.");
    await renderizarConsolaOperaciones(paradasRestantes, 0, 0);
}

// Bindings globales estáticos en el objeto window
window.renderizarConsolaOperaciones = renderizarConsolaOperaciones;
window.refrescarConsolaOperaciones = refrescarConsolaOperaciones;
window.refrescarConsolaOperacionesUI = refrescarConsolaOperaciones;
window.ejecutarZonificacionAutomatica = ejecutarZonificacionAutomatica;
window.moverParadaSecuencia = moverParadaSecuencia;
window.activarEdicionParadaUI = activarEdicionParadaUI;
window.cancelarEdicionParadaUI = cancelarEdicionParadaUI;
window.guardarEdicionParadaUI = guardarEdicionParadaUI;
window.eliminarParadaUI = eliminarParadaUI;