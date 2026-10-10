/**
 * Browser IndexedDB read boundary. Reads stay scoped to the primary key or
 * ownerUid index; never enumerate all accounts' locally queued payloads.
 */
function fromRequest<T>(makeRequest: () => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const pending = makeRequest();
    pending.onsuccess = () => resolve(pending.result);
    pending.onerror = () => reject(pending.error ?? new Error('indexeddb_read_failed'));
  });
}

export function queueItemById<T>(db: IDBDatabase, storeName: string, id: string): Promise<T | undefined> {
  const tx = db.transaction(storeName, 'readonly');
  return fromRequest<T | undefined>(() => tx.objectStore(storeName).get(id));
}

export function queueItemsForOwner<T>(db: IDBDatabase, storeName: string, ownerUid: string): Promise<T[]> {
  if (!ownerUid) return Promise.reject(new Error('invalid_queue_owner'));
  const tx = db.transaction(storeName, 'readonly');
  return fromRequest<T[]>(() =>
    tx.objectStore(storeName).index('ownerUid').getAll(IDBKeyRange.only(ownerUid)),
  );
}
