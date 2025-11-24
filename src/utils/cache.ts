// frontend/src/utils/cache.ts
// CREATE NEW FILE: src/utils/cache.ts

// ✅ IndexedDB cache (much larger quota than localStorage)
const DB_NAME = "onevyou-cache";
const STORE_NAME = "users";
const VERSION = 1;

let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const cacheUsers = async (users: any[]): Promise<void> => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.put({
      users,
      timestamp: Date.now(),
    }, "cachedUsers");

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log("💾 Cached", users.length, "users to IndexedDB");
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.error("IndexedDB cache failed:", err);
    throw err;
  }
};

export const getCachedUsers = async (): Promise<any[] | null> => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get("cachedUsers");

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const data = request.result;
        if (data && Date.now() - data.timestamp < 60000) { // 1 min cache
          console.log("♻️ Loaded", data.users.length, "users from IndexedDB");
          resolve(data.users);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.error("IndexedDB read failed:", err);
    return null;
  }
};