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

function dbFor(user: { exists?: boolean; data?: Record<string, unknown> } = {}) {
  const set = vi.fn(async () => undefined);
  const get = vi.fn(async () => ({
    exists: user.exists ?? true,
    data: () => user.data ?? { isAdult: true, location: 'München' },
  }));
  const db = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn(() => name === 'users' ? { get } : { set }),
    })),
  } as any;
  return { db, set, get };
}

async function endpoint(overrides: Partial<ProfileRecommendationsRouterDeps> = {}, user?: { exists?: boolean; data?: Record<string, unknown> }) {
  const store = dbFor(user);
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
    expect(ctx.store.set).toHaveBeenCalledWith(profile);
    expect(await response.json()).toEqual({ ok: true, city: 'München' });
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
