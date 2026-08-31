/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE CAPAS, ZONIFICACIÓN Y FRAGMENTACIÓN DE RUTAS
 * Ubicación: pwa-bodega/modulos/mapa-zonas.js
 */

import { MAPA_ZONAS_CALI, obtenerZonaPorNombre } from "./zonificacion-config.js";
import { obtenerMensajeros } from "./flota-mensajeros.js";

const PALETA_ZONAS = {
  CENTRO: { fill: "#ff007f", stroke: "#ff66b2" },
  "NORTE-1": { fill: "#00f0ff", stroke: "#80f8ff" },
  "NORTE-2": { fill: "#39ff14", stroke: "#85ff70" },
  OESTE: { fill: "#ff9900", stroke: "#ffcc80" },
  ORIENTE: { fill: "#ffe600", stroke: "#ffff80" },
  "SUR-1": { fill: "#b359ff", stroke: "#d9b3ff" },
  "SUR-2": { fill: "#0077ff", stroke: "#66abff" },
  "SUR-3": { fill: "#ff0033", stroke: "#ff6680" },
  "SUR-4": { fill: "#00ffaa", stroke: "#80ffcd" }
};

function obtenerColorFallback(texto) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return { fill: `hsl(${hue}, 80%, 50%)`, stroke: `hsl(${hue}, 90%, 75%)` };
}

export function cargarZonasEnMapa(instanciaMapa) {
  if (!instanciaMapa || typeof google === "undefined" || !google.maps) return;

  try {
    instanciaMapa.data.forEach((feature) => {
      instanciaMapa.data.remove(feature);
    });

    instanciaMapa.data.addGeoJson(MAPA_ZONAS_CALI);

    instanciaMapa.data.setStyle((feature) => {
      const keyZona = feature.getProperty("key") || "";
      const nombreZona = feature.getProperty("nombre") || "";
      const colores = PALETA_ZONAS[keyZona] || obtenerColorFallback(nombreZona);

      return {
        fillColor: colores.fill,
        fillOpacity: 0.22,
        strokeColor: colores.stroke,
        strokeWeight: 2,
        clickable: true
      };
    });
  } catch (err) {
    console.error(">>> [ZONAS_ERROR]: Falló la carga de polígonos GeoJSON:", err);
  }
}

export function puntoEnPoligono(lat, lng, vs) {
  let x = lng,
    y = lat;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i][0],
      yi = vs[i][1];
    let xj = vs[j][0],
      yj = vs[j][1];
    let intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function determinarZonaPorCoordenadas(lat, lng) {
  if (!MAPA_ZONAS_CALI || !MAPA_ZONAS_CALI.features) {
    return { nombre: "ZONA OESTE / OTROS", key: "OESTE" };
  }

  for (const feature of MAPA_ZONAS_CALI.features) {
    if (feature.geometry && feature.geometry.coordinates) {
      const coords = feature.geometry.coordinates[0];
      if (puntoEnPoligono(lat, lng, coords)) {
        const rawNombre = (feature.properties.nombre || "").replace("zona_", "").toUpperCase().replace(/_/g, " ");
        return {
          nombre: `ZONA ${rawNombre}`,
          key: feature.properties.key || "OESTE"
        };
      }
    }
  }
  return { nombre: "ZONA OESTE / OTROS", key: "OESTE" };
}

// Cache global temporal de fragmentos calculados
window.lotesZonificadosCache = {};

