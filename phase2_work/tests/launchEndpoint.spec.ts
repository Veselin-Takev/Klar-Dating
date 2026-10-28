// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { referralCodeFor } from '../src/server/platform/launchPlatform';
import type { AddressInfo } from 'node:net';
import { createLaunchRouter, type LaunchRouterDeps } from '../src/server/routes/launch';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function baseDb() {
  return {
    collection: vi.fn((_name: string) => ({
      doc: vi.fn((id: string) => ({ id, get: vi.fn(async () => ({ exists: true, data: () => ({ location: 'München', isAdult: true }) })), set: vi.fn(async () => undefined) })),
      where: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn(async () => ({ empty: true, docs: [] })) })) })),
    })),
    runTransaction: vi.fn(async (fn: any) => fn({ get: vi.fn(async () => ({ exists: false, data: () => undefined })), set: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() })),
  } as any;
}

function referralDb() {
  const store = new Map<string, Record<string, unknown>>([
    ['users/user-a', { isAdult: true, isVerified: false }],
    ['users/inviter', { referralCode: 'ABCDEFGHIJ', isVerified: false }],
  ]);
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  let beforeRead: (() => void) | undefined;
  const ref = (collection: string, id: string) => ({ id, path: collection + '/' + id });
  const snapshot = (r: { id: string; path: string }) => ({
    ...r, ref: r, exists: store.has(r.path), data: () => store.get(r.path),
  });
  const db = {
    collection: (collection: string) => ({
      doc: (id: string) => ref(collection, id),
      where: (field: string, _operator: string, value: unknown) => ({
        limit: (_limit: number) => ({
          get: async () => {
            const docs = [...store].filter(([key, data]) => key.startsWith(collection + '/') && data[field] === value)
              .map(([key]) => snapshot(ref(collection, key.slice(collection.length + 1))));
            return { docs, empty: docs.length === 0 };
          },
        }),
      }),
    }),
    runTransaction: async (callback: (tx: any) => unknown) => callback({
      get: async (r: { id: string; path: string }) => snapshot(r),
      getAll: async (...refs: Array<{ id: string; path: string }>) => {
        beforeRead?.();
        beforeRead = undefined;
        return refs.map(snapshot);
      },
      update: (r: { path: string }, data: Record<string, unknown>) => {
        if (!store.has(r.path)) throw new Error('NOT_FOUND');
        store.set(r.path, { ...store.get(r.path), ...data });
        writes.push({ path: r.path, data });
      },
      set: (r: { path: string }, data: Record<string, unknown>) => {
        store.set(r.path, { ...store.get(r.path), ...data });
        writes.push({ path: r.path, data });
      },
    }),
  };
  return { db: db as any, store, writes, beforeRead: (callback: () => void) => { beforeRead = callback; } };
}


