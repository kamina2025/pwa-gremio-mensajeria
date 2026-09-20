/**
 * PROTOCOLO MACONDO - CONTROLADOR DE UI PERFIL DE CONDUCTOR
 * Ubicación: pwa-mensajero/modulos/perfil-ui.js
 */

import { obtenerPerfilLocal, guardarPerfilLocal } from './perfil-db.js';

/**
 * Convierte un archivo a formato Base64 para optimización Local-First.
 */
function archivoABase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/**
 * Carga e inyecta los datos guardados en el formulario de la vista perfil.
 */
export async function cargarPerfilUI() {
    const perfil = await obtenerPerfilLocal();
    if (!perfil) return;

    if (document.getElementById("perfil-nombre")) document.getElementById("perfil-nombre").value = perfil.nombre || "";
    if (document.getElementById("perfil-cedula")) document.getElementById("perfil-cedula").value = perfil.cedula || "";
    if (document.getElementById("perfil-telefono")) document.getElementById("perfil-telefono").value = perfil.telefono || "";
    if (document.getElementById("perfil-placa")) document.getElementById("perfil-placa").value = perfil.placa || "";
    
    if (document.getElementById("perfil-soat-vencimiento")) document.getElementById("perfil-soat-vencimiento").value = perfil.soatVencimiento || "";
    if (document.getElementById("perfil-tecno-vencimiento")) document.getElementById("perfil-tecno-vencimiento").value = perfil.tecnoVencimiento || "";

    // Previsualizaciones de documentos
    if (perfil.docPropiedad) mostrarVistaPrevia("prev-tarjeta-propiedad", perfil.docPropiedad);
    if (perfil.docSoat) mostrarVistaPrevia("prev-soat", perfil.docSoat);
    if (perfil.docTecno) mostrarVistaPrevia("prev-tecno", perfil.docTecno);
}

function mostrarVistaPrevia(elementId, base64) {
    const contenedor = document.getElementById(elementId);
    if (!contenedor) return;

    if (base64.startsWith("data:image")) {
        contenedor.innerHTML = `<img src="${base64}" alt="Documento" class="img-preview-cyber" />`;
    } else {
        contenedor.innerHTML = `<span class="badge badge-success">📄 Documento PDF Cargado</span>`;
    }
}

/**
 * Maneja el evento de guardado del formulario de perfil.
 */
export async function manejarGuardarPerfil(e) {
    if (e) e.preventDefault();

    const perfilExistente = await obtenerPerfilLocal() || {};

    // Obtener Base64 de nuevos archivos seleccionados
    const inputPropiedad = document.getElementById("doc-tarjeta-propiedad")?.files[0];
    const inputSoat = document.getElementById("doc-soat")?.files[0];
    const inputTecno = document.getElementById("doc-tecno")?.files[0];

    const docPropiedadB64 = inputPropiedad ? await archivoABase64(inputPropiedad) : perfilExistente.docPropiedad;
    const docSoatB64 = inputSoat ? await archivoABase64(inputSoat) : perfilExistente.docSoat;
    const docTecnoB64 = inputTecno ? await archivoABase64(inputTecno) : perfilExistente.docTecno;

    const datosPerfil = {
        nombre: document.getElementById("perfil-nombre")?.value.trim(),
        cedula: document.getElementById("perfil-cedula")?.value.trim(),
        telefono: document.getElementById("perfil-telefono")?.value.trim(),
        placa: document.getElementById("perfil-placa")?.value.trim().toUpperCase(),
        soatVencimiento: document.getElementById("perfil-soat-vencimiento")?.value,
        tecnoVencimiento: document.getElementById("perfil-tecno-vencimiento")?.value,
        docPropiedad: docPropiedadB64,
        docSoat: docSoatB64,
        docTecno: docTecnoB64
    };

    await guardarPerfilLocal(datosPerfil);
    alert("✅ [ÉXITO]: Datos del perfil y documentos guardados localmente.");
    cargarPerfilUI();
}

// Exposición global
window.cargarPerfilUI = cargarPerfilUI;
window.manejarGuardarPerfil = manejarGuardarPerfil;