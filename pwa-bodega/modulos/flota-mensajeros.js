/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE GESTIÓN DE FLOTA DE MENSAJEROS
 * Ubicación: pwa-bodega/modulos/flota-mensajeros.js
 */

const STORAGE_KEY_FLOTA = "macondo_flota_mensajeros";

// Cargar mensajeros desde localStorage
export function obtenerMensajeros() {
    try {
        const datos = localStorage.getItem(STORAGE_KEY_FLOTA);
        return datos ? JSON.parse(datos) : [
            { id: "M-001", nombre: "Carlos Restrepo", telefono: "573001234567", vehiculo: "Moto Bajaj 125", zonaPreferida: "ZONA NORTE 1" },
            { id: "M-002", nombre: "Felipe Andrade", telefono: "573159876543", vehiculo: "Moto Yamaha 150", zonaPreferida: "ZONA SUR 2" }
        ];
    } catch (e) {
        console.error(">>> [FLOTA_ERROR]: Error leyendo almacenamiento local:", e);
        return [];
    }
}

// Guardar lista completa
export function guardarMensajeros(lista) {
    localStorage.setItem(STORAGE_KEY_FLOTA, JSON.stringify(lista));
    renderizarTablaFlotaUI();
}

// Agregar nuevo mensajero
export function agregarMensajero(nombre, telefono, vehiculo = "Moto", zonaPreferida = "TODAS") {
    const lista = obtenerMensajeros();
    let telSanitizado = telefono.replace(/\D/g, '');
    if (!telSanitizado.startsWith("57") && telSanitizado.length === 10) {
        telSanitizado = "57" + telSanitizado;
    }

    const nuevo = {
        id: "M-" + Math.floor(100 + Math.random() * 900),
        nombre,
        telefono: telSanitizado,
        vehiculo,
        zonaPreferida
    };

    lista.push(nuevo);
    guardarMensajeros(lista);
    return nuevo;
}

// Eliminar mensajero por ID
export function eliminarMensajero(id) {
    let lista = obtenerMensajeros();
    lista = lista.filter(m => m.id !== id);
    guardarMensajeros(lista);
}

// Renderizar tabla en la interfaz
export function renderizarTablaFlotaUI() {
    const contenedor = document.getElementById("tabla-flota-body");
    if (!contenedor) return;

    const lista = obtenerMensajeros();
    if (lista.length === 0) {
        contenedor.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#888;">No hay mensajeros registrados.</td></tr>`;
        return;
    }

    contenedor.innerHTML = lista.map(m => `
        <tr style="border-bottom: 1px solid #291f33;">
            <td style="color: var(--neon-blue); font-family: monospace;">${m.id}</td>
            <td style="color: #fff; font-weight: bold;">${m.nombre}</td>
            <td style="color: #ccc;">${m.telefono}</td>
            <td style="color: #aaa;">${m.vehiculo}</td>
            <td>
                <button type="button" onclick="eliminarMensajeroGlobal('${m.id}')" style="background: transparent; border: 1px solid #ff3366; color: #ff3366; cursor: pointer; padding: 2px 8px; border-radius: 3px; font-size: 0.75rem;">
                    [❌] ELIMINAR
                </button>
            </td>
        </tr>
    `).join("");
}

// Globalización para llamadas inline
window.eliminarMensajeroGlobal = (id) => {
    if (confirm("¿Desea eliminar este mensajero de la flota?")) {
        eliminarMensajero(id);
    }
};

window.obtenerMensajeros = obtenerMensajeros;
window.agregarMensajero = agregarMensajero;
window.eliminarMensajero = eliminarMensajero;
window.renderizarTablaFlotaUI = renderizarTablaFlotaUI;