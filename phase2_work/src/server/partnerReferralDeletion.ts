import type { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { scopeServiceDatabase } from './firestoreRepository/nativeDatabase';
import { z } from 'zod';
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
  database: Firestore | TenantAwareFirestoreRepository,
  referralRef: DocumentReference | string,
  ownerUid: string,
): Promise<OwnerReferralQuarantineResult> {
  const path = typeof referralRef === 'string' ? referralRef : referralRef.path;
  if (!ownerUid || !/^partner_referrals\/[A-Za-z0-9_-]+$/.test(path)) throw new Error('partner_referral_quarantine_invalid_target');
  const db = scopeServiceDatabase(database, 'auth');
  const schema = z.object({ownerUid:z.string(), status:z.string()}).passthrough();
  return db.transaction<OwnerReferralQuarantineResult>(async tx => {
    const current = await tx.read(path, schema);
    if (!current) return 'missing';
    if (current.ownerUid !== ownerUid) throw new Error('partner_referral_owner_changed');
    if (current.status === 'deleting') return 'already_deleting';
    tx.write(path, schema.partial(), {status:'deleting'}, {merge:true});
    return 'updated';
  });
}
