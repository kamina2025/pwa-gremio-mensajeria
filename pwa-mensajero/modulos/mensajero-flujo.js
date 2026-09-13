/**
 * PROTOCOLO MACONDO - CONTROLADOR DE FLUJO Y NOVEDADES
 * Ubicación: pwa-mensajero/modulos/mensajero-flujo.js
 */

import { 
    actualizarEstadoPedido, 
    capturarCoordenadasGPS, 
    convertirArchivoBase64,
    procesarCustodiaEnServidor,
    sincronizarYRenderizarPool
} from "./mensajero-persistencia.js";

export function registrarIntentoLlamada(getLlamadas, setLlamadas, callbackRender) {
    const total = getLlamadas() + 1;
    setLlamadas(total);
    callbackRender();
}

export function abrirModalNovedad() {
    const modal = document.getElementById("modal-novedad");
    if (modal) modal.style.display = "flex";
}

export function cerrarModalNovedad() {
    const modal = document.getElementById("modal-novedad");
    if (modal) modal.style.display = "none";
}

export function configurarEventosFormularioNovedad(getPedidoActivo, getLlamadas, callbackAvanzar) {
    const formNovedad = document.getElementById("form-novedad-coordinador");
    if (formNovedad) {
        formNovedad.addEventListener("submit", async (e) => {
            e.preventDefault();
            const pedidoActual = getPedidoActivo();
            
            const fileTirilla = document.getElementById("foto-tirilla").files[0];
            const fileFachada = document.getElementById("foto-fachada").files[0];
            const motivo = document.getElementById("txt-motivo-novedad").value.trim();

            const base64Tirilla = await convertirArchivoBase64(fileTirilla);
            const base64Fachada = await convertirArchivoBase64(fileFachada);
            const coords = await capturarCoordenadasGPS();

            const reporteNovedadPayload = {
                idPedido: pedidoActual.id,
                coordinadorNotificado: true,
                motivo: motivo,
                intentosLlamadas: getLlamadas(),
                coordenadasGPS: coords,
                fotoTirilla: base64Tirilla,
                fotoFachada: base64Fachada,
                fechaReporte: new Date().toISOString()
            };

            actualizarEstadoPedido(pedidoActual.id, "NOVEDAD", { novedad: reporteNovedadPayload });
            cerrarModalNovedad();
            callbackAvanzar();
        });
    }
}

export async function ejecutarCustodia(idPedido) {
    let poolCached = JSON.parse(localStorage.getItem("MACONDO_POOL")) || {};
    if (poolCached[idPedido]) {
        await procesarCustodiaEnServidor(idPedido, poolCached[idPedido]);
        sincronizarYRenderizarPool();
    }
}

window.abrirModalNovedad = abrirModalNovedad;
window.cerrarModalNovedad = cerrarModalNovedad;
window.ejecutarCustodia = ejecutarCustodia;