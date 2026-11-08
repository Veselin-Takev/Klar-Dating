// @vitest-environment node
import express, { type Request } from 'express';
import { afterEach, expect, it } from 'vitest';
import { createMediaAccessGuard } from '../src/server/mediaAccess';
import { tenantRepositoryHarness } from './helpers/tenantRepositoryHarness';

const servers: ReturnType<typeof express.application.listen>[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await new Promise<void>(resolve => server.close(() => resolve())); });
async function endpoint(provider: string | null, data: Record<string, unknown> | null, deletion = false, fail = false) {
  const fixture = tenantRepositoryHarness({...(data ? {'users/reader':data} : {}), ...(deletion ? {'account_deletions/reader':{status:'pending'}} : {})}, () => { if(fail) throw new Error('unavailable'); });
  const app = express();
  app.use((req,_res,next) => { req.user = {uid:'reader',firebase:{sign_in_provider:provider}} as unknown as Request['user'];next(); });
  app.use(createMediaAccessGuard(() => fixture.repo));
  app.get(/.*/, (_req,res) => res.json({media:'authorized'}));
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const listener = app.listen(0,'127.0.0.1',()=>resolve(listener)); });
  servers.push(server);
  const addr = server.address(); if(!addr || typeof addr === 'string')throw new Error('listen_failed');
  return `http://127.0.0.1:${addr.port}`;
}
it.each(['anonymous',null])('rejects guest/missing-provider claims before returning profile data (%s)', async provider => {
  const base = await endpoint(provider,{isAdult:true,mediaAccessState:'active'});
  for(const path of ['/recommendations','/Recommendations/','/chats','/chats/other','/date-planner/connections','/media/profile']) {
    const response=await fetch(base+path);expect(response.status).toBe(403);expect(await response.json()).not.toHaveProperty('media');
  }
});
it.each([null,{isAdult:false,mediaAccessState:'active'},{isAdult:true},{isAdult:true,mediaAccessState:'erasing'}])('denies missing/underage/unmigrated/erasing authoritative states (%j)', async data => {
  const base=await endpoint('password',data);expect((await fetch(base+'/recommendations')).status).toBe(403);
});
it('denies a tombstone even if a stale adult media fence is active',async()=>{
  const base=await endpoint('password',{isAdult:true,mediaAccessState:'active'},true);expect((await fetch(base+'/chats')).status).toBe(403);
});
it('fails closed on repository failure',async()=>{
  const base=await endpoint('password',{isAdult:true,mediaAccessState:'active'},false,true);expect((await fetch(base+'/recommendations')).status).toBe(503);
});
it('allows an authoritative active adult and leaves unrelated account recovery paths available',async()=>{
  const base=await endpoint('password',{isAdult:true,mediaAccessState:'active'});const response=await fetch(base+'/recommendations');expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
  const guest=await endpoint('anonymous',null);expect((await fetch(guest+'/account/export')).status).toBe(200);
});
