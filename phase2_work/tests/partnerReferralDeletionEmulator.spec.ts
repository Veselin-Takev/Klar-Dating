// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from '../src/server/db';
import { quarantineOwnedPartnerReferral } from '../src/server/partnerReferralDeletion';

// Firebase notes that concurrent emulator writes can hold locks for ~30 seconds.
// Allow transaction retries to finish before classifying the integration as failed.
const EMULATOR_CONTENTION_TIMEOUT_MS = 90_000;

// This file can also be invoked directly by Vitest, bypassing the CLI wrapper.
// Fail closed before getDb() can create any Admin SDK client.
const activeEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (activeEmulatorHost || process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1') {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), 'firebase.pruefung.json'), 'utf8'));
  const local = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(activeEmulatorHost);
  const ids = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID].filter(Boolean);
  if (!local || Number(local[2]) !== config?.emulators?.firestore?.port
    || ids.some(id => id !== 'demo-klar')
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true'
    || process.env.NODE_ENV === 'production') {
    throw new Error('art17_firestore_emulator_unsafe_target');
  }
}

// Run with the real Firestore emulator. This file skips outside emulator mode
// so ordinary unit-test jobs cannot write to a live Firebase project.
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('owner referral quarantine (Firestore Emulator)', () => {
  const paths: string[] = [];
  afterEach(async () => {
    const db = getDb();
    await Promise.all(paths.splice(0).map(path => db.doc(path).delete()));
  });

  it('tombstones once across concurrent workers; conversion eligibility becomes false', async () => {
    const db = getDb();
    const ref = db.collection('partner_referrals').doc('erasure-' + randomUUID());
    paths.push(ref.path);
    await ref.set({ ownerUid: 'owner', campaignId: 'campaign', status: 'active' });
    const states = await Promise.all([
      quarantineOwnedPartnerReferral(db, ref, 'owner'),
      quarantineOwnedPartnerReferral(db, ref, 'owner'),
    ]);
    expect(states.sort()).toEqual(['already_deleting', 'updated']);
    const snapshot = await ref.get();
    expect(snapshot.data()).toMatchObject({ ownerUid: 'owner', status: 'deleting' });
    // The actual partner conversion service reads this same referral and
    // rejects any status other than active inside its transaction.
    expect(snapshot.data()?.status === 'active').toBe(false);
  }, EMULATOR_CONTENTION_TIMEOUT_MS);

  it('keeps a tombstone over a simulated restart so no new claim can be created', async () => {
    const db = getDb();
    const referralRef = db.collection('partner_referrals').doc('erasure-' + randomUUID());
    const claimRef = db.collection('partner_referral_buyer_claims').doc('erasure-' + randomUUID());
    paths.push(referralRef.path, claimRef.path);
    await referralRef.set({ ownerUid: 'owner', status: 'active' });
    await claimRef.set({ referralId: referralRef.id, buyerRef: 'buyer' });
    expect(await quarantineOwnedPartnerReferral(db, referralRef, 'owner')).toBe('updated');

    // Simulate a later conversion writer. The same status predicate as the
    // production conversion transaction blocks this write after quarantine.
    const unexpectedClaim = db.collection('partner_referral_buyer_claims').doc('unexpected-' + randomUUID());
    paths.push(unexpectedClaim.path);
    await db.runTransaction(async tx => {
      const referral = await tx.get(referralRef);
      if (referral.data()?.status === 'active') {
        tx.create(unexpectedClaim, { referralId: referralRef.id });
      }
    });
    expect((await unexpectedClaim.get()).exists).toBe(false);
    expect(await quarantineOwnedPartnerReferral(db, referralRef, 'owner')).toBe('already_deleting');
    expect((await claimRef.get()).exists).toBe(true);
    await claimRef.delete();
    await referralRef.delete();
    expect((await claimRef.get()).exists).toBe(false);
    expect((await referralRef.get()).exists).toBe(false);
  }, EMULATOR_CONTENTION_TIMEOUT_MS);

  it('does not strand claims when assertions race the owner quarantine', async () => {
    const db = getDb();
    const owner = 'owner-' + randomUUID();
    const referral = db.collection('partner_referrals').doc('erasure-' + randomUUID());
    const claimedA = db.collection('partner_referral_buyer_claims').doc('claim-' + randomUUID());
    const claimedB = db.collection('partner_referral_buyer_claims').doc('claim-' + randomUUID());
    paths.push(referral.path, claimedA.path, claimedB.path);
    await referral.set({ ownerUid: owner, status: 'active' });

    // Model the status predicate of the real conversion service. A writer
    // committed before quarantine may create a claim; one serialized after it
    // must not. The subsequent deletion sweep must remove either outcome.
    const tryClaim = (claim: typeof claimedA) => db.runTransaction(async tx => {
      const snapshot = await tx.get(referral);
      if (!snapshot.exists || snapshot.data()?.status !== 'active') return 'rejected';
      tx.create(claim, { referralId: referral.id, buyerRef: 'other-buyer' });
      return 'accepted';
    });
    const outcomes = await Promise.all([
      quarantineOwnedPartnerReferral(db, referral, owner),
      tryClaim(claimedA),
      tryClaim(claimedB),
    ]);
    expect(outcomes[0]).toBe('updated');
    expect((await referral.get()).data()?.status).toBe('deleting');

    const children = await db.collection('partner_referral_buyer_claims')
      .where('referralId', '==', referral.id).get();
    const batch = db.batch();
    children.docs.forEach(child => batch.delete(child.ref));
    if (!children.empty) await batch.commit();
    await referral.delete();

    expect((await db.collection('partner_referral_buyer_claims')
      .where('referralId', '==', referral.id).get()).empty).toBe(true);
    expect(await tryClaim(db.collection('partner_referral_buyer_claims').doc('late-' + randomUUID())))
      .toBe('rejected');
  }, EMULATOR_CONTENTION_TIMEOUT_MS);

  it('rejects a changed owner without a destructive write', async () => {
    const db = getDb();
    const ref = db.collection('partner_referrals').doc('erasure-' + randomUUID());
    paths.push(ref.path);
    await ref.set({ ownerUid: 'somebody-else', status: 'active' });
    await expect(quarantineOwnedPartnerReferral(db, ref, 'owner'))
      .rejects.toThrow('partner_referral_owner_changed');
    expect((await ref.get()).data()?.status).toBe('active');
  }, EMULATOR_CONTENTION_TIMEOUT_MS);
});
