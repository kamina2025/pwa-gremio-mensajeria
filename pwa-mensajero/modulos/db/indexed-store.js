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

    return this._dbPromise;
  }

  /**
   * Helper genérico para ejecutar transacciones IndexedDB de forma segura.
   * @private
   * @param {string} storeName 
   * @param {IDBTransactionMode} mode 
   * @param {Function} callback 
   * @returns {Promise<any>}
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
   * Normaliza un objeto de parada garantizando un ID primario válido y limpio.
   * @private
   * @param {Object} registro 
   * @param {number} [fallbackIndex=0] 
   * @returns {Object}
   */
  _normalizarRegistro(registro, fallbackIndex = 0) {
    const copia = { ...registro };
    const rawId = copia.id || copia.ssc || copia.idParada || copia.id_parada;

    if (rawId !== undefined && rawId !== null && String(rawId).trim() !== '') {
      copia.id = String(rawId).trim();
    } else {
      copia.id = `#PNT-${copia.secuencia || copia.orden || fallbackIndex + 1}`;
    }

    if (copia.sincronizado === undefined) {
      copia.sincronizado = 0;
    }
    copia.updated_at = new Date().toISOString();
    return copia;
  }

  /**
   * Recupera todos los registros de un ObjectStore determinado.
   * @param {string} [storeOpcional]
   * @returns {Promise<Array<Object>>}
   */
  async obtenerParadas(storeOpcional) {
    const targetStore = storeOpcional || this.defaultStore;
    return this._execTx(targetStore, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const resultados = request.result || [];
          console.log(`📦 [INDEXED_STORE]: ${resultados.length} registro(s) obtenido(s) de '${targetStore}'.`);
          resolve(resultados);
        };
        request.onerror = () => reject(request.error);
      });
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
    if (!id) return null;
    const targetStore = storeOpcional || this.defaultStore;
    const searchKey = String(id).trim();

    return this._execTx(targetStore, 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(searchKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
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
    const copia = this._normalizarRegistro(registro);

    return this._execTx(targetStore, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(copia);
        request.onsuccess = () => {
          console.log(`💾 [INDEXED_STORE]: Registro '${copia.id}' guardado en '${targetStore}'.`);
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  /** Alias genérico para guardar un registro */
  async guardarRegistro(storeName, registro) {
    return this.actualizarParada(registro, storeName || this.defaultStore);
  }

  /**
   * Actualiza de forma atómica los campos de una parada incrustada dentro del array `paradas` de una planilla.
   * @param {string|number} idPlanilla 
   * @param {string|number} idParada 
   * @param {Object} datosNuevos 
   * @returns {Promise<boolean>}
   */
  async actualizarParadaEnPlanilla(idPlanilla, idParada, datosNuevos) {
    if (!idPlanilla || !idParada || !datosNuevos) return false;
    const keyPlanilla = String(idPlanilla).trim();
    const keyParada = String(idParada).trim();

    return this._execTx('planillas', 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const getRequest = store.get(keyPlanilla);

        getRequest.onsuccess = () => {
          const planilla = getRequest.result;
          if (!planilla) {
            console.warn(`⚠️ [INDEXED_STORE]: Planilla '${keyPlanilla}' no encontrada para actualización atómica.`);
            return resolve(false);
          }

          if (Array.isArray(planilla.paradas)) {
            const idx = planilla.paradas.findIndex((p) => {
              const pid = String(p.id || p.ssc || p.idParada || '').trim();
              return pid === keyParada;
            });

            if (idx !== -1) {
              planilla.paradas[idx] = {
                ...planilla.paradas[idx],
                ...datosNuevos,
                updated_at: new Date().toISOString()
              };
              planilla.updated_at = new Date().toISOString();

              const putRequest = store.put(planilla);
              putRequest.onsuccess = () => {
                console.log(`💾 [INDEXED_STORE]: Parada '${keyParada}' actualizada atómicamente dentro de Planilla #${keyPlanilla}.`);
                resolve(true);
              };
              putRequest.onerror = () => reject(putRequest.error);
            } else {
              console.warn(`⚠️ [INDEXED_STORE]: Parada '${keyParada}' no coincide en el listado de la Planilla #${keyPlanilla}.`);
              resolve(false);
            }
          } else {
            resolve(false);
          }
        };

        getRequest.onerror = () => reject(getRequest.error);
      });
    });
  }

  /**
   * Persiste un archivo PDF en formato Blob dentro del store 'planillas_pdf'.
   * @param {string|number} idPlanilla
   * @param {Blob} blobArchivo
   * @returns {Promise<boolean>}
   */
  async guardarPdfBlob(idPlanilla, blobArchivo) {
    if (!idPlanilla || !(blobArchivo instanceof Blob)) return false;

    try {
      return await this._execTx('planillas_pdf', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
          const registro = {
            id: String(idPlanilla).trim(),
            blob: blobArchivo,
            created_at: new Date().toISOString()
          };

          const request = store.put(registro);
          request.onsuccess = () => resolve(true);
          request.onerror = () => reject(request.error);
        });
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
    if (!idPlanilla) return null;

    try {
      return await this._execTx('planillas_pdf', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
          const request = store.get(String(idPlanilla).trim());
          request.onsuccess = () => resolve(request.result ? request.result.blob : null);
          request.onerror = () => reject(request.error);
        });
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

    return this._execTx(targetStore, 'readwrite', (store) => {
      store.clear();

      listaRegistros.forEach((item, index) => {
        const copia = this._normalizarRegistro(item, index);
        store.put(copia);
      });

      console.log(`✅ [INDEXED_STORE]: Sincronizados ${listaRegistros.length} registros en '${targetStore}'.`);
      return true;
    });
  }

  /**
   * Elimina un registro por su clave identificadora.
   * @param {string|number} id
   * @param {string} [storeOpcional]
   * @returns {Promise<boolean>}
   */
  async eliminarParada(id, storeOpcional) {
    if (!id) return false;
    const targetStore = storeOpcional || this.defaultStore;
    const key = String(id).trim();

    return this._execTx(targetStore, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => {
          console.log(`🗑️ [INDEXED_STORE]: Registro '${key}' eliminado de '${targetStore}'.`);
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      });
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

    return this._execTx(targetStore, 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          console.log(`🧹 [INDEXED_STORE]: ObjectStore '${targetStore}' vaciado correctamente.`);
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Registra una acción pendiente en la cola de sincronización offline.
   * @param {string} accion 
   * @param {Object} payload 
   * @returns {Promise<boolean>}
   */
  async registrarOperacionPendiente(accion, payload) {
    return this._execTx('sincronizacion_pendiente', 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const registro = {
          accion,
          payload,
          timestamp: new Date().toISOString()
        };
        const request = store.add(registro);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Obtiene la cola de operaciones pendientes de sincronizar con el backend PHP.
   * @returns {Promise<Array<Object>>}
   */
  async obtenerOperacionesPendientes() {
    return this.obtenerParadas('sincronizacion_pendiente');
  }

  /**
   * Vacía la cola de sincronización pendiente una vez transmitida con éxito.
   * @returns {Promise<boolean>}
   */
  async limpiarColaSincronizacion() {
    return this.limpiarStore('sincronizacion_pendiente');
  }
}