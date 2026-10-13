import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => {
  const nativeDb = { collection: vi.fn(), runTransaction: vi.fn(), batch: vi.fn(), recursiveDelete: vi.fn() };
  const durableDb = { collection: vi.fn(), runTransaction: vi.fn() };
  return { nativeDb, durableDb, createDurableDbProxy: vi.fn(() => durableDb), sdkFailure: { enabled: false } };
});

vi.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp: () => ({ name: 'unit-test' }),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => { if (doubles.sdkFailure.enabled) throw new Error('Firestore SDK unavailable'); return doubles.nativeDb; },
  FieldValue: {},
}));
vi.mock('../src/server/firebaseRuntime', () => ({
  resolveFirebaseRuntime: () => ({ projectId: 'demo-klar' }),
}));
vi.mock('../src/server/durableStore', () => ({
  createDurableDbProxy: doubles.createDurableDbProxy,
}));
vi.mock('../src/server/observability', () => ({
  observeFirestoreTransaction: (_name: string, fn: () => unknown) => fn(),
}));

const oldMode = process.env.NODE_ENV;
const oldFallback = process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK;

describe('Firestore production boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    doubles.createDurableDbProxy.mockClear();
    doubles.sdkFailure.enabled = false;
    delete process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK;
  });
  afterEach(() => {
    doubles.sdkFailure.enabled = false;
    if (oldMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldMode;
    if (oldFallback === undefined) delete process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK;
    else process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK = oldFallback;
  });

  it.each(['production', 'test', 'staging'])('uses native Firebase Admin in %s without the durable proxy', async mode => {
    process.env.NODE_ENV = mode;
    process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK = 'true';
    const { getDb } = await import('../src/server/db');
    expect(getDb()).toBe(doubles.nativeDb);
    expect(doubles.createDurableDbProxy).not.toHaveBeenCalled();
  });

  it('does not wrap Firestore in normal development without an explicit opt-in', async () => {
    process.env.NODE_ENV = 'development';
    const { getDb } = await import('../src/server/db');
    expect(getDb()).toBe(doubles.nativeDb);
    expect(doubles.createDurableDbProxy).not.toHaveBeenCalled();
  });

  it.each(['production', 'staging', 'test'])('fails closed on Firebase SDK initialization failure in %s', async mode => {
    process.env.NODE_ENV = mode;
    process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK = 'true';
    doubles.sdkFailure.enabled = true;
    const { getDb } = await import('../src/server/db');
    expect(() => getDb()).toThrow(/Firestore initialization failed/);
    expect(doubles.createDurableDbProxy).not.toHaveBeenCalled();
  });

  it.each(['false', 'TRUE', '1', ''])('fails closed when local opt-in is not exactly true (%s)', async flag => {
    process.env.NODE_ENV = 'development';
    process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK = flag;
    doubles.sdkFailure.enabled = true;
    const { getDb } = await import('../src/server/db');
    expect(() => getDb()).toThrow(/Firestore initialization failed/);
    expect(doubles.createDurableDbProxy).not.toHaveBeenCalled();
  });

  it('retains native transaction and batch identities without a local opt-in', async () => {
    process.env.NODE_ENV = 'development';
    const { getDb } = await import('../src/server/db');
    const db = getDb();
    expect(db.runTransaction).toBe(doubles.nativeDb.runTransaction);
    expect(db.batch).toBe(doubles.nativeDb.batch);
    expect(db.recursiveDelete).toBe(doubles.nativeDb.recursiveDelete);
  });

  it('permits an explicit development fallback when Firebase initialization fails', async () => {
    process.env.NODE_ENV = 'development';
    process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK = 'true';
    doubles.sdkFailure.enabled = true;
    const { getDb } = await import('../src/server/db');
    expect(getDb()).toBe(doubles.durableDb);
    expect(doubles.createDurableDbProxy).toHaveBeenCalledWith(null);
  });

  it('retains explicit development-only proxy opt-in', async () => {
    process.env.NODE_ENV = 'development';
    process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK = 'true';
    const { getDb } = await import('../src/server/db');
    expect(getDb()).toBe(doubles.durableDb);
    expect(doubles.createDurableDbProxy).toHaveBeenCalledWith(doubles.nativeDb);
  });
});
