import type { Firestore } from 'firebase-admin/firestore';
export type RiskSignals = {
  accountAgeDays?: number;
  reportCount?: number;
  blockCount?: number;
  outboundMessages24h?: number;
  repeatedMessageRatio?: number;
  externalPaymentMentions?: number;
  externalContactRequests?: number;
  verificationAgeDays?: number;
};

export type RiskDecision = { score: number; level: 'low' | 'medium' | 'high'; actions: string[] };

export function assessRisk(s: RiskSignals): RiskDecision {
  let score = 0;
  if ((s.accountAgeDays ?? 999) < 3) score += 10;
  score += Math.min(25, (s.reportCount ?? 0) * 8);
  score += Math.min(15, (s.blockCount ?? 0) * 3);
  if ((s.outboundMessages24h ?? 0) > 100) score += 15;
  score += Math.round(Math.min(15, (s.repeatedMessageRatio ?? 0) * 20));
  score += Math.min(20, (s.externalPaymentMentions ?? 0) * 10);
  score += Math.min(10, (s.externalContactRequests ?? 0) * 2);
  if ((s.verificationAgeDays ?? 0) > 365) score += 5;
  score = Math.min(100, score);
  const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  const actions = level === 'high' ? ['throttle_outbound', 'step_up_verification', 'safety_review']
    : level === 'medium' ? ['throttle_outbound', 'monitor'] : [];
  return { score, level, actions };
}

export async function evaluateAccountRisk(
  db: Firestore,
  uid: string,
  extraSignals: Partial<RiskSignals> = {}
): Promise<RiskDecision> {
  try {
    const [reportsSnap, blocksSnap, userDoc] = await Promise.all([
      db.collection('reports').where('reportedProfileId', '==', uid).limit(50).get(),
      db.collection('blocks').where('blockedUid', '==', uid).limit(50).get(),
      db.collection('users').doc(uid).get(),
    ]);

    const userData = userDoc && typeof userDoc.data === 'function' ? userDoc.data() : null;
    let accountAgeDays = 999;
    if (userData?.createdAt?.toDate) {
      accountAgeDays = Math.max(0, (Date.now() - userData.createdAt.toDate().getTime()) / 86_400_000);
    }

    const signals: RiskSignals = {
      accountAgeDays,
      reportCount: reportsSnap ? reportsSnap.size : 0,
      blockCount: blocksSnap ? blocksSnap.size : 0,
      ...extraSignals,
    };

    const decision = assessRisk(signals);

    if (decision.level === 'high') {
      await db.collection('users').doc(uid).set({
        riskLevel: decision.level,
        riskScore: decision.score,
        requiresSafetyReview: true,
        riskActions: decision.actions,
      }, { merge: true });
    }

    return decision;
  } catch (err) {
    console.error(`[riskEngine] Error evaluating risk for user ${uid}:`, err);
    // Safety decisions must never degrade to a low-risk result when the
    // evidence store is unavailable. Callers must handle the outage explicitly.
    throw new Error('Risk evaluation unavailable; safety evidence could not be loaded.', { cause: err });
  }
}
