// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { createProfileMediaRouter, createCanonicalMediaRef } from '../src/server/platform/profileMedia';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r())))); vi.restoreAllMocks(); });

async function setup(options: { token?: string; provider?: string; requester?: Record<string, unknown>; target?: Record<string, unknown>; requesterDeleted?: boolean; targetDeleted?: boolean; blocked?: boolean; exists?: boolean; selfView?: boolean; canonicalSelfView?: boolean; targetUid?: string; firestoreFailure?: boolean } = {}) {
  const requester = {
    isAdult: true,
    active: true,
    isSuspended: false,
    isBlocked: false,
    deletionPending: false,
    ...(options.selfView ? { photoURL: options.canonicalSelfView
      ? createCanonicalMediaRef('viewer', 'profiles/viewer/photo.jpg')
      : 'https://firebasestorage.googleapis.com/v0/b/demo-klar.appspot.com/o/profiles%2Fviewer%2Fphoto.jpg?alt=media&token=legacy-test-token' } : {}),
    ...(options.requester ?? {}),
  };
  const targetUid = options.targetUid ?? 'target';
  const target = { isAdult: true, active: true, isSuspended: false, isBlocked: false, deletionPending: false, ...(options.target ?? {}) };
  const requestedPaths: string[] = [];
  const db = { collection: (name: string) => {
    if (name === 'users') return { doc: (uid: string) => ({ get: async () => ({ exists: true, data: () => uid === 'viewer' ? requester : target }) }) };
    if (name === 'account_deletions') return { doc: (uid: string) => ({ get: async () => ({ exists: uid === 'viewer' ? !!options.requesterDeleted : !!options.targetDeleted }) }) };
    return { where: () => ({ where: () => ({ limit: () => ({ get: async () => ({ empty: !options.blocked }) }) }) }) };
  } } as any;
  const file = {
    exists: async () => [options.exists !== false],
    getMetadata: async () => [{ contentType: 'image/jpeg', size: '12' }],
    createReadStream: () => Readable.from([Buffer.from('image-bytes')]),
  };
  const verifyIdToken = vi.fn(async (token: string, checkRevoked: boolean) => {
    if (token !== 'valid' || checkRevoked !== true) throw new Error('invalid');
    return { uid: 'viewer', firebase: { sign_in_provider: options.provider ?? 'password' } };
  });
  const app = express();
  app.use('/api', createProfileMediaRouter({
    getFirestore: () => {
      if (options.firestoreFailure) throw new Error('Firestore unavailable');
      return db;
    },
    getAuth: () => ({ verifyIdToken }) as any,
    getBucket: () => ({ file: (path: string) => { requestedPaths.push(path); return file; } }) as any,
  }));
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const ref = createCanonicalMediaRef(targetUid, `profiles/${targetUid}/photo.jpg`);
  const headers = new Headers();
  if (options.token !== undefined) headers.set('Authorization', `Bearer ${options.token}`);
  const path = options.selfView
    ? '/api/profile-media/self'
    : `/api/profile-media/${encodeURIComponent(targetUid)}/${encodeURIComponent(ref)}`;
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, headers, requestedPaths, verifyIdToken };
}

describe('authenticated profile media delivery', () => {
  it('returns 401 only for missing or invalid Firebase ID tokens', async () => {
    const missing = await setup();
    expect((await fetch(missing.url)).status).toBe(401);
    expect(missing.verifyIdToken).not.toHaveBeenCalled();

    const invalid = await setup({ token: 'bad' });
    expect((await fetch(invalid.url, { headers: invalid.headers })).status).toBe(401);
    expect(invalid.verifyIdToken).toHaveBeenCalledWith('bad', true);

    const valid = await setup({ token: 'valid' });
    await fetch(valid.url, { headers: valid.headers });
    expect(valid.verifyIdToken).toHaveBeenCalledWith('valid', true);
  });
  it.each([
    ['guest', { provider: 'anonymous' }, 403],
    ['underage requester', { requester: { isAdult: false } }, 403],
    ['inactive requester', { requester: { active: false } }, 403],
    ['suspended requester', { requester: { isSuspended: true } }, 403],
    ['missing suspension state requester', { requester: { isSuspended: undefined } }, 403],
    ['missing block state requester', { requester: { isBlocked: undefined } }, 403],
    ['missing deletion state requester', { requester: { deletionPending: undefined } }, 403],
    ['deletion flag requester', { requester: { deletionPending: true } }, 403],
    ['deletion-pending requester', { requesterDeleted: true }, 403],
    ['underage target', { target: { isAdult: false } }, 404],
    ['suspended target', { target: { isSuspended: true } }, 404],
    ['missing suspension state target', { target: { isSuspended: undefined } }, 404],
    ['missing block state target', { target: { isBlocked: undefined } }, 404],
    ['missing deletion state target', { target: { deletionPending: undefined } }, 404],
    ['deletion flag target', { target: { deletionPending: true } }, 404],
    ['deletion-pending target', { targetDeleted: true }, 404],
    ['mutually blocked pair', { blocked: true }, 404],
  ] as const)('denies %s with the expected authorization status', async (_name, options, expectedStatus) => {
    const ctx = await setup({ token: 'valid', ...options });
    expect((await fetch(ctx.url, { headers: ctx.headers })).status).toBe(expectedStatus);
    expect(ctx.verifyIdToken).toHaveBeenCalledWith('valid', true);
  });
  it('denies self-reads through the other-profile route', async () => {
    const ctx = await setup({ token: 'valid', targetUid: 'viewer' });
    expect((await fetch(ctx.url, { headers: ctx.headers })).status).toBe(404);
    expect(ctx.requestedPaths).toEqual([]);
  });
  it('serves own profile media through the UID-bound self-view route', async () => {
    const ctx = await setup({ token: 'valid', selfView: true, canonicalSelfView: true });
    const response = await fetch(ctx.url, { headers: ctx.headers });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(await response.text()).toBe('image-bytes');
    expect(ctx.requestedPaths).toEqual(['profiles/viewer/photo.jpg']);
  });
  it('rejects legacy bearer download URLs on self-view without reading Storage', async () => {
    const ctx = await setup({ token: 'valid', selfView: true });
    const response = await fetch(ctx.url, { headers: ctx.headers });
    expect(response.status).toBe(404);
    expect(ctx.requestedPaths).toEqual([]);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('denies self-view for deletion-pending accounts', async () => {
    const ctx = await setup({ token: 'valid', selfView: true, requesterDeleted: true });
    expect((await fetch(ctx.url, { headers: ctx.headers })).status).toBe(403);
    expect(ctx.requestedPaths).toEqual([]);
  });
  it('streams image bytes only after every authorization check passes', async () => {
    const ctx = await setup({ token: 'valid' });
    const response = await fetch(ctx.url, { headers: ctx.headers });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.text()).toBe('image-bytes');
  });
  it('returns 500 rather than 401 for an authenticated backend dependency failure', async () => {
    const ctx = await setup({ token: 'valid', firestoreFailure: true });
    expect((await fetch(ctx.url, { headers: ctx.headers })).status).toBe(500);
    expect(ctx.verifyIdToken).toHaveBeenCalledWith('valid', true);
  });
});
