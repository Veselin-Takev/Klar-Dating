/** Unit fixture types; application code only accepts the closed tenant repository or SDK infrastructure. */
export interface MinimalDocSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

export interface MinimalTransaction {
  get: (ref: unknown) => Promise<MinimalDocSnapshot>;
  set: (ref: unknown, data: unknown, options?: unknown) => void;
  delete: (ref: unknown) => void;
}

export interface MinimalFirestore {
  collection: (name: string) => {
    doc: (id: string) => unknown;
  };
  runTransaction: <T>(updateFunction: (transaction: MinimalTransaction) => Promise<T>) => Promise<T>;
}
