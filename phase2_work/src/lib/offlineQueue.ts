import { klarStorage } from '../lib/userScopedStorage';
const DB_NAME = "klar_offline_queue_db";
const IDBKeyRange = globalThis.IDBKeyRange;
const STORE_NAME = "pending_writes";
const MAX_ATTEMPTS = 5;
const MAX_ITEMS_PER_USER = 100;

export interface PendingQueueItem {
  id: string;
  ownerUid: string;
  url: "/api/messages/send" | "/api/checklists/date_prep";
  method: "POST" | "PUT";
  payload: { chatId: string; text: string; clientMessageId: string } | { checklist: Record<string, boolean> };
  queuedAt: number;
  attempts: number;
  nextAttemptAt: number;
  status?: 'pending' | 'dead_letter';
  lastError?: string;
  deadLetteredAt?: number;
}

export interface QueuedAction {
  id: string;
  type: 'SEND_MESSAGE';
  payload: {
    chatId: string;
    text: string;
    clientMessageId: string;
    uid: string;
  };
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'success' | 'dead_letter';
  retryCount: number;
  lastError?: string;
}

export interface SyncLogEntry {
  timestamp: string;
  action: string;
  status: 'pending' | 'success' | 'failed';
  type?: string;
  latencyMs?: number;
  details?: string;
}

