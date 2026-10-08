// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createChecklistRouter } from '../src/server/routes/checklists';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });

function endpoint(initial: Record<string, unknown> = {}) {
  const set = vi.fn(async () => undefined);
  const get = vi.fn(async () => ({ exists: Object.keys(initial).length > 0, data: () => initial }));
  const db = { doc: vi.fn(() => ({ get, set })) } as any;
  const app = express(); app.use(express.json()); app.use('/api', createChecklistRouter({ currentUserId: () => 'user-a', getFirestore: () => db }));
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  return new Promise<{base:string,set:any}>(resolve => server.once('listening', () => resolve({ base: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api', set })));
}

describe('date prep checklist endpoint', () => {
  it('returns server-authoritative defaults', async () => { const ctx = await endpoint(); const response = await fetch(ctx.base + '/checklists/date_prep'); expect(response.status).toBe(200); expect((await response.json()).checklist.location).toBe(false); });
  it('rejects unknown or malformed values', async () => { const ctx = await endpoint(); const response = await fetch(ctx.base + '/checklists/date_prep', { method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify({checklist:{location:'yes'}}) }); expect(response.status).toBe(400); expect(ctx.set).not.toHaveBeenCalled(); });
  it('writes only the UID-scoped checklist document', async () => { const ctx = await endpoint(); const response = await fetch(ctx.base + '/checklists/date_prep', { method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify({checklist:{location:true}}) }); expect(response.status).toBe(200); expect(ctx.set).toHaveBeenCalledWith(expect.objectContaining({checklist:expect.objectContaining({location:true})}), {merge:true}); });
});
