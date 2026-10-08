import type { JsonObject } from '../types/strict';
import { isRecord } from '../types/strict';

/**
 * In-memory fallback Firestore implementation for AI Studio sandbox environments
 * where Google Cloud Application Default Credentials (ADC) lack IAM permissions
 * on the production Firestore instance.
 *
 * This ensures that all server-side operations (quota, verification, chats, subscriptions,
 * founding member claims, age verification, consent) succeed smoothly with full in-memory
 * state persistence across the session without throwing 7 PERMISSION_DENIED.
 */

export class MemoryTimestamp {
  constructor(private readonly _millis: number) {}
  get seconds(): number { return Math.floor(this._millis / 1000); }
  get nanoseconds(): number { return (this._millis % 1000) * 1e6; }
  toDate(): Date { return new Date(this._millis); }
  toMillis(): number { return this._millis; }
  getTime(): number { return this._millis; }
  toISOString(): string { return new Date(this._millis).toISOString(); }
  valueOf(): number { return this._millis; }
  isEqual(other: unknown): boolean {
    if (other instanceof Date) return other.getTime() === this._millis;
    if (isRecord(other) && typeof other.toMillis === 'function') {
      return other.toMillis() === this._millis;
    }
    return false;
  }
}

interface MemoryDocumentReference {
  id: string;
  path: string;
  get: () => Promise<MemorySnapshot>;
  set: (data: unknown, options?: { merge?: boolean }) => Promise<{ writeTime: Date }>;
  update: (data: unknown) => Promise<{ writeTime: Date }>;
  delete: () => Promise<{ writeTime: Date }>;
  collection: (subColName: string) => unknown;
}

interface MemoryTransaction {
  get: (docRef: MemoryDocumentReference) => Promise<MemorySnapshot>;
  set: (docRef: MemoryDocumentReference, data: unknown, options?: { merge?: boolean }) => void;
  update: (docRef: MemoryDocumentReference, data: unknown) => void;
  delete: (docRef: MemoryDocumentReference) => void;
}

function cloneValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (val instanceof MemoryTimestamp) return new MemoryTimestamp(val.toMillis());
  if (val instanceof Date) return new MemoryTimestamp(val.getTime());
  if (isRecord(val) && typeof val.toMillis === 'function') return new MemoryTimestamp(val.toMillis());
  if (isRecord(val) && typeof val.toDate === 'function') return new MemoryTimestamp(val.toDate().getTime());
  if (Array.isArray(val)) return val.map(cloneValue);
  const copy: JsonObject = {};
  for (const [k, v] of Object.entries(val)) {
    copy[k] = cloneValue(v);
  }
  return copy;
}

class MemorySnapshot {
  constructor(
    public readonly id: string,
    private readonly _data: JsonObject | undefined,
    public readonly ref: unknown,
  ) {}

  get exists(): boolean {
    return this._data !== undefined && this._data !== null;
  }

  data(): JsonObject | undefined {
    if (!this.exists) return undefined;
    const cloned = cloneValue(this._data);
    return isRecord(cloned) ? cloned : undefined;
  }
}

class MemoryQuerySnapshot {
  constructor(public readonly docs: MemorySnapshot[]) {}

  get size(): number {
    return this.docs.length;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  forEach(callback: (doc: MemorySnapshot) => void): void {
    this.docs.forEach(callback);
  }
}

export class InMemoryFirestore {
  private documents = new Map<string, JsonObject>();

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    // Cohorts & launch promo
    this.documents.set('cohorts/founding_500', {
      count: 42,
      updatedAt: new Date().toISOString(),
    });
    this.documents.set('promo/founding_member', {
      claimedCount: 42,
      updatedAt: new Date().toISOString(),
    });
    this.documents.set('config/maintenance', {
      active: false,
      message: 'Reguläre Wartung',
    });
  }

  private cleanData(data: unknown): JsonObject | unknown {
    if (!data || typeof data !== 'object') return data;
    if (data instanceof MemoryTimestamp) return new MemoryTimestamp(data.toMillis());
    if (data instanceof Date) return new MemoryTimestamp(data.getTime());
    if (isRecord(data) && typeof data.toMillis === 'function') return new MemoryTimestamp(data.toMillis());
    if (isRecord(data) && typeof data.toDate === 'function') return new MemoryTimestamp(data.toDate().getTime());
    if (Array.isArray(data)) return data.map(item => this.cleanData(item));

    const cleaned: JsonObject = {};
    for (const [key, value] of Object.entries(data)) {
      // Handle FieldValue.serverTimestamp or FieldValue.delete
      if (isRecord(value) && (value.constructor?.name === 'ServerTimestampTransform' || value._methodName === 'serverTimestamp')) {
        cleaned[key] = new MemoryTimestamp(Date.now());
      } else if (value === '__DELETE_FIELD__' || (isRecord(value) && value._methodName === 'delete')) {
        // Skip deleted field
        continue;
      } else {
        cleaned[key] = this.cleanData(value);
      }
    }
    return cleaned;
  }