export async function generarFragmentacionDeRutas() {
  const contenedorHTML = document.getElementById("contenedor-lotes-fragmentados");

  if (!window.loteActualPedidos || window.loteActualPedidos.length === 0) {
    alert(">>> ALERTA BODEGA: Inyecte direcciones al lote antes de calcular la fragmentación.");
    return;
  }

  if (contenedorHTML) {
    contenedorHTML.innerHTML = `
      <div style="color: var(--neon-blue, #00f0ff); text-align: center; padding: 25px; font-family: monospace;">
        [⚙️ CALCULANDO RAY-CASTING Y AGRUPANDO PUNTOS POR ZONA...]
      </div>`;
  }

  const geocoder = new google.maps.Geocoder();
  window.lotesZonificadosCache = {};

  for (let pedido of window.loteActualPedidos) {
    let dirCompleta = pedido.direccion || pedido.direccionDestino || "";
    if (!dirCompleta.toLowerCase().includes("cali") && !dirCompleta.toLowerCase().includes("miranda")) {
      dirCompleta += ", Cali, Colombia";
    }

    try {
      const res = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: dirCompleta }, (results, status) => {
          if (status === "OK" && results[0]) resolve(results[0]);
          else reject(status);
        });
      });

      const lat = res.geometry.location.lat();
      const lng = res.geometry.location.lng();
      const zonaInfo = determinarZonaPorCoordenadas(lat, lng);

      pedido.zonaKey = zonaInfo.key;
      pedido.zonaNombre = zonaInfo.nombre;

      if (!window.lotesZonificadosCache[zonaInfo.nombre]) {
        window.lotesZonificadosCache[zonaInfo.nombre] = {
          key: zonaInfo.key,
          puntos: []
        };
      }
      window.lotesZonificadosCache[zonaInfo.nombre].puntos.push(pedido);
    } catch (e) {
      const zonaFallback = "ZONA OESTE / OTROS";
      pedido.zonaKey = "OESTE";
      pedido.zonaNombre = zonaFallback;

      if (!window.lotesZonificadosCache[zonaFallback]) {
        window.lotesZonificadosCache[zonaFallback] = {
          key: "OESTE",
          puntos: []
        };
      }
      window.lotesZonificadosCache[zonaFallback].puntos.push(pedido);
    }
  }

  renderizarTarjetasZonasUI();
}

