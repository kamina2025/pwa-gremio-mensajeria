/**
 * PROTOCOLO MACONDO - SUBSISTEMA BODEGA: BALANCEADOR POR CRÉDITOS Y PUNTOS DE ACOPIO
 * Ubicación: pwa-bodega/modulos/tablero-bodega.js
 */

export class TableroBodega {
    constructor(bodegaId) {
        this.bodegaId = bodegaId;
        this.costoPorPunto = 500; // COP por crédito/punto
    }

    /**
     * Registra un nuevo punto de despacho/acopio y descuenta el saldo del desarrollador
     */
    async crearPunto(alias, latitud, longitud) {
        const payload = {
            bodega_id: this.bodegaId,
            alias: alias,
            latitud: latitud,
            longitud: longitud
        };

        try {
            const response = await fetch('/api.php?action=crear_punto_bodega', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const resultado = await response.json();

            if (!response.ok) {
                throw new Error(resultado.message || 'Error en la API de Bodega');
            }

            console.log(`[Bodega] Punto creado con éxito: ${resultado.punto.id}`);
            console.log(`[Tarifa] Aporte al desarrollador devengado: $${resultado.aporte_desarrollador} COP`);

            return resultado;
        } catch (error) {
            console.error('[Bodega Error] No se pudo crear el punto:', error);
            throw error;
        }
    }
}

/**
 * Sobreescribe la lógica del tablero de costos adaptada al modelo de Créditos de Bodega
 */
export function actualizarTableroUIBodega(kilometros, minutosRutaGoogle, cantidadEntregas) {
    const totalPuntos = cantidadEntregas || (window.loteActualPedidos ? window.loteActualPedidos.length : 0);
    const totalCreditos = totalPuntos; 
    const valorTotalCOP = totalCreditos * 500;

    // Actualización de elementos DOM específicos de Bodega
    const elDistancia = document.getElementById("meta-distancia");
    const elTiempo = document.getElementById("meta-tiempo");
    const elMutual = document.getElementById("meta-mutual");
    const elAhorro = document.getElementById("meta-ahorro");
    const elNeto = document.getElementById("meta-neto");

    if (elDistancia) elDistancia.innerText = `${totalPuntos} ${totalPuntos === 1 ? 'Punto' : 'Puntos'}`;
    if (elTiempo) elTiempo.innerText = `${totalCreditos} ${totalCreditos === 1 ? 'Crédito' : 'Créditos'}`;
    if (elMutual) elMutual.innerText = "$500 COP";
    if (elAhorro) elAhorro.innerText = `$${valorTotalCOP.toLocaleString('es-CO')} COP`;
    if (elNeto) elNeto.innerText = `${totalCreditos} CRÉDITO(S) ($${valorTotalCOP.toLocaleString('es-CO')} COP)`;

    window.valoresCalculadosLote = {
        tarifa: valorTotalCOP,
        creditosTotal: totalCreditos,
        neto: valorTotalCOP,
        minutosTotales: 0
    };
}

// Inyección al Scope Global para mantener compatibilidad con indexador-pedidos.js
window.actualizarTableroUI = actualizarTableroUIBodega;