  doc(docPath: string): MemoryDocumentReference {
    const parts = docPath.replace(/^\/+|\/+$/g, '').split('/');
    const docId = parts[parts.length - 1];
    const colPath = parts.slice(0, -1).join('/');

    return {
      id: docId,
      path: docPath,
      get: async () => {
        let existing = this.documents.get(docPath);
        // If querying a user doc that doesn't exist yet, return a safe default user
        if (!existing && colPath === 'users') {
          existing = {
            uid: docId,
            isAdult: true,
            isVerified: false,
            contactCount: 0,
            contactDay: new Date().toISOString().slice(0, 10),
            plan: 'frei',
            einwilligung: { ki_auswertung: true, analytik: true },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          this.documents.set(docPath, existing);
        }
        return new MemorySnapshot(docId || '', existing, this.doc(docPath));
      },
      set: async (data: unknown, options?: { merge?: boolean }) => {
        const cleaned = this.cleanData(data);
        if (!isRecord(cleaned)) throw new TypeError('Document data must be an object');
        if (options?.merge) {
          const prev = this.documents.get(docPath) || {};
          this.documents.set(docPath, { ...prev, ...cleaned });
        } else {
          this.documents.set(docPath, cleaned);
        }
        return { writeTime: new Date() };
      },
      update: async (data: unknown) => {
        const cleaned = this.cleanData(data);
        if (!isRecord(cleaned)) throw new TypeError('Document data must be an object');
        const prev = this.documents.get(docPath) || {};
        this.documents.set(docPath, { ...prev, ...cleaned });
        return { writeTime: new Date() };
      },
      delete: async () => {
        this.documents.delete(docPath);
        return { writeTime: new Date() };
      },
      collection: (subColName: string) => this.collection(`${docPath}/${subColName}`),
    };
  }

  collection(colPath: string): unknown {
    const normalizedCol = colPath.replace(/^\/+|\/+$/g, '');

    const createQuery = (
      filters: Array<{ field: string; op: string; val: unknown }> = [],
      limitNum?: number,
      orderField?: string,
      orderDir?: 'asc' | 'desc',
      startAfterCursor?: unknown,
    ) => ({
      where(field: string, op: string, val: unknown) {
        return createQuery([...filters, { field, op, val }], limitNum, orderField, orderDir, startAfterCursor);
      },
      orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
        return createQuery(filters, limitNum, field, dir, startAfterCursor);
      },
      limit(n: number) {
        return createQuery(filters, n, orderField, orderDir, startAfterCursor);
      },
      startAfter(cursor: unknown) {
        return createQuery(filters, limitNum, orderField, orderDir, cursor);
      },
      get: async () => {
        const matching: MemorySnapshot[] = [];
        const prefix = `${normalizedCol}/`;

        for (const [key, value] of this.documents.entries()) {
          if (!key.startsWith(prefix)) continue;
          const subPath = key.slice(prefix.length);
          // Check that it's a direct child
          if (subPath.includes('/')) continue;

          let matches = true;
          for (const f of filters) {
            const actual = value[f.field];
            if (f.op === '==') {
              if (actual !== f.val) matches = false;
            } else if (f.op === '!=') {
              if (actual === f.val) matches = false;
            } else if (f.op === 'array-contains') {
              if (!Array.isArray(actual) || !actual.includes(f.val)) matches = false;
            } else if (f.op === 'in') {
              if (!Array.isArray(f.val) || !f.val.includes(actual)) matches = false;
            }
            if (!matches) break;
          }

          if (matches) {
            matching.push(new MemorySnapshot(subPath, value, this.doc(key)));
          }
        }

        if (orderField) {
          matching.sort((a, b) => {
            const va = a.data()?.[orderField];
            const vb = b.data()?.[orderField];
            const left = typeof va === 'number' || typeof va === 'string' ? va : String(va ?? '');
            const right = typeof vb === 'number' || typeof vb === 'string' ? vb : String(vb ?? '');
            if (left < right) return orderDir === 'desc' ? 1 : -1;
            if (left > right) return orderDir === 'desc' ? -1 : 1;
            return 0;
          });
        }

        let filtered = matching;
        if (startAfterCursor) {
          const cursorId = typeof startAfterCursor === 'object' && startAfterCursor !== null && 'id' in startAfterCursor
            ? startAfterCursor.id
            : String(startAfterCursor);
          const idx = filtered.findIndex(d => d.id === cursorId);
          if (idx !== -1) {
            filtered = filtered.slice(idx + 1);
          }
        }

        const finalDocs = typeof limitNum === 'number' ? filtered.slice(0, limitNum) : filtered;
        return new MemoryQuerySnapshot(finalDocs);
      },
    });

    return {
      doc: (docId?: string) => {
        const id = docId || `doc_${Date.now()}_${crypto.randomUUID()}`;
        return this.doc(`${normalizedCol}/${id}`);
      },
      add: async (data: unknown) => {
        const id = `doc_${Date.now()}_${crypto.randomUUID()}`;
        const docRef = this.doc(`${normalizedCol}/${id}`);
        await docRef.set(data);
        return docRef;
      },
      ...createQuery(),
    };
  }

  async runTransaction<T>(updateFunction: (transaction: MemoryTransaction) => Promise<T>): Promise<T> {
    const tx: MemoryTransaction = {
      get: async (docRef: MemoryDocumentReference) => docRef.get(),
      set: (docRef, data, options) => { void docRef.set(data, options); },
      update: (docRef, data) => { void docRef.update(data); },
      delete: (docRef) => { void docRef.delete(); },
    };
    return updateFunction(tx);
  }

  batch(): {
    set: (docRef: MemoryDocumentReference, data: unknown, options?: { merge?: boolean }) => InMemoryFirestore;
    update: (docRef: MemoryDocumentReference, data: unknown) => InMemoryFirestore;
    delete: (docRef: MemoryDocumentReference) => InMemoryFirestore;
    commit: () => Promise<void>;
  } {
    const operations: Array<() => Promise<unknown>> = [];
    return {
      set: (docRef: MemoryDocumentReference, data: unknown, options?: { merge?: boolean }) => {
        operations.push(() => docRef.set(data, options));
        return this;
      },
      update: (docRef: MemoryDocumentReference, data: unknown) => {
        operations.push(() => docRef.update(data));
        return this;
      },
      delete: (docRef: MemoryDocumentReference) => {
        operations.push(() => docRef.delete());
        return this;
      },
      commit: async () => {
        for (const op of operations) {
          await op();
        }
      },
    };
  }
}
