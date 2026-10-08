// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const doubles = vi.hoisted(() => {
  const get = vi.fn();
  const db = { collection: vi.fn(() => ({ doc: vi.fn(() => ({ get })) })) };
  return { get, db, getFirestore: vi.fn(() => db) };
});
vi.mock('firebase-admin/app', () => ({
  getApps: () => [{ name: 'test' }], initializeApp: vi.fn(),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: doubles.getFirestore, FieldValue: {},
}));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });
describe('durable server storage', () => {
  it('returns the real SDK instance after a successful startup probe', async () => {
    doubles.get.mockResolvedValue({});
    const { initServerDb, getDb } = await import('../src/server/db');
    expect(await initServerDb()).toBe(doubles.db);
    expect(getDb()).toBe(doubles.db);
  });
  it('propagates storage failures and permits a real retry', async () => {
    doubles.get.mockRejectedValue(new Error('PERMISSION_DENIED'));
    const { initServerDb, getDb } = await import('../src/server/db');
    await expect(initServerDb()).rejects.toThrow('PERMISSION_DENIED');
    expect(getDb()).toBe(doubles.db);
    doubles.get.mockResolvedValue({});
    expect(await initServerDb()).toBe(doubles.db);
  });
  it('fails a stalled probe within the startup deadline', async () => {
    vi.useFakeTimers();
    doubles.get.mockImplementation(() => new Promise(() => {}));
    const { initServerDb } = await import('../src/server/db');
    const assertion = expect(initServerDb()).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
