/**
 * PROTOCOLO MACONDO - CAPA DE PERSISTENCIA LOCAL (INDEXEDDB)
 * Ubicación: pwa-mensajero/modulos/db/indexed-store.js
 * Arquitectura: Singleton / Local-First / Transactions Helper
 */

const CLAVE_ESTADO_NAVEGACION = "macondo_ultimo_estado_mapa";

export class IndexedStore {
  /**
   * @param {string} dbName - Nombre unificado de la base de datos
   * @param {string} defaultStore - Store predeterminado para paradas
   */
  constructor(dbName = 'PWA_Mensajero_DB', defaultStore = 'paradas_rutas') {
    this.dbName = dbName;
    this.defaultStore = defaultStore;
    this.dbVersion = 2;
    this._dbPromise = null;
  }

  /**
   * Abre o recupera la conexión activa con IndexedDB (Singleton Pattern).
   * @returns {Promise<IDBDatabase>}
   */
  async openDB() {
    if (this._dbPromise) {
      return this._dbPromise;
    }

    this._dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ [INDEXED_STORE]: Error al abrir IndexedDB:', request.error);
        this._dbPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          console.warn('⚠️ [INDEXED_STORE]: Conexión cerrada. Reiniciando pool...');
          this._dbPromise = null;
        };
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('paradas_rutas')) {
          const store = db.createObjectStore('paradas_rutas', { keyPath: 'id' });
          store.createIndex('secuencia', 'secuencia', { unique: false });
          store.createIndex('estado', 'estado', { unique: false });
          store.createIndex('sincronizado', 'sincronizado', { unique: false });
        }

        if (!db.objectStoreNames.contains('planillas')) {
          db.createObjectStore('planillas', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('planillas_pdf')) {
          db.createObjectStore('planillas_pdf', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('sincronizacion_pendiente')) {
          db.createObjectStore('sincronizacion_pendiente', { keyPath: 'id', autoIncrement: true });
        }
      };
    });

    return this._dbPromise;
  }

  /**
   * Helper genérico para ejecutar transacciones IndexedDB de forma segura.
   * @private
   */
  async _execTx(storeName, mode, callback) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result = null;

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => {
        console.error(`❌ [INDEXED_STORE]: Error en transacción sobre '${storeName}':`, tx.error);
        reject(tx.error);
      };
      tx.onabort = () => reject(new Error(`Transacción en '${storeName}' abortada.`));

      result = callback(store, tx);
    });
  }

  /**
   * Guarda en almacenamiento local el estado actual de navegación y la parada activa.
   * @param {Object} estado 
   */
  async guardarUltimoEstadoNavegacion(estado) {
    try {
      const payload = {
        paradaId: estado.paradaId || null,
        indexParada: estado.indexParada ?? -1,
        zoom: estado.zoom || 16,
        centro: estado.centro || null,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(CLAVE_ESTADO_NAVEGACION, JSON.stringify(payload));
      console.log("💾 [PERSISTENCIA_MAPA]: Estado de navegación guardado:", payload);
    } catch (error) {
      console.error("❌ [PERSISTENCIA_MAPA]: Error guardando estado de navegación:", error);
    }
  }

  /**
   * Recupera el último estado de navegación guardado.
   * @returns {Promise<Object|null>}
   */
  async obtenerUltimoEstadoNavegacion() {
    try {
      const data = localStorage.getItem(CLAVE_ESTADO_NAVEGACION);
      if (!data) return null;
      const parsed = JSON.parse(data);
      console.log("📂 [PERSISTENCIA_MAPA]: Estado de navegación recuperado:", parsed);
      return parsed;
    } catch (error) {
      console.error("❌ [PERSISTENCIA_MAPA]: Error leyendo estado de navegación:", error);
      return null;
    }
  }
}

// INSTANCIA SINGLETON
export const indexedStore = new IndexedStore();

// EXPORTACIONES NOMBRADAS DIRECTAS PARA IMPORTACIONES ES6
export async function guardarUltimoEstadoNavegacion(estado) {
  return indexedStore.guardarUltimoEstadoNavegacion(estado);
}

export async function obtenerUltimoEstadoNavegacion() {
  return indexedStore.obtenerUltimoEstadoNavegacion();
}

// BINDINGS GLOBALES EN WINDOW
if (typeof window !== "undefined") {
  window.IndexedStore = IndexedStore;
  window.indexedStore = indexedStore;
  window.guardarUltimoEstadoNavegacion = guardarUltimoEstadoNavegacion;
  window.obtenerUltimoEstadoNavegacion = obtenerUltimoEstadoNavegacion;
}