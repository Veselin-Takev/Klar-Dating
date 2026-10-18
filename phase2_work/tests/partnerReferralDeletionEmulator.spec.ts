// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/server/db';
import { quarantineOwnedPartnerReferral } from '../src/server/partnerReferralDeletion';

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
  }, 20_000);

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
  }, 20_000);

  it('rejects a changed owner without a destructive write', async () => {
    const db = getDb();
    const ref = db.collection('partner_referrals').doc('erasure-' + randomUUID());
    paths.push(ref.path);
    await ref.set({ ownerUid: 'somebody-else', status: 'active' });
    await expect(quarantineOwnedPartnerReferral(db, ref, 'owner'))
      .rejects.toThrow('partner_referral_owner_changed');
    expect((await ref.get()).data()?.status).toBe('active');
  }, 20_000);
});
