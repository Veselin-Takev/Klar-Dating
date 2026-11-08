// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const doubles = vi.hoisted(() => ({ terminate: vi.fn() }));
vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ terminate: doubles.terminate }),
  FieldValue: {},
}));
vi.mock('../src/server/observability', () => ({
  observeFirestoreTransaction: (_name: string, work: () => unknown) => work(),
}));
beforeEach(() => {
  vi.resetModules();
  doubles.terminate.mockReset();
});
describe('database shutdown boundary', () => {
  it('closes the private SDK once across concurrent requests', async () => {
    doubles.terminate.mockResolvedValue(undefined);
    const { getInfrastructureRepository, closeServerDb } =
      await import('../src/server/firestoreRepository/nativeDatabase');
    getInfrastructureRepository();
    await Promise.all([closeServerDb(), closeServerDb()]);
    expect(doubles.terminate).toHaveBeenCalledTimes(1);
  });
  it('propagates and memoizes termination failure', async () => {
    doubles.terminate.mockRejectedValue(new Error('termination_failed'));
    const { getInfrastructureRepository, closeServerDb } =
      await import('../src/server/firestoreRepository/nativeDatabase');
    getInfrastructureRepository();
    await expect(closeServerDb()).rejects.toThrow('termination_failed');
    await expect(closeServerDb()).rejects.toThrow('termination_failed');
    expect(doubles.terminate).toHaveBeenCalledTimes(1);
  });
});
