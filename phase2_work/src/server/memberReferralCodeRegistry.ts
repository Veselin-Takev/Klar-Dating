import type { Firestore } from 'firebase-admin/firestore';

/**
 * Proposed P0 #48 reservation primitive, deliberately NOT called by HTTP routes.
 * Enabling requires approved migration of existing users.referralCode values,
 * a compatible claim-time registry check and independent release sign-off.
 */
export const MEMBER_REFERRAL_CODE_REGISTRY = 'member_referral_code_registry';

export type MemberReferralReservation =
  | { status: 'created' }
  | { status: 'already_owned' }
  | { status: 'conflict' }
  | { status: 'account_unavailable' };

function validCode(code: string): boolean {
  return /^[A-Z0-9_-]{10}$/.test(code);
}

function validUid(uid: string): boolean {
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 128
    && !uid.includes('/') && uid !== '.' && uid !== '..';
}

/**
 * All reads happen before any write, including the legacy owner check.
 * Two different owners with the same code always contend on one registry doc;
 * Firestore transaction retries must recheck the registry before succeeding.
 * Invalid data, existing foreign owners and pending deletion all fail closed.
 *
 * IMPORTANT: this is an isolated, non-activated building block. The existing
 * GET /referral and POST /referral/claim routes remain on their legacy flow.
 */
export async function reserveMemberReferralCode(
  db: Firestore,
  uid: string,
  code: string,
): Promise<MemberReferralReservation> {
  if (!validUid(uid) || !validCode(code)) {
    return { status: 'conflict' };
  }

  const ownerRef = db.collection('users').doc(uid);
  const deletionRef = db.collection('account_deletions').doc(uid);
  const reservationRef = db.collection(MEMBER_REFERRAL_CODE_REGISTRY).doc(code);

  return db.runTransaction(async tx => {
    const [owner, deletion, reservation] = await tx.getAll(
      ownerRef, deletionRef, reservationRef,
    );
    if (!owner.exists || deletion.exists) return { status: 'account_unavailable' } as const;

    const priorCode = owner.data()?.referralCode;
    // Never silently rotate a legacy code or repair malformed account data.
    if (priorCode !== undefined && priorCode !== code) return { status: 'conflict' } as const;

    const legacyOwners = await tx.get(
      db.collection('users').where('referralCode', '==', code).limit(2),
    );
    if (legacyOwners.docs.some(doc => doc.id !== uid)) return { status: 'conflict' } as const;

    if (reservation.exists) {
      const data = reservation.data();
      if (data?.ownerUid !== uid || data?.codeVersion !== 1 || data?.status !== 'active'
        || priorCode !== code) {
        return { status: 'conflict' } as const;
      }
      return { status: 'already_owned' } as const;
    }

    // In a future approved migration, this creates an unambiguous ownership
    // record; owner profile and registry commit/rollback in one transaction.
    tx.create(reservationRef, {
      ownerUid: uid,
      codeVersion: 1,
      status: 'active',
      createdAt: new Date(),
    });
    tx.update(ownerRef, { referralCode: code });
    return { status: 'created' } as const;
  });
}
