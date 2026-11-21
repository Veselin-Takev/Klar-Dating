// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createProfileRecommendationsRouter, type ProfileRecommendationsRouterDeps } from '../src/server/routes/profileRecommendations';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.restoreAllMocks();
});

function dbFor(
  user: { exists?: boolean; data?: Record<string, unknown>; deletionPending?: boolean } = {},
  deletionExists = false,
  simulateDeletionRace = false,
) {
  const set = vi.fn(async (_ref: unknown, _data: unknown) => undefined);
  const get = vi.fn(async () => ({
    exists: user.exists ?? true,
    data: () => ({ isAdult: true, active: true, location: 'München', ...(user.data ?? {}) }),
  }));
  const refs = new Map<string, { collection: string; id: string }>();
  const collection = vi.fn((name: string) => ({
    doc: vi.fn((id: string) => {
      const ref = { collection: name, id };
      refs.set(name + '/' + id, ref);
      return { ...ref, get: name === 'account_deletions' ? vi.fn(async () => ({ exists: deletionBarrierExists })) : get, set };
    }),
  }));
  let deletionBarrierExists = deletionExists || user.deletionPending === true;
  // Firestore invokes the transaction callback again after a contention retry;
  // runTransaction itself is still called only once by the route.
  const transactionAttempts = vi.fn();
  const runTransaction = vi.fn(async (work: (tx: any) => Promise<unknown>) => {
    let attempt = 0;
    while (true) {
      const stagedWrites: Array<[ref: unknown, data: unknown]> = [];
      transactionAttempts();
      const result = await work({
        get: async (ref: { collection: string }) => ref.collection === 'account_deletions'
          ? { exists: deletionBarrierExists, data: () => ({ status: 'pending' }) }
          : { exists: user.exists ?? true, data: () => user.data ?? { isAdult: true, location: 'München' } },
        set: (ref: unknown, data: unknown) => { stagedWrites.push([ref, data]); },
      });
      // Simulate Firestore retry after the deletion transaction wins the
      // conflict: writes from attempt one are discarded, and attempt two
      // observes the durable deletion barrier.
      if (simulateDeletionRace && attempt === 0) {
        deletionBarrierExists = true;
        attempt += 1;
        continue;
      }
      for (const [ref, data] of stagedWrites) set(ref, data);
      return result;
    }
  });
  const db = { collection, runTransaction } as any;
  return { db, set, get, runTransaction, transactionAttempts };
}

async function endpoint(
  overrides: Partial<ProfileRecommendationsRouterDeps> = {},
  user?: { exists?: boolean; data?: Record<string, unknown>; deletionPending?: boolean },
  deletionExists = false,
  simulateDeletionRace = false,
) {
  const store = dbFor(user, deletionExists, simulateDeletionRace);
  const getRecommendations = vi.fn(async () => [{ id: 'candidate-1' }]);
  const deps: ProfileRecommendationsRouterDeps = {
    currentUserId: () => 'user-a',
    getFirestore: () => store.db,
    normalizeLaunchCity: value => typeof value === 'string' && ['München','Berlin','Hamburg','Köln','Frankfurt am Main'].includes(value) ? value as any : null,
    toPublicProfile: (uid, data) => ({
      id: uid,
      name: 'Alex',
      age: 30,
      location: String(data.location ?? 'München'),
      bio: '',
      photoUrl: '',
      interests: [],
    }),
    getRecommendations,
    ...overrides,
  };
  const app = express();
  app.use('/api', createProfileRecommendationsRouter(deps));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  return {
    base: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api',
    deps,
    store,
    getRecommendations,
  };
}

