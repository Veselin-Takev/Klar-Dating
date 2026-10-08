// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
const db = vi.hoisted(() => {
  const get = vi.fn();
  const set = vi.fn();
  const userRef = { get, set, collection: () => ({ doc: () => ({ id: 'evidence' }) }) };
  return { collection: () => ({ doc: () => userRef }), runTransaction: vi.fn(), get, set };
});
vi.mock('../src/server/db', () => ({ getDb: () => db, FieldValue: { serverTimestamp: () => 'timestamp' } }));
import { handleAlter, handleEinwilligung, handleEinwilligungLesen, handleEinwilligungWiderruf } from '../src/server/datenschutz';

beforeEach(() => {
  vi.stubEnv('CONSENT_AUDIT_SECRET', 'test-consent-failure-secret-at-least-32-chars');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  db.get.mockRejectedValue(new Error('PERMISSION_DENIED'));
  db.set.mockRejectedValue(new Error('PERMISSION_DENIED'));
  db.runTransaction.mockRejectedValue(new Error('UNAVAILABLE'));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('privacy storage failures', () => {
  it.each([
    ['age', handleAlter, { geburtsdatum: '1990-01-01' }],
    ['grant', handleEinwilligung, { zwecke: { ki_auswertung: true } }],
    ['withdrawal', handleEinwilligungWiderruf, { zweck: 'ki_auswertung' }],
    ['read', handleEinwilligungLesen, {}],
  ] as const)('does not acknowledge %s when storage is unavailable', async (_name, handler, body) => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    await handler({ user: { uid: 'test' }, body } as unknown as Request, { status, json } as unknown as Response);
    expect(status).toHaveBeenCalledOnce();
    expect(json).toHaveBeenCalledOnce();
    expect(status.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(500);
    expect(json.mock.calls[0]?.[0]).not.toHaveProperty('ok', true);
    expect(json.mock.calls[0]?.[0]).not.toHaveProperty('isAdult');
    expect(json.mock.calls[0]?.[0]).not.toHaveProperty('evidenceId');
  });
});
