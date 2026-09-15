// Minimal promise wrapper over IndexedDB. Stores use out-of-line keys so Blobs and records share one API.

const DB_NAME = "autoyt-library";
const VERSION = 1;
export const STORES = ["projects", "files", "renders", "renderFiles"] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB no está disponible en este navegador."));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        for (const name of STORES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error("No se pudo abrir la biblioteca local."));
      };
    });
  }
  return dbPromise;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = op(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    const fail = () => {
      const err = tx.error ?? req.error;
      reject(
        err?.name === "QuotaExceededError"
          ? new Error("No hay espacio en el almacenamiento del navegador. Borrá proyectos o renders viejos.")
          : (err ?? new Error("Operación de IndexedDB abortada.")),
      );
    };
    tx.onerror = fail;
    tx.onabort = fail;
  });
}

export const idbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key));
export const idbAll = <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
export const idbPut = (store: StoreName, key: string, value: unknown) => run(store, "readwrite", (s) => s.put(value, key));
export const idbDelete = (store: StoreName, key: string) => run(store, "readwrite", (s) => s.delete(key));
