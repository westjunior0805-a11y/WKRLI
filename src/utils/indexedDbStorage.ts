/**
 * Moteur de persistance locale haute capacité via IndexedDB pour EquipStock Pro.
 * Permet de dépasser la limite stricte de ~5 Mo du localStorage des navigateurs
 * afin de conserver 100 % du catalogue, des stocks multi-marques, des mouvements
 * et des images hors connexion, même après actualisation de la page (F5).
 */

const IDB_NAME = 'equipstock_pro_idb_v1';
const IDB_VERSION = 1;
const STORE_COLLECTIONS = 'collections';

export interface IdbStoredRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openEquipStockIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_COLLECTIONS)) {
          db.createObjectStore(STORE_COLLECTIONS, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('IndexedDB non disponible dans ce contexte:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('Erreur ouverture IndexedDB:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Enregistre une collection ou valeur complète dans IndexedDB sans troncature ni limite de 5 Mo.
 */
export async function idbSetItem<T = unknown>(key: string, value: T): Promise<boolean> {
  const db = await openEquipStockIdb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_COLLECTIONS, 'readwrite');
      const store = tx.objectStore(STORE_COLLECTIONS);
      const payload: IdbStoredRecord<T> = {
        key,
        value,
        updatedAt: Date.now(),
      };
      store.put(payload);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Récupère une collection stockée dans IndexedDB.
 */
export async function idbGetItem<T = unknown>(key: string): Promise<IdbStoredRecord<T> | null> {
  const db = await openEquipStockIdb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_COLLECTIONS, 'readonly');
      const store = tx.objectStore(STORE_COLLECTIONS);
      const req = store.get(key);
      req.onsuccess = () => {
        const res = req.result as IdbStoredRecord<T> | undefined;
        resolve(res || null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Récupère l'ensemble des collections sauvegardées dans IndexedDB au démarrage.
 */
export async function idbGetAllItems(): Promise<Record<string, IdbStoredRecord<any>>> {
  const db = await openEquipStockIdb();
  if (!db) return {};

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_COLLECTIONS, 'readonly');
      const store = tx.objectStore(STORE_COLLECTIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as IdbStoredRecord<any>[]) || [];
        const map: Record<string, IdbStoredRecord<any>> = {};
        for (const item of list) {
          if (item && item.key) {
            map[item.key] = item;
          }
        }
        resolve(map);
      };
      req.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });
}

/**
 * Supprime une clé spécifique dans IndexedDB.
 */
export async function idbRemoveItem(key: string): Promise<boolean> {
  const db = await openEquipStockIdb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_COLLECTIONS, 'readwrite');
      const store = tx.objectStore(STORE_COLLECTIONS);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
