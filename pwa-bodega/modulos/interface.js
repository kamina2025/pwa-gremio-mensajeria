/**
 * PROTOCOLO MACONDO - PRINCIPAL LOGISTICS CORE INTERFACE ORCHESTRATOR
 * Ubicación: modulos/interface.js
 */

// Orquestación y Delegación de Eventos en Caliente
document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.actualizarPanelRutasUI === "function") window.actualizarPanelRutasUI();
    if (typeof window.actualizarMonitorMasaUI === "function") window.actualizarMonitorMasaUI();

    // Capturar reordenamiento en selectores de paradas dinámicos
    document.addEventListener("change", (e) => {
        if (e.target.classList.contains("selector-posicion-nodo")) {
            const idxOrigen = e.target.getAttribute("data-idx");
            if (typeof window.intercambiarPosicionNodo === "function") {
                window.intercambiarPosicionNodo(idxOrigen, e.target.value);
            }
        }
    });

    // Capturar cancelación de lotes en la pool sin romper scopes
    document.addEventListener("click", (e) => {
        const botonCancelar = e.target.closest(".btn-cancelar-solicitud");
        if (botonCancelar) {
            const idLote = botonCancelar.getAttribute("data-id");
            if (typeof window.eliminarSolicitudPoolEnDisco === "function") {
                window.eliminarSolicitudPoolEnDisco(idLote);
            }
        }
    });
});

/**
 * CAPA DE ESCUCHA: MANEJADOR DE SOBERANÍA CRIPTOGRÁFICA DE IDENTIDAD
 */
document.addEventListener("DOMContentLoaded", () => {
    const formIdentidad = document.getElementById("form-registro-nodal");
    if (formIdentidad) {
        formIdentidad.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById("reg-nombre").value.trim();
            const tipo = document.getElementById("reg-tipo").value;
            const telefono = document.getElementById("reg-telefono").value.trim();
            const direccion = document.getElementById("reg-direccion").value.trim();
            const pgpInvitador = document.getElementById("reg-invitador").value;

            if (!nombre || !telefono || !direccion) {
                alert(">>> ERROR: Todos los campos del nodo son requeridos para derivar la firma.");
                return;
            }

            // Invocar el motor criptográfico ECDSA local
            if (typeof window.generarNuevaCedulaNodal === "function" && typeof window.registrarCedulaEnDisco === "function") {
                const nuevaCedula = await window.generarNuevaCedulaNodal(nombre, tipo, telefono, direccion, pgpInvitador);
                
                if (nuevaCedula) {
                    const exitoDisco = await window.registrarCedulaEnDisco(nuevaCedula);
                    if (exitoDisco) {
                        alert(`>>> CÉDULA NODAL GENERADA CON ÉXITO <<<\n\nID: ${nuevaCedula.id_firma_nodal}\nCapacidad Inicial: ASINCRÓNICA\n\nLas llaves asimétricas han sido inyectadas en su dispositivo.`);
                        
                        if (typeof verificarAccesoCedulaAlArranque === "function") {
                            verificarAccesoCedulaAlArranque();
                        }
                    }
                }
            } else {
                console.error(">>> [ERROR]: El script modulos/cedula-nodal.js no se ha cargado correctamente.");
            }
        });
    }
});

/**
 * NAVEGACIÓN Y CAMBIO DE PASOS (PASO 1 -> PASO 2 -> PASO 3 -> PASO 4)
 */
function cambiarPasoGuiado(numeroPaso) {
    const sufijos = ["ingesta", "enlistamiento", "mapa", "asignacion"];
    
    for (let i = 1; i <= 4; i++) {
        const panel = document.getElementById(`paso-${i}-${sufijos[i-1]}`);
        const indicador = document.getElementById(`indicator-step-${i}`);
        
        if (panel) panel.style.display = (i === numeroPaso) ? "block" : "none";
        if (indicador) {
            if (i === numeroPaso) {
                indicador.classList.add("active");
            } else {
                indicador.classList.remove("active");
            }
        }
    }

    // Disparar refresco del mapa de Google si pasamos al Paso 3
    if (numeroPaso === 3 && window.mapa) {
        setTimeout(() => {
            google.maps.event.trigger(window.mapa, "resize");
        }, 150);
    }
}

