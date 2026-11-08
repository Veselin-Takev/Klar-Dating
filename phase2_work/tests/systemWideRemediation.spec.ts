// @vitest-environment node
import {afterEach, expect, it, vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import express from 'express';
import type {AddressInfo} from 'node:net';
import {createMediaUploadAdmission} from '../src/server/routes/media';
import {FirestoreRateLimitStore} from '../src/server/sharedRateLimit';
import type {Options} from 'express-rate-limit';
import {getAuth} from 'firebase-admin/auth';
import {getServerFirebaseApp} from '../src/server/db';
import {getAppBucket} from '../src/server/storage';
import {scopedFirestoreFixture} from './helpers/scopedFirestoreFixture';
import {disableAndRevoke, enforceAccountLock} from '../src/server/accountSecurity';
import {recordModerationDecision} from '../src/server/platform/dsaAppealEngine';
import {tenantRepositoryHarness} from './helpers/tenantRepositoryHarness';
import {revokeAccountMediaCapabilities} from '../src/server/mediaCapabilities';
import {safeLogRecord} from '../functions/src/loggingPrivacy';
import {profileMediaPath, protectedMediaSource} from '../src/lib/profileMedia';
import {purgeAccountData} from '../src/server/trustAndSafety';
import {emptyDeletionCounts} from '../src/server/deletionAccounting';
import {DeletionStoragePageComplete} from '../src/server/deletionProgress';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
it('serializes same-key counter transactions during a parallel request burst',async()=>{
 const f=tenantRepositoryHarness(), store=new FirestoreRateLimitStore('parallel-regression',()=>f.repo);
 store.init({windowMs:60_000} as Options);
 const results=await Promise.all(Array.from({length:32},()=>store.increment('same-principal')));
 expect(results.map(result=>result.totalHits).sort((a,b)=>a-b)).toEqual(Array.from({length:32},(_,i)=>i+1));
});
it('bounds upload memory even if clients abort while the backend is still processing',async()=>{
 const app=express(),slots=createMediaUploadAdmission(1);
 let started!:()=>void,release!:()=>void;
 const ready=new Promise<void>(resolve=>{started=resolve});
 app.post('/',slots.admit,slots.run(async(_req,res)=>{started();await new Promise<void>(resolve=>{release=resolve});res.sendStatus(200)}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
 const controller=new AbortController();
 const first=fetch(base,{method:'POST',signal:controller.signal}).catch(()=>undefined);
 try{
  await ready;controller.abort();await first;
  expect((await fetch(base,{method:'POST'})).status).toBe(503);
  release();
 }finally{release?.();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
it.runIf(!!process.env.FIREBASE_STORAGE_EMULATOR_HOST)('retains the DSA retry job/fence when Auth disable fails, then resumes independent security steps',async()=>{
 const uid='lock-'+randomUUID(),auth=getAuth(getServerFirebaseApp());
 const disable=vi.spyOn(auth,'updateUser').mockRejectedValueOnce(new Error('injected provider failure')).mockResolvedValue({uid} as never);
 const revoke=vi.spyOn(auth,'revokeRefreshTokens').mockResolvedValue();
 const f=tenantRepositoryHarness({['users/'+uid]:{isAdult:true,mediaAccessState:'active'},'reports/probe':{reportedProfileId:uid}});
 await expect(recordModerationDecision(f.repo,'probe','moderator',{restrictionType:'account_suspension',legalGround:'terms_violation',factsAndCircumstances:'Synthetic regression decision.'})).rejects.toThrow('account_security_retry_required');
 expect(revoke).toHaveBeenCalledOnce();expect(f.store.has('tenants/default/account_locks/'+uid)).toBe(true);expect(f.store.has('tenants/default/account_security_jobs/'+uid)).toBe(true);
 await enforceAccountLock(uid,f.repo);
 expect(disable).toHaveBeenCalledTimes(2);expect(f.store.has('tenants/default/account_security_jobs/'+uid)).toBe(false);
 expect(f.store.has('tenants/default/account_locks/'+uid)).toBe(true);
});
it('filters actual stdout/stderr sinks, including trace, table and failed assertions',()=>{
 const result=spawnSync(process.execPath,['--import=tsx','--input-type=module','--eval',`
  import {installPrivacyLogging} from './functions/src/loggingPrivacy.ts';
  installPrivacyLogging();
  const privateError=new Error('synthetic-private@example.test');
  for(const level of ['log','info','warn','error','debug','trace','dir','table'])console[level](privateError);
  console.assert(false,privateError);console.assert(true,privateError);
  console.log(JSON.stringify({event:'http_request',status:503,email:'synthetic-private@example.test'}));
 `],{encoding:'utf8'});
 expect(result.status,result.stderr).toBe(0);
 const output=result.stdout+result.stderr;
 expect(output).not.toContain('synthetic-private');expect(output).not.toContain('Error:');
 expect(output.split('\n').filter(line=>line.startsWith('{'))).toHaveLength(10);
});
it.runIf(!!process.env.FIREBASE_STORAGE_EMULATOR_HOST)('does not acknowledge a newer security command when an older provider call finishes',async()=>{
 const uid='lease-'+randomUUID(),auth=getAuth(getServerFirebaseApp());
 let release!:()=>void, started!:()=>void;
 const ready=new Promise<void>(resolve=>{started=resolve});
 vi.spyOn(auth,'updateUser').mockImplementation(async()=>{started();await new Promise<void>(resolve=>{release=resolve});return {uid} as never;});
 vi.spyOn(auth,'revokeRefreshTokens').mockResolvedValue();
 const f=tenantRepositoryHarness({['users/'+uid]:{active:false},['account_locks/'+uid]:{lockedAt:new Date()},['account_security_jobs/'+uid]:{requestId:'old',action:'disable',leaseUntil:0}});
 const pending=enforceAccountLock(uid,f.repo);await ready;
 f.store.get('tenants/default/account_security_jobs/'+uid)!.requestId='new';release();await pending;
 expect(f.store.get('tenants/default/account_security_jobs/'+uid)?.requestId).toBe('new');
 expect(f.store.has('tenants/default/account_locks/'+uid)).toBe(true);
});
it.each(['disable','revoke'] as const)('attempts both security operations despite %s failure',async kind=>{
 const updateUser=vi.fn(async()=>{if(kind==='disable')throw new Error('synthetic-private@example.test');return {} as never;});
 const revokeRefreshTokens=vi.fn(async()=>{if(kind==='revoke')throw new Error('synthetic-private@example.test');});
 await expect(disableAndRevoke('synthetic',{updateUser,revokeRefreshTokens})).rejects.toThrow('account_security_retry_required');
 expect(updateUser).toHaveBeenCalledOnce();expect(revokeRefreshTokens).toHaveBeenCalledOnce();
});
it.each([
 [new Error('synthetic-private@example.test',{cause:'secret'})],
 [{email:'synthetic-private@example.test',phone:'+49123456789'}],
 ['raw synthetic-private@example.test'],
 [new Proxy({},{get(){throw new Error('getter must not execute')}})],
 [JSON.stringify({event:'http_request',email:'synthetic-private@example.test',status:503,route:'/person/private'})],
])('constructs logs only from allowlisted fields: %#',(...args)=>{
 const output=JSON.stringify(safeLogRecord('error',args));
 expect(output).not.toMatch(/synthetic-private|491234|secret|person\/private/);
});
it('rewrites own legacy media capabilities and refuses foreign buckets/path traversal',()=>{
 const legacy='https://firebasestorage.googleapis.com/v0/b/test-bucket/o/profiles%2Fowner%2Fphoto.jpg?alt=media&token=secret';
 expect(protectedMediaSource(legacy,'test-bucket')).toBe('/api/media/profiles/owner/photo.jpg');
 expect(protectedMediaSource(legacy,'foreign-bucket')).toBeNull();
 expect(()=>profileMediaPath('..','photo.jpg')).toThrow();
 expect(protectedMediaSource('/api/media/profiles/owner/photo.jpg?token=secret','test-bucket')).toBeNull();
});
it.runIf(!!process.env.FIREBASE_STORAGE_EMULATOR_HOST)('revokes an already captured legacy bearer capability without deleting held evidence',async()=>{
 const bucket=getAppBucket(),uid='capability-'+randomUUID(),token=randomUUID(),file=bucket.file(`profiles/${uid}/photo.jpg`);
 await file.save(Buffer.from([255,216,255,224]),{metadata:{contentType:'image/jpeg',metadata:{firebaseStorageDownloadTokens:token}}});
 const base='http://'+process.env.FIREBASE_STORAGE_EMULATOR_HOST;
 const url=base+'/v0/b/'+encodeURIComponent(bucket.name)+'/o/'+encodeURIComponent(file.name)+'?alt=media&token='+token;
 try{
  expect((await fetch(url)).status).toBe(200);
  await revokeAccountMediaCapabilities(uid,bucket);
  expect([401,403,404]).toContain((await fetch(url)).status);
  expect((await file.exists())[0]).toBe(true);
 }finally{await file.delete();}
});
it.runIf(!!process.env.FIREBASE_STORAGE_EMULATOR_HOST)('retries verified account-specific image erasure while keeping legacy/missing provenance fail closed',async()=>{
 vi.stubEnv('CONSENT_AUDIT_SECRET','synthetic-remediation-secret-not-for-production');
 const db=scopedFirestoreFixture(),bucket=getAppBucket(),uid='proof-'+randomUUID(),requestId=randomUUID();
 const user=db.doc('users/'+uid),job=db.doc('account_deletions/'+uid),event=db.doc('verification_events/'+uid),plan=db.doc('account_photo_purge_plans/'+uid);
 const file=bucket.file(`verification/${uid}/photo.jpg`);
 await file.save('synthetic evidence');const [metadata]=await file.getMetadata();
 await user.set({isAdult:true,mediaAccessState:'erasing'});
 await job.set({requestId,status:'pending',createdAt:new Date(Date.now()-62*60_000),accountingVersion:2,deletedCounts:emptyDeletionCounts()});
 await event.set({uid,storagePath:file.name,bucket:bucket.name,generation:metadata.generation,legalHold:false,photoPurgeHold:false,entscheidung:'bestaetigt'});
 try{
  await expect(purgeAccountData(uid,requestId)).rejects.toThrow('verification_photo_p0_fencing_unverified');
  expect((await file.exists())[0]).toBe(true);
  await plan.set({requestId,bucket:bucket.name,writerFenceVerified:true,legalApproved:true,evidenceDigest:'a'.repeat(64),expiresAt:new Date(Date.now()+300_000)});
  await event.update({legalHold:true});
  await expect(purgeAccountData(uid,requestId)).rejects.toThrow('deletion_legal_hold');
  expect((await file.exists())[0]).toBe(true);
  await event.update({legalHold:false});
  await expect(purgeAccountData(uid,requestId)).rejects.toBeInstanceOf(DeletionStoragePageComplete);
  expect((await file.exists())[0]).toBe(false);
  await purgeAccountData(uid,requestId);
  expect((await event.get()).exists).toBe(false);
  await purgeAccountData(uid,requestId);
 }finally{await Promise.all([file.delete().catch(()=>{}),db.recursiveDelete(user),job.delete(),event.delete(),plan.delete()]);}
});
it.runIf(!!process.env.FIREBASE_AUTH_EMULATOR_HOST)('serves uploaded media only through authenticated current-state API checks',async()=>{
 const signup=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:randomUUID()+'@example.test',password:'synthetic-password-123!',returnSecureToken:true})});
 const {localId:uid,idToken}=await signup.json();expect(typeof uid).toBe('string');
 const db=scopedFirestoreFixture(),user=db.doc('users/'+uid);await user.set({isAdult:true,mediaAccessState:'active'});
 const headers={authorization:'Bearer '+idToken};let path:string|undefined;
 try{
  const upload=await fetch('http://127.0.0.1:3000/api/media/profile',{method:'POST',headers:{...headers,'content-type':'image/jpeg'},body:Buffer.from([255,216,255,224])});
  expect(upload.status,await upload.clone().text()).toBe(200);path=(await upload.json()).url;
  expect(path).toMatch(/^\/api\/media\/profiles\//);expect(path).not.toContain('token=');
  const response=await fetch('http://127.0.0.1:3000'+path,{headers});expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([255,216,255,224]));
  expect((await fetch('http://127.0.0.1:3000'+path)).status).toBe(401);
  const file=getAppBucket().file(path!.replace('/api/media/',''));const [metadata]=await file.getMetadata();expect(metadata.metadata?.firebaseStorageDownloadTokens).toBeUndefined();
  await user.update({active:false,mediaAccessState:'blocked'});
  expect((await fetch('http://127.0.0.1:3000'+path,{headers})).status).toBe(403);
 }finally{if(path)await getAppBucket().file(path.replace('/api/media/','')).delete();await db.recursiveDelete(user);await getAuth(getServerFirebaseApp()).deleteUser(uid);}
},30_000);
