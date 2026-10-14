// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express, { type Request } from 'express';
import type { AddressInfo } from 'node:net';
import { createPartnerReferralRouter } from '../src/server/routes/partnerReferrals';

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
  });

  it('accepts explicit Firebase admin:true claim', async () => {
    const result = await requestAdmin({ uid: 'admin-1', admin: true });
    expect(result.response.status).toBe(200);
    expect(await result.response.json()).toEqual({ campaigns: [] });
    expect(result.getFirestore).toHaveBeenCalled();
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
      ['/api/partner/open/invalid!', { method: 'POST' }],
    ] as const) {
      const response = await fetch(base + path, init);
      if (path === '/api/partner/referrals') {
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ consent: { allowed: true }, referrals: [] });
      } else {
        expect(response.status).toBe(400);
      }
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('pragma')).toBe('no-cache');
    }
  });

});
