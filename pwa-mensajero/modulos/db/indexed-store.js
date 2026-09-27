/**
 * PROTOCOLO MACONDO - CAPA DE PERSISTENCIA LOCAL (INDEXEDDB)
 * Ubicación: pwa-mensajero/modulos/db/indexed-store.js
 */

export class IndexedStore {
  /**
   * @param {string} dbName - Nombre unificado de la base de datos
   * @param {string} defaultStore - Store predeterminado para paradas
   */
  constructor(dbName = 'PWA_Mensajero_DB', defaultStore = 'paradas_rutas') {
    this.dbName = dbName;
    this.defaultStore = defaultStore;
    this.dbVersion = 2; // Sincronizado para evitar VersionError en Chromium
  }

  /**
   * Abre o actualiza la conexión con IndexedDB.
   * @returns {Promise<IDBDatabase>}
   */
  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ [INDEXED_STORE]: Error al abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Store Principal de Paradas y Rutas
        if (!db.objectStoreNames.contains('paradas_rutas')) {
          const store = db.createObjectStore('paradas_rutas', { keyPath: 'id' });
          store.createIndex('secuencia', 'secuencia', { unique: false });
          store.createIndex('estado', 'estado', { unique: false });
          store.createIndex('sincronizado', 'sincronizado', { unique: false });
          console.log("📦 [INDEXED_STORE]: Store 'paradas_rutas' creado.");
        }

        // 2. Store de Planillas Reportadas
        if (!db.objectStoreNames.contains('planillas')) {
          db.createObjectStore('planillas', { keyPath: 'id' });
          console.log("📦 [INDEXED_STORE]: Store 'planillas' creado.");
        }

        // 3. Store para Archivos Binarios PDF (Ahorro de RAM en Android)
        if (!db.objectStoreNames.contains('planillas_pdf')) {
          db.createObjectStore('planillas_pdf', { keyPath: 'id' });
          console.log("📦 [INDEXED_STORE]: Store 'planillas_pdf' creado.");
        }

