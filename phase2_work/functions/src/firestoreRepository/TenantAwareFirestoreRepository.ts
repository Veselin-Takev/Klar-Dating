import type { Firestore, DocumentData, WhereFilterOp, Query } from 'firebase-admin/firestore';
export interface RuntimeSchema<T> { parse(input: unknown): T }
export interface TenantQuery { limit: number; orderBy?: string; orderDirection?: 'asc' | 'desc'; whereAll?: readonly (readonly [string, WhereFilterOp, unknown])[]; startAfter?: string; where?: readonly [string, WhereFilterOp, unknown] }
export interface TenantRow<T> { id: string; data: T }
export interface TenantTransaction {
  read<T>(path: string, schema: RuntimeSchema<T>): Promise<T | null>;
  list<T>(path: string, schema: RuntimeSchema<T>, query: TenantQuery): Promise<TenantRow<T>[]>;
  write<T extends DocumentData>(path: string, schema: RuntimeSchema<T>, input: unknown, options?: {merge:true}): void;
  create<T extends DocumentData>(path: string, schema: RuntimeSchema<T>, input: unknown): void;
  delete(path: string): void;
}
/** Canonical repository shared by Functions and API. Never exposes native refs/db. */
export class TenantAwareFirestoreRepository {
  readonly #db: Firestore;
  readonly #prefix: string;
  constructor(db: Firestore, tenantId: string) {
    if (typeof tenantId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(tenantId)) throw new Error('tenant_id_invalid');
    this.#db = db; this.#prefix = `tenants/${tenantId}/`;
  }
  #path(path: string, document: boolean): string {
    if (typeof path !== 'string') throw new Error('tenant_document_path_invalid');
    const parts = path.split('/');
    if (parts.length < (document ? 2 : 1) || (parts.length % 2 === 0) !== document || parts[0] === 'tenants'
        || parts.some((part, index) => !(index % 2 === 1 ? /^[A-Za-z0-9_:-]+$/ : /^[A-Za-z0-9_-]+$/).test(part))) throw new Error('tenant_document_path_invalid');
    return this.#prefix + path;
  }
  #query(path: string, options: TenantQuery): Query {
    if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 200) throw new Error('tenant_query_limit_invalid');
    let query: Query = this.#db.collection(this.#path(path, false));
    if (options.where) query = query.where(...options.where);
    if (options.whereAll) for (const clause of options.whereAll) query = query.where(...clause);
    if (options.orderBy) query = query.orderBy(options.orderBy, options.orderDirection ?? 'asc');
    if (options.startAfter !== undefined) {
      if (options.orderBy !== '__name__' || !/^[A-Za-z0-9_:-]+$/.test(options.startAfter)) throw new Error('tenant_cursor_invalid');
      query = query.startAfter(options.startAfter);
    }
    return query.limit(options.limit);
  }
  async read<T>(path: string, schema: RuntimeSchema<T>): Promise<T | null> {
    const snap = await this.#db.doc(this.#path(path, true)).get();
    return snap.exists ? schema.parse(snap.data()) : null;
  }
  async write<T extends DocumentData>(path: string, schema: RuntimeSchema<T>, input: unknown, options?: {merge: true}): Promise<void> {
    const scoped = this.#path(path, true), data = schema.parse(input);
    if (options) await this.#db.doc(scoped).set(data, options);
    else await this.#db.doc(scoped).set(data);
  }
  async create<T extends DocumentData>(path: string, schema: RuntimeSchema<T>, input: unknown): Promise<void> {
    const scoped = this.#path(path, true), data = schema.parse(input);
    await this.#db.doc(scoped).create(data);
  }
  async delete(path: string): Promise<void> { await this.#db.doc(this.#path(path, true)).delete(); }
  async list<T>(path: string, schema: RuntimeSchema<T>, options: TenantQuery): Promise<TenantRow<T>[]> {
    return (await this.#query(path, options).get()).docs.map(doc => ({id: doc.id, data: schema.parse(doc.data())}));
  }
  /** Exhaustive bounded export/read. Never silently truncates at a page boundary. */
  async listAll<T>(path: string, schema: RuntimeSchema<T>, options: Pick<TenantQuery, 'where' | 'whereAll'> = {}, maxRows = 10_000): Promise<TenantRow<T>[]> {
    if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10_000) throw new Error('tenant_scan_limit_invalid');
    const rows: TenantRow<T>[] = [];
    let cursor: string | undefined;
    for (;;) {
      const pageSize = Math.min(200, maxRows - rows.length + 1);
      const page = await this.list(path, schema, {...options, orderBy: '__name__', limit: pageSize, ...(cursor ? {startAfter: cursor} : {})});
      rows.push(...page);
      if (rows.length > maxRows) throw new Error('tenant_scan_limit_exceeded');
      if (page.length < pageSize) return rows;
      cursor = page[page.length - 1]!.id;
    }
  }
  /** Recursive removal stays inside the same validated tenant capability. */
  async deleteTree(path: string): Promise<void> { await this.#db.recursiveDelete(this.#db.doc(this.#path(path, true))); }
  async transaction<T>(callback: (tx: TenantTransaction) => Promise<T>): Promise<T> {
    return this.#db.runTransaction(native => callback({
      read: async <V>(path: string, schema: RuntimeSchema<V>) => {
        const snap = await native.get(this.#db.doc(this.#path(path, true)));
        return snap.exists ? schema.parse(snap.data()) : null;
      },
      list: async <V>(path: string, schema: RuntimeSchema<V>, options: TenantQuery) =>
        (await native.get(this.#query(path, options))).docs.map(doc => ({id: doc.id, data: schema.parse(doc.data())})),
      write: <V extends DocumentData>(path: string, schema: RuntimeSchema<V>, input: unknown, options?: {merge:true}) => {
        const scoped = this.#path(path, true), data = schema.parse(input);
        if (options) native.set(this.#db.doc(scoped), data, options);
        else native.set(this.#db.doc(scoped), data);
      },
      create: <V extends DocumentData>(path: string, schema: RuntimeSchema<V>, input: unknown) => {
        const scoped = this.#path(path, true), data = schema.parse(input);
        native.create(this.#db.doc(scoped), data);
      },
      delete: (path: string) => { native.delete(this.#db.doc(this.#path(path, true))); },
    }));
  }
}
