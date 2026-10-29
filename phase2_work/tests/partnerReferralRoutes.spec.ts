// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express, { type Request } from 'express';
import type { AddressInfo } from 'node:net';
import { createPartnerReferralPublicRouter, createPartnerReferralRouter } from '../src/server/routes/partnerReferrals';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
});

function makeDb(seed: Array<{ collection: string; id: string; data: Record<string, unknown> }> = []) {
  const store = new Map<string, Record<string, unknown>>();
  for (const item of seed) store.set(item.collection + '/' + item.id, structuredClone(item.data));
  const docRef = (collectionName: string, id: string) => ({ id, path: collectionName + '/' + id,
    get: async () => ({ id, exists: store.has(collectionName + '/' + id), data: () => store.get(collectionName + '/' + id) }),
  });
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => docRef(name, id),
      limit: (_count: number) => ({ get: async () => ({ docs: [] }) }),
      where: (_field: string, _op: string, _value: unknown) => ({ limit: (_count: number) => ({ get: async () => ({ docs: [] }) }) }),
    }),
    runTransaction: async (callback: (tx: {
      get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      set: (ref: { path: string }, data: Record<string, unknown>) => void;
      create: (ref: { path: string }, data: Record<string, unknown>) => void;
      update: (ref: { path: string }, data: Record<string, unknown>) => void;
      getAll: (...refs: Array<{ path: string }>) => Promise<Array<{ exists: boolean; data: () => Record<string, unknown> | undefined }>>;
    }) => unknown) => callback({
      get: async ref => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
      getAll: async (...refs) => refs.map(ref => ({ exists: store.has(ref.path), data: () => store.get(ref.path) })),
      set: (ref, data) => store.set(ref.path, data),
      create: (ref, data) => { if (store.has(ref.path)) throw new Error('already exists'); store.set(ref.path, data); },
      update: (ref, data) => store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data }),
    }),
  };
  return db as unknown as import('firebase-admin/firestore').Firestore;
}

