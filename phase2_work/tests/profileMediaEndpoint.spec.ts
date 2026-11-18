// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import { createProfileMediaRouter, createCanonicalMediaRef } from '../src/server/platform/profileMedia';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r())))); vi.restoreAllMocks(); });

async function setup(options: { token?: string; provider?: string; requester?: Record<string, unknown>; target?: Record<string, unknown>; requesterDeleted?: boolean; targetDeleted?: boolean; blocked?: boolean; exists?: boolean; selfView?: boolean; targetUid?: string } = {}) {
  const requester = {
    isAdult: true,
    active: true,
    ...(options.selfView ? { photoURL: 'https://firebasestorage.googleapis.com/v0/b/demo-klar.appspot.com/o/profiles%2Fviewer%2Fphoto.jpg?alt=media&token=legacy-test-token' } : {}),
    ...(options.requester ?? {}),
  };
  const targetUid = options.targetUid ?? 'target';
  const target = { isAdult: true, active: true, ...(options.target ?? {}) };
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
  const app = express();
  app.use('/api', createProfileMediaRouter({
    getFirestore: () => db,
    getAuth: () => ({ verifyIdToken: vi.fn(async (token: string, checkRevoked: boolean) => {
      if (token !== 'valid' || checkRevoked !== true) throw new Error('invalid');
      return { uid: 'viewer', firebase: { sign_in_provider: options.provider ?? 'password' } };
    }) } as any),
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
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, headers, requestedPaths };
}

describe('authenticated profile media delivery', () => {
  it('denies missing and invalid credentials', async () => {
    const missing = await setup(); expect((await fetch(missing.url)).status).toBe(401);
    const invalid = await setup({ token: 'bad' }); expect((await fetch(invalid.url, { headers: invalid.headers })).status).toBe(401);
  });
  it.each([
    ['guest', { provider: 'anonymous' }],
    ['underage requester', { requester: { isAdult: false } }],
    ['inactive requester', { requester: { active: false } }],
    ['suspended requester', { requester: { isSuspended: true } }],
    ['deletion-pending requester', { requesterDeleted: true }],
    ['underage target', { target: { isAdult: false } }],
    ['suspended target', { target: { isSuspended: true } }],
    ['deletion-pending target', { targetDeleted: true }],
    ['mutually blocked pair', { blocked: true }],
  ] as const)('denies %s', async (_name, options) => {
    const ctx = await setup({ token: 'valid', ...options });
    expect([403, 404]).toContain((await fetch(ctx.url, { headers: ctx.headers })).status);
  });
  it('denies self-reads through the other-profile route', async () => {
    const ctx = await setup({ token: 'valid', targetUid: 'viewer' });
    expect((await fetch(ctx.url, { headers: ctx.headers })).status).toBe(404);
    expect(ctx.requestedPaths).toEqual([]);
  });
  it('serves own profile media through the UID-bound self-view route', async () => {
    const ctx = await setup({ token: 'valid', selfView: true });
    const response = await fetch(ctx.url, { headers: ctx.headers });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.text()).toBe('image-bytes');
    expect(ctx.requestedPaths).toEqual(['profiles/viewer/photo.jpg']);
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
});
