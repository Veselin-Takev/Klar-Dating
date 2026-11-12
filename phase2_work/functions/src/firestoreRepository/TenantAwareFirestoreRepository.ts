import type {
  Firestore,
  DocumentData,
  WhereFilterOp,
  Query,
} from 'firebase-admin/firestore';
export interface RuntimeSchema<T> {
  parse(input: unknown): T;
}
export interface TenantQuery {
  limit: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  whereAll?: readonly (readonly [string, WhereFilterOp, unknown])[];
  startAfter?: string;
  where?: readonly [string, WhereFilterOp, unknown];
}
export interface TenantRow<T> {
  id: string;
  data: T;
}
export interface TenantTransaction {
  read<T>(path: string, schema: RuntimeSchema<T>): Promise<T | null>;
  list<T>(
    path: string,
    schema: RuntimeSchema<T>,
    query: TenantQuery,
  ): Promise<TenantRow<T>[]>;
  write<T extends DocumentData>(
    path: string,
    schema: RuntimeSchema<T>,
    input: unknown,
    options?: { merge: true },
  ): void;
  create<T extends DocumentData>(
    path: string,
    schema: RuntimeSchema<T>,
    input: unknown,
  ): void;
  delete(path: string): void;
}
/** Infrastructure port for explicit local stores; paths are always prefixed by the repository. */
export interface RepositoryStoreTransaction {
  read(path: string): Promise<unknown | null>;
  list(path: string, query: TenantQuery): Promise<TenantRow<unknown>[]>;
  write(path: string, data: DocumentData, options?: { merge: true }): void;
  create(path: string, data: DocumentData): void;
  delete(path: string): void;
}
export interface RepositoryStore {
  readonly kind: 'tenant-local-store';
  read(path: string): Promise<unknown | null>;
  list(path: string, query: TenantQuery): Promise<TenantRow<unknown>[]>;
  write(
    path: string,
    data: DocumentData,
    options?: { merge: true },
  ): Promise<void>;
  create(path: string, data: DocumentData): Promise<void>;
  delete(path: string): Promise<void>;
  deleteTree(path: string): Promise<void>;
  transaction<T>(
    work: (tx: RepositoryStoreTransaction) => Promise<T>,
  ): Promise<T>;
}
function isLocalStore(db: Firestore | RepositoryStore): db is RepositoryStore {
  return 'kind' in db && db.kind === 'tenant-local-store';
}
/** Canonical repository shared by Functions and API. Never exposes native refs/db. */
export class TenantAwareFirestoreRepository {
  readonly #db: Firestore | null;
  readonly #store: RepositoryStore | null;
  readonly #prefix: string;
  readonly #observe: <T>(work: () => Promise<T>) => Promise<T>;
  constructor(
    db: Firestore | RepositoryStore,
    tenantId: string,
    observe: <T>(work: () => Promise<T>) => Promise<T> = (work) => work(),
  ) {
    if (typeof tenantId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(tenantId))
      throw new Error('tenant_id_invalid');
    this.#observe = observe;
    this.#db = isLocalStore(db) ? null : db;
    this.#store = isLocalStore(db) ? db : null;
    this.#prefix = `tenants/${tenantId}/`;
  }
  #path(path: string, document: boolean): string {
    if (typeof path !== 'string')
      throw new Error('tenant_document_path_invalid');
    const parts = path.split('/');
    if (
      parts.length < (document ? 2 : 1) ||
      (parts.length % 2 === 0) !== document ||
      parts[0] === 'tenants' ||
      parts.some(
        (part, index) =>
          !(index % 2 === 1 ? /^[A-Za-z0-9_:-]+$/ : /^[A-Za-z0-9_-]+$/).test(
            part,
          ),
      )
    )
      throw new Error('tenant_document_path_invalid');
    return this.#prefix + path;
  }
  #validateQuery(options: TenantQuery): void {
    if (
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      options.limit > 200
    )
      throw new Error('tenant_query_limit_invalid');
    if (
      options.startAfter !== undefined &&
      (options.orderBy !== '__name__' ||
        !/^[A-Za-z0-9_:-]+$/.test(options.startAfter))
    )
      throw new Error('tenant_cursor_invalid');
  }
  #query(path: string, options: TenantQuery): Query {
    this.#validateQuery(options);
    let query: Query = this.#db!.collection(this.#path(path, false));
    if (options.where) query = query.where(...options.where);
    if (options.whereAll)
      for (const clause of options.whereAll) query = query.where(...clause);
    if (options.orderBy)
      query = query.orderBy(options.orderBy, options.orderDirection ?? 'asc');
    if (options.startAfter !== undefined) {
      if (
        options.orderBy !== '__name__' ||
        !/^[A-Za-z0-9_:-]+$/.test(options.startAfter)
      )
        throw new Error('tenant_cursor_invalid');
      query = query.startAfter(options.startAfter);
    }
    return query.limit(options.limit);
  }
  async read<T>(path: string, schema: RuntimeSchema<T>): Promise<T | null> {
    const scoped = this.#path(path, true);
    if (this.#store) {
      const data = await this.#store.read(scoped);
      return data === null ? null : schema.parse(data);
    }
    const snap = await this.#db!.doc(scoped).get();
    return snap.exists ? schema.parse(snap.data()) : null;
  }
  async write<T extends DocumentData>(
    path: string,
    schema: RuntimeSchema<T>,
    input: unknown,
    options?: { merge: true },
  ): Promise<void> {
    const scoped = this.#path(path, true),
      data = schema.parse(input);
    if (this.#store) return this.#store.write(scoped, data, options);
    if (options) await this.#db!.doc(scoped).set(data, options);
    else await this.#db!.doc(scoped).set(data);
  }
  async create<T extends DocumentData>(
    path: string,
    schema: RuntimeSchema<T>,
    input: unknown,
  ): Promise<void> {
    const scoped = this.#path(path, true),
      data = schema.parse(input);
    if (this.#store) return this.#store.create(scoped, data);
    await this.#db!.doc(scoped).create(data);
  }
  async delete(path: string): Promise<void> {
    const scoped = this.#path(path, true);
    if (this.#store) return this.#store.delete(scoped);
    await this.#db!.doc(scoped).delete();
  }
  async list<T>(
    path: string,
    schema: RuntimeSchema<T>,
    options: TenantQuery,
  ): Promise<TenantRow<T>[]> {
    this.#validateQuery(options);
    if (this.#store)
      return (await this.#store.list(this.#path(path, false), options)).map(
        (row) => ({ id: row.id, data: schema.parse(row.data) }),
      );
    return (await this.#query(path, options).get()).docs.map((doc) => ({
      id: doc.id,
      data: schema.parse(doc.data()),
    }));
  }
  /** Exhaustive bounded export/read. Never silently truncates at a page boundary. */
  async listAll<T>(
    path: string,
    schema: RuntimeSchema<T>,
    options: Pick<TenantQuery, 'where' | 'whereAll'> = {},
    maxRows = 10_000,
  ): Promise<TenantRow<T>[]> {
    if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10_000)
      throw new Error('tenant_scan_limit_invalid');
    const rows: TenantRow<T>[] = [];
    let cursor: string | undefined;
    for (;;) {
      const pageSize = Math.min(200, maxRows - rows.length + 1);
      const page = await this.list(path, schema, {
        ...options,
        orderBy: '__name__',
        limit: pageSize,
        ...(cursor ? { startAfter: cursor } : {}),
      });
      rows.push(...page);
      if (rows.length > maxRows) throw new Error('tenant_scan_limit_exceeded');
      if (page.length < pageSize) return rows;
      cursor = page[page.length - 1]!.id;
    }
  }
  /** Recursive removal stays inside the same validated tenant capability. */
  async deleteTree(path: string): Promise<void> {
    const scoped = this.#path(path, true);
    if (this.#store) return this.#store.deleteTree(scoped);
    await this.#db!.recursiveDelete(this.#db!.doc(scoped));
  }
  async transaction<T>(
    callback: (tx: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    if (this.#store)
      return this.#observe(() =>
        this.#store!.transaction((store) =>
          callback({
            read: async <V>(path: string, schema: RuntimeSchema<V>) => {
              const data = await store.read(this.#path(path, true));
              return data === null ? null : schema.parse(data);
            },
            list: async <V>(
              path: string,
              schema: RuntimeSchema<V>,
              options: TenantQuery,
            ) => {
              this.#validateQuery(options);
              return (await store.list(this.#path(path, false), options)).map(
                (row) => ({ id: row.id, data: schema.parse(row.data) }),
              );
            },
            write: <V extends DocumentData>(
              path: string,
              schema: RuntimeSchema<V>,
              input: unknown,
              options?: { merge: true },
            ) =>
              store.write(this.#path(path, true), schema.parse(input), options),
            create: <V extends DocumentData>(
              path: string,
              schema: RuntimeSchema<V>,
              input: unknown,
            ) => store.create(this.#path(path, true), schema.parse(input)),
            delete: (path: string) => store.delete(this.#path(path, true)),
          }),
        ),
      );
    return this.#observe(() =>
      this.#db!.runTransaction((native) =>
        callback({
          read: async <V>(path: string, schema: RuntimeSchema<V>) => {
            const snap = await native.get(
              this.#db!.doc(this.#path(path, true)),
            );
            return snap.exists ? schema.parse(snap.data()) : null;
          },
          list: async <V>(
            path: string,
            schema: RuntimeSchema<V>,
            options: TenantQuery,
          ) =>
            (await native.get(this.#query(path, options))).docs.map((doc) => ({
              id: doc.id,
              data: schema.parse(doc.data()),
            })),
          write: <V extends DocumentData>(
            path: string,
            schema: RuntimeSchema<V>,
            input: unknown,
            options?: { merge: true },
          ) => {
            const scoped = this.#path(path, true),
              data = schema.parse(input);
            if (options) native.set(this.#db!.doc(scoped), data, options);
            else native.set(this.#db!.doc(scoped), data);
          },
          create: <V extends DocumentData>(
            path: string,
            schema: RuntimeSchema<V>,
            input: unknown,
          ) => {
            const scoped = this.#path(path, true),
              data = schema.parse(input);
            native.create(this.#db!.doc(scoped), data);
          },
          delete: (path: string) => {
            native.delete(this.#db!.doc(this.#path(path, true)));
          },
        }),
      ),
    );
  }
}