export function renderizarTarjetasZonasUI() {
  const contenedorHTML = document.getElementById("contenedor-lotes-fragmentados");
  if (!contenedorHTML) return;

  const lotes = window.lotesZonificadosCache || {};
  const nombresZonas = Object.keys(lotes);
  const mensajeros = typeof obtenerMensajeros === "function" ? obtenerMensajeros() : [];

  if (nombresZonas.length === 0) {
    contenedorHTML.innerHTML = `<div style="text-align: center; padding: 20px; color: #aaa;">[VACÍO] No se generaron zonas.</div>`;
    return;
  }

  contenedorHTML.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; width: 100%;">
      ${nombresZonas
        .map((nombreZona) => {
          const grupo = lotes[nombreZona];
          const listaPuntos = grupo.puntos;
          const totalPuntos = listaPuntos.length;
          const idSafeZona = nombreZona.replace(/[^a-zA-Z0-9]/g, "_");

          return `
          <div class="tarjeta-lote-fragmentado" style="border: 1px solid var(--neon-blue, #00f0ff); background: #0c080f; padding: 16px; border-radius: 4px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <!-- ENCABEZADO -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #291f33; padding-bottom: 10px; margin-bottom: 12px;">
                <strong style="color: #ffffff; font-size: 1rem;">📦 ${nombreZona}</strong>
                <span style="background: var(--neon-green, #39ff14); color: #000; font-weight: bold; font-size: 0.78rem; padding: 3px 10px; border-radius: 12px; font-family: monospace;">
                  ${totalPuntos} ${totalPuntos === 1 ? "Punto" : "Puntos"}
                </span>
              </div>

              <!-- SELECTOR DE MENSAJERO -->
              <div style="margin-bottom: 12px;">
                <label style="font-size: 0.75rem; color: var(--neon-blue); display: block; margin-bottom: 4px; font-weight: bold;">
                  🚴 MENSAJERO ASIGNADO:
                </label>
                <select id="select-mensajero-${idSafeZona}" class="input-maquina" style="background: #150f1d; color: #fff; font-size: 0.8rem; border: 1px solid var(--neon-purple); width: 100%; padding: 6px;">
                  <option value="">-- Seleccionar de la lista --</option>
                  ${mensajeros
                    .map(
                      (m) => `
                    <option value="${m.telefono}" ${m.zonaPreferida === nombreZona ? "selected" : ""}>
                      ${m.nombre} (${m.vehiculo})
                    </option>
                  `
                    )
                    .join("")}
                </select>
              </div>

              <!-- DESGLOSE DE PUNTOS -->
              <div style="font-size: 0.82rem; color: #ccc; margin-bottom: 14px; line-height: 1.4;">
                <details style="background: #150f1d; border: 1px solid #291f33; padding: 8px; border-radius: 4px; cursor: pointer;">
                  <summary style="color: var(--neon-blue, #00f0ff); font-size: 0.78rem; font-weight: bold; outline: none;">
                    ▶ Ver entregas (${totalPuntos})
                  </summary>
                  <ul style="margin-top: 8px; padding-left: 20px; font-size: 0.76rem; color: #ddd; max-height: 140px; overflow-y: auto;">
                    ${listaPuntos
                      .map(
                        (p, idx) => `
                      <li style="margin-bottom: 4px;">
                        <strong style="color: var(--neon-green);">[${String.fromCharCode(65 + idx)}] ${p.destinatario || "Cliente"}:</strong> ${p.direccion}
                        ${p.telefono ? `<span style="color: #888;"> (${p.telefono})</span>` : ""}
                      </li>
                    `
                      )
                      .join("")}
                  </ul>
                </details>
              </div>
            </div>

            <!-- BOTONES TELEMÁTICOS -->
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
              <button type="button" class="btn-terminal" style="border-color: var(--neon-green); color: var(--neon-green); width: 100%; font-size: 0.8rem; padding: 8px; cursor: pointer;" onclick="despacharPorWhatsApp('${nombreZona}', 'select-mensajero-${idSafeZona}')">
                [ 📱 ] ENVIAR RUTA POR WHATSAPP
              </button>
              <!-- BOTÓN TELEGRAM DENTRO DE LA TARJETA EN mapa-zonas.js -->
<button type="button" class="btn-terminal" style="border-color: var(--neon-blue); color: var(--neon-blue); width: 100%; font-size: 0.8rem; padding: 8px; cursor: pointer;" onclick="despacharPorTelegram('${nombreZona}', 'select-mensajero-${idSafeZona}')">
  [ ✈️ ] TELEGRAM
</button>
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
}

// Construye la plantilla de texto plano completa de la ruta
export function construirTextoPlanoRuta(nombreZona, listaPuntos) {
  let texto = `🚚 *PROTOCOLO MACONDO - MANIFIESTO DE DESPACHO*\n`;
  texto += `📍 *Sector:* ${nombreZona}\n`;
  texto += `📦 *Total Entregas:* ${listaPuntos.length}\n`;
  texto += `----------------------------------------\n\n`;

  listaPuntos.forEach((p, idx) => {
    const letra = String.fromCharCode(65 + idx);
    texto += `*PARADA [${letra}]* - ${p.id || "#MAC"}\n`;
    texto += `👤 *Cliente:* ${p.destinatario || "N/A"}\n`;
    texto += `🏠 *Dirección:* ${p.direccion}\n`;
    if (p.telefono) texto += `📞 *Teléfono:* ${p.telefono}\n`;
    if (p.carga) texto += `📋 *Detalle:* ${p.carga}\n`;
    texto += `----------------------------------------\n`;
  });

  const payloadData = encodeURIComponent(JSON.stringify(listaPuntos));
  texto += `\n🔗 *Cargar Ruta en PWA Mensajero:*\nhttps://kamina2025.github.io/pwa-gremio-mensajeria/pwa-mensajero/?payload=${payloadData}\n`;

  return texto;
}

export function despacharPorWhatsApp(nombreZona, idSelectMensajero) {
  const grupo = window.lotesZonificadosCache[nombreZona];
  if (!grupo || !grupo.puntos) return;

  const selectEl = document.getElementById(idSelectMensajero);
  const telefonoMensajero = selectEl ? selectEl.value : "";

  const mensajePlano = construirTextoPlanoRuta(nombreZona, grupo.puntos);
  const urlWA = telefonoMensajero
    ? `https://api.whatsapp.com/send?phone=${telefonoMensajero}&text=${encodeURIComponent(mensajePlano)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensajePlano)}`;

  window.open(urlWA, "_blank");
}

/**
 * PROTOCOLO MACONDO - SUBSISTEMA DE DESPACHO TELEMÁTICO PARA TELEGRAM Y WHATSAPP
 * Ubicación: pwa-bodega/modulos/mapa-zonas.js
 */

export function despacharPorTelegram(nombreZona, idSelectMensajero) {
  const grupo = window.lotesZonificadosCache ? window.lotesZonificadosCache[nombreZona] : null;
  if (!grupo || !grupo.puntos) {
    alert(">>> ALERTA BODEGA: No se encontraron puntos en la zona seleccionada.");
    return;
  }

  // 1. Obtenemos el selector del mensajero asignado a esta tarjeta de zona
  const selectEl = document.getElementById(idSelectMensajero);
  let telefonoMensajero = selectEl ? selectEl.value.trim() : "";

  // Sanitizar el número de teléfono: conservar únicamente dígitos
  let telSanitizado = telefonoMensajero.replace(/\D/g, "");
  if (telSanitizado.length === 10 && !telSanitizado.startsWith("57")) {
    telSanitizado = "57" + telSanitizado;
  }

  // 2. Construir el manifiesto completo en texto plano con payload de la PWA
  const mensajePlano = construirTextoPlanoRuta(nombreZona, grupo.puntos);

  // 3. Copiar el texto del manifiesto al portapapeles automáticamente
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(mensajePlano)
      .then(() => {
        console.log(">>> [TELEGRAM_DESK]: Manifiesto copiado al portapapeles.");
      })
      .catch((err) => {
        console.warn(">>> [TELEGRAM_WARN]: No se pudo copiar al portapapeles automáticamente.", err);
      });
  }

  // 4. Determinar la URI de apertura directa en Telegram Desktop
  let urlTelegramTarget = "";

  if (telSanitizado) {
    // Si hay teléfono seleccionado, abrir el chat directo de Telegram con ese número
    urlTelegramTarget = `https://t.me/+${telSanitizado}`;
    alert(
      `>>> MANIFIESTO COPIADO AL PORTAPAPELES 📋\n\nSe abrirá el chat con el mensajero (${telSanitizado}). Solo presiona 'Pegar' (Ctrl + V) en Telegram.`
    );
  } else {
    // Si no hay mensajero seleccionado, abrir selector de compartir estándar
    const textoCodificado = encodeURIComponent(mensajePlano);
    urlTelegramTarget = `https://t.me/share/url?url=&text=${textoCodificado}`;
  }

  // 5. Lanzar Telegram Desktop
  try {
    if (telSanitizado) {
      // Intenta abrir mediante el protocolo nativo de Telegram Desktop
      window.location.href = `tg://resolve?phone=${telSanitizado}`;
      setTimeout(() => {
        window.open(urlTelegramTarget, "_blank");
      }, 1200);
    } else {
      window.open(urlTelegramTarget, "_blank");
    }
  } catch (e) {
    window.open(urlTelegramTarget, "_blank");
  }
}

// Asegurar exposición global
window.construirTextoPlanoRuta = construirTextoPlanoRuta;
export const renderizarZonasEnMapa = cargarZonasEnMapa;
window.cargarZonasEnMapa = cargarZonasEnMapa;
window.renderizarZonasEnMapa = renderizarZonasEnMapa;
window.obtenerZonaPorNombre = obtenerZonaPorNombre;
window.determinarZonaPorCoordenadas = determinarZonaPorCoordenadas;
window.puntoEnPoligono = puntoEnPoligono;
window.generarFragmentacionDeRutas = generarFragmentacionDeRutas;
window.despacharPorWhatsApp = despacharPorWhatsApp;
window.despacharPorTelegram = despacharPorTelegram;
