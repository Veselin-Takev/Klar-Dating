// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getDb } from '../src/server/db';
import { TenantAwareFirestoreRepository } from '../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { drainTenantMailQueue, type MailQueueProviders } from '../src/server/email';

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const schema = z.record(z.string(), z.unknown());
const cleanup: string[] = [];
afterEach(async () => { for (const path of cleanup.splice(0)) await getDb().doc(path).delete(); });
function context() {
  if (!/^(localhost|127\.0\.0\.1|\[::1\]):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) throw new Error('loopback emulator required');
  const tenant = 'mail-' + randomUUID();
  return {tenant, repo:new TenantAwareFirestoreRepository(getDb(), tenant)};
}
async function queue(tenant: string, id: string, patch: Record<string,unknown> = {}) {
  const path=`tenants/${tenant}/mail_queue/${id}`;cleanup.push(path);
  await getDb().doc(path).set({uid:'synthetic-owner',type:'verification',status:'pending',retryCount:0,nextAttemptAt:new Date(0),...patch});
  return getDb().doc(path);
}
function providers() {
  const send=vi.fn(async (_message: unknown) => undefined);
  const api:MailQueueProviders={available:true,getUser:async()=>({email:'synthetic@example.test'}),generateResetLink:async()=> 'https://example.test/reset?oobCode=synthetic',generateVerificationLink:async()=> 'https://example.test/verify?oobCode=synthetic',send};
  return {api,send};
}
describe.runIf(enabled)('native tenant mail outbox boundary', () => {
  it('dispatches its own job once and leaves root and foreign queues untouched', async () => {
    const {tenant,repo}=context(), {api,send}=providers();
    const own=await queue(tenant,'same-id'), foreign=await queue(tenant+'-foreign','same-id');
    const root='mail_queue/legacy-'+randomUUID();cleanup.push(root);await getDb().doc(root).set({status:'pending',uid:'synthetic-owner',nextAttemptAt:new Date(0)});
    await drainTenantMailQueue(repo,api);await drainTenantMailQueue(repo,api);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await own.get()).data()?.status).toBe('success');
    expect((await foreign.get()).data()?.status).toBe('pending');
    expect((await getDb().doc(root).get()).data()?.status).toBe('pending');
    expect(JSON.stringify(await repo.read('mail_queue/same-id',schema))).not.toContain('oobCode');
  });
  it('does not dispatch a pending erasure or an unavailable provider', async () => {
    const {tenant,repo}=context(), {api,send}=providers();const job=await queue(tenant,'blocked');
    const tombstone=`tenants/${tenant}/account_deletions/synthetic-owner`;cleanup.push(tombstone);await getDb().doc(tombstone).set({status:'pending'});
    await drainTenantMailQueue(repo,api);expect(send).not.toHaveBeenCalled();
    await getDb().doc(tombstone).delete();api.available=false;
    await drainTenantMailQueue(repo,api);expect(send).not.toHaveBeenCalled();expect((await job.get()).data()?.status).toBe('pending');
  });
  it('quarantines ambiguous dispatches rather than sending again', async () => {
    const {tenant,repo}=context(), {api,send}=providers();const job=await queue(tenant,'ambiguous');
    send.mockRejectedValueOnce(new Error('response lost after provider acceptance'));
    await drainTenantMailQueue(repo,api);await drainTenantMailQueue(repo,api);
    expect(send).toHaveBeenCalledTimes(1);expect((await job.get()).data()?.status).toBe('dispatch_unknown');
  });
  it('quarantines an expired dispatch lease without calling the provider', async () => {
    const {tenant,repo}=context(), {api,send}=providers();const job=await queue(tenant,'expired',{status:'dispatching',mailLease:'old',mailLeaseUntil:new Date(0)});
    await drainTenantMailQueue(repo,api);
    expect(send).not.toHaveBeenCalled();expect((await job.get()).data()?.status).toBe('dispatch_unknown');
  });
});
