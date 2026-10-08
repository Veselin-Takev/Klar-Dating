// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createLaunchRouter, type LaunchRouterDeps } from '../src/server/routes/launch';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
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

  it('fails closed when the referral public origin is not configured', async () => {
    const ctx = await api({ publicUrl: () => undefined });
    const response = await fetch(ctx.base + '/referral');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Referral ist für diese Umgebung noch nicht konfiguriert.' });
    expect(ctx.db.collection).not.toHaveBeenCalled();
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

  it('deduplicates activation event names in the summary', async () => {
    const db = baseDb();
    db.collection = vi.fn((name: string) => {
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
