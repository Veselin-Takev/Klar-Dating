// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalDiditJson, diditConfig, verifyDiditSignature } from '../src/server/verification/diditKyc';

const now = 1_800_000_000_000; const timestamp = String(now / 1000); const secret = 'test-only-secret-with-at-least-32-characters';
describe('Didit V3 full-body trust boundary', () => {
  it('matches canonical Unicode JSON including numeric keys, arrays, nulls and empty objects', () => {
    const body = { timestamp: now / 1000, z: { '2': {}, '10': [1.0, null, 'José'] }, a: false };
    const canonical = '{"a":false,"timestamp":1800000000,"z":{"10":[1,null,"José"],"2":{}}}';
    expect(canonicalDiditJson(body)).toBe(canonical);
    const signature = createHmac('sha256', secret).update(canonical).digest('hex');
    expect(verifyDiditSignature(body, signature, timestamp, secret, now)).toBe(true);
    expect(verifyDiditSignature({ ...body, a: true }, signature, timestamp, secret, now)).toBe(false);
  });
  it('rejects stale events, fresh-header replays, malformed hex, missing signatures and excess nesting', () => {
    const body = { timestamp: now / 1000 - 301 };
    const signature = createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    expect(verifyDiditSignature(body, signature, String(body.timestamp), secret, now)).toBe(false);
    expect(verifyDiditSignature(body, signature, timestamp, secret, now)).toBe(false);
    for (const value of ['', undefined, 'zz'.repeat(32), 'a'.repeat(63)]) expect(verifyDiditSignature(body, value, timestamp, secret, now)).toBe(false);
    let nested: unknown = null; for (let n = 0; n < 34; n++) nested = [nested];
    expect(() => canonicalDiditJson(nested)).toThrow('invalid_webhook');
  });
  it('fails closed unless explicitly enabled and all server settings validate', () => {
    const env = { DIDIT_ENABLED: 'true', DIDIT_API_KEY: 'server-secret', DIDIT_WEBHOOK_SECRET: secret,
      DIDIT_WORKFLOW_ID: '22222222-3333-4444-8555-666666666666', DIDIT_APPLICATION_ID: '11111111-2222-4333-8444-555555555555',
      DIDIT_ENVIRONMENT: 'sandbox', DIDIT_CALLBACK_URL: 'https://app.example/verifizierung', DIDIT_PRIVACY_NOTICE_URL: 'https://app.example/privacy/kyc', DIDIT_PRIVACY_NOTICE_VERSION: 'test-v1' };
    expect(diditConfig(env).environment).toBe('sandbox');
    for (const changes of [{ DIDIT_ENABLED: 'false' }, { DIDIT_ENVIRONMENT: 'prod' }, { DIDIT_WEBHOOK_SECRET: '' }, { DIDIT_CALLBACK_URL: 'http://app.example/' }]) expect(() => diditConfig({ ...env, ...changes })).toThrow('kyc_unavailable');
  });
});
