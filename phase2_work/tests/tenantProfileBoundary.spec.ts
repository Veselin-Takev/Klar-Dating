// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getDb } from '../src/server/db';
import { TenantAwareFirestoreRepository } from '../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { processAgeVerification } from '../src/server/platform/ageGateEngine';
import { recordExplicitConsent, revokeExplicitConsent } from '../src/server/platform/consentEngine';

const host=process.env.FIRESTORE_EMULATOR_HOST;
if(host&&!/^(localhost|127\.0\.0\.1|\[::1\]):[0-9]+$/.test(host))throw new Error('loopback emulator required');
const cleanup:string[]=[];
afterEach(async()=>{vi.unstubAllEnvs();for(const path of cleanup.splice(0))await getDb().recursiveDelete(getDb().doc(path));});
function fixture() {
  vi.stubEnv('KLAR_TENANT_AUTH_MIGRATION_READY','true');
  vi.stubEnv('CONSENT_AUDIT_SECRET','synthetic-profile-boundary-secret-not-production');
  const id=randomUUID(), tenant='profile-'+id, uid='owner-'+id;
  cleanup.push(`tenants/${tenant}`,`tenants/other-${id}`,`users/${uid}`,`public_profiles/${uid}`);
  return {uid,repo:new TenantAwareFirestoreRepository(getDb(),tenant),own:(path:string)=>getDb().doc(`tenants/${tenant}/${path}`),foreign:(path:string)=>getDb().doc(`tenants/other-${id}/${path}`),root:(path:string)=>getDb().doc(path)};
}
describe.runIf(Boolean(host))('native age and consent namespace boundaries',()=>{
  it('updates age and purges revoked sensitive fields only in the selected namespace',async()=>{
    const f=fixture();
    for(const doc of [f.own,f.foreign,f.root]) {await doc(`users/${f.uid}`).set({sexualOrientation:'synthetic-sensitive'});await doc(`public_profiles/${f.uid}`).set({sexualOrientation:'synthetic-sensitive'});}
    await processAgeVerification(f.repo,f.uid,'1990-01-01');
    expect((await f.own(`users/${f.uid}`).get()).data()?.isAdult).toBe(true);
    await recordExplicitConsent(f.repo,f.uid,{art9_sexual_orientation:true});
    await revokeExplicitConsent(f.repo,f.uid,'all');
    for(const path of [`users/${f.uid}`,`public_profiles/${f.uid}`]) {
      expect((await f.own(path).get()).data()?.sexualOrientation).toBeNull();
      expect((await f.foreign(path).get()).data()?.sexualOrientation).toBe('synthetic-sensitive');
      expect((await f.root(path).get()).data()?.sexualOrientation).toBe('synthetic-sensitive');
    }
    expect((await f.foreign(`users/${f.uid}`).get()).data()?.isAdult).toBeUndefined();
  });
  it('rejects age and consent mutations after an erasure tombstone',async()=>{
    const f=fixture();await f.own(`users/${f.uid}`).set({marker:'unchanged'});await f.own(`account_deletions/${f.uid}`).set({status:'pending'});
    await expect(processAgeVerification(f.repo,f.uid,'1990-01-01')).rejects.toThrow('account_unavailable');
    await expect(recordExplicitConsent(f.repo,f.uid,{ai_personality_insights:true})).rejects.toThrow('account_unavailable');
    await expect(revokeExplicitConsent(f.repo,f.uid,'all')).rejects.toThrow('account_unavailable');
    expect((await f.own(`users/${f.uid}`).get()).data()).toEqual({marker:'unchanged'});
  });
  it('paginates scoped exports and fails closed instead of silently truncating them',async()=>{
    const f=fixture(),batch=getDb().batch();
    for(let index=0;index<201;index++)batch.set(f.own(`events/e${String(index).padStart(3,'0')}`),{index});
    batch.set(f.foreign('events/foreign'),{index:999});await batch.commit();
    const schema=z.object({index:z.number()});
    expect(await f.repo.listAll('events',schema,{},201)).toHaveLength(201);
    await expect(f.repo.listAll('events',schema,{},200)).rejects.toThrow('tenant_scan_limit_exceeded');
    await expect(f.repo.deleteTree('tenants/foreign/users/victim')).rejects.toThrow();
    expect((await f.foreign('events/foreign').get()).exists).toBe(true);
  });
});
