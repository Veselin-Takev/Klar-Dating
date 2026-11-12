import type {
  RepositoryStore,
  RepositoryStoreTransaction,
  TenantQuery,
  TenantRow,
} from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';

type Data = Record<string, unknown>;
type Snapshot = Map<string, Data>;
export function assertLocalRepositoryMode() {
  if (
    process.env.K_SERVICE ||
    process.env.FUNCTION_TARGET ||
    process.env.VERCEL
  )
    throw new Error('local_repository_forbidden_in_cloud');
  if (
    process.env.NODE_ENV !== 'test' &&
    !(
      process.env.NODE_ENV === 'development' &&
      process.env.KLAR_ALLOW_LOCAL_REPOSITORY === 'true'
    )
  )
    throw new Error('local_repository_requires_explicit_development_opt_in');
}
function clone(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return new Date(value);
  if (Array.isArray(value)) return value.map(clone);
  if (
    value &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)]),
    );
  throw new Error(
    'local_repository_requires_plain_data_use_emulators_for_sdk_transforms',
  );
}
function copy(data: Data): Data {
  return clone(data) as Data;
}
function check(path: string, document: boolean) {
  const parts = path.split('/');
  if (
    parts[0] !== 'tenants' ||
    parts.length < (document ? 4 : 3) ||
    (parts.length % 2 === 0) !== document ||
    parts.some((part) => !/^[A-Za-z0-9_:-]+$/.test(part))
  )
    throw new Error('local_repository_unscoped_path');
}
function compare(left: unknown, right: unknown): number {
  const a = left instanceof Date ? left.getTime() : left,
    b = right instanceof Date ? right.getTime() : right;
  if (a === b) return 0;
  if (
    (typeof a === 'number' && typeof b === 'number') ||
    (typeof a === 'string' && typeof b === 'string')
  )
    return a < b ? -1 : 1;
  throw new Error('local_repository_query_type_mismatch');
}
function select(
  state: Snapshot,
  path: string,
  query: TenantQuery,
): TenantRow<unknown>[] {
  check(path, false);
  let rows = [...state]
    .filter(
      ([key]) =>
        key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/'),
    )
    .map(([key, data]) => ({
      id: key.slice(path.length + 1),
      data: copy(data),
    }));
  const filters = [
    ...(query.where ? [query.where] : []),
    ...(query.whereAll ?? []),
  ];
  for (const [field, op, value] of filters)
    rows = rows.filter((row) => {
      const current = row.data[field];
      if (current === undefined) return false;
      switch (op) {
        case '==':
          return JSON.stringify(current) === JSON.stringify(value);
        case '!=':
          return JSON.stringify(current) !== JSON.stringify(value);
        case '<':
          return compare(current, value) < 0;
        case '<=':
          return compare(current, value) <= 0;
        case '>':
          return compare(current, value) > 0;
        case '>=':
          return compare(current, value) >= 0;
        case 'in':
          return Array.isArray(value) && value.includes(current);
        case 'array-contains':
          return Array.isArray(current) && current.includes(value);
        default:
          throw new Error('local_repository_query_not_supported');
      }
    });
  const field = query.orderBy ?? '__name__';
  if (field !== '__name__')
    rows = rows.filter((row) => row.data[field] !== undefined);
  rows.sort(
    (a, b) =>
      (compare(
        field === '__name__' ? a.id : a.data[field],
        field === '__name__' ? b.id : b.data[field],
      ) || compare(a.id, b.id)) * (query.orderDirection === 'desc' ? -1 : 1),
  );
  if (query.startAfter !== undefined)
    rows = rows.filter((row) =>
      query.orderDirection === 'desc'
        ? row.id < query.startAfter!
        : row.id > query.startAfter!,
    );
  return rows.slice(0, query.limit);
}
/** Private port implementation. Explicit local repositories never replace a failed cloud client. */
export class LocalRepositoryStore implements RepositoryStore {
  readonly kind = 'tenant-local-store' as const;
  #state: Snapshot;
  #queue: Promise<void> = Promise.resolve();
  readonly #persist: (state: ReadonlyMap<string, Data>) => void;
  constructor(
    initial: ReadonlyMap<string, Data> = new Map(),
    persist: (state: ReadonlyMap<string, Data>) => void = () => {},
  ) {
    assertLocalRepositoryMode();
    for (const path of initial.keys()) check(path, true);
    this.#state = new Map(
      [...initial].map(([path, data]) => [path, copy(data)]),
    );
    this.#persist = persist;
  }
  async read(path: string) {
    assertLocalRepositoryMode();
    check(path, true);
    await this.#queue;
    const data = this.#state.get(path);
    return data ? copy(data) : null;
  }
  async list(path: string, query: TenantQuery) {
    assertLocalRepositoryMode();
    await this.#queue;
    return select(this.#state, path, query);
  }
  write(path: string, data: Data, options?: { merge: true }) {
    return this.transaction(async (tx) => {
      tx.write(path, data, options);
    });
  }
  create(path: string, data: Data) {
    return this.transaction(async (tx) => {
      tx.create(path, data);
    });
  }
  delete(path: string) {
    return this.transaction(async (tx) => {
      tx.delete(path);
    });
  }
  async deleteTree(path: string) {
    check(path, true);
    await this.#exclusive(async (state) => {
      for (const key of state.keys())
        if (key === path || key.startsWith(path + '/')) state.delete(key);
    });
  }
  async #exclusive<T>(work: (state: Snapshot) => Promise<T>): Promise<T> {
    assertLocalRepositoryMode();
    const previous = this.#queue;
    let release!: () => void;
    this.#queue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const pending = new Map(
        [...this.#state].map(([path, data]) => [path, copy(data)]),
      );
      const result = await work(pending);
      this.#persist(pending);
      this.#state = pending;
      return result;
    } finally {
      release();
    }
  }
  transaction<T>(
    work: (tx: RepositoryStoreTransaction) => Promise<T>,
  ): Promise<T> {
    return this.#exclusive(async (state) => {
      let writing = false;
      let active = true;
      const ensureActive = () => {
        if (!active) throw new Error('transaction_already_closed');
      };
      const canRead = () => {
        ensureActive();
        if (writing) throw new Error('transaction_reads_must_precede_writes');
      };
      try {
        return await work({
          read: async (path) => {
            canRead();
            check(path, true);
            const data = state.get(path);
            return data ? copy(data) : null;
          },
          list: async (path, query) => {
            canRead();
            return select(state, path, query);
          },
          write: (path, data, options) => {
            ensureActive();
            check(path, true);
            writing = true;
            state.set(
              path,
              options?.merge
                ? { ...state.get(path), ...copy(data) }
                : copy(data),
            );
          },
          create: (path, data) => {
            ensureActive();
            check(path, true);
            writing = true;
            if (state.has(path))
              throw Object.assign(new Error('Document already exists'), {
                code: 6,
              });
            state.set(path, copy(data));
          },
          delete: (path) => {
            ensureActive();
            check(path, true);
            writing = true;
            state.delete(path);
          },
        });
      } finally {
        active = false;
      }
    });
  }
}
