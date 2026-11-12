// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
const doubles = vi.hoisted(() => ({
  sdk: vi.fn(),
  doc: vi.fn(),
  runTransaction: vi.fn(),
  project: 'demo-klar',
}));
vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: doubles.sdk,
  FieldValue: {},
}));
vi.mock('../src/server/firebaseRuntime', () => ({
  resolveFirebaseRuntime: () => ({ projectId: doubles.project }),
}));
vi.mock('../src/server/observability', () => ({
  observeFirestoreTransaction: (_name: string, work: () => unknown) => work(),
}));
const schema = z.record(z.string(), z.unknown());
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  doubles.project = 'demo-klar';
  doubles.sdk.mockReturnValue({
    doc: doubles.doc,
    runTransaction: doubles.runTransaction,
  });
  doubles.doc.mockReturnValue({ get: async () => ({ exists: false }) });
});
afterEach(() => vi.unstubAllEnvs());
describe('private native SDK capability boundary', () => {
  it.each(['production', 'test', 'development', 'staging'])(
    'returns only a scoped repository in %s',
    async (mode) => {
      vi.stubEnv('NODE_ENV', mode);
      vi.stubEnv('KLAR_ALLOW_DURABLE_DB_FALLBACK', 'true');
      const { getInfrastructureRepository } =
        await import('../src/server/firestoreRepository/nativeDatabase');
      const repo = getInfrastructureRepository();
      expect('doc' in repo).toBe(false);
      expect('collection' in repo).toBe(false);
      await repo.read('users/owner', schema);
      expect(doubles.doc).toHaveBeenCalledWith('tenants/default/users/owner');
      await expect(
        repo.read('tenants/foreign/users/owner', schema),
      ).rejects.toThrow('tenant_document_path_invalid');
    },
  );
  it.each(['production', 'development', 'test'])(
    'never falls back after SDK failure in %s even with the retired flag',
    async (mode) => {
      vi.stubEnv('NODE_ENV', mode);
      vi.stubEnv('KLAR_ALLOW_DURABLE_DB_FALLBACK', 'true');
      doubles.sdk.mockImplementation(() => {
        throw new Error('SDK failure');
      });
      const { getInfrastructureRepository } =
        await import('../src/server/firestoreRepository/nativeDatabase');
      expect(() => getInfrastructureRepository()).toThrow(
        'automatic local fallback is disabled',
      );
    },
  );
  it.each([
    { NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    { NODE_ENV: 'test', FIRESTORE_EMULATOR_HOST: 'remote.example:8080' },
    { NODE_ENV: 'test', FIRESTORE_EMULATOR_HOST: '', K_SERVICE: 'service' },
  ])('denies a raw client before SDK initialization: %j', async (env) => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const { getEmulatorDatabase } =
      await import('../src/server/firestoreRepository/nativeDatabase');
    expect(() => getEmulatorDatabase()).toThrow(
      'raw_database_requires_loopback_test_emulator',
    );
    expect(doubles.sdk).not.toHaveBeenCalled();
  });
  it('requires a demo project even at a loopback emulator', async () => {
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
    doubles.project = 'real-project';
    const { getEmulatorDatabase } =
      await import('../src/server/firestoreRepository/nativeDatabase');
    expect(() => getEmulatorDatabase()).toThrow(
      'raw_database_requires_demo_project',
    );
    expect(doubles.sdk).not.toHaveBeenCalled();
  });
  it('retains native SDK transactions behind the repository', async () => {
    const set = vi.fn();
    doubles.runTransaction.mockImplementation(async (work) => work({ set }));
    const { getInfrastructureRepository } =
      await import('../src/server/firestoreRepository/nativeDatabase');
    await getInfrastructureRepository().transaction(async (tx) => {
      tx.write('users/owner', schema, { value: 1 });
    });
    expect(doubles.runTransaction).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(doubles.doc).toHaveBeenCalledWith('tenants/default/users/owner');
  });
  it('requires an explicit trusted maintenance tenant before initializing SDK', async () => {
    vi.stubEnv('KLAR_TENANT_MIGRATION_READY', 'true');
    vi.stubEnv('KLAR_MAINTENANCE_TENANT_ID', '../foreign');
    const { getConfiguredMaintenanceRepository } =
      await import('../src/server/firestoreRepository/nativeDatabase');
    expect(() => getConfiguredMaintenanceRepository()).toThrow(
      'explicit_maintenance_tenant_required',
    );
    expect(doubles.sdk).not.toHaveBeenCalled();
    vi.stubEnv('KLAR_MAINTENANCE_TENANT_ID', 'maintenance-A');
    await getConfiguredMaintenanceRepository().read('users/owner', schema);
    expect(doubles.doc).toHaveBeenCalledWith(
      'tenants/maintenance-A/users/owner',
    );
  });
  it('rejects unverified or conflicting claims before returning a request capability', async () => {
    const { createVerifiedRequestRepository } =
      await import('../src/server/firestoreRepository/nativeDatabase');
    expect(() =>
      createVerifiedRequestRepository({ uid: 'u', tenantId: 'foreign' }),
    ).toThrow();
    expect(() => createVerifiedRequestRepository(undefined)).toThrow();
  });
});