let memoryQueue: QueuedAction[] = [];
let memorySyncLogs: SyncLogEntry[] = [];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('indexeddb_unavailable'));
    }
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!store.indexNames.contains("ownerUid")) store.createIndex("ownerUid", "ownerUid", { unique: false });
      if (!store.indexNames.contains("queuedAt")) store.createIndex("queuedAt", "queuedAt", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateQueueId(ownerUid: string, clientMessageId: string): string {
  return `message:${ownerUid}:${clientMessageId}`;
}

export const DATE_PREP_CHECKLIST_DEFAULTS: Record<string, boolean> = {
  location: false, battery: false, trustedPerson: false, money: false,
  outfit_comfort: false, outfit_weather: false, outfit_ready: false,
  mindset: false, boundaries: false, authenticity: false, curiosity: false, openMind: false,
  topics_hobbies: false, topics_questions: false, topics_no_ex: false,
};

function generateChecklistQueueId(ownerUid: string): string {
  return `checklist:date_prep:${ownerUid}`;
}

export async function loadQueuedDatePrepChecklist(ownerUid: string): Promise<Record<string, boolean> | null> {
  if (!ownerUid || typeof indexedDB === 'undefined') return null;
  const db = await openDatabase();
  try {
    const item = (await allItems(db)).find(candidate => candidate.ownerUid === ownerUid && candidate.id === generateChecklistQueueId(ownerUid));
    const payload = item?.payload;
    if (!payload || !('checklist' in payload) || !payload.checklist || typeof payload.checklist !== 'object') return null;
    return { ...DATE_PREP_CHECKLIST_DEFAULTS, ...(payload.checklist as Record<string, boolean>) };
  } finally { db.close(); }
}

export async function enqueueDatePrepChecklist(ownerUid: string, checklist: Record<string, boolean>, now = Date.now()): Promise<void> {
  if (!ownerUid) throw new Error('invalid_checklist_owner');
  const normalized = Object.fromEntries(Object.entries({ ...DATE_PREP_CHECKLIST_DEFAULTS, ...checklist }).map(([key, value]) => [key, value === true]));
  const db = await openDatabase();
  try {
    await putItem(db, { id: generateChecklistQueueId(ownerUid), ownerUid, url: '/api/checklists/date_prep', method: 'PUT', payload: { checklist: normalized }, queuedAt: now, attempts: 0, nextAttemptAt: 0 });
  } finally { db.close(); }
}

export async function flushDatePrepChecklist(options: { ownerUid: string; token: string; fetcher?: typeof fetch; now?: number }): Promise<{ synced: boolean; remaining: boolean }> {
  if (!options.ownerUid || !options.token) return { synced: false, remaining: false };
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now();
  const db = await openDatabase();
  try {
    const item = (await allItems(db)).find(candidate => candidate.ownerUid === options.ownerUid && candidate.id === generateChecklistQueueId(options.ownerUid));
    if (!item || item.nextAttemptAt > now || !('checklist' in item.payload)) return { synced: false, remaining: Boolean(item) };
    try {
      const res = await fetcher(item.url, { method: item.method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.token}` }, body: JSON.stringify(item.payload) });
      if (res.ok) { await deleteItem(db, item.id); return { synced: true, remaining: false }; }
    } catch {}
    const attempts = item.attempts + 1;
    await putItem(db, { ...item, attempts, nextAttemptAt: now + retryDelayMs(attempts) });
    return { synced: false, remaining: true };
  } finally { db.close(); }
}

export function validMessagePayload(value: { chatId: unknown; text: unknown; clientMessageId: unknown }): boolean {
  return typeof value.chatId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value.chatId)
    && typeof value.text === 'string' && !!value.text.trim() && value.text.length <= 4000
    && typeof value.clientMessageId === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value.clientMessageId);
}

function request<T>(factory: () => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = factory();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function allItems(db: IDBDatabase): Promise<PendingQueueItem[]> {
  const tx = db.transaction(STORE_NAME, "readonly");
  return request(() => tx.objectStore(STORE_NAME).getAll());
}


function transactionComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('indexeddb_transaction_aborted'));
  });
}

async function putItem(db: IDBDatabase, item: PendingQueueItem): Promise<void> {
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(item);
  await transactionComplete(tx);
}

async function deleteItem(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await transactionComplete(tx);
}

export function retryDelayMs(attempts: number): number {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attempts - 1));
}

export async function clearQueueForUser(ownerUid: string): Promise<void> {
  if (!ownerUid) return;
  memoryQueue = memoryQueue.filter((item) => item.payload.uid !== ownerUid);
  await clearOfflineQueueForUser(ownerUid);
}

export async function enqueueChatMessage(
  chatId: string,
  text: string,
  clientMessageId: string,
  uid: string
): Promise<QueuedAction> {
  const existing = memoryQueue.find(
    (item) => item.payload.clientMessageId === clientMessageId
  );
  if (existing) {
    return existing;
  }

  const action: QueuedAction = {
    id: `message:${uid}:${clientMessageId}`,
    type: 'SEND_MESSAGE',
    payload: { chatId, text, clientMessageId, uid },
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  };

  memoryQueue.push(action);
  return action;
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  return [...memoryQueue];
}

export async function getQueuedMessagesForChat(chatId: string): Promise<QueuedAction[]> {
  return memoryQueue.filter(
    (item) => item.payload.chatId === chatId && item.status !== 'dead_letter'
  );
}

export async function syncQueuedActions(options?: {
  authToken?: string;
  fetchFn?: typeof fetch;
}): Promise<{ total: number; succeeded: number; failed: number }> {
  const fetcher = options?.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetcher) return { total: 0, succeeded: 0, failed: 0 };

  const actions = [...memoryQueue];
  let succeeded = 0;
  let failed = 0;

  for (const action of actions) {
    if (action.status === 'dead_letter' || action.status === 'success') continue;

    const startTime = Date.now();
    try {
      const res = await fetcher('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
        },
        body: JSON.stringify(action.payload),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        action.status = 'success';
        succeeded++;
        memoryQueue = memoryQueue.filter((a) => a.id !== action.id);

        addSyncLog({
          timestamp: new Date().toISOString(),
          action: 'SEND_MESSAGE',
          type: 'SEND_MESSAGE',
          status: 'success',
          latencyMs,
        });
      } else {
        const body = (await res.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
        const errMsg = responseError(res, body);

        failed++;
        action.retryCount = (action.retryCount || 0) + 1;
        action.lastError = errMsg;

        if (!retryableStatus(res.status) || action.retryCount >= MAX_ATTEMPTS) {
          action.status = 'dead_letter';
        } else {
          action.status = 'failed';
        }

        addSyncLog({
          timestamp: new Date().toISOString(),
          action: 'SEND_MESSAGE',
          type: 'SEND_MESSAGE',
          status: 'failed',
          latencyMs,
          details: errMsg,
        });
      }
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      failed++;
      action.retryCount = (action.retryCount || 0) + 1;
      action.status = action.retryCount >= MAX_ATTEMPTS ? 'dead_letter' : 'failed';
      action.lastError = err instanceof Error ? err.message : 'network_error';

      addSyncLog({
        timestamp: new Date().toISOString(),
        action: 'SEND_MESSAGE',
        type: 'SEND_MESSAGE',
        status: 'failed',
        latencyMs,
        details: err?.message,
      });
    }
  }

  return { total: actions.length, succeeded, failed };
}

export async function enqueueOfflineMessage(input: {
  ownerUid: string;
  chatId: string;
  text: string;
  clientMessageId: string;
  now?: number;
}): Promise<void> {
  const payload = { chatId: input.chatId, text: input.text, clientMessageId: input.clientMessageId };
  if (!input.ownerUid || !validMessagePayload(payload)) throw new Error("invalid_offline_message");
  const db = await openDatabase();
  try {
    const id = generateQueueId(input.ownerUid, input.clientMessageId);
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const existing = await request(() => store.get(id));
    if (!existing) {
      const ownedCount = await request(() => store.index("ownerUid").count(IDBKeyRange.only(input.ownerUid)));
      if (ownedCount >= MAX_ITEMS_PER_USER) {
        tx.abort();
        throw new Error("offline_queue_full");
      }
      store.put({
        id, ownerUid: input.ownerUid, url: "/api/messages/send", method: "POST", payload,
        queuedAt: input.now ?? Date.now(), attempts: 0, nextAttemptAt: 0,
      });
    }
    await transactionComplete(tx);
  } finally { db.close(); }
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function responseError(res: Response, body: { error?: unknown; code?: unknown } | null): string {
  if (typeof body?.code === 'string' && body.code) return body.code;
  if (typeof body?.error === 'string' && body.error) return body.error;
  return res.statusText || `http_${res.status}`;
}

export async function flushOfflineQueue(options: {
  ownerUid: string;
  token: string;
  fetcher?: typeof fetch;
  now?: number;
}): Promise<{ sent: number; failed: number; remaining: number; deadLettered: number }> {
  if (!options.ownerUid || !options.token) return { sent: 0, failed: 0, remaining: 0, deadLettered: 0 };
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now();
  const db = await openDatabase();
  let sent = 0;
  let failed = 0;
  try {
    const items = (await allItems(db))
      .filter(item => item.ownerUid === options.ownerUid && item.status !== 'dead_letter')
      .sort((a, b) => a.queuedAt - b.queuedAt);

    let deadLettered = 0;
    for (const item of items) {
      if (item.attempts >= MAX_ATTEMPTS) {
        await putItem(db, { ...item, status: 'dead_letter', deadLetteredAt: now, lastError: item.lastError ?? 'retry_limit_reached' });
        deadLettered += 1;
        continue;
      }
      if (item.nextAttemptAt > now) continue;
      try {
        const res = await fetcher(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${options.token}` },
          body: JSON.stringify(item.payload),
        });
        const body = await res.json().catch(() => null) as { success?: unknown; error?: unknown; code?: unknown } | null;
        if (res.ok && body?.success === true) {
          await deleteItem(db, item.id);
          sent += 1;
          continue;
        }
        const error = responseError(res, body);
        if (!retryableStatus(res.status)) {
          failed += 1;
          await putItem(db, { ...item, status: 'dead_letter', deadLetteredAt: now, lastError: error, nextAttemptAt: Number.MAX_SAFE_INTEGER });
          deadLettered += 1;
          continue;
        }
        failed += 1;
        const attempts = item.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await putItem(db, { ...item, attempts, status: 'dead_letter', deadLetteredAt: now, lastError: error, nextAttemptAt: Number.MAX_SAFE_INTEGER });
          deadLettered += 1;
          continue;
        }
        await putItem(db, { ...item, attempts, status: 'pending', nextAttemptAt: now + retryDelayMs(attempts), lastError: error });
        break;
      } catch (err: unknown) {
        failed += 1;
        const attempts = item.attempts + 1;
        const error = err instanceof Error ? err.message : 'network_error';
        if (attempts >= MAX_ATTEMPTS) {
          await putItem(db, { ...item, attempts, status: 'dead_letter', deadLetteredAt: now, lastError: error, nextAttemptAt: Number.MAX_SAFE_INTEGER });
          deadLettered += 1;
          continue;
        }
        await putItem(db, { ...item, attempts, status: 'pending', nextAttemptAt: now + retryDelayMs(attempts), lastError: error });
        break;
      }
    }
    const remaining = (await allItems(db)).filter(item => item.ownerUid === options.ownerUid && item.status !== 'dead_letter').length;
    return { sent, failed, remaining, deadLettered };
  } finally { db.close(); }
}

export async function clearOfflineQueueForUser(ownerUid: string): Promise<void> {
  if (!ownerUid) return;
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const ownerIndex = store.index("ownerUid");
    const request = ownerIndex.openCursor(IDBKeyRange.only(ownerUid));
    request.onerror = () => {
      try { tx.abort(); } catch {}
    };
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    await transactionComplete(tx);
  } finally { db.close(); }
}

function addSyncLog(entry: SyncLogEntry): void {
  memorySyncLogs.push(entry);
  if (typeof klarStorage !== 'undefined') {
    try {
      klarStorage.setItem('klar_sync_logs', JSON.stringify(memorySyncLogs));
    } catch {}
  }
}

export function getSyncLogs(): SyncLogEntry[] {
  if (typeof klarStorage !== 'undefined') {
    try {
      const raw = klarStorage.getItem('klar_sync_logs');
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return [...memorySyncLogs];
}

export function clearSyncLogs(): void {
  memorySyncLogs = [];
  if (typeof klarStorage !== 'undefined') {
    try { klarStorage.removeItem('klar_sync_logs'); } catch {}
  }
}
