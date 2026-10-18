import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

export type OwnerReferralQuarantineResult = 'updated' | 'already_deleting' | 'missing';

/**
 * Atomically disables new partner conversions before the account deletion worker
 * removes the owner's cross-buyer claims. Conversion transactions read the
 * referral document and require status === 'active'. The status transition
 * conflicts with a concurrent conversion transaction reading the same referral,
 * rather than leaving a check/delete race during the claims sweep.
 *
 * This is idempotent: a resumed deletion slice accepts 'already_deleting'.
 * It never changes ownership and never creates a missing referral.
 */
export async function quarantineOwnedPartnerReferral(
  db: Firestore,
  referralRef: DocumentReference,
  ownerUid: string,
): Promise<OwnerReferralQuarantineResult> {
  // A nested users/{uid}/partner_referrals/{id} ref has the same parent ID.
  // Restrict erasure to the canonical root collection, not just its last segment.
  if (!ownerUid || typeof referralRef?.path !== 'string'
    || !/^partner_referrals\/[^/]+$/.test(referralRef.path)
    || referralRef.parent.id !== 'partner_referrals') {
    throw new Error('partner_referral_quarantine_invalid_target');
  }
  return db.runTransaction<OwnerReferralQuarantineResult>(async tx => {
    const snapshot = await tx.get(referralRef);
    if (!snapshot.exists) return 'missing';
    if (snapshot.data()?.ownerUid !== ownerUid) {
      throw new Error('partner_referral_owner_changed');
    }
    if (snapshot.data()?.status === 'deleting') return 'already_deleting';
    tx.update(referralRef, { status: 'deleting' });
    return 'updated';
  });
}