        // 4. Store para Cola de Sincronización Offline
        if (!db.objectStoreNames.contains('sincronizacion_pendiente')) {
          db.createObjectStore('sincronizacion_pendiente', { keyPath: 'id', autoIncrement: true });
          console.log("📦 [INDEXED_STORE]: Store 'sincronizacion_pendiente' creado.");
        }
      };
    });
  }

  /**
   * Recupera todos los registros de un ObjectStore determinado.
   * @param {string} [storeOpcional]
   * @returns {Promise<Array<Object>>}
   */
  async obtenerParadas(storeOpcional) {
    const targetStore = storeOpcional || this.defaultStore;
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(targetStore, 'readonly');
      const store = tx.objectStore(targetStore);
      const request = store.getAll();

      request.onsuccess = () => {
        const resultados = request.result || [];
        console.log(`📦 [INDEXED_STORE]: ${resultados.length} registro(s) obtenido(s) de '${targetStore}'.`);
        resolve(resultados);
      };

      request.onerror = () => {
        console.error(`❌ [INDEXED_STORE]: Error al consultar '${targetStore}':`, request.error);
        reject(request.error);
      };
    });
  }

  /** Alias de compatibilidad */
  async obtenerTodasParadas() {
    return this.obtenerParadas(this.defaultStore);
  }

  /** Alias genérico para compatibilidad con la API Key-Value Storage */
  async getAll(storeOpcional) {
    return this.obtenerParadas(storeOpcional);
  }

  /**
   * Obtiene un registro individual por su identificador primario.
   * @param {string|number} id
   * @param {string} [storeOpcional]
   * @returns {Promise<Object|null>}
   */
  async obtenerParadaPorId(id, storeOpcional) {
    const targetStore = storeOpcional || this.defaultStore;
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(targetStore, 'readonly');
      const store = tx.objectStore(targetStore);
      const request = store.get(String(id));

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Inserta o actualiza un registro individual.
   * @param {Object} registro
   * @param {string} [storeOpcional]
   * @returns {Promise<boolean>}
   */
  async actualizarParada(registro, storeOpcional) {
    if (!registro) return false;
    const targetStore = storeOpcional || this.defaultStore;

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(targetStore, 'readwrite');
      const store = tx.objectStore(targetStore);

      const copia = { ...registro };

      if (!copia.id) {
        copia.id = String(
          copia.ssc || 
          copia.idParada || 
          `#PNT-${copia.secuencia || copia.orden || Date.now()}`
        );
      } else {
        copia.id = String(copia.id);
      }

      if (copia.sincronizado === undefined) {
        copia.sincronizado = 0;
      }
      copia.updated_at = new Date().toISOString();

      const request = store.put(copia);

      request.onsuccess = () => {
        console.log(`💾 [INDEXED_STORE]: Registro '${copia.id}' guardado en '${targetStore}'.`);
        resolve(true);
      };

      request.onerror = () => {
        console.error(`❌ [INDEXED_STORE]: Error al actualizar '${copia.id}' en '${targetStore}':`, request.error);
        reject(request.error);
      };
    });
  }

  /** Alias genérico para guardar un registro */
  async guardarRegistro(storeName, registro) {
    return this.actualizarParada(registro, storeName || this.defaultStore);
  }

  /**
   * Persiste un archivo PDF en formato Blob dentro del store 'planillas_pdf'.
   * @param {string|number} idPlanilla
   * @param {Blob} blobArchivo
   * @returns {Promise<boolean>}
   */
  async guardarPdfBlob(idPlanilla, blobArchivo) {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('planillas_pdf', 'readwrite');
        const store = tx.objectStore('planillas_pdf');

        const registro = {
          id: String(idPlanilla),
          blob: blobArchivo,
          created_at: new Date().toISOString()
        };

        const request = store.put(registro);
        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn("⚠️ [INDEXED_STORE]: No se pudo guardar el Blob PDF en IndexedDB:", err);
      return false;
    }
  }

  /**
   * Recupera un Blob PDF previamente almacenado.
   * @param {string|number} idPlanilla
   * @returns {Promise<Blob|null>}
   */
  async obtenerPdfBlob(idPlanilla) {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('planillas_pdf', 'readonly');
        const store = tx.objectStore('planillas_pdf');
        const request = store.get(String(idPlanilla));

        request.onsuccess = () => resolve(request.result ? request.result.blob : null);
        request.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      return null;
    }
  }

  /**
   * Reemplaza masivamente una colección de registros en una transacción atómica.
   * @param {Array<Object>} listaRegistros
   * @param {string} [storeOpcional]
   * @returns {Promise<boolean>}
   */
  async guardarColeccionParadas(listaRegistros, storeOpcional) {
    if (!Array.isArray(listaRegistros)) return false;
    const targetStore = storeOpcional || this.defaultStore;

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(targetStore, 'readwrite');
      const store = tx.objectStore(targetStore);

      store.clear();

      listaRegistros.forEach((item, index) => {
        const copia = { ...item };
        if (!copia.id) {
          copia.id = String(copia.ssc || `#PNT-${copia.secuencia || copia.orden || index + 1}`);
        } else {
          copia.id = String(copia.id);
        }
        copia.updated_at = new Date().toISOString();
        store.put(copia);
      });

      tx.oncomplete = () => {
        console.log(`✅ [INDEXED_STORE]: Sincronizados ${listaRegistros.length} registros en '${targetStore}'.`);
        resolve(true);
      };

      tx.onerror = () => {
        console.error(`❌ [INDEXED_STORE]: Error en la transacción masiva sobre '${targetStore}':`, tx.error);
        reject(tx.error);
      };
    });
  }

  /**
   * Elimina un registro por su clave identificadora.
   * @param {string|number} id
   * @param {string} [storeOpcional]
   * @returns {Promise<boolean>}
   */
  async eliminarParada(id, storeOpcional) {
    const targetStore = storeOpcional || this.defaultStore;
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(targetStore, 'readwrite');
      const store = tx.objectStore(targetStore);
      const request = store.delete(String(id));

      request.onsuccess = () => {
        console.log(`🗑️ [INDEXED_STORE]: Registro '${id}' eliminado de '${targetStore}'.`);
        resolve(true);
      };

      request.onerror = () => {
        console.error(`❌ [INDEXED_STORE]: Error al eliminar '${id}' de '${targetStore}':`, request.error);
        reject(request.error);
      };
    });
  }

  /** Alias genérico para eliminación */
  async eliminarRegistro(storeName, id) {
    return this.eliminarParada(id, storeName || this.defaultStore);
  }

  /**
   * Limpia completamente un ObjectStore.
   * @param {string} [storeOpcional]
   * @returns {Promise<boolean>}
   */
  async limpiarStore(storeOpcional) {
    const targetStore = storeOpcional || this.defaultStore;
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(targetStore, 'readwrite');
      const store = tx.objectStore(targetStore);
      const request = store.clear();

      request.onsuccess = () => {
        console.log(`🧹 [INDEXED_STORE]: ObjectStore '${targetStore}' vaciado correctamente.`);
        resolve(true);
      };

      request.onerror = () => reject(request.error);
    });
  }
}