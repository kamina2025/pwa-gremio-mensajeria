/**
 * PROTOCOLO MACONDO - CAPA DE PERSISTENCIA LOCAL (INDEXEDDB)
 * Ubicación: pwa-mensajero/modulos/db/indexed-store.js
 */

export class IndexedStore {
  constructor(dbName = 'PWA_Mensajero_DB', storeName = 'paradas_rutas') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  /**
   * Abre o crea la conexión con la base de datos IndexedDB unificada.
   * @returns {Promise<IDBDatabase>}
   */
  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('❌ [INDEXED_STORE]: Error al abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // KeyPath 'id' para identificación única de cada parada
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('secuencia', 'secuencia', { unique: false });
          store.createIndex('estado', 'estado', { unique: false });
          store.createIndex('sincronizado', 'sincronizado', { unique: false });
          console.log(`📦 [INDEXED_STORE]: ObjectStore '${this.storeName}' creado exitosamente.`);
        }
      };
    });
  }

  /**
   * Obtiene la colección completa de paradas guardadas en la base local.
   * @returns {Promise<Array<Object>>}
   */
  async obtenerParadas() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const resultados = request.result || [];
        console.log(`📦 [INDEXED_STORE]: ${resultados.length} parada(s) obtenida(s) localmente.`);
        resolve(resultados);
      };

      request.onerror = () => {
        console.error('❌ [INDEXED_STORE]: Error al obtener paradas:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Alias de compatibilidad para recuperar la colección completa de paradas.
   * @returns {Promise<Array<Object>>}
   */
  async obtenerTodasParadas() {
    return this.obtenerParadas();
  }

  /**
   * Alias genérico de compatibilidad con la API Key-Value/Storage.
   * @param {string} [storeOpcional] 
   * @returns {Promise<Array<Object>>}
   */
  async getAll(storeOpcional) {
    return this.obtenerParadas();
  }

  /**
   * Obtiene una parada específica por su identificador único ID.
   * @param {string|number} id 
   * @returns {Promise<Object|null>}
   */
  async obtenerParadaPorId(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Inserta o actualiza un registro individual de parada en IndexedDB.
   * @param {Object} parada 
   * @returns {Promise<boolean>}
   */
  async actualizarParada(parada) {
    if (!parada) return false;

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      // Normalizar estructura del objeto antes de guardar
      const copiaParada = { ...parada };
      
      // Garantizar la presencia del atributo id para el KeyPath
      if (!copiaParada.id) {
        copiaParada.id = copiaParada.ssc || `#PNT-${copiaParada.secuencia || copiaParada.orden || Date.now()}`;
      }

      // Metadata Local-First
      copiaParada.sincronizado = 0;
      copiaParada.updated_at = new Date().toISOString();

      const request = store.put(copiaParada);

      request.onsuccess = () => {
        console.log(`💾 [INDEXED_STORE]: Parada '${copiaParada.id}' guardada/actualizada con éxito.`);
        resolve(true);
      };

      request.onerror = () => {
        console.error(`❌ [INDEXED_STORE]: Error al actualizar la parada '${copiaParada.id}':`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Alias genérico para guardar o actualizar un registro.
   * @param {string} storeName - Nombre del store (opcional)
   * @param {Object} registro 
   * @returns {Promise<boolean>}
   */
  async guardarRegistro(storeName, registro) {
    return this.actualizarParada(registro);
  }

  /**
   * Guarda o reemplaza de forma masiva un arreglo de paradas en una sola transacción.
   * @param {Array<Object>} listaParadas 
   * @returns {Promise<boolean>}
   */
  async guardarColeccionParadas(listaParadas) {
    if (!Array.isArray(listaParadas) || listaParadas.length === 0) return false;

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      // Limpiar datos previos en la colección para sobrescritura atómica
      store.clear();

      listaParadas.forEach((parada, index) => {
        const item = { ...parada };
        if (!item.id) {
          item.id = item.ssc || `#PNT-${item.secuencia || item.orden || index + 1}`;
        }
        item.updated_at = new Date().toISOString();
        store.put(item);
      });

      tx.oncomplete = () => {
        console.log(`✅ [INDEXED_STORE]: Sincronizadas ${listaParadas.length} paradas en IndexedDB.`);
        resolve(true);
      };

      tx.onerror = () => {
        console.error('❌ [INDEXED_STORE]: Error en la transacción masiva:', tx.error);
        reject(tx.error);
      };
    });
  }

  /**
   * Elimina un registro de parada por su identificador clave.
   * @param {string|number} id 
   * @returns {Promise<boolean>}
   */
  async eliminarParada(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`🗑️ [INDEXED_STORE]: Parada '${id}' eliminada de la base local.`);
        resolve(true);
      };

      request.onerror = () => {
        console.error(`❌ [INDEXED_STORE]: Error al eliminar la parada '${id}':`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Alias de compatibilidad para eliminación.
   */
  async eliminarRegistro(storeName, id) {
    return this.eliminarParada(id);
  }

  /**
   * Limpia completamente todos los registros del ObjectStore de paradas.
   * @returns {Promise<boolean>}
   */
  async limpiarStore() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log(`🧹 [INDEXED_STORE]: ObjectStore '${this.storeName}' vaciado correctamente.`);
        resolve(true);
      };

      request.onerror = () => reject(request.error);
    });
  }
}