// @vitest-environment node
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  handleForgotPassword, handleVerifyResetToken, handleResetPassword, validatePasswordStrength,
  checkAccountRateLimit, clearResetTokensForTesting, NEUTRAL_FORGOT_PASSWORD_MESSAGE,
} from '../src/server/passwordReset';

const mockGetUserByEmail = vi.hoisted(() => vi.fn());
const mailAdd = vi.hoisted(() => vi.fn(async () => ({ id: 'mail-job' })));

vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ getUserByEmail: mockGetUserByEmail }) }));

const state = new Map<string, { count: number; windowStartedAt: number; expiresAt?: Date }>();
function strictUpdate(path: string, value: Record<string, unknown>) {
  if (!state.has(path)) throw Object.assign(new Error('Document does not exist'), { code: 5 });
  state.set(path, { ...state.get(path)!, ...value });
}
const db = {
  collection: (name: string) => ({
    doc: (id: string) => ({
      path: name + '/' + id,
      get: vi.fn(async () => ({ exists: state.has(name + '/' + id), data: () => state.get(name + '/' + id) })),
      set: vi.fn(async (value: any) => { state.set(name + '/' + id, value); }),
      update: vi.fn(async (value: any) => { strictUpdate(name + '/' + id, value); }),
    }),
    add: name === 'mail_queue' ? mailAdd : vi.fn(),
  }),
  runTransaction: async (fn: any) => fn({
    get: async (ref: any) => ({ exists: state.has(ref.path), data: () => state.get(ref.path) }),
    set: (ref: any, value: any) => state.set(ref.path, value),
    update: (ref: any, value: any) => strictUpdate(ref.path, value),
  }),
} as any;

vi.mock('../src/server/db', () => ({ getDb: () => db }));

function request(app: express.Application, path: string, body: unknown) {
  return new Promise<Response>((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', async () => {
      try {
        const port = (server.address() as AddressInfo).port;
        const response = await fetch('http://127.0.0.1:' + port + path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        server.close();
        resolve(response);
      } catch (error) { server.close(); reject(error); }
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.clear();
  vi.stubEnv('KLAR_PUBLIC_URL', 'https://klar.app');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); clearResetTokensForTesting(); });

describe('Password Reset Security & Account Enumeration Prevention Suite', () => {
  it('returns identical neutral 200 responses for registered and unassigned emails without token disclosure', async () => {
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'uid-existing' }).mockRejectedValueOnce({ code: 'auth/user-not-found' });
    const app = express(); app.use(express.json()); app.post('/forgot', handleForgotPassword);
    const existing = await request(app, '/forgot', { email: 'existing@example.test', method: 'password' });
    const absent = await request(app, '/forgot', { email: 'absent@example.test', method: 'password' });
    expect(existing.status).toBe(200);
    expect(absent.status).toBe(200);
    expect(await existing.json()).toEqual(await absent.json());
  });

  it('queues mail work for existing accounts but never exposes reset tokens', async () => {
    mockGetUserByEmail.mockResolvedValueOnce({ uid: 'uid-existing' });
    const app = express(); app.use(express.json()); app.post('/forgot', handleForgotPassword);
    const response = await request(app, '/forgot', { email: 'existing@example.test', method: 'password' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, message: NEUTRAL_FORGOT_PASSWORD_MESSAGE });
    expect(body._testToken).toBeUndefined();
    expect(mailAdd).toHaveBeenCalledTimes(1);
  });

  it('retires server-side token verification and reset with stable 410 boundaries', async () => {
    const app = express(); app.use(express.json());
    app.post('/verify', handleVerifyResetToken); app.post('/reset', handleResetPassword);
    const verify = await request(app, '/verify', { token: 'legacy-token' });
    const reset = await request(app, '/reset', { token: 'legacy-token', newPassword: 'SicheresPasswort2026!' });
    expect(verify.status).toBe(410);
    expect((await verify.json()).code).toBe('RESET_FLOW_RETIRED');
    expect(reset.status).toBe(410);
    expect((await reset.json()).code).toBe('RESET_FLOW_RETIRED');
  });

  it('keeps the server password-strength policy explicit and deterministic', () => {
    expect(validatePasswordStrength('short').valid).toBe(false);
    expect(validatePasswordStrength('onlylowercasewordslongerthan12').valid).toBe(false);
    expect(validatePasswordStrength('ONLYUPPERCASE123456789!').valid).toBe(false);
    expect(validatePasswordStrength('LettersOnlyWithoutNumbersOrSpecialChars').valid).toBe(false);
    expect(validatePasswordStrength('ValidPassword2026!').valid).toBe(true);
  });

  it('enforces the asynchronous account rate limit at three accepted requests', async () => {
    expect(await checkAccountRateLimit('target@example.com')).toBe(true);
    expect(await checkAccountRateLimit('target@example.com')).toBe(true);
    expect(await checkAccountRateLimit('target@example.com')).toBe(true);
    expect(await checkAccountRateLimit('target@example.com')).toBe(false);
  });

  it('creates a missing limiter document with count and TTL without storing the address', async () => {
    expect(await checkAccountRateLimit('fresh@example.test')).toBe(true);
    const [path, value] = [...state.entries()][0]!;
    expect(path).toMatch(/^password_reset_rate_limits\/[a-f0-9]{16}$/);
    expect(value.count).toBe(1);
    expect(value.expiresAt).toBeInstanceOf(Date);
    expect(value.expiresAt!.getTime()).toBe(value.windowStartedAt + 3_600_000);
    expect(JSON.stringify([...state.entries()])).not.toContain('fresh@example.test');
  });

  it('restarts an expired window and treats normalized addresses as one quota', async () => {
    await checkAccountRateLimit('Fresh@Example.Test');
    const [path, value] = [...state.entries()][0]!;
    state.set(path, { ...value, count: 3, windowStartedAt: Date.now() - 3_600_001 });
    expect(await checkAccountRateLimit(' fresh@example.test ')).toBe(true);
    expect(state.get(path)!.count).toBe(1);
    expect(await checkAccountRateLimit('FRESH@example.test')).toBe(true);
    expect(await checkAccountRateLimit('fresh@example.test')).toBe(true);
    expect(await checkAccountRateLimit('fresh@example.test')).toBe(false);
  });

  it('propagates unavailable quota storage without looking up an account or queuing mail', async () => {
    vi.spyOn(db, 'runTransaction').mockRejectedValueOnce(new Error('synthetic_store_unavailable'));
    await expect(checkAccountRateLimit('fresh@example.test')).rejects.toThrow('synthetic_store_unavailable');
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mailAdd).not.toHaveBeenCalled();
  });
  it('keeps the documented authentication endpoint inventory stable', () => {
    expect(['/api/auth/forgot-password', '/api/auth/verify-reset-token', '/api/auth/reset-password']).toHaveLength(3);
  });
});