async function api(overrides: Partial<LaunchRouterDeps> = {}) {
  const db = baseDb();
  const deps: LaunchRouterDeps = {
    currentUserId: () => 'user-a',
    getFirestore: () => db,
    normalizeLaunchCity: value => typeof value === 'string' && value.toLowerCase().includes('münchen') ? 'München' : null,
    getLocalDensity: vi.fn(async () => ({ city: 'München', activeUsers: 4, verifiedUsers: 2, band: 'building', threshold: 5 })),
    referralCodeFor: () => 'ABCDEFGHIJ',
    recordActivation: vi.fn(async () => ({ eventId: 'evt-12345678', weight: 10 })),
    activationScore: events => ({ score: events.length * 10, activated: false }),
    serverTimestamp: () => 'server-time',
    publicUrl: () => 'https://klar.app',
    ...overrides,
  };
  const app = express();
  app.use('/api', createLaunchRouter(deps));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  return { base: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api', deps, db };
}

describe('launch/referral/activation HTTP boundary', () => {
  it('requires authentication before launch data access', async () => {
    const ctx = await api({ currentUserId: () => null });
    expect((await fetch(ctx.base + '/launch/summary')).status).toBe(401);
    expect(ctx.deps.getLocalDensity).not.toHaveBeenCalled();
  });

  it('returns aggregate launch density without exposing profiles', async () => {
    const ctx = await api();
    const response = await fetch(ctx.base + '/launch/summary?city=M%C3%BCnchen');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ city: 'München', activeUsers: 4, verifiedUsers: 2, band: 'building', threshold: 5 });
    expect(body.message).toContain('auf');
  });

  it('rejects malformed referral codes before database lookup', async () => {
    const ctx = await api();
    const response = await fetch(ctx.base + '/referral/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'bad' }),
    });
    expect(response.status).toBe(400);
    expect(ctx.db.collection).toHaveBeenCalledTimes(1);
    expect(ctx.db.collection).toHaveBeenCalledWith('rate_limit_launch_referral_claim');
  });


  it('accepts generated base64url invitation codes before resolving their owner', async () => {
    vi.stubEnv('REFERRAL_CODE_SECRET', 'test-only-referral-contract-secret-0123456789');
    const generated = Array.from({ length: 500 }, (_, index) => referralCodeFor('contract-user-' + index));
    const code = generated.find(value => /[_-]/.test(value));
    expect(code).toBeDefined();
    const ctx = await api();
    const response = await fetch(ctx.base + '/referral/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code!.toLowerCase() }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Einladung nicht verfügbar.' });
    expect(ctx.db.collection).toHaveBeenCalledWith('users');
  });

  it.each(['ABC!EFGHIJ', 'ABCDEFGHI', 'ABCDEFGHIJK', 'ABCD/EFGHI', 'ABCD.EFGHI', 'ÄBCDEFGHIJ'])(
    'rejects invalid invitation code %s before owner lookup', async code => {
      const ctx = await api();
      const response = await fetch(ctx.base + '/referral/claim', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Ungültiger Einladungslink.' });
      expect(ctx.db.collection).not.toHaveBeenCalledWith('users');
    },
  );



  it.each(['missing', 'deleting'])('does not issue a code for a %s profile', async state => {
    const fixture = referralDb();
    if (state === 'missing') fixture.store.delete('users/user-a');
    else fixture.beforeRead(() => { fixture.store.set('account_deletions/user-a', {}); });
    const ctx = await api({ getFirestore: () => fixture.db });
    const response = await fetch(ctx.base + '/referral');
    expect(response.status).toBe(409);
    expect(fixture.writes.filter(write => write.path.startsWith('users/'))).toHaveLength(0);
    if (state === 'missing') expect(fixture.store.has('users/user-a')).toBe(false);
  });

  it.each(['missing-invitee', 'missing-inviter', 'deleting-invitee', 'deleting-inviter'])(
    'rejects a claim when the transactional state becomes %s', async state => {
      const fixture = referralDb();
      fixture.beforeRead(() => {
        if (state === 'missing-invitee') fixture.store.delete('users/user-a');
        if (state === 'missing-inviter') fixture.store.delete('users/inviter');
        if (state === 'deleting-invitee') fixture.store.set('account_deletions/user-a', {});
        if (state === 'deleting-inviter') fixture.store.set('account_deletions/inviter', {});
      });
      const ctx = await api({ getFirestore: () => fixture.db });
      const response = await fetch(ctx.base + '/referral/claim', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'ABCDEFGHIJ' }),
      });
      expect(response.status).toBe(409);
      expect(fixture.writes.filter(write => write.path.startsWith('users/') || write.path.startsWith('referral_events/'))).toHaveLength(0);
    },
  );

  it('keeps eligible generation and repeated claims compatible without granting verification', async () => {
    const fixture = referralDb();
    const ctx = await api({ getFirestore: () => fixture.db, referralCodeFor: () => 'SELFKEY123' });
    const issued = await fetch(ctx.base + '/referral');
    expect(issued.status).toBe(200);
    expect(await issued.json()).toEqual({ code: 'SELFKEY123', shareUrl: 'https://klar.app/?ref=SELFKEY123' });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(ctx.base + '/referral/claim', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'ABCDEFGHIJ' }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    }
    expect(fixture.store.get('users/user-a')).toMatchObject({ referredBy: 'inviter', referralQualified: false, isVerified: false });
    expect(fixture.writes.filter(write => write.path.startsWith('referral_events/'))).toHaveLength(1);
    expect(fixture.store.get('users/inviter')?.isVerified).toBe(false);
  });


  it('fails closed when the referral public origin is not configured', async () => {
    const ctx = await api({ publicUrl: () => undefined });
    const response = await fetch(ctx.base + '/referral');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Referral ist für diese Umgebung noch nicht konfiguriert.' });
    expect(ctx.db.collection).toHaveBeenCalledTimes(1);
    expect(ctx.db.collection).toHaveBeenCalledWith('rate_limit_launch_referral_generation');
  });

  it('maps duplicate activation writes to an idempotent 200 response', async () => {
    const duplicate = Object.assign(new Error('Already exists'), { code: 6 });
    const ctx = await api({ recordActivation: vi.fn(async () => { throw duplicate; }) });
    const response = await fetch(ctx.base + '/activation', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventName: 'first_contact' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ duplicate: true });
  });

  it('requires authentication before founding-claim transactions', async () => {
    const ctx = await api({ currentUserId: () => null });
    const response = await fetch(ctx.base + '/launch/founding-claim', { method: 'POST' });
    expect(response.status).toBe(401);
    expect(ctx.db.runTransaction).not.toHaveBeenCalled();
  });

  it('suppresses activation-event readback while account deletion is pending', async () => {
    const db = baseDb();
    const eventQuery = vi.fn();
    db.collection = vi.fn((name: string) => {
      if (name === 'account_deletions') return {
        doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: true })) })),
      } as any;
      if (name === 'activation_events') return { where: eventQuery } as any;
      return baseDb().collection(name);
    });
    const ctx = await api({ getFirestore: () => db });
    const response = await fetch(ctx.base + '/activation/summary');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Aktivierungsstatus für dieses Konto nicht verfügbar.' });
    expect(eventQuery).not.toHaveBeenCalled();
  });

  it('fails closed if deletion marker status cannot be loaded', async () => {
    const db = baseDb();
    const eventQuery = vi.fn();
    db.collection = vi.fn((name: string) => {
      if (name === 'account_deletions') return {
        doc: vi.fn(() => ({ get: vi.fn(async () => { throw new Error('Firestore unavailable'); }) })),
      } as any;
      if (name === 'activation_events') return { where: eventQuery } as any;
      return baseDb().collection(name);
    });
    const ctx = await api({ getFirestore: () => db });
    const response = await fetch(ctx.base + '/activation/summary');
    expect(response.status).toBe(503);
    expect(eventQuery).not.toHaveBeenCalled();
  });

  it('deduplicates activation event names in the summary', async () => {
    const db = baseDb();
    db.collection = vi.fn((name: string) => {
      if (name === 'account_deletions') return {
        doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: false })) })),
      } as any;
      if (name === 'activation_events') return {
        where: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn(async () => ({
          docs: [
            { data: () => ({ eventName: 'first_contact' }) },
            { data: () => ({ eventName: 'first_contact' }) },
            { data: () => ({ eventName: 'first_conversation' }) },
          ],
        })) })) })),
      } as any;
      return baseDb().collection(name);
    });
    const ctx = await api({ getFirestore: () => db });
    const response = await fetch(ctx.base + '/activation/summary');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ score: 20, activated: false, events: ['first_contact', 'first_conversation'] });
  });
});
