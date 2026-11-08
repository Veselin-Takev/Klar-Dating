// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { TenantAwareFirestoreRepository } from '../src/server/TenantAwareFirestoreRepository';
import type { AddressInfo } from 'node:net';
import { createChecklistRouter } from '../src/server/routes/checklists';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
beforeEach(() => vi.stubEnv('KLAR_TENANT_CHECKLIST_MIGRATION_READY','true'));
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });

function endpoint(initial: Record<string, unknown> = {}) {
  const set = vi.fn(async () => undefined);
  const get = vi.fn(async () => ({ exists: Object.keys(initial).length > 0, data: () => initial }));
  const doc = vi.fn((_path:string) => ({get,set}));
  const db = {doc} as unknown as Firestore;
  const app = express(); app.use(express.json()); app.use('/api', createChecklistRouter({ currentUserId: () => 'user-a', repositoryFor: () => new TenantAwareFirestoreRepository(db, {uid:'user-a'}) }));
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  return new Promise<{base:string,set:typeof set,doc:typeof doc}>(resolve => server.once('listening', () => resolve({ base: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api', set, doc })));
}

describe('date prep checklist endpoint', () => {
  it('refuses unapproved data cutover without opening the database', async () => {
    vi.stubEnv('KLAR_TENANT_CHECKLIST_MIGRATION_READY','false');
    const ctx = await endpoint();
    expect((await fetch(ctx.base + '/checklists/date_prep')).status).toBe(503);
    expect(ctx.doc).not.toHaveBeenCalled();
  });
  it('returns server-authoritative defaults', async () => { const ctx = await endpoint(); const response = await fetch(ctx.base + '/checklists/date_prep'); expect(response.status).toBe(200); expect((await response.json()).checklist.location).toBe(false); });
  it('rejects unknown or malformed values', async () => { const ctx = await endpoint(); const response = await fetch(ctx.base + '/checklists/date_prep', { method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify({checklist:{location:'yes'}}) }); expect(response.status).toBe(400); expect(ctx.set).not.toHaveBeenCalled(); });
  it('writes only the UID-scoped checklist document', async () => { const ctx = await endpoint(); const response = await fetch(ctx.base + '/checklists/date_prep', { method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify({checklist:{location:true}}) }); expect(response.status).toBe(200); expect(ctx.doc).toHaveBeenCalledWith('tenants/default/users/user-a/checklists/date_prep'); expect(ctx.set).toHaveBeenCalledWith(expect.objectContaining({checklist:expect.objectContaining({location:true})}), {merge:true}); });
});
