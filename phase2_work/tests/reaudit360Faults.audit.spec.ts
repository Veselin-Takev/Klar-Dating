// @vitest-environment node
// Audit-only probes; not a remediation change or security acceptance suite.
import {afterEach,expect,it,vi} from 'vitest';
import {getAuth} from 'firebase-admin/auth';
import {getServerFirebaseApp} from '../src/server/db';
import {tenantRepositoryHarness} from './helpers/tenantRepositoryHarness';
import {requestAccountDeletion,runAccountDeletion,type DeletionDependencies} from '../src/server/accountDeletion';
import {emptyDeletionCounts,deletionReceiptId} from '../src/server/deletionAccounting';
afterEach(()=>vi.restoreAllMocks());
it('attempts refresh-token revocation even when the independent disable call fails',async()=>{
 const auth=getAuth(getServerFirebaseApp());
 vi.spyOn(auth,'updateUser').mockRejectedValue(new Error('injected Auth outage'));
 const revoke=vi.spyOn(auth,'revokeRefreshTokens').mockResolvedValue();
 const f=tenantRepositoryHarness({'users/probe':{isAdult:true,mediaAccessState:'active'}});
 await expect(requestAccountDeletion('probe',f.repo)).rejects.toThrow('account_security_retry_required');
 expect(revoke).toHaveBeenCalledOnce();
 expect(f.store.get('tenants/default/users/probe')?.mediaAccessState).toBe('erasing');
 expect(f.store.get('tenants/default/account_deletions/probe')?.status).toBe('pending');
 console.log('REGRESSION: disable failure -> revokeRefreshTokens calls=1; durable deletion fence persists');
});
it('retains the durable fence when refresh-token revocation itself fails',async()=>{
 const auth=getAuth(getServerFirebaseApp());
 vi.spyOn(auth,'updateUser').mockResolvedValue({uid:'probe'} as never);
 const revoke=vi.spyOn(auth,'revokeRefreshTokens').mockRejectedValue(new Error('injected revoke outage'));
 const f=tenantRepositoryHarness({'users/probe':{isAdult:true,mediaAccessState:'active'}});
 await expect(requestAccountDeletion('probe',f.repo)).rejects.toThrow('account_security_retry_required');
 expect(revoke).toHaveBeenCalledOnce();
 expect(f.store.get('tenants/default/account_deletions/probe')?.status).toBe('pending');
});
function worker(){
 let now=Date.now(),authPresent=true,photoPresent=true;
 const f=tenantRepositoryHarness({'users/probe':{isAdult:true,mediaAccessState:'erasing'},'account_deletions/probe':{requestId:'audit-probe',status:'pending',phase:'purge',leaseUntil:0,attempts:0,nextAttemptAt:new Date(0),accountingVersion:2,deletedCounts:emptyDeletionCounts(),hasDidit:false}});
 const deps:DeletionDependencies={repository:f.repo,now:()=>now,disable:vi.fn(async()=>{}),purge:vi.fn(async()=>{photoPresent=false;f.store.delete('tenants/default/users/probe')}),removeAuth:vi.fn(async()=>{authPresent=false}),eraseProvider:vi.fn(async()=>true),cancelSubscription:vi.fn(async()=>{})};
 return{f,deps,advance:(ms:number)=>{now+=ms},auth:()=>authPresent,photo:()=>photoPresent,job:()=>f.store.get('tenants/default/account_deletions/probe'),receipt:()=>f.store.get('tenants/default/deletion_log/'+deletionReceiptId('audit-probe'))};
}
it('does not mark completed after partial purge and Auth failure, then idempotently resumes',async()=>{
 const w=worker();vi.mocked(w.deps.removeAuth).mockRejectedValueOnce(new Error('Auth unavailable after Storage/Firestore purge'));
 await runAccountDeletion('probe',w.deps);
 expect(w.photo()).toBe(false);expect(w.auth()).toBe(true);expect(w.job()).toMatchObject({status:'pending',lastError:'retry_required'});expect(w.receipt()).toBeUndefined();
 w.advance(600_000);await runAccountDeletion('probe',w.deps);expect(w.auth()).toBe(false);expect(w.job()).toMatchObject({status:'pending',phase:'final_sweep'});
 w.advance(62*60_000);await runAccountDeletion('probe',w.deps);expect(w.job()?.status).toBe('completed');expect(w.receipt()?.status).toBe('completed');
 const proof=JSON.stringify(w.receipt());await runAccountDeletion('probe',w.deps);expect(JSON.stringify(w.receipt())).toBe(proof);
});
it('continues automatic retries after repeated failures while escalating attention',async()=>{
 const w=worker();w.f.store.get('tenants/default/account_deletions/probe')!.attempts=49;
 vi.mocked(w.deps.purge).mockRejectedValue(new Error('persistent Storage failure'));
 await runAccountDeletion('probe',w.deps);expect(w.job()).toMatchObject({status:'pending',requiresAttention:true});expect(w.auth()).toBe(true);expect(w.receipt()).toBeUndefined();
 w.advance(2*86400_000);await runAccountDeletion('probe',w.deps);expect(w.deps.purge).toHaveBeenCalledTimes(2);expect(w.job()).toMatchObject({status:'pending',requiresAttention:true});
});