describe('profile publication and recommendation HTTP boundary', () => {
  it('requires authentication before profile access', async () => {
    const ctx = await endpoint({ currentUserId: () => null });
    expect((await fetch(ctx.base + '/recommendations')).status).toBe(401);
    expect(ctx.store.get).not.toHaveBeenCalled();
  });

  it('publishes only a validated public projection', async () => {
    const profile = { id: 'user-a', name: 'Alex', age: 30, location: 'München', bio: '', photoUrl: '', interests: [] };
    const ctx = await endpoint({ toPublicProfile: vi.fn(() => profile) });
    const response = await fetch(ctx.base + '/profile/publish', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(ctx.store.runTransaction).toHaveBeenCalledOnce();
    expect(ctx.store.set).toHaveBeenCalledWith(expect.objectContaining({ collection: 'public_profiles', id: 'user-a' }), profile);
    expect(await response.json()).toEqual({ ok: true, city: 'München' });
  });

  it('does not publish while an account-erasure barrier exists', async () => {
    const ctx = await endpoint({}, undefined, true);
    const response = await fetch(ctx.base + '/profile/publish', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, reason: 'Kontolöschung läuft bereits.' });
    expect(ctx.store.set).not.toHaveBeenCalled();
  });

  it('does not resurrect a public profile when deletion wins a transaction retry race', async () => {
    const ctx = await endpoint({}, undefined, false, true);
    const response = await fetch(ctx.base + '/profile/publish', { method: 'POST' });
    expect(response.status).toBe(200);
    // The route starts one Firestore transaction; Firestore retries its callback.
    expect(ctx.store.runTransaction).toHaveBeenCalledTimes(1);
    expect(ctx.store.transactionAttempts).toHaveBeenCalledTimes(2);
    expect(await response.json()).toEqual({ ok: false, reason: 'Kontolöschung läuft bereits.' });
    expect(ctx.store.set).not.toHaveBeenCalled();
  });

  it('does not publish example profiles', async () => {
    const ctx = await endpoint({}, { data: { isAdult: true, isExample: true, location: 'München' } });
    const response = await fetch(ctx.base + '/profile/publish', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: false, reason: 'Beispielprofile dürfen nicht veröffentlicht werden.' });
    expect(ctx.store.set).not.toHaveBeenCalled();
  });

  it('does not publish missing or underage/incomplete profiles', async () => {
    const missing = await endpoint({}, { exists: false });
    expect(await (await fetch(missing.base + '/profile/publish', { method: 'POST' })).json()).toMatchObject({ ok: false });

    const underage = await endpoint({}, { data: { isAdult: false, location: 'München' } });
    expect(await (await fetch(underage.base + '/profile/publish', { method: 'POST' })).json()).toMatchObject({ ok: false });
    expect(underage.store.set).not.toHaveBeenCalled();
  });

  it.each([
    'limit=abc',
    'limit=0',
    'limit=31',
    'minAge=17',
    'maxAge=101',
    'minAge=40&maxAge=30',
    'limit=1&limit=2',
    'city=London',
  ])('rejects malformed recommendation query: %s', async query => {
    const ctx = await endpoint();
    const response = await fetch(ctx.base + '/recommendations?' + query);
    expect(response.status).toBe(400);
    expect(ctx.getRecommendations).not.toHaveBeenCalled();
  });

  it.each([
    ['underage', { isAdult: false }, false],
    ['inactive', { active: false }, false],
    ['blocked', { isBlocked: true }, false],
    ['suspended', { isSuspended: true }, false],
    ['deletion-pending', {}, true],
  ] as const)('rejects %s requesters before recommendation computation', async (_label, data, deletionPending) => {
    const ctx = await endpoint({}, { data: { ...data, location: 'München' }, deletionPending });
    const response = await fetch(ctx.base + '/recommendations');
    expect(response.status).toBe(403);
    expect(ctx.getRecommendations).not.toHaveBeenCalled();
  });

  it('rejects guest requesters before reading recommendations', async () => {
    const ctx = await endpoint({ isGuest: () => true });
    const response = await fetch(ctx.base + '/recommendations');
    expect(response.status).toBe(403);
    expect(ctx.getRecommendations).not.toHaveBeenCalled();
  });

  it('rejects an unsupported stored city before recommendation computation', async () => {
    const ctx = await endpoint({}, { data: { isAdult: true, location: 'London' } });
    const response = await fetch(ctx.base + '/recommendations');
    expect(response.status).toBe(400);
    expect(ctx.getRecommendations).not.toHaveBeenCalled();
  });

  it('passes bounded defaults and stored profile dimensions to the domain service', async () => {
    const ctx = await endpoint({}, {
      data: {
        isAdult: true,
        location: 'München',
        interests: ['Wandern', 42],
        values: ['Ehrlichkeit'],
        goal: 'Langfristig',
        communication: ['Direkt'],
        availability: ['Wochenende'],
      },
    });
    const response = await fetch(ctx.base + '/recommendations?limit=5&minAge=25&maxAge=35');
    expect(response.status).toBe(200);
    expect(ctx.getRecommendations).toHaveBeenCalledWith(
      ctx.store.db,
      'user-a',
      expect.objectContaining({
        location: 'München',
        minAge: 25,
        maxAge: 35,
        limit: 5,
        interests: ['Wandern'],
        values: ['Ehrlichkeit'],
        relationshipGoals: ['Langfristig'],
      }),
    );
  });

  it('fails closed when recommendation computation is unavailable', async () => {
    const ctx = await endpoint({ getRecommendations: vi.fn(async () => { throw new Error('private detail'); }) });
    const response = await fetch(ctx.base + '/recommendations');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Vorschläge derzeit nicht verfügbar.', recommendations: [] });
  });
});
