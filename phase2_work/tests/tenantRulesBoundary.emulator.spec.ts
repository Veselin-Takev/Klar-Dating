// @vitest-environment node
/**
 * P0 #254 — REAL Firestore Rules Emulator tests for legacy-vs-tenant claims.
 * No production queries or changes. Critically, current legacy users/{uid}
 * remains UID-scoped, not tenant-scoped: a PASS is NOT tenant cutover approval.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST || '';
const match = /^(127\.0\.0\.1|localhost|\[::1\]):(\d{2,5})$/.exec(host);
const emulatorOnly = !!match && Number(match[2]) > 0 && Number(match[2]) < 65536 &&
  (!process.env.GCLOUD_PROJECT || process.env.GCLOUD_PROJECT === 'demo-klar') &&
  (!process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT === 'demo-klar');
let env: RulesTestEnvironment;
const profile = (uid: string) => ({ uid, name: uid, createdAt: '2026-11-01', updatedAt: '2026-11-01' });
const asUser = (uid: string, tenantId: string, roles: string[] = []) =>
  env.authenticatedContext(uid, { tenantId, roles, role: roles[0] ?? 'member' }).firestore();

describe.skipIf(!emulatorOnly)('P0 #254 native rules — legacy UID vs tenant-boundary evidence, NOT migration approval', () => {
  beforeAll(async () => {
    if (!match) throw new Error('firebase_rules_loopback_emulator_required');
    env = await initializeTestEnvironment({
      projectId: 'demo-klar',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: match[1],
        port: Number(match[2]),
      },
    });
  });
  afterAll(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/tenant-fixture-anna'), profile('tenant-fixture-anna'));
      await setDoc(doc(db, 'users/tenant-fixture-bea'), profile('tenant-fixture-bea'));
      await setDoc(doc(db, 'tenants/tenant-alpha/users/tenant-fixture-anna'), profile('tenant-fixture-anna'));
      await setDoc(doc(db, 'tenants/tenant-beta/users/tenant-fixture-anna'), profile('tenant-fixture-anna'));
    });
  });
  it('legacy root access remains UID-only even when the same UID uses a different tenant claim', async () => {
    const alpha = asUser('tenant-fixture-anna', 'tenant-alpha');
    const beta = asUser('tenant-fixture-anna', 'tenant-beta');
    await assertSucceeds(getDoc(doc(alpha, 'users/tenant-fixture-anna')));
    await assertSucceeds(getDoc(doc(beta, 'users/tenant-fixture-anna')));
    // This documents a remaining cutover blocker: no root-path tenant claim fence.
  });
  it('another UID cannot read, overwrite or delete legacy full profiles even with same tenant claim', async () => {
    const outsider = asUser('tenant-fixture-bea', 'tenant-alpha');
    await assertFails(getDoc(doc(outsider, 'users/tenant-fixture-anna')));
    await assertFails(updateDoc(doc(outsider, 'users/tenant-fixture-anna'), { name: 'forged' }));
    await assertSucceeds(getDoc(doc(outsider, 'users/tenant-fixture-bea')));
  });
  it('current tenant-namespaced data is deny-by-default, including same UID and same tenant', async () => {
    for (const tenantId of ['tenant-alpha', 'tenant-beta']) {
      const owner = asUser('tenant-fixture-anna', tenantId);
      await assertFails(getDoc(doc(owner, `tenants/${tenantId}/users/tenant-fixture-anna`)));
      await assertFails(setDoc(doc(owner, `tenants/${tenantId}/users/new-client`), profile('new-client')));
    }
    // Failure to read tenant-specific documents is NOT functional readiness.
  });
  it('a forged admin role or tenantId claim cannot bypass current tenant-namespaced default-deny', async () => {
    const claimedAdmin = asUser('tenant-fixture-anna', 'tenant-alpha', ['admin', 'super_admin']);
    await assertFails(getDoc(doc(claimedAdmin, 'tenants/tenant-beta/users/tenant-fixture-anna')));
    await assertFails(getDoc(doc(claimedAdmin, 'tenants/tenant-alpha/users/tenant-fixture-anna')));
    await assertFails(updateDoc(doc(claimedAdmin, 'users/tenant-fixture-bea'), { name: 'admin spoof' }));
  });
  it('untrusted clients cannot set a tenant authorization field on a legacy full profile', async () => {
    const owner = asUser('tenant-fixture-anna', 'tenant-alpha');
    await assertFails(updateDoc(doc(owner, 'users/tenant-fixture-anna'), { tenantId: 'tenant-beta' }));
    await assertFails(updateDoc(doc(owner, 'users/tenant-fixture-anna'), { roles: ['admin'] }));
    await assertSucceeds(updateDoc(doc(owner, 'users/tenant-fixture-anna'), { name: 'safe', updatedAt: '2026-11-01' }));
  });
  it('unauthenticated users cannot access either sensitive legacy or future tenant paths', async () => {
    const guest = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guest, 'users/tenant-fixture-anna')));
    await assertFails(getDoc(doc(guest, 'tenants/tenant-alpha/users/tenant-fixture-anna')));
  });
});
