// @vitest-environment node
// Audit-only characterization. A passing probe may reproduce a release blocker.
import {afterEach, expect, it, vi} from 'vitest';
import express from 'express';
import {ipKeyGenerator} from 'express-rate-limit';
import rateLimit from '../src/server/sharedRateLimit';
import {getServiceRepository} from '../src/server/firestoreRepository/nativeDatabase';
import {trustedProxyPolicy} from '../src/server/proxyTrust';
import type {AddressInfo} from 'node:net';
import {randomUUID} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {getServerFirebaseApp} from '../src/server/db';
import {tenantRepositoryHarness} from './helpers/tenantRepositoryHarness';
import {scopedFirestoreFixture} from './helpers/scopedFirestoreFixture';
import {createProfileRecommendationsRouter} from '../src/server/routes/profileRecommendations';
import {recordModerationDecision} from '../src/server/platform/dsaAppealEngine';
import {createMediaAccessGuard} from '../src/server/mediaAccess';
import {purgeAccountData} from '../src/server/trustAndSafety';
import {emptyDeletionCounts} from '../src/server/deletionAccounting';

const servers: ReturnType<ReturnType<typeof express>['listen']>[]=[];
afterEach(async()=>{
 await Promise.all(servers.splice(0).map(server=>new Promise<void>(resolve=>server.close(()=>resolve()))));
 vi.restoreAllMocks();vi.unstubAllEnvs();
});
async function serve(app:ReturnType<typeof express>){
 const server=app.listen(0,'127.0.0.1');servers.push(server);
 await new Promise<void>(resolve=>server.once('listening',resolve));
 return 'http://127.0.0.1:'+(server.address() as AddressInfo).port;
}
it('prevents synthetic PII in recommendation failure logs while the HTTP response is sanitized',async()=>{
 const marker='synthetic-audit-pii@example.test';
 const sink=vi.spyOn(console,'error').mockImplementation(()=>{});
 const fixture=tenantRepositoryHarness({'users/probe':{isAdult:true,mediaAccessState:'active',location:'Berlin'}});
 const app=express();app.use('/api',createProfileRecommendationsRouter({
  currentUserId:()=> 'probe',repository:()=>fixture.repo,toPublicProfile:()=>null,
  normalizeLaunchCity:()=> 'Berlin',getRecommendations:async()=>{throw new Error(marker)},
 }));
 const response=await fetch(await serve(app)+'/api/recommendations');
 expect(response.status).toBe(503);expect(await response.text()).not.toContain(marker);
 expect(sink.mock.calls.flat().some(value=>value instanceof Error && value.message.includes(marker))).toBe(false);
});
it.runIf(!!process.env.FIREBASE_STORAGE_EMULATOR_HOST)('preserves explicitly held verification metadata when no verification object exists',async()=>{
 vi.stubEnv('CONSENT_AUDIT_SECRET','synthetic-audit-secret-2026-only');
 const db=scopedFirestoreFixture(), uid='hold-audit-'+randomUUID(),requestId=randomUUID();
 const job=db.doc('account_deletions/'+uid),user=db.doc('users/'+uid),event=db.doc('verification_events/'+uid);
 await job.set({requestId,status:'pending',accountingVersion:2,deletedCounts:emptyDeletionCounts()});
 await user.set({isAdult:true,mediaAccessState:'erasing'});
 await event.set({uid,legalHold:true,photoPurgeHold:true,decision:'synthetic-held-record'});
 try {
  expect((await event.get()).data()?.legalHold).toBe(true);
  await expect(purgeAccountData(uid,requestId)).rejects.toThrow('deletion_legal_hold');
  expect((await event.get()).exists).toBe(true);
  expect((await job.get()).data()?.status).toBe('pending');
 }finally{await Promise.all([job.delete(),event.delete(),db.recursiveDelete(user)]);}
});
it.each(['account_suspension','account_termination'] as const)('enforces %s with Auth revocation and a closed media guard',async restrictionType=>{
 const auth=getAuth(getServerFirebaseApp());
 const revoke=vi.spyOn(auth,'revokeRefreshTokens').mockResolvedValue();
 const disable=vi.spyOn(auth,'updateUser').mockResolvedValue({uid:'probe'} as never);
 const f=tenantRepositoryHarness({'users/probe':{isAdult:true,mediaAccessState:'active',active:true},'reports/report':{reportedProfileId:'probe'}});
 await recordModerationDecision(f.repo,'report','moderator',{restrictionType,legalGround:'terms_violation',factsAndCircumstances:'Synthetic moderation audit decision.'});
 expect(f.store.get('tenants/default/users/probe')).toMatchObject({active:false,mediaAccessState:'blocked'});
 expect(revoke).toHaveBeenCalledOnce();expect(disable).toHaveBeenCalledOnce();
 const next=vi.fn(),res={set:vi.fn(),status:vi.fn().mockReturnThis(),json:vi.fn()};
 await createMediaAccessGuard(()=>f.repo)({path:'/recommendations',user:{uid:'probe',firebase:{sign_in_provider:'password'}}} as any,res as any,next);
 expect(next).not.toHaveBeenCalled();
});
it('shares a two-request policy across two independent HTTP server instances',async()=>{
 const namespace='audit-'+randomUUID();
 const make=()=>{const app=express();app.use(rateLimit({namespace,repository:()=>getServiceRepository('auth'),windowMs:60_000,limit:2,keyGenerator:req=>ipKeyGenerator(req.ip??''),validate:{xForwardedForHeader:false}}));app.get('/',(_req,res)=>res.sendStatus(200));return app;};
 const bases=await Promise.all([serve(make()),serve(make())]);
 expect((await fetch(bases[0]!)).status).toBe(200);expect((await fetch(bases[1]!)).status).toBe(200);
 for(const base of bases)expect((await fetch(base)).status).toBe(429);
});
it('rejects numeric proxy trust and ignores forged XFF by default',async()=>{
 vi.stubEnv('TRUST_PROXY_HOPS','1');expect(()=>trustedProxyPolicy()).toThrow('numeric_proxy_trust_forbidden');
 vi.stubEnv('TRUST_PROXY_HOPS','0');vi.stubEnv('KLAR_TRUSTED_PROXY_CIDRS','');
 const app=express();app.set('trust proxy',trustedProxyPolicy());app.get('/',(req,res)=>res.json({ip:req.ip}));
 const base=await serve(app);
 const result=await(await fetch(base,{headers:{'x-forwarded-for':'198.51.100.72'}})).json();
 expect(result.ip).toBe('127.0.0.1');
});
it.runIf(!!process.env.FIREBASE_AUTH_EMULATOR_HOST)('actual backend rejects identity/subdomain headers without a bearer credential',async()=>{
 const response=await fetch('http://127.0.0.1:3000/api/account/status',{headers:{host:'foreign.example.test','x-tenant-id':'foreign','x-user-id':'admin','x-forwarded-host':'admin.example.test','x-forwarded-for':'198.51.100.73'}});
 expect(response.status).toBe(401);
});
it.runIf(!!process.env.FIREBASE_AUTH_EMULATOR_HOST)('actual backend accepts a verified owner without edge proof and ignores spoofed tenant/user/host headers',async()=>{
 if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST??''))throw new Error('local emulator required');
 const signup=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'audit-'+randomUUID()+'@example.test',password:'synthetic-emulator-password-123!',returnSecureToken:true})});
 expect(signup.status).toBe(200);const {localId:uid,idToken}=await signup.json();
 const db=scopedFirestoreFixture(),foreign='foreign-'+randomUUID();
 const own=db.doc('users/'+uid),foreignRef=db.doc('users/'+foreign);
 await own.set({isAdult:true,mediaAccessState:'active'});
 await own.collection('checklists').doc('date_prep').set({checklist:{location:true}});
 await foreignRef.collection('checklists').doc('date_prep').set({checklist:{location:false}});
 try{
  const response=await fetch('http://127.0.0.1:3000/api/checklists/date_prep?uid='+foreign+'&tenantId=foreign',{headers:{authorization:'Bearer '+idToken,host:'foreign.example.test','x-tenant-id':'foreign','x-user-id':foreign,'x-forwarded-host':'admin.example.test'}});
  expect(response.status).toBe(200);expect((await response.json()).checklist.location).toBe(true);
  expect((await foreignRef.collection('checklists').doc('date_prep').get()).data()?.checklist.location).toBe(false);
 }finally{await Promise.all([db.recursiveDelete(own),db.recursiveDelete(foreignRef),getAuth(getServerFirebaseApp()).deleteUser(uid)]);}
});
