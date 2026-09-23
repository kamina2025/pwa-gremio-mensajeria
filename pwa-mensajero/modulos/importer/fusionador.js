/**
 * PROTOCOLO MACONDO - ESPECIALIDAD: FUSIONADOR DE PARADAS
 * Ubicación: pwa-mensajero/modulos/importer/fusionador.js
 * Función: Deduplica por SSC y persiste acumulativamente en almacenamiento local.
 */

import { guardarRutaZonificada, obtenerParadasGuardadas } from "../mensajero-persistencia.js";
import { normalizarParadaTirilla } from "./normalizador.js";

/**
 * Fusiona las nuevas paradas con la base existente deduplicando por SSC.
 * 
 * @param {Array<Object>} nuevasParadasRaw 
 * @returns {Promise<Array<Object>>} Lista acumulada unificada.
 */
export async function fusionarYGuardarParadas(nuevasParadasRaw) {
    console.log(">>> [IMPORTER_MERGE]: Leyendo paradas existentes en almacenamiento local...");
    const paradasExistentes = (await obtenerParadasGuardadas()) || [];
    
    const nuevasNormalizadas = nuevasParadasRaw.map((p, idx) => 
        normalizarParadaTirilla(p, paradasExistentes.length + idx)
    );

    const listaFusionada = [...paradasExistentes];

    nuevasNormalizadas.forEach(nueva => {
        const existeIndice = listaFusionada.findIndex(p => 
            p.ssc !== "N/A" && 
            p.ssc !== "S/N" && 
            p.ssc.toString().trim() === nueva.ssc.toString().trim()
        );

        if (existeIndice !== -1) {
            console.log(`🔄 [IMPORTER_MERGE_UPDATE]: Actualizando parada existente SSC: ${nueva.ssc}`);
            listaFusionada[existeIndice] = { ...listaFusionada[existeIndice], ...nueva };
        } else {
            console.log(`➕ [IMPORTER_MERGE_ADD]: Agregando nueva parada acumulada SSC: ${nueva.ssc}`);
            listaFusionada.push(nueva);
        }
    });

    console.log(`>>> [IMPORTER_PERSIST]: Guardando un total de ${listaFusionada.length} parada(s) acumuladas en IndexedDB.`);
    await guardarRutaZonificada(listaFusionada);
    return listaFusionada;
}