/**
 * PASO 4: FRAGMENTACIÓN ZONAL Y DESPACHO A MENSAJEROS
 */
function generarFragmentacionDeRutas() {
    const contenedor = document.getElementById("contenedor-lotes-fragmentados");
    if (!contenedor) return;

    const pedidos = window.loteActualPedidos || [];
    if (pedidos.length === 0) {
        contenedor.innerHTML = `<div class="txt-consola-info" style="color: var(--neon-amber); text-align: center;">[ADVERTENCIA] No hay datos cargados en la matriz para fragmentar. Agregue puntos en el Paso 1 y 2.</div>`;
        return;
    }

    const metodo = document.getElementById("select-metodo-corte").value;
    let lotesFragmentados = {};

    if (metodo === "CUPO_MAXIMO") {
        const maxPorMoto = parseInt(document.getElementById("input-max-paquetes").value) || 30;
        let indexLote = 1;
        for (let i = 0; i < pedidos.length; i += maxPorMoto) {
            const bloque = pedidos.slice(i, i + maxPorMoto);
            lotesFragmentados[`Mensajero / Bloque ${indexLote}`] = bloque;
            indexLote++;
        }
    } else {
        // ZONIFICACIÓN POR REGIONES DE CALI
        lotesFragmentados = {
            "Zona Norte": [],
            "Zona Sur": [],
            "Zona Centro / Oriente": [],
            "Zona Oeste / Otros": []
        };

        pedidos.forEach(p => {
            const dir = (p.direccion || "").toLowerCase();
            if (dir.includes("norte") || dir.includes("av 6") || dir.includes("chipichape") || dir.includes("flora")) {
                lotesFragmentados["Zona Norte"].push(p);
            } else if (dir.includes("sur") || dir.includes("calle 5") || dir.includes("unicentro") || dir.includes("valle del lili")) {
                lotesFragmentados["Zona Sur"].push(p);
            } else if (dir.includes("oriental") || dir.includes("aguablanca") || dir.includes("centro") || dir.includes("carrera 1")) {
                lotesFragmentados["Zona Centro / Oriente"].push(p);
            } else {
                lotesFragmentados["Zona Oeste / Otros"].push(p);
            }
        });
    }

    contenedor.innerHTML = "";
    Object.keys(lotesFragmentados).forEach((nombreZona) => {
        const items = lotesFragmentados[nombreZona];
        if (items.length === 0) return;

        const payloadData = encodeURIComponent(JSON.stringify(items));
        const linkWhatsApp = `https://api.whatsapp.com/send?text=*PROTOCOLO%20MACONDO%20-%20ASIGNACIÓN%20DE%20RUTA*%0AZona:%20${encodeURIComponent(nombreZona)}%0APaquetes:%20${items.length}%0A%0ACargar%20en%20PWA:%20https://kamina2025.github.io/pwa-gremio-mensajeria/pwa-mensajero/?payload=${payloadData}`;
        const linkTelegram = `https://t.me/share/url?url=${encodeURIComponent("https://kamina2025.github.io/pwa-gremio-mensajeria/")}&text=*RUTA%20${encodeURIComponent(nombreZona)}*%20Paquetes:%20${items.length}`;

        const card = document.createElement("div");
        card.className = "card-lote-asignado";
        card.innerHTML = `
            <div class="card-lote-header">
                <h3 style="font-size: 0.85rem; color: var(--neon-blue);">📦 ${nombreZona}</h3>
                <span class="badge-cantidad">${items.length} Puntos</span>
            </div>
            <div class="card-lote-body" style="font-size: 0.75rem; color: #ccc; margin-bottom: 8px;">
                <p><strong>Punto Inicial:</strong> ${items[0].direccion || 'N/A'}</p>
                <p><strong>Punto Final:</strong> ${items[items.length - 1].direccion || 'N/A'}</p>
            </div>
            <div class="card-lote-acciones">
                <a href="${linkWhatsApp}" target="_blank" class="btn-share wa">[📱] ENVIAR RUTA POR WHATSAPP</a>
                <a href="${linkTelegram}" target="_blank" class="btn-share tg">[✈️] TELEGRAM</a>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

// Exportación al scope window
window.cambiarPasoGuiado = cambiarPasoGuiado;
window.generarFragmentacionDeRutas = generarFragmentacionDeRutas;