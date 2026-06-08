/**
 * PROTOCOLO MACONDO - MESSENGER SUBSYSTEM: LIBRO CONTABLE SOBERANO
 * Ubicación: pwa-mensajero/modulos/libro-contable.js
 */

function calcularYRenderizarLibro() {
    const ledger = JSON.parse(localStorage.getItem("MACONDO_LEDGER")) || [];
    const tbody = document.getElementById("historial-transacciones-dinamico");
    const capBox = document.getElementById("balance-capital");
    const mutBox = document.getElementById("balance-mutual");

    if (!tbody || !capBox || !mutBox) return;
    tbody.innerHTML = "";

    let totalNeto = 0;
    let totalMutual = 0;
    let contenidoHTML = "";

    if (ledger.length > 0) {
        ledger.forEach((tx) => {
            totalNeto += tx.neto;
            totalMutual += tx.mutual;

            contenidoHTML += `
                <tr>
                    <td>${tx.timestamp}</td>
                    <td class="hash">${tx.id}</td>
                    <td>$${tx.tarifa.toLocaleString()}</td>
                    <td class="debit">-$${tx.rodamiento.toLocaleString()}</td>
                    <td class="mutual">-$${tx.mutual.toLocaleString()}</td>
                    <td class="credit">+$${tx.neto.toLocaleString()}</td>
                </tr>
            `;
        });
    } else {
        contenidoHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">[LEDGER_EMPTY] No hay registros contables indexados.</td></tr>`;
    }

    tbody.innerHTML = contenidoHTML;
    capBox.innerText = `$${totalNeto.toLocaleString()} COP`;
    mutBox.innerText = `$${totalMutual.toLocaleString()} COP`;
}

// Inyección limpia al Scope Global
window.calcularYRenderizarLibro = calcularYRenderizarLibro;