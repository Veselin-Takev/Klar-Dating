import { observeFirestoreTransaction } from './observability';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Query,
  QuerySnapshot,
  Transaction,
} from 'firebase-admin/firestore';

type DurableData = Record<string, unknown>;

type DurableDocSnapshot = {
  id: string;
  exists: boolean;
  data: () => unknown;
  ref: DurableDocRef;
};

type DurableDocRef = {
  id: string;
  path: string;
  _realDocRef?: DocumentReference | null;
  get: () => Promise<DurableDocSnapshot | DocumentSnapshot>;
  set: (data: unknown, options?: unknown) => Promise<void>;
  update: (data: unknown) => Promise<void>;
  delete: () => Promise<void>;
  collection: (subCol: string) => DurableCollectionRef;
};

type DurableQuerySnapshot = {
  docs: DurableDocSnapshot[];
  empty: boolean;
  size: number;
  forEach: (callback: (doc: DurableDocSnapshot) => void) => void;
};

type DurableQuery = {
  where: (field: string, op: string, val: unknown) => DurableQuery;
  orderBy: (field: string, dir?: 'asc' | 'desc') => DurableQuery;
  limit: (n: number) => DurableQuery;
  startAfter: (...args: unknown[]) => DurableQuery;
  get: () => Promise<DurableQuerySnapshot | QuerySnapshot>;
};

type DurableCollectionRef = {
  path: string;
  doc: (docId?: string) => DurableDocRef;
  add: (data: unknown) => Promise<DurableDocRef>;
  get: () => Promise<DurableQuerySnapshot | QuerySnapshot>;
  where: (field: string, op: string, val: unknown) => DurableQuery;
  orderBy: (field: string, dir?: 'asc' | 'desc') => DurableQuery;
  limit: (n: number) => DurableQuery;
  startAfter: (...args: unknown[]) => DurableQuery;
};

type DurableDocRefLike = DurableDocRef | DocumentReference;

type DurableTransaction = {
  get: (ref: DurableDocRefLike) => Promise<DurableDocSnapshot | DocumentSnapshot>;
  getAll: (...refs: DurableDocRefLike[]) => Promise<Array<DurableDocSnapshot | DocumentSnapshot>>;
  set: (ref: DurableDocRefLike, data: unknown, options?: unknown) => DurableTransaction;
  create: (ref: DurableDocRefLike, data: unknown) => DurableTransaction;
  update: (ref: DurableDocRefLike, data: unknown) => DurableTransaction;
  delete: (ref: DurableDocRefLike) => DurableTransaction;
};

