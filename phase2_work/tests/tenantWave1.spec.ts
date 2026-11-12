// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/server/db';
import { evaluateAccountRisk } from '../src/server/platform/riskEngine';
import { appendAuditLog, pseudonymizeAuditSubject } from '../src/server/platform/auditLog';
import { getServiceRepository } from '../src/server/firestoreRepository/nativeDatabase';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if (process.env.CI==='true' && !host) throw new Error('wave1_emulator_required');
if (host && !/^(localhost|127\.0\.0\.1|\[::1\]):[0-9]+$/.test(host)) throw new Error('wave1_unsafe_target');
afterEach(()=>vi.unstubAllEnvs());
describe.runIf(Boolean(host))('Wave 1 native user/security boundaries',()=>{
  it('writes risk flags only inside the default tenant',async()=>{
    vi.stubEnv('KLAR_TENANT_AUTH_MIGRATION_READY','true');
    const db=getDb(), uid='risk-'+randomUUID();
    const root=db.doc(`users/${uid}`), own=db.doc(`tenants/default/users/${uid}`), foreign=db.doc(`tenants/foreign/users/${uid}`);
    await Promise.all([root.set({marker:'root'}),own.set({createdAt:new Date()}),foreign.set({marker:'foreign'})]);
    try {
      const decision=await evaluateAccountRisk(db,uid,{reportCount:5,blockCount:5,externalPaymentMentions:2,outboundMessages24h:120});
      expect(decision.level).toBe('high'); expect((await own.get()).data()?.requiresSafetyReview).toBe(true);
      expect((await root.get()).data()).toEqual({marker:'root'}); expect((await foreign.get()).data()).toEqual({marker:'foreign'});
    } finally {await Promise.all([root.delete(),own.delete(),foreign.delete()]);}
  });
  it('refuses missing subjects and pending erasure instead of recreating a profile',async()=>{
    vi.stubEnv('KLAR_TENANT_AUTH_MIGRATION_READY','true');
    const db=getDb(), uid='risk-'+randomUUID(), own=db.doc(`tenants/default/users/${uid}`), deletion=db.doc(`tenants/default/account_deletions/${uid}`);
    await expect(evaluateAccountRisk(db,uid)).rejects.toThrow('Risk evaluation unavailable');
    await own.set({createdAt:new Date()}); await deletion.set({status:'pending'});
    try {await expect(evaluateAccountRisk(db,uid)).rejects.toThrow('Risk evaluation unavailable');await expect(evaluateAccountRisk(db,uid,{externalPaymentMentions:3,reportCount:5,blockCount:5})).rejects.toThrow('Risk evaluation unavailable');expect((await own.get()).data()?.requiresSafetyReview).toBeUndefined();}
    finally {await Promise.all([own.delete(),deletion.delete()]);}
  });
  it('appends schema-validated pseudonymous audit data only under tenant prefix',async()=>{
    vi.stubEnv('KLAR_TENANT_AUTH_MIGRATION_READY','true'); vi.stubEnv('AUDIT_LOG_SECRET_KEY','wave1-emulator-only-audit-secret-123456789');
    const db=getDb(), uid='audit-'+randomUUID();
    const id=await appendAuditLog(db,{type:'auth.wave1_test',actorUid:uid,metadata:{outcome:'synthetic'}});
    const path=`audit_logs/${id}`, ref=db.doc('tenants/default/'+path);
    try {const data=(await ref.get()).data();expect(data?.actorPseudonym).toBe(pseudonymizeAuditSubject(uid));expect(JSON.stringify(data)).not.toContain(uid);expect((await db.doc(path).get()).exists).toBe(false);expect((await db.doc('tenants/foreign/'+path).get()).exists).toBe(false);}
    finally {await ref.delete();}
  });
  it.each(['auth','payments'] as const)('refuses domain %s before opening Firestore when cutover is unapproved',domain=>{
    vi.stubEnv(`KLAR_TENANT_${domain.toUpperCase()}_MIGRATION_READY`,'false');
    expect(()=>getServiceRepository(domain)).toThrow('tenant_'+domain+'_migration_not_ready');
  });
});