async function requestAdmin(claims: Record<string, unknown>) {
  const getFirestore = vi.fn(() => makeDb());
  const app = express();
  app.use((req, _res, next) => {
    req.user = {
      aud: 'demo-klar', auth_time: 1, exp: 2, iat: 1,
      iss: 'https://securetoken.google.com/demo-klar', sub: String(claims.uid),
      uid: String(claims.uid), firebase: { identities: {}, sign_in_provider: 'custom' },
      ...claims,
    };
    next();
  });
  app.use('/api', createPartnerReferralRouter({
    currentUserId: req => {
      const uid = (req as Request & { user?: { uid?: unknown } }).user?.uid;
      return typeof uid === 'string' ? uid : null;
    },
    getFirestore,
    tokenSecret: () => 'partner-token-secret-at-least-thirty-two-characters',
    auditSecret: () => 'partner-audit-secret-at-least-thirty-two-characters',
    publicUrl: () => 'https://klar-app.example',
    webhookSecrets: () => ({}),
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/admin/partners';
  return { response: await fetch(url), getFirestore };
}

describe('Klar & Partner strict Admin claim boundary', () => {
  it('rejects role-only admin identity without touching Firestore', async () => {
    const result = await requestAdmin({ uid: 'user-1', role: 'admin', roles: ['admin'] });
    expect(result.response.status).toBe(403);
    expect(result.getFirestore).not.toHaveBeenCalled();
    expect(result.response.headers.get('cache-control')).toContain('no-store');
    expect(result.response.headers.get('pragma')).toBe('no-cache');
    expect(result.response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('accepts explicit Firebase admin:true claim', async () => {
    const result = await requestAdmin({ uid: 'admin-1', admin: true });
    expect(result.response.status).toBe(200);
    expect(await result.response.json()).toEqual({ campaigns: [] });
    expect(result.getFirestore).toHaveBeenCalled();
    expect(result.response.headers.get('cache-control')).toContain('no-store');
    expect(result.response.headers.get('pragma')).toBe('no-cache');
    expect(result.response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('disables caching of personalized partner link responses, including failures', async () => {
    const getFirestore = vi.fn(() => makeDb([{ collection: 'users', id: 'user-1', data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } }]));
    const app = express();
    app.use((req, _res, next) => {
      req.user = {
        aud: 'demo-klar', auth_time: 1, exp: 2, iat: 1,
        iss: 'https://securetoken.google.com/demo-klar', sub: 'user-1',
        uid: 'user-1', firebase: { identities: {}, sign_in_provider: 'custom' },
      };
      next();
    });
    app.use('/api', createPartnerReferralRouter({
      currentUserId: () => 'user-1',
      getFirestore,
      tokenSecret: () => 'partner-token-secret-at-least-thirty-two-characters',
      auditSecret: () => 'partner-audit-secret-at-least-thirty-two-characters',
      publicUrl: () => 'https://klar-app.example',
      webhookSecrets: () => ({}),
    }));
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    for (const [path, init] of [
      ['/api/partner/referrals', undefined],
      ['/api/partner/consent', undefined],
      ['/api/partner/consent', { method: 'POST' }],
      ['/api/partner/open/invalid!', { method: 'POST' }],
    ] as const) {
      const response = await fetch(base + path, init);
      if (path === '/api/partner/referrals') {
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ consent: { allowed: true }, referrals: [] });
      } else if (path === '/api/partner/consent' && init === undefined) {
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ allowed: true });
      } else {
        expect(response.status).toBe(400);
      }
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('pragma')).toBe('no-cache');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    }
  });

  it('applies private no-store headers even when authentication rejects partner requests', async () => {
    const app = express();
    app.use('/api', createPartnerReferralRouter({
      currentUserId: () => null,
      getFirestore: () => { throw new Error('Unauthorized routes must not touch Firestore'); },
      tokenSecret: () => 'partner-token-secret-at-least-thirty-two-characters',
      auditSecret: () => 'partner-audit-secret-at-least-thirty-two-characters',
      publicUrl: () => 'https://klar-app.example',
      webhookSecrets: () => ({}),
    }));
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    for (const [path, init] of [
      ['/api/partner/consent', undefined],
      ['/api/partner/consent', { method: 'POST' }],
      ['/api/partner/referrals', undefined],
      ['/api/partner/open/campaign-1', { method: 'POST' }],
    ] as const) {
      const response = await fetch(origin + path, init);
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('pragma')).toBe('no-cache');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    }
  });

  it('prevents caching and referrer disclosure on invalid public partner tokens', async () => {
    const app = express();
    app.use('/api', createPartnerReferralPublicRouter({
      currentUserId: () => null,
      getFirestore: () => { throw new Error('Invalid token must not access Firestore'); },
      tokenSecret: () => 'partner-token-secret-at-least-thirty-two-characters',
      auditSecret: () => 'partner-audit-secret-at-least-thirty-two-characters',
      publicUrl: () => 'https://klar-app.example',
      webhookSecrets: () => ({}),
    }));
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    const response = await fetch(origin + '/api/partner/click/not-a-valid-token');
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    // A syntactically valid token MUST still reach the existing distributed limiter.
    // Its deliberately unavailable Firestore dependency must fail closed, not bypass the gate.
    const validShape = await fetch(origin + '/api/partner/click/' + 'a'.repeat(64));
    expect(validShape.status).toBe(500);
    expect(validShape.headers.get('cache-control')).toContain('no-store');
    expect(validShape.headers.get('pragma')).toBe('no-cache');
    expect(validShape.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('rejects malformed partner webhook slugs before Firestore limiter access', async () => {
    const getFirestore = vi.fn(() => { throw new Error('Malformed slug must not use Firestore'); });
    const app = express();
    app.use('/api', createPartnerReferralPublicRouter({
      currentUserId: () => null,
      getFirestore,
      tokenSecret: () => 'partner-token-secret-at-least-thirty-two-characters',
      auditSecret: () => 'partner-audit-secret-at-least-thirty-two-characters',
      publicUrl: () => 'https://klar-app.example',
      webhookSecrets: () => ({}),
    }));
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    const response = await fetch(origin + '/api/partner/webhook/INVALID_SLUG', { method: 'POST' });
    expect(response.status).toBe(404);
    expect(getFirestore).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('shares the webhook 429 budget across distinct valid-looking slugs', async () => {
    const { createHash } = await import('node:crypto');
    const { ipKeyGenerator } = await import('express-rate-limit');
    const key = createHash('sha256').update(
      'klar-rate-limit:partner_referral_webhook_rate_limits:ip:' + ipKeyGenerator('127.0.0.1'),
    ).digest('hex');
    const db = makeDb([{
      collection: 'partner_referral_webhook_rate_limits',
      id: key,
      data: { count: 120, windowStartedAt: Date.now() },
    }]);
    const app = express();
    app.use('/api', createPartnerReferralPublicRouter({
      currentUserId: () => null,
      getFirestore: () => db,
      tokenSecret: () => 'partner-token-secret-at-least-thirty-two-characters',
      auditSecret: () => 'partner-audit-secret-at-least-thirty-two-characters',
      publicUrl: () => 'https://klar-app.example',
      webhookSecrets: () => ({}),
    }));
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    for (const slug of ['campaign-one', 'campaign-two']) {
      const response = await fetch(origin + '/api/partner/webhook/' + slug, { method: 'POST' });
      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).not.toBeNull();
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
  });

  it('protects webhook response headers even when the distributed limiter fails', async () => {
    const app = express();
    app.use('/api', createPartnerReferralPublicRouter({
      currentUserId: () => null,
      getFirestore: () => { throw new Error('Simulated limiter infrastructure outage'); },
      tokenSecret: () => 'partner-token-secret-at-least-thirty-two-characters',
      auditSecret: () => 'partner-audit-secret-at-least-thirty-two-characters',
      publicUrl: () => 'https://klar-app.example',
      webhookSecrets: () => ({}),
    }));
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    const response = await fetch(origin + '/api/partner/webhook/test-partner', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'invalid' }),
    });
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

});
