// Original bytes live in a separate device database. They never become fields
// on PaperRecord, so the existing cloud queue cannot upload them.
const databaseName = 'statlab-paper-originals';
const storeName = 'originals';

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPaperPdf(id: string, ownerId: string | null): Promise<Blob | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(JSON.stringify([ownerId, id]));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function savePaperPdf(id: string, ownerId: string | null, file: Blob) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(file, JSON.stringify([ownerId, id]));
    transaction.oncomplete = () => {db.close(); resolve();};
    transaction.onerror = transaction.onabort = () => {db.close(); reject(transaction.error);};
  });
}

export async function deletePaperPdf(id: string, ownerId: string | null) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(JSON.stringify([ownerId, id]));
    transaction.oncomplete = () => {db.close(); resolve();};
    transaction.onerror = transaction.onabort = () => {db.close(); reject(transaction.error);};
  });
}
