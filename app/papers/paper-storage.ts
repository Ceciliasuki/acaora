import type { CloudDeletion, PaperRecord, PaperSyncOperation } from "./paper-types";
import {reconcileSnapshot} from './paper-sync.mjs';

const databaseName = "statlab-paper-memory";
const storeName = "papers";
const syncStoreName = "paper-sync-operations";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(syncStoreName)) {
        database.createObjectStore(syncStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPaperLibrary(ownerId: string | null = null): Promise<PaperRecord[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as PaperRecord[])
      .filter((paper) => (paper.ownerId ?? null) === ownerId)
      .sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function savePaper(paper: PaperRecord) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(paper);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deletePaper(id: string) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function savePaperAndQueue(paper: PaperRecord, options: {requireExisting?: boolean} = {}) {
  const database = await openDatabase();
  return new Promise<boolean>((resolve, reject) => {
    const transaction = database.transaction([storeName, syncStoreName], "readwrite");
    let saved = false;
    const syncStore = transaction.objectStore(syncStoreName);
    const existingRequest = syncStore.get(paper.id);
    existingRequest.onsuccess = () => {
      if ((existingRequest.result as PaperSyncOperation | undefined)?.type === "delete") return;
      const write = () => {
        transaction.objectStore(storeName).put(paper);
        syncStore.put({ id: paper.id, ownerId: paper.ownerId, type: "upsert", updatedAt: paper.updatedAt, paper, attempts: 0, nextAttemptAt: 0 } satisfies PaperSyncOperation);
        saved = true;
      };
      if (options.requireExisting) {
        // An edit queued behind a cloud deletion may update, but never recreate,
        // an existing paper. Imports deliberately keep the creation path.
        const record = transaction.objectStore(storeName).get(paper.id);
        record.onsuccess = () => {
          if (record.result && (record.result as PaperRecord).ownerId === paper.ownerId) write();
        };
      } else write();
    };
    transaction.oncomplete = () => { database.close(); resolve(saved); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

export async function deletePaperAndQueue(id: string, updatedAt: number, ownerId: string) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([storeName, syncStoreName], "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.objectStore(syncStoreName).put({ id, ownerId, type: "delete", updatedAt, attempts: 0, nextAttemptAt: 0 } satisfies PaperSyncOperation);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

export async function getPaperSyncOperations(ownerId: string): Promise<PaperSyncOperation[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(syncStoreName, "readonly");
    const request = transaction.objectStore(syncStoreName).getAll();
    request.onsuccess = () => resolve((request.result as PaperSyncOperation[]).filter((operation) => operation.ownerId === ownerId));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function putPaperSyncOperation(operation: PaperSyncOperation) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(syncStoreName, "readwrite");
    transaction.objectStore(syncStoreName).put(operation);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function deletePaperSyncOperation(id: string) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(syncStoreName, "readwrite");
    transaction.objectStore(syncStoreName).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

// Read, reconcile and write in one transaction. A note save must land entirely
// before or after this merge, never between a stale read and its replacement.
export async function applyPaperSyncSnapshot(ownerId: string, cloudPapers: PaperRecord[], deletions: CloudDeletion[]) {
  const database = await openDatabase();
  return new Promise<ReturnType<typeof reconcileSnapshot>>((resolve, reject) => {
    const transaction = database.transaction([storeName, syncStoreName], "readwrite");
    const paperStore = transaction.objectStore(storeName);
    const syncStore = transaction.objectStore(syncStoreName);
    const papersRequest = paperStore.getAll();
    const syncRequest = syncStore.getAll();
    let localPapers: PaperRecord[] | undefined;
    let pending: PaperSyncOperation[] | undefined;
    let result: ReturnType<typeof reconcileSnapshot>;
    const merge = () => {
      if (!localPapers || !pending) return;
      result = reconcileSnapshot({
        localPapers: localPapers.filter(paper => paper.ownerId === ownerId),
        cloudPapers: cloudPapers.map(paper => ({...paper, ownerId})),
        deletions,
        pending: pending.filter(operation => operation.ownerId === ownerId),
      });
      const nextIds = new Set(result.papers.map((paper) => paper.id));
      for (const oldPaper of papersRequest.result as PaperRecord[]) {
        if (oldPaper.ownerId === ownerId && !nextIds.has(oldPaper.id)) paperStore.delete(oldPaper.id);
      }
      for (const paper of result.papers) paperStore.put(paper);
      const nextOperationIds = new Set(result.pending.map((operation) => operation.id));
      for (const oldOperation of syncRequest.result as PaperSyncOperation[]) {
        if (oldOperation.ownerId === ownerId && !nextOperationIds.has(oldOperation.id)) syncStore.delete(oldOperation.id);
      }
      for (const operation of result.pending) syncStore.put(operation);
    };
    papersRequest.onsuccess = () => {localPapers = papersRequest.result as PaperRecord[]; merge();};
    syncRequest.onsuccess = () => {pending = syncRequest.result as PaperSyncOperation[]; merge();};
    transaction.oncomplete = () => { database.close(); resolve(result); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

export async function acknowledgePaperSyncOperation(sent: PaperSyncOperation) {
  return changePaperSyncOperation(sent, () => null);
}

export async function reschedulePaperSyncOperation(sent: PaperSyncOperation, next: PaperSyncOperation) {
  return changePaperSyncOperation(sent, () => next);
}

async function changePaperSyncOperation(sent: PaperSyncOperation, change: () => PaperSyncOperation | null) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(syncStoreName, "readwrite");
    const store = transaction.objectStore(syncStoreName);
    const request = store.get(sent.id);
    request.onsuccess = () => {
      const current = request.result as PaperSyncOperation | undefined;
      if (!current || current.ownerId !== sent.ownerId || current.type !== sent.type || current.updatedAt !== sent.updatedAt || current.attempts !== sent.attempts) return;
      if (current.type === "upsert" && sent.type === "upsert" && JSON.stringify(current.paper) !== JSON.stringify(sent.paper)) return;
      const next = change();
      if (next) store.put(next);
      else store.delete(sent.id);
    };
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}
