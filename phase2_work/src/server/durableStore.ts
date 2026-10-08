import { observeFirestoreTransaction } from './observability';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import type { JsonObject } from '../types/strict';
export class DurableFirestoreStore {
  private filePath: string;
  private data: Record<string, JsonObject> = {};
  private isLoaded = false;

  constructor(storageDir = path.resolve(process.cwd(), '.data')) {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.filePath = path.join(storageDir, 'durable-firestore.json');
    this.load();
  }

  private load() {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(raw);
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

  private persistImmediate() {
    try {
      const tmpPath = `${this.filePath}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (e) {
      console.warn('Durable store write failed:', e);
    }
  }

  public getDoc(fullPath: string): JsonObject | null {
    this.load();
    const doc = this.data[fullPath];
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  }

  public setDoc(fullPath: string, incoming: JsonObject, merge = false): void {
    this.load();
    const processed = this.resolveFieldValues(incoming, this.data[fullPath]);
    if (merge && this.data[fullPath]) {
      this.data[fullPath] = this.deepMerge(this.data[fullPath], processed);
    } else {
      this.data[fullPath] = processed;
    }
    this.persistImmediate();
  }

  public updateDoc(fullPath: string, updates: JsonObject): void {
    this.load();
    if (!this.data[fullPath]) {
      this.data[fullPath] = {};
    }
    const processed = this.resolveFieldValues(updates, this.data[fullPath]);
    this.data[fullPath] = this.deepMerge(this.data[fullPath], processed);
    this.persistImmediate();
  }

  public deleteDoc(fullPath: string): void {
    this.load();
    delete this.data[fullPath];
    this.persistImmediate();
  }

  public queryCollection(colPrefix: string, filterFn?: (data: JsonObject) => boolean): Array<{ id: string; path: string; data: JsonObject }> {
    this.load();
    const results: Array<{ id: string; path: string; data: JsonObject }> = [];
    const prefix = colPrefix.endsWith('/') ? colPrefix : `${colPrefix}/`;

    for (const [key, val] of Object.entries(this.data)) {
      if (key.startsWith(prefix)) {
        const remaining = key.substring(prefix.length);
        if (!remaining.includes('/')) {
          if (!filterFn || filterFn(val)) {
            results.push({ id: remaining, path: key, data: JSON.parse(JSON.stringify(val)) });
          }
        }
      }
    }
    return results;
  }

  private resolveFieldValues(obj: unknown, existing?: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) {
      return { _isTimestamp: true, millis: obj.getTime(), iso: obj.toISOString() };
    }
    if (typeof obj.toMillis === 'function') {
      const ms = obj.toMillis();
      return { _isTimestamp: true, millis: ms, iso: new Date(ms).toISOString() };
    }
    if (typeof obj.toDate === 'function') {
      const ms = obj.toDate().getTime();
      return { _isTimestamp: true, millis: ms, iso: new Date(ms).toISOString() };
    }
    if (typeof obj !== 'object') return obj;

    // Check for sentinel FieldValues
    if (obj.constructor && obj.constructor.name === 'FieldValue') {
      const now = Date.now();
      return { _isTimestamp: true, millis: now, iso: new Date(now).toISOString() };
    }
    if (obj._methodName === 'serverTimestamp') {
      const now = Date.now();
      return { _isTimestamp: true, millis: now, iso: new Date(now).toISOString() };
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveFieldValues(item));
    }

    const out: JsonObject = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') {
        if (v instanceof Date) {
          out[k] = { _isTimestamp: true, millis: v.getTime(), iso: v.toISOString() };
          continue;
        }
        if (typeof (v as unknown).toMillis === 'function') {
          const ms = (v as unknown).toMillis();
          out[k] = { _isTimestamp: true, millis: ms, iso: new Date(ms).toISOString() };
          continue;
        }
        if (typeof (v as unknown).toDate === 'function') {
          const ms = (v as unknown).toDate().getTime();
          out[k] = { _isTimestamp: true, millis: ms, iso: new Date(ms).toISOString() };
          continue;
        }
        const constrName = v.constructor ? v.constructor.name : '';
        const methodName = (v as unknown)._methodName || (v as unknown).methodName;
        if (constrName.includes('ServerTimestamp') || methodName === 'serverTimestamp') {
          const now = Date.now();
          out[k] = { _isTimestamp: true, millis: now, iso: new Date(now).toISOString() };
          continue;
        }
        if (methodName === 'delete') {
          continue;
        }
        if (methodName === 'increment') {
          const inc = (v as unknown)._operand || (v as unknown).operand || 1;
          const prev = typeof existing?.[k] === 'number' ? existing[k] : 0;
          out[k] = prev + inc;
          continue;
        }
        if (methodName === 'arrayUnion') {
          const elements = (v as unknown)._elements || (v as unknown).elements || [];
          const prev = Array.isArray(existing?.[k]) ? existing[k] : [];
          const set = new Set([...prev, ...elements]);
          out[k] = Array.from(set);
          continue;
        }
        if (methodName === 'arrayRemove') {
          const elements = (v as unknown)._elements || (v as unknown).elements || [];
          const prev = Array.isArray(existing?.[k]) ? existing[k] : [];
          out[k] = prev.filter((item: unknown) => !elements.includes(item));
          continue;
        }
      }
      out[k] = this.resolveFieldValues(v, existing?.[k]);
    }
    return out;
  }

  private deepMerge(target: JsonObject, source: JsonObject): JsonObject {
    const output = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
          output[key] = this.deepMerge(target[key], value);
        } else {
          output[key] = value;
        }
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
  if (typeof data !== 'object') return data;
  if (data._isTimestamp && typeof data.millis === 'number') {
    const ms = data.millis;
    return {
      toDate: () => new Date(ms),
      toMillis: () => ms,
      getTime: () => ms,
      toISOString: () => data.iso || new Date(ms).toISOString(),
      valueOf: () => ms,
      toString: () => data.iso || new Date(ms).toISOString(),
    };
  }
  if (data instanceof Date) {
    const ms = data.getTime();
    return {
      toDate: () => new Date(ms),
      toMillis: () => ms,
      getTime: () => ms,
      toISOString: () => data.toISOString(),
      valueOf: () => ms,
      toString: () => data.toISOString(),
    };
  }
  if (typeof data.toMillis === 'function') {
    const ms = data.toMillis();
    return {
      toDate: () => new Date(ms),
      toMillis: () => ms,
      getTime: () => ms,
      toISOString: () => new Date(ms).toISOString(),
      valueOf: () => ms,
      toString: () => new Date(ms).toISOString(),
    };
  }
  if (Array.isArray(data)) return data.map(wrapDurableData);
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = wrapDurableData(v);
  }
  return out;
}

export function createDurableDocRef(fullPath: string): unknown {
  const parts = fullPath.split('/');
  const docId = parts[parts.length - 1];

  return {
    id: docId,
    path: fullPath,
    get: async () => {
      const data = durableStore.getDoc(fullPath);
      return {
        id: docId,
        exists: data !== null,
        data: () => (data ? wrapDurableData(data) : undefined),
        ref: createDurableDocRef(fullPath),
      };
    },
    set: async (data: JsonObject, options?: { merge?: boolean }) => {
      durableStore.setDoc(fullPath, data, options?.merge ?? false);
    },
    update: async (data: JsonObject) => {
      durableStore.updateDoc(fullPath, data);
    },
    delete: async () => {
      durableStore.deleteDoc(fullPath);
    },
    collection: (subCol: string) => {
      return createDurableCollectionRef(`${fullPath}/${subCol}`);
    },
  };
}

export function createDurableCollectionRef(colPath: string): unknown {
  return {
    path: colPath,
    doc: (docId?: string) => {
      const id = docId || crypto.randomUUID();
      return createDurableDocRef(`${colPath}/${id}`);
    },
    add: async (data: JsonObject) => {
      const id = crypto.randomUUID();
      const ref = createDurableDocRef(`${colPath}/${id}`);
      await ref.set(data);
      return ref;
    },
    get: async () => {
      const docsData = durableStore.queryCollection(colPath);
      const docs = docsData.map(d => ({
        id: d.id,
        exists: true,
        data: () => wrapDurableData(d.data),
        ref: createDurableDocRef(d.path),
      }));
      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (callback: (doc: unknown) => void) => docs.forEach(callback),
      };
    },
    where: (field: string, op: string, val: unknown) => {
      return createDurableQuery(colPath, (d) => {
        const itemVal = d[field];
        if (op === '==' || op === '===') return itemVal === val;
        if (op === '!=') return itemVal !== val;
        if (op === '>') return itemVal > val;
        if (op === '>=') return itemVal >= val;
        if (op === '<') return itemVal < val;
        if (op === '<=') return itemVal <= val;
        if (op === 'in' && Array.isArray(val)) return val.includes(itemVal);
        if (op === 'array-contains' && Array.isArray(itemVal)) return itemVal.includes(val);
        return true;
      });
    },
    orderBy: (field: string, dir?: 'asc' | 'desc') => {
      return createDurableQuery(colPath, undefined, undefined, field, dir);
    },
    limit: (limitCount: number) => {
      return createDurableQuery(colPath, undefined, limitCount);
    },
    startAfter: (cursor: unknown) => {
      return createDurableQuery(colPath, undefined, undefined, undefined, undefined, cursor);
    },
  };
}

function createDurableQuery(
  colPath: string,
  filterFn?: (data: JsonObject) => boolean,
  limitCount?: number,
  orderField?: string,
  orderDir?: 'asc' | 'desc',
  startAfterCursor?: unknown,
): unknown {
  return {
    where: (field: string, op: string, val: unknown) => {
      const newFilter = (d: JsonObject) => {
        if (filterFn && !filterFn(d)) return false;
        const itemVal = d[field];
        if (op === '==' || op === '===') return itemVal === val;
        if (op === '!=') return itemVal !== val;
        if (op === '>') return itemVal > val;
        if (op === '>=') return itemVal >= val;
        if (op === '<') return itemVal < val;
        if (op === '<=') return itemVal <= val;
        if (op === 'in' && Array.isArray(val)) return val.includes(itemVal);
        if (op === 'array-contains' && Array.isArray(itemVal)) return itemVal.includes(val);
        return true;
      };
      return createDurableQuery(colPath, newFilter, limitCount, orderField, orderDir, startAfterCursor);
    },
    orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') => {
      return createDurableQuery(colPath, filterFn, limitCount, field, dir, startAfterCursor);
    },
    limit: (n: number) => {
      return createDurableQuery(colPath, filterFn, n, orderField, orderDir, startAfterCursor);
    },
    startAfter: (cursor: unknown) => {
      return createDurableQuery(colPath, filterFn, limitCount, orderField, orderDir, cursor);
    },
    get: async () => {
      let docsData = durableStore.queryCollection(colPath, filterFn);
      if (orderField) {
        docsData.sort((a, b) => {
          const va = a.data[orderField];
          const vb = b.data[orderField];
          if (va < vb) return orderDir === 'desc' ? 1 : -1;
          if (va > vb) return orderDir === 'desc' ? -1 : 1;
          return 0;
        });
      }
      if (startAfterCursor) {
        const cursorId = typeof startAfterCursor === 'object' && startAfterCursor !== null && 'id' in startAfterCursor
          ? startAfterCursor.id
          : String(startAfterCursor);
        const idx = docsData.findIndex(d => d.id === cursorId);
        if (idx !== -1) {
          docsData = docsData.slice(idx + 1);
        }
      }
      if (typeof limitCount === 'number' && limitCount >= 0) {
        docsData = docsData.slice(0, limitCount);
      }
      const docs = docsData.map(d => ({
        id: d.id,
        exists: true,
        data: () => wrapDurableData(d.data),
        ref: createDurableDocRef(d.path),
      }));
      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (callback: (doc: unknown) => void) => docs.forEach(callback),
      };
    },
  };
}

let txQueue: Promise<unknown> = Promise.resolve();

export function createDurableDbProxy(realDb: unknown): unknown {
  const allowFallback = process.env.NODE_ENV === 'development' && process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true';
  let fallbackActive = !realDb && allowFallback;

  const isPermissionDenied = (err: unknown) => {
    if (!err) return false;
    const code = err.code ?? (typeof err.status === 'number' ? err.status : undefined);
    const msg = String(err.message || err.details || '');
    return code === 7 || code === 403 || code === 16 || code === 14 || code === 4 || code === 5 ||
      msg.includes('PERMISSION_DENIED') || msg.includes('Missing or insufficient permissions') ||
      msg.includes('credentials') || msg.includes('UNAUTHENTICATED') || msg.includes('UNAVAILABLE') ||
      msg.includes('DEADLINE_EXCEEDED') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') ||
      msg.includes('NOT_FOUND') || msg.includes('network') || msg.includes('timed out');
  };

  const wrapDocRef = (realDocRef: unknown, fullPath: string): unknown => {
    const durableDoc = createDurableDocRef(fullPath);
    return {
      _realDocRef: realDocRef,
      id: durableDoc.id,
      path: fullPath,
      get: async () => {
        if (!fallbackActive && realDocRef) {
          try {
            return await realDocRef.get();
          } catch (e: unknown) {
            if (allowFallback && isPermissionDenied(e)) {
              fallbackActive = true;
              return durableDoc.get();
            }
            throw e;
          }
        }
        return durableDoc.get();
      },
      set: async (data: unknown, options?: unknown) => {
        if (!fallbackActive && realDocRef) {
          try {
            await realDocRef.set(data, options);
            durableDoc.set(data, options).catch(() => {});
            return;
          } catch (e: unknown) {
            if (allowFallback && isPermissionDenied(e)) {
              fallbackActive = true;
              return durableDoc.set(data, options);
            }
            throw e;
          }
        }
        return durableDoc.set(data, options);
      },
      update: async (data: unknown) => {
        if (!fallbackActive && realDocRef) {
          try {
            await realDocRef.update(data);
            durableDoc.update(data).catch(() => {});
            return;
          } catch (e: unknown) {
            if (allowFallback && isPermissionDenied(e)) {
              fallbackActive = true;
              return durableDoc.update(data);
            }
            throw e;
          }
        }
        return durableDoc.update(data);
      },
      delete: async () => {
        if (!fallbackActive && realDocRef) {
          try {
            await realDocRef.delete();
            durableDoc.delete().catch(() => {});
            return;
          } catch (e: unknown) {
            if (allowFallback && isPermissionDenied(e)) {
              fallbackActive = true;
              return durableDoc.delete();
            }
            throw e;
          }
        }
        return durableDoc.delete();
      },
      collection: (subCol: string) => wrapColRef(realDocRef ? realDocRef.collection(subCol) : null, `${fullPath}/${subCol}`),
    };
  };

  const wrapColRef = (realColRef: unknown, colPath: string): unknown => {
    const durableCol = createDurableCollectionRef(colPath);

    const wrapQuery = (realQ: unknown, durableQ: unknown): unknown => ({
      where: (f: string, o: string, v: unknown) =>
        wrapQuery(realQ ? realQ.where(f, o, v) : null, durableQ.where(f, o, v)),
      orderBy: (f: string, d?: unknown) =>
        wrapQuery(realQ ? realQ.orderBy(f, d) : null, durableQ.orderBy(f, d)),
      limit: (n: number) =>
        wrapQuery(realQ ? realQ.limit(n) : null, durableQ.limit(n)),
      startAfter: (...args: unknown[]) => {
        let nextRealQ: unknown = null;
        if (realQ && typeof realQ.startAfter === 'function') {
          try {
            nextRealQ = realQ.startAfter(...args);
          } catch {
            nextRealQ = null;
          }
        }
        return wrapQuery(nextRealQ, durableQ.startAfter(...args));
      },
      get: async () => {
        if (!fallbackActive && realQ) {
          try {
            return await realQ.get();
          } catch (e: unknown) {
            if (allowFallback && isPermissionDenied(e)) {
              fallbackActive = true;
              return durableQ.get();
            }
            throw e;
          }
        }
        return durableQ.get();
      },
    });

    return {
      path: colPath,
      doc: (docId?: string) => {
        const id = docId || crypto.randomUUID();
        return wrapDocRef(realColRef ? realColRef.doc(id) : null, `${colPath}/${id}`);
      },
      add: async (data: unknown) => {
        if (!fallbackActive && realColRef) {
          try {
            const res = await realColRef.add(data);
            durableCol.doc(res.id).set(data).catch(() => {});
            return wrapDocRef(res, `${colPath}/${res.id}`);
          } catch (e: unknown) {
            if (allowFallback && isPermissionDenied(e)) {
              fallbackActive = true;
              return durableCol.add(data);
            }
            throw e;
          }
        }
        return durableCol.add(data);
      },
      get: async () => {
        if (!fallbackActive && realColRef) {
          try {
            return await realColRef.get();
          } catch (e: unknown) {
            if (allowFallback && isPermissionDenied(e)) {
              fallbackActive = true;
              return durableCol.get();
            }
            throw e;
          }
        }
        return durableCol.get();
      },
      where: (field: string, op: string, val: unknown) =>
        wrapQuery(realColRef ? realColRef.where(field, op, val) : null, durableCol.where(field, op, val)),
      orderBy: (field: string, dir?: unknown) =>
        wrapQuery(realColRef ? realColRef.orderBy(field, dir) : null, durableCol.orderBy(field, dir)),
      limit: (n: number) =>
        wrapQuery(realColRef ? realColRef.limit(n) : null, durableCol.limit(n)),
      startAfter: (...args: unknown[]) =>
        wrapQuery(realColRef && typeof realColRef.startAfter === 'function' ? realColRef.startAfter(...args) : null, durableCol.startAfter(...args)),
    };
  };

  return {
    collection: (colPath: string) => wrapColRef(realDb ? realDb.collection(colPath) : null, colPath),
    doc: (docPath: string) => {
      const lastSlash = docPath.lastIndexOf('/');
      if (lastSlash === -1) {
        throw new Error(`Invalid docPath: ${docPath}`);
      }
      const colPath = docPath.slice(0, lastSlash);
      const docId = docPath.slice(lastSlash + 1);
      return wrapColRef(realDb ? realDb.collection(colPath) : null, colPath).doc(docId);
    },
    runTransaction: async (updateFunction: (tx: unknown) => Promise<unknown>) => {
      const execute = async () => {
        if (!fallbackActive && realDb) {
          try {
            return await realDb.runTransaction(async (realTx: unknown) => {
              const wrappedTx = {
                get: async (ref: unknown) => {
                  const unwrapped = ref?._realDocRef || ref;
                  return await realTx.get(unwrapped);
                },
                getAll: async (...refs: unknown[]) => {
                  const unwrapped = refs.map((ref: unknown) => ref?._realDocRef || ref);
                  if (typeof realTx.getAll === 'function') {
                    return await realTx.getAll(...unwrapped);
                  }
                  return await Promise.all(unwrapped.map((r: unknown) => realTx.get(r)));
                },
                set: (ref: unknown, data: unknown, options?: unknown) => {
                  const unwrapped = ref?._realDocRef || ref;
                  realTx.set(unwrapped, data, options);
                  if (ref?.path) {
                    createDurableDocRef(ref.path).set(data, options).catch(() => {});
                  }
                  return wrappedTx;
                },
                create: (ref: unknown, data: unknown) => {
                  const unwrapped = ref?._realDocRef || ref;
                  realTx.create(unwrapped, data);
                  if (ref?.path) {
                    createDurableDocRef(ref.path).set(data).catch(() => {});
                  }
                  return wrappedTx;
                },
                update: (ref: unknown, data: unknown) => {
                  const unwrapped = ref?._realDocRef || ref;
                  realTx.update(unwrapped, data);
                  if (ref?.path) {
                    createDurableDocRef(ref.path).update(data).catch(() => {});
                  }
                  return wrappedTx;
                },
                delete: (ref: unknown) => {
                  const unwrapped = ref?._realDocRef || ref;
                  realTx.delete(unwrapped);
                  if (ref?.path) {
                    createDurableDocRef(ref.path).delete().catch(() => {});
                  }
                  return wrappedTx;
                },
              };
              return await updateFunction(wrappedTx);
            });
          } catch (e: unknown) {
            if (allowFallback && isPermissionDenied(e)) {
              fallbackActive = true;
            } else {
              throw e;
            }
          }
        }
        const stagedWrites: Array<() => Promise<void>> = [];
        const tx = {
          get: async (ref: unknown) => ref.get(),
          getAll: async (...refs: unknown[]) => {
            return await Promise.all(refs.map((r: unknown) => tx.get(r)));
          },
          set: (ref: unknown, data: unknown, options?: unknown) => {
            stagedWrites.push(() => ref.set(data, options));
            return tx;
          },
          create: (ref: unknown, data: unknown) => {
            stagedWrites.push(() => ref.set(data));
            return tx;
          },
          update: (ref: unknown, data: unknown) => {
            stagedWrites.push(() => ref.update(data));
            return tx;
          },
          delete: (ref: unknown) => {
            stagedWrites.push(() => ref.delete());
            return tx;
          },
        };
        const result = await updateFunction(tx);
        for (const write of stagedWrites) {
          await write();
        }
        return result;
      };

      const prev = txQueue;
      let resolveNext: (val?: unknown) => void;
      txQueue = new Promise((resolve) => {
        resolveNext = resolve;
      });

      try {
        await prev;
        return await observeFirestoreTransaction('runTransaction', execute);
      } finally {
        resolveNext!();
      }
    },
    batch: () => {
      const operations: Array<() => Promise<void>> = [];
      return {
        set: (ref: unknown, data: unknown, options?: unknown) => {
          operations.push(() => ref.set(data, options));
        },
        update: (ref: unknown, data: unknown) => {
          operations.push(() => ref.update(data));
        },
        delete: (ref: unknown) => {
          operations.push(() => ref.delete());
        },
        commit: async () => {
          for (const op of operations) {
            await op();
          }
        },
      };
    },
    recursiveDelete: async (ref: unknown) => {
      const unwrapped = ref?._realDocRef || ref;
      if (!fallbackActive && realDb && typeof realDb.recursiveDelete === 'function' && unwrapped && typeof unwrapped.get === 'function') {
        try {
          return await realDb.recursiveDelete(unwrapped);
        } catch (e: unknown) {
          if (allowFallback && isPermissionDenied(e)) {
            fallbackActive = true;
          } else {
            throw e;
          }
        }
      }
      const targetPath = ref?.path;
      if (targetPath) {
        durableStore.deleteDoc(targetPath);
      }
    },
  };
}
