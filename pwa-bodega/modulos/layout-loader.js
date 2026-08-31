/**
 * PROTOCOLO MACONDO - CARGADOR ASÍNCRONO DE COMPONENTES DE LAYOUT
 * Ubicación: modulos/layout-loader.js
 */

export async function cargarComponentesHTML() {
  console.log(">>> [LAYOUT_LOADER]: Ensamblando componentes dinámicos HTML...");

  const mapaInyecciones = [
    { targetId: "vista-bloqueo-seguro", url: "vistas/auth-bloqueo.html" },
    { targetId: "pestana-indexar", url: "vistas/paso-1-ingesta.html", append: true },
    { targetId: "pestana-indexar", url: "vistas/paso-2-enlistamiento.html", append: true },
    { targetId: "pestana-indexar", url: "vistas/paso-3-mapa.html", append: true },
    { targetId: "pestana-indexar", url: "vistas/paso-4-asignacion.html", append: true },
    { targetId: "modulo-operaciones-central", url: "vistas/pestana-monitorear.html", append: true },
    { targetId: "modulo-operaciones-central", url: "vistas/pestana-billetera.html", append: true }
  ];

  for (const item of mapaInyecciones) {
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status} al solicitar ${item.url}`);
      const htmlText = await res.text();
      const contenedor = document.getElementById(item.targetId);

      if (contenedor) {
        if (item.append) {
          contenedor.insertAdjacentHTML("beforeend", htmlText);
        } else {
          contenedor.innerHTML = htmlText;
        }
      }
    } catch (err) {
      console.error(`>>> [LAYOUT_LOADER_FAIL]: No se pudo inyectar ${item.url}`, err);
    }
  }

  console.log(">>> [LAYOUT_LOADER_OK]: Estructura DOM compilada satisfechamente.");
}