type DurableDbProxy = {
  collection: (colPath: string) => DurableCollectionRef;
  doc: (docPath: string) => DurableDocRef;
  runTransaction: <T>(updateFunction: (tx: DurableTransaction) => Promise<T>) => Promise<T>;
  batch: () => {
    set: (ref: DurableDocRef, data: unknown, options?: unknown) => void;
    update: (ref: DurableDocRef, data: unknown) => void;
    delete: (ref: DurableDocRef) => void;
    commit: () => Promise<void>;
  };
  recursiveDelete: (ref: DurableDocRef) => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function property(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function callable(value: unknown, key: string): ((...args: unknown[]) => unknown) | undefined {
  const member = property(value, key);
  return typeof member === 'function' ? member.bind(value) : undefined;
}

export class DurableFirestoreStore {
  private filePath: string;
  private data: Record<string, DurableData> = {};
  private isLoaded = false;

  constructor(storageDir = path.resolve(process.cwd(), '.data')) {
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
    this.filePath = path.join(storageDir, 'durable-firestore.json');
    this.load();
  }

  private load(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed: unknown = JSON.parse(raw);
        const entries: Array<[string, DurableData]> = isRecord(parsed)
          ? Object.entries(parsed)
              .filter(([, value]) => isRecord(value))
              .map(([key, value]) => [key, value as DurableData])
          : [];
        this.data = Object.fromEntries(entries);
      } else {
        this.data = {
          'system/ping': { ok: true, at: new Date().toISOString() },
          'system/readiness': { ok: true, at: new Date().toISOString() },
        };
        this.persistImmediate();
      }
    } catch {
      this.data = {};
    }
    this.isLoaded = true;
  }

  private persistImmediate(): void {
    try {
      const tmpPath = `${this.filePath}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (error: unknown) {
      console.warn('Durable store write failed:', error);
    }
  }

  public getDoc(fullPath: string): DurableData | null {
    this.load();
    const doc = this.data[fullPath];
    return doc ? JSON.parse(JSON.stringify(doc)) as DurableData : null;
  }

  public setDoc(fullPath: string, incoming: unknown, merge = false): void {
    this.load();
    const processed = this.resolveFieldValues(incoming, this.data[fullPath]);
    if (!isRecord(processed)) throw new Error('Durable Firestore document must be an object.');
    if (merge && this.data[fullPath]) {
      this.data[fullPath] = this.deepMerge(this.data[fullPath], processed);
    } else {
      this.data[fullPath] = processed;
    }
    this.persistImmediate();
  }

  public updateDoc(fullPath: string, updates: unknown): void {
    this.load();
    const current = this.data[fullPath] ?? {};
    const processed = this.resolveFieldValues(updates, current);
    if (!isRecord(processed)) throw new Error('Durable Firestore update must be an object.');
    this.data[fullPath] = this.deepMerge(current, processed);
    this.persistImmediate();
  }

  public deleteDoc(fullPath: string): void {
    this.load();
    delete this.data[fullPath];
    this.persistImmediate();
  }

  public queryCollection(
    colPrefix: string,
    filterFn?: (data: DurableData) => boolean,
  ): Array<{ id: string; path: string; data: DurableData }> {
    this.load();
    const results: Array<{ id: string; path: string; data: DurableData }> = [];
    const prefix = colPrefix.endsWith('/') ? colPrefix : `${colPrefix}/`;
    for (const [key, val] of Object.entries(this.data)) {
      if (!key.startsWith(prefix)) continue;
      const remaining = key.substring(prefix.length);
      if (!remaining.includes('/') && (!filterFn || filterFn(val))) {
        results.push({ id: remaining, path: key, data: JSON.parse(JSON.stringify(val)) as DurableData });
      }
    }
    return results;
  }

  private resolveFieldValues(obj: unknown, existing?: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return { _isTimestamp: true, millis: obj.getTime(), iso: obj.toISOString() };

    const toMillis = callable(obj, 'toMillis');
    if (toMillis) {
      const ms = Number(toMillis());
      if (Number.isFinite(ms)) return { _isTimestamp: true, millis: ms, iso: new Date(ms).toISOString() };
    }

    const toDate = callable(obj, 'toDate');
    if (toDate) {
      const date = toDate();
      if (date instanceof Date) return { _isTimestamp: true, millis: date.getTime(), iso: date.toISOString() };
    }

    if (typeof obj !== 'object') return obj;

    const constructorName = typeof property(property(obj, 'constructor'), 'name') === 'string'
      ? String(property(property(obj, 'constructor'), 'name'))
      : '';
    const methodName = property(obj, '_methodName') ?? property(obj, 'methodName');

    if (constructorName === 'FieldValue' || constructorName.includes('ServerTimestamp') || methodName === 'serverTimestamp') {
      const now = Date.now();
      return { _isTimestamp: true, millis: now, iso: new Date(now).toISOString() };
    }

    if (Array.isArray(obj)) return obj.map(item => this.resolveFieldValues(item));

    if (!isRecord(obj)) return obj;
    const existingRecord = isRecord(existing) ? existing : undefined;
    const out: DurableData = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && typeof value === 'object') {
        if (value instanceof Date) {
          out[key] = { _isTimestamp: true, millis: value.getTime(), iso: value.toISOString() };
          continue;
        }

        const nestedMillis = callable(value, 'toMillis');
        if (nestedMillis) {
          const ms = Number(nestedMillis());
          if (Number.isFinite(ms)) {
            out[key] = { _isTimestamp: true, millis: ms, iso: new Date(ms).toISOString() };
            continue;
          }
        }

        const nestedDate = callable(value, 'toDate');
        if (nestedDate) {
          const date = nestedDate();
          if (date instanceof Date) {
            out[key] = { _isTimestamp: true, millis: date.getTime(), iso: date.toISOString() };
            continue;
          }
        }

        const nestedConstructorName = String(property(property(value, 'constructor'), 'name') ?? '');
        const nestedMethodName = property(value, '_methodName') ?? property(value, 'methodName');

        if (nestedConstructorName.includes('ServerTimestamp') || nestedMethodName === 'serverTimestamp') {
          const now = Date.now();
          out[key] = { _isTimestamp: true, millis: now, iso: new Date(now).toISOString() };
          continue;
        }
        if (nestedMethodName === 'delete') continue;

        if (nestedMethodName === 'increment') {
          const incrementValue = Number(property(value, '_operand') ?? property(value, 'operand') ?? 1);
          const previousValue = existingRecord?.[key];
          const previous = typeof previousValue === 'number' ? previousValue : 0;
          out[key] = previous + (Number.isFinite(incrementValue) ? incrementValue : 1);
          continue;
        }

        if (nestedMethodName === 'arrayUnion') {
          const rawElements = property(value, '_elements') ?? property(value, 'elements');
          const elements = Array.isArray(rawElements) ? rawElements : [];
          const previous = Array.isArray(existingRecord?.[key]) ? existingRecord[key] as unknown[] : [];
          out[key] = Array.from(new Set([...previous, ...elements]));
          continue;
        }

        if (nestedMethodName === 'arrayRemove') {
          const rawElements = property(value, '_elements') ?? property(value, 'elements');
          const elements = Array.isArray(rawElements) ? rawElements : [];
          const previous = Array.isArray(existingRecord?.[key]) ? existingRecord[key] as unknown[] : [];
          out[key] = previous.filter(item => !elements.includes(item));
          continue;
        }
      }
      out[key] = this.resolveFieldValues(value, existingRecord?.[key]);
    }
    return out;
  }

  private deepMerge(target: DurableData, source: DurableData): DurableData {
    const output: DurableData = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (isRecord(value)) {
        const targetValue = output[key];
        output[key] = isRecord(targetValue) ? this.deepMerge(targetValue, value) : value;
      } else {
        output[key] = value;
      }
    }
    return output;
  }
}

export const durableStore = new DurableFirestoreStore();

export function wrapDurableData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) {
    const ms = data.getTime();
    return { toDate: () => new Date(ms), toMillis: () => ms, getTime: () => ms, toISOString: () => data.toISOString(), valueOf: () => ms, toString: () => data.toISOString() };
  }
  if (isRecord(data) && data._isTimestamp === true && typeof data.millis === 'number') {
    const ms = data.millis;
    const iso = typeof data.iso === 'string' ? data.iso : new Date(ms).toISOString();
    return { toDate: () => new Date(ms), toMillis: () => ms, getTime: () => ms, toISOString: () => iso, valueOf: () => ms, toString: () => iso };
  }
  const toMillis = callable(data, 'toMillis');
  if (toMillis) {
    const ms = Number(toMillis());
    if (Number.isFinite(ms)) return { toDate: () => new Date(ms), toMillis: () => ms, getTime: () => ms, toISOString: () => new Date(ms).toISOString(), valueOf: () => ms, toString: () => new Date(ms).toISOString() };
  }
  if (Array.isArray(data)) return data.map(wrapDurableData);
  if (!isRecord(data)) return data;
  const out: DurableData = {};
  for (const [key, value] of Object.entries(data)) out[key] = wrapDurableData(value);
  return out;
}

export function createDurableDocRef(fullPath: string): DurableDocRef {
  const parts = fullPath.split('/');
  const docId = parts[parts.length - 1] ?? '';
  return {
    id: docId,
    path: fullPath,
    get: async () => {
      const data = durableStore.getDoc(fullPath);
      return { id: docId, exists: data !== null, data: () => (data ? wrapDurableData(data) : undefined), ref: createDurableDocRef(fullPath) };
    },
    set: async (data: unknown, options?: unknown) => {
      const merge = isRecord(options) && options.merge === true;
      durableStore.setDoc(fullPath, data, merge);
    },
    update: async (data: unknown) => durableStore.updateDoc(fullPath, data),
    delete: async () => { durableStore.deleteDoc(fullPath); },
    collection: (subCol: string) => createDurableCollectionRef(`${fullPath}/${subCol}`),
  };
}

export function createDurableCollectionRef(colPath: string): DurableCollectionRef {
  return {
    path: colPath,
    doc: (docId?: string) => createDurableDocRef(`${colPath}/${docId || crypto.randomUUID()}`),
    add: async (data: unknown) => {
      const id = crypto.randomUUID();
      const ref = createDurableDocRef(`${colPath}/${id}`);
      await ref.set(data);
      return ref;
    },
    get: async () => {
      const docsData = durableStore.queryCollection(colPath);
      const docs = docsData.map(d => ({ id: d.id, exists: true, data: () => wrapDurableData(d.data), ref: createDurableDocRef(d.path) }));
      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (callback: (doc: DurableDocSnapshot) => void) => docs.forEach(callback),
      };
    },
    where: (field, op, val) => createDurableQuery(colPath, d => compare(d[field], op, val)),
    orderBy: (field, dir = 'asc') => createDurableQuery(colPath, undefined, undefined, field, dir),
    limit: n => createDurableQuery(colPath, undefined, n),
    startAfter: (...args) => createDurableQuery(colPath, undefined, undefined, undefined, undefined, args[0]),
  };
}

function compare(left: unknown, op: string, right: unknown): boolean {
  if (op === '==' || op === '===') return left === right;
  if (op === '!=') return left !== right;
  if (op === '>') return typeof left === 'number' && typeof right === 'number' ? left > right : String(left) > String(right);
  if (op === '>=') return typeof left === 'number' && typeof right === 'number' ? left >= right : String(left) >= String(right);
  if (op === '<') return typeof left === 'number' && typeof right === 'number' ? left < right : String(left) < String(right);
  if (op === '<=') return typeof left === 'number' && typeof right === 'number' ? left <= right : String(left) <= String(right);
  if (op === 'in' && Array.isArray(right)) return right.includes(left);
  return op === 'array-contains' && Array.isArray(left) ? left.includes(right) : true;
}

function createDurableQuery(
  colPath: string,
  filterFn?: (data: DurableData) => boolean,
  limitCount?: number,
  orderField?: string,
  orderDir?: 'asc' | 'desc',
  startAfterCursor?: unknown,
): DurableQuery {
  return {
    where: (field, op, val) => createDurableQuery(colPath, d => (filterFn ? filterFn(d) : true) && compare(d[field], op, val), limitCount, orderField, orderDir, startAfterCursor),
    orderBy: (field, dir = 'asc') => createDurableQuery(colPath, filterFn, limitCount, field, dir, startAfterCursor),
    limit: n => createDurableQuery(colPath, filterFn, n, orderField, orderDir, startAfterCursor),
    startAfter: (...args) => createDurableQuery(colPath, filterFn, limitCount, orderField, orderDir, args[0]),
    get: async () => {
      let docsData = durableStore.queryCollection(colPath, filterFn);
      if (orderField) {
        docsData.sort((a, b) => {
          const va = a.data[orderField];
          const vb = b.data[orderField];
          return compare(va, orderDir === 'desc' ? '>' : '<', vb) ? (orderDir === 'desc' ? -1 : 1) : 0;
        });
      }
      if (startAfterCursor !== undefined) {
        const cursorId = isRecord(startAfterCursor) && typeof startAfterCursor.id === 'string' ? startAfterCursor.id : String(startAfterCursor);
        const idx = docsData.findIndex(d => d.id === cursorId);
        if (idx !== -1) docsData = docsData.slice(idx + 1);
      }
      if (typeof limitCount === 'number' && limitCount >= 0) docsData = docsData.slice(0, limitCount);
      const docs = docsData.map(d => ({ id: d.id, exists: true, data: () => wrapDurableData(d.data), ref: createDurableDocRef(d.path) }));
      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (callback: (doc: DurableDocSnapshot) => void) => docs.forEach(callback),
      };
    },
  };
}

function realDocRef(value: DurableDocRefLike): DocumentReference | null {
  if (value._realDocRef) return value._realDocRef;
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.path === 'string' &&
    typeof value.get === 'function' &&
    typeof value.set === 'function' &&
    typeof value.update === 'function' &&
    property(value, 'parent') !== undefined
  ) {
    return value as unknown as DocumentReference;
  }
  return null;
}

function realErrorCode(error: unknown): unknown {
  return property(error, 'code') ?? (typeof property(error, 'status') === 'number' ? property(error, 'status') : undefined);
}

function realErrorMessage(error: unknown): string {
  return String(property(error, 'message') ?? property(error, 'details') ?? '');
}

export function createDurableDbProxy(realDb: Firestore | null): DurableDbProxy {
  const allowFallback = process.env.NODE_ENV === 'development' && process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true';
  let fallbackActive = !realDb && allowFallback;

  const isPermissionDenied = (error: unknown): boolean => {
    const code = realErrorCode(error);
    const msg = realErrorMessage(error);
    return code === 7 || code === 403 || code === 16 || code === 14 || code === 4 || code === 5 ||
      msg.includes('PERMISSION_DENIED') || msg.includes('Missing or insufficient permissions') ||
      msg.includes('credentials') || msg.includes('UNAUTHENTICATED') || msg.includes('UNAVAILABLE') ||
      msg.includes('DEADLINE_EXCEEDED') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') ||
      msg.includes('NOT_FOUND') || msg.includes('network') || msg.includes('timed out');
  };

  const wrapDocRef = (realRef: DocumentReference | null, fullPath: string): DurableDocRef => {
    const durableDoc = createDurableDocRef(fullPath);
    return {
      ...durableDoc,
      _realDocRef: realRef,
      get: async () => {
        if (!fallbackActive && realRef) {
          try {
            return await realRef.get();
          } catch (error: unknown) {
            if (allowFallback && isPermissionDenied(error)) {
              fallbackActive = true;
              return durableDoc.get();
            }
            throw error;
          }
        }
        return durableDoc.get();
      },
      set: async (data, options) => {
        if (!fallbackActive && realRef) {
          try {
            await realRef.set(data as never, options as never);
            void durableDoc.set(data, options).catch(() => {});
            return;
          } catch (error: unknown) {
            if (allowFallback && isPermissionDenied(error)) {
              fallbackActive = true;
              await durableDoc.set(data, options);
              return;
            }
            throw error;
          }
        }
        await durableDoc.set(data, options);
      },
      update: async data => {
        if (!fallbackActive && realRef) {
          try {
            await realRef.update(data as never);
            void durableDoc.update(data).catch(() => {});
            return;
          } catch (error: unknown) {
            if (allowFallback && isPermissionDenied(error)) {
              fallbackActive = true;
              await durableDoc.update(data);
              return;
            }
            throw error;
          }
        }
        await durableDoc.update(data);
      },
      delete: async () => {
        if (!fallbackActive && realRef) {
          try {
            await realRef.delete();
            void durableDoc.delete().catch(() => {});
            return;
          } catch (error: unknown) {
            if (allowFallback && isPermissionDenied(error)) {
              fallbackActive = true;
              await durableDoc.delete();
              return;
            }
            throw error;
          }
        }
        await durableDoc.delete();
      },
      collection: subCol => wrapColRef(realRef ? realRef.collection(subCol) : null, `${fullPath}/${subCol}`),
    };
  };

  const wrapQuery = (realQuery: Query | null, durableQuery: DurableQuery): DurableQuery => ({
    where: (field, op, val) => wrapQuery(realQuery ? realQuery.where(field, op as never, val) : null, durableQuery.where(field, op, val)),
    orderBy: (field, dir = 'asc') => wrapQuery(realQuery ? realQuery.orderBy(field, dir) : null, durableQuery.orderBy(field, dir)),
    limit: n => wrapQuery(realQuery ? realQuery.limit(n) : null, durableQuery.limit(n)),
    startAfter: (...args) => {
      if (realQuery) {
        try {
          const startAfter = (realQuery.startAfter as unknown as (...values: unknown[]) => Query)(...args);
          return wrapQuery(startAfter, durableQuery.startAfter(...args));
        } catch {
          // The durable query remains the deterministic fallback cursor implementation.
        }
      }
      return wrapQuery(null, durableQuery.startAfter(...args));
    },
    get: async () => {
      if (!fallbackActive && realQuery) {
        try {
          return await realQuery.get();
        } catch (error: unknown) {
          if (allowFallback && isPermissionDenied(error)) {
            fallbackActive = true;
            return durableQuery.get();
          }
          throw error;
        }
      }
      return durableQuery.get();
    },
  });

  const wrapColRef = (realRef: CollectionReference | null, colPath: string): DurableCollectionRef => {
    const durableCol = createDurableCollectionRef(colPath);
    return {
      path: colPath,
      doc: docId => {
        const id = docId || crypto.randomUUID();
        return wrapDocRef(realRef ? realRef.doc(id) : null, `${colPath}/${id}`);
      },
      add: async data => {
        if (!fallbackActive && realRef) {
          try {
            const res = await realRef.add(data as never);
            void durableCol.doc(res.id).set(data).catch(() => {});
            return wrapDocRef(res, `${colPath}/${res.id}`);
          } catch (error: unknown) {
            if (allowFallback && isPermissionDenied(error)) {
              fallbackActive = true;
              return durableCol.add(data);
            }
            throw error;
          }
        }
        return durableCol.add(data);
      },
      get: async () => {
        if (!fallbackActive && realRef) {
          try {
            return await realRef.get();
          } catch (error: unknown) {
            if (allowFallback && isPermissionDenied(error)) {
              fallbackActive = true;
              return durableCol.get();
            }
            throw error;
          }
        }
        return durableCol.get();
      },
      where: (field, op, val) => wrapQuery(realRef ? realRef.where(field, op as never, val) : null, durableCol.where(field, op, val)),
      orderBy: (field, dir = 'asc') => wrapQuery(realRef ? realRef.orderBy(field, dir) : null, durableCol.orderBy(field, dir)),
      limit: n => wrapQuery(realRef ? realRef.limit(n) : null, durableCol.limit(n)),
      startAfter: (...args) => {
        if (realRef) {
          try {
            const startAfter = (realRef.startAfter as unknown as (...values: unknown[]) => Query)(...args);
            return wrapQuery(startAfter, durableCol.startAfter(...args));
          } catch {
            // Fall through to durable cursor.
          }
        }
        return wrapQuery(null, durableCol.startAfter(...args));
      },
    };
  };

  return {
    collection: colPath => wrapColRef(realDb ? realDb.collection(colPath) : null, colPath),
    doc: docPath => {
      const lastSlash = docPath.lastIndexOf('/');
      if (lastSlash === -1 || lastSlash === docPath.length - 1) throw new Error(`Invalid docPath: ${docPath}`);
      const colPath = docPath.slice(0, lastSlash);
      const docId = docPath.slice(lastSlash + 1);
      return wrapColRef(realDb ? realDb.collection(colPath) : null, colPath).doc(docId);
    },
    runTransaction: async <T>(updateFunction: (tx: DurableTransaction) => Promise<T>): Promise<T> => {
      const execute = async (): Promise<T> => {
        if (!fallbackActive && realDb) {
          try {
            return await realDb.runTransaction(async (realTx: Transaction) => {
              const unwrap = (ref: DurableDocRef): DocumentReference => {
                const actual = realDocRef(ref);
                if (!actual) throw new Error('Durable transaction reference is not backed by Firestore.');
                return actual;
              };
              const wrappedTx: DurableTransaction = {
                get: async ref => realTx.get(unwrap(ref)),
                getAll: async (...refs) => realTx.getAll(...refs.map(unwrap)),
                set: (ref, data, options) => {
                  realTx.set(unwrap(ref), data as never, options as never);
                  void createDurableDocRef(ref.path).set(data, options).catch(() => {});
                  return wrappedTx;
                },
                create: (ref, data) => {
                  realTx.create(unwrap(ref), data as never);
                  void createDurableDocRef(ref.path).set(data).catch(() => {});
                  return wrappedTx;
                },
                update: (ref, data) => {
                  realTx.update(unwrap(ref), data as never);
                  void createDurableDocRef(ref.path).update(data).catch(() => {});
                  return wrappedTx;
                },
                delete: ref => {
                  realTx.delete(unwrap(ref));
                  void createDurableDocRef(ref.path).delete().catch(() => {});
                  return wrappedTx;
                },
              };
              return updateFunction(wrappedTx);
            });
          } catch (error: unknown) {
            if (allowFallback && isPermissionDenied(error)) fallbackActive = true;
            else throw error;
          }
        }

        const stagedWrites: Array<() => Promise<void>> = [];
        const tx: DurableTransaction = {
          get: ref => ref.get(),
          getAll: async (...refs) => Promise.all(refs.map(ref => tx.get(ref))),
          set: (ref, data, options) => { stagedWrites.push(() => ref.set(data, options)); return tx; },
          create: (ref, data) => { stagedWrites.push(() => ref.set(data)); return tx; },
          update: (ref, data) => { stagedWrites.push(() => ref.update(data)); return tx; },
          delete: ref => { stagedWrites.push(() => ref.delete()); return tx; },
        };
        const result = await updateFunction(tx);
        for (const write of stagedWrites) await write();
        return result;
      };

      const previous = txQueue;
      let resolveNext!: () => void;
      txQueue = new Promise<void>(resolve => { resolveNext = resolve; });
      try {
        await previous;
        return await observeFirestoreTransaction('runTransaction', execute);
      } finally {
        resolveNext();
      }
    },
    batch: () => {
      const operations: Array<() => Promise<void>> = [];
      const batch: {
        set: (ref: DurableDocRef, data: unknown, options?: unknown) => void;
        update: (ref: DurableDocRef, data: unknown) => void;
        delete: (ref: DurableDocRef) => void;
        commit: () => Promise<void>;
      } = {
        set: (ref, data, options) => { operations.push(() => ref.set(data, options)); },
        update: (ref, data) => { operations.push(() => ref.update(data)); },
        delete: ref => { operations.push(() => ref.delete()); },
        commit: async () => { for (const operation of operations) await operation(); },
      };
      return batch;
    },
    recursiveDelete: async ref => {
      const actual = realDocRef(ref);
      if (!fallbackActive && realDb && actual && typeof realDb.recursiveDelete === 'function') {
        try {
          await realDb.recursiveDelete(actual);
          return;
        } catch (error: unknown) {
          if (allowFallback && isPermissionDenied(error)) fallbackActive = true;
          else throw error;
        }
      }
      durableStore.deleteDoc(ref.path);
    },
  };
}

let txQueue: Promise<void> = Promise.resolve();
