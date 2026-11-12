import { z } from 'zod';
import { scopeServiceDatabase } from '../firestoreRepository/nativeDatabase';
const record = z.record(z.string(), z.unknown());
import type { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
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
  db: Firestore | TenantAwareFirestoreRepository,
  uid: string,
  extraSignals: Partial<RiskSignals> = {}
): Promise<RiskDecision> {
  try {
    const repo = scopeServiceDatabase(db, 'auth');
    const [reportsSnap, blocksSnap, userData, pendingDeletion] = await Promise.all([
      repo.list('reports', record, {where:['reportedProfileId','==',uid],limit:50}),
      repo.list('blocks', record, {where:['blockedUid','==',uid],limit:50}),
      repo.read(`users/${uid}`, record),
      repo.read(`account_deletions/${uid}`, record),
    ]);
    if (!userData || pendingDeletion) throw new Error('risk_subject_not_available');

    let accountAgeDays = 999;
    const timestamp = userData.createdAt;
    const date: unknown = timestamp instanceof Date ? timestamp : timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function' ? timestamp.toDate() : undefined;
    if (date instanceof Date && Number.isFinite(date.getTime())) accountAgeDays = Math.max(0, (Date.now() - date.getTime()) / 86_400_000);

    const signals: RiskSignals = {
      accountAgeDays,
      reportCount: reportsSnap.length,
      blockCount: blocksSnap.length,
      ...extraSignals,
    };

    const decision = assessRisk(signals);

    if (decision.level === 'high') {
      await repo.transaction(async tx => {
        const [current, deletion] = await Promise.all([tx.read(`users/${uid}`, record), tx.read(`account_deletions/${uid}`, record)]);
        if (!current || deletion) throw new Error('risk_subject_not_available');
        tx.write(`users/${uid}`, record, {
        riskLevel: decision.level,
        riskScore: decision.score,
        requiresSafetyReview: true,
        riskActions: decision.actions,
        }, {merge:true});
      });
    }

    return decision;
  } catch (err) {
    console.error('risk_evaluation_unavailable');
    // Safety decisions must never degrade to a low-risk result when the
    // evidence store is unavailable. Callers must handle the outage explicitly.
    throw new Error('Risk evaluation unavailable; safety evidence could not be loaded.', { cause: err });
  }
}
