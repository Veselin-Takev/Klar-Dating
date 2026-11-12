import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from 'firebase-admin/firestore';
import type { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { getServiceRepository, scopeServiceDatabase } from '../firestoreRepository/nativeDatabase';
import { randomUUID } from 'node:crypto';
import { enforceAccountLock, securityJob } from '../accountSecurity';
import { z } from 'zod';
const record = z.record(z.string(), z.unknown());
type SecurityEnforcer = (uid: string, repo: TenantAwareFirestoreRepository) => Promise<void>;
import { InputError, requireString, optionalString } from '../pure';

import type { JsonObject } from '../../types/strict';
export type DsaRestrictionType =
  | 'content_removal'
  | 'account_suspension'
  | 'account_warning'
  | 'account_termination'
  | 'feature_restriction';

export type DsaLegalGround =
  | 'harassment'
  | 'hate_speech'
  | 'underage'
  | 'fraud_scam'
  | 'unauthorized_commercial'
  | 'impersonation'
  | 'terms_violation';

export interface DsaRedressOptions {
  internalAppealAvailable: boolean;
  appealWindowDays: number;
  externalArbitrationAvailable: boolean;
  legalVenue: string;
}

export interface DsaStatementOfReasons {
  id: string;
  reportId: string;
  targetUid: string;
  restrictionType: DsaRestrictionType;
  legalGround: DsaLegalGround;
  factsAndCircumstances: string;
  redressOptions: DsaRedressOptions;
  decidedAt: string;
  decidedByUid: string;
}

export type DsaAppealStatus = 'pending' | 'under_review' | 'upheld' | 'overturned';

export interface DsaAppeal {
  id: string;
  reportId: string;
  statementId: string;
  appellantUid: string;
  appealReason: string;
  additionalEvidence?: string | null;
  status: DsaAppealStatus;
  submittedAt: string;
  reviewedByUid?: string | null;
  reviewDecision?: string | null;
  reviewedAt?: string | null;
}

export interface ModerationDecisionInput {
  restrictionType: DsaRestrictionType;
  legalGround: DsaLegalGround;
  factsAndCircumstances: string;
}

export interface DsaModerationDecision {
  decisionId: string;
  userId: string;
  actionTaken: "account_suspended" | "content_removed" | "feature_restricted";
  legalGround: string;
  reasonStatement: string;
  automatedDecision: boolean;
  decidedAt: Timestamp;
  appealDeadline: Timestamp;
}

export interface DsaAppealSubmission {
  decisionId: string;
  userId: string;
  appealStatement: string;
  submittedAt: Timestamp;
  status: "pending_review" | "upheld" | "reversed";
}

const APPEAL_WINDOW_DAYS = 180; // Gesetzliche Mindestfrist nach DSA Art. 17

export async function issueModerationDecision(
  userId: string,
  action: DsaModerationDecision["actionTaken"],
  legalGround: string,
  reason: string,
  automated: boolean = false
): Promise<DsaModerationDecision> {
  const db = getServiceRepository('auth');
  const decisionRef = `dsa_decisions/${randomUUID()}`;

  const now = new Date();
  const deadlineDate = new Date(now.getTime() + APPEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const decision: DsaModerationDecision = {
    decisionId: decisionRef.split('/')[1]!,
    userId,
    actionTaken: action,
    legalGround,
    reasonStatement: reason,
    automatedDecision: automated,
    decidedAt: Timestamp.fromDate(now),
    appealDeadline: Timestamp.fromDate(deadlineDate),
  };

  if (action === 'account_suspended') {
    await db.transaction(async tx => {
      const previous = await tx.read(`account_security_jobs/${userId}`, record);
      tx.create(decisionRef, record, decision);
      tx.write(`users/${userId}`, record, { active: false, mediaAccessState: 'blocked' }, { merge: true });
      tx.write(`account_locks/${userId}`, record, { lockedAt: now, reason: 'moderation' });
      tx.write(`account_security_jobs/${userId}`, record, securityJob(previous, 'disable', now));
    });
    await enforceAccountLock(userId, db);
  } else await db.create(decisionRef, record, decision);
  return decision;
}

const VALID_RESTRICTIONS = new Set<DsaRestrictionType>([
  'content_removal',
  'account_suspension',
  'account_warning',
  'account_termination',
  'feature_restriction',
]);

const VALID_LEGAL_GROUNDS = new Set<DsaLegalGround>([
  'harassment',
  'hate_speech',
  'underage',
  'fraud_scam',
  'unauthorized_commercial',
  'impersonation',
  'terms_violation',
]);

export function buildStatementOfReasons(
  reportId: string,
  targetUid: string,
  moderatorUid: string,
  decision: ModerationDecisionInput,
  now: Date = new Date()
): DsaStatementOfReasons {
  if (!VALID_RESTRICTIONS.has(decision.restrictionType)) {
    throw new InputError(`Ungültige Beschränkungsart: ${decision.restrictionType}`);
  }
  if (!VALID_LEGAL_GROUNDS.has(decision.legalGround)) {
    throw new InputError(`Ungültiger Rechtsgrund: ${decision.legalGround}`);
  }

  const facts = requireString(decision.factsAndCircumstances, 'factsAndCircumstances', 2000);
  if (facts.length < 10) {
    throw new InputError('Die Begründung nach DSA Art. 17 muss mindestens 10 Zeichen lang sein.');
  }

  return {
    id: `stmt_${reportId}_${now.getTime()}`,
    reportId,
    targetUid,
    restrictionType: decision.restrictionType,
    legalGround: decision.legalGround,
    factsAndCircumstances: facts,
    redressOptions: {
      internalAppealAvailable: true,
      appealWindowDays: 180, // DSA Art. 20 Abs. 1 (mind. 6 Monate)
      externalArbitrationAvailable: true,
      legalVenue: 'Zuständige außergerichtliche Streitbeilegungsstelle (DSA Art. 21)',
    },
    decidedAt: now.toISOString(),
    decidedByUid: moderatorUid,
  };
}

export async function recordModerationDecision(
  firestore: Firestore | TenantAwareFirestoreRepository,
  reportIdRaw: unknown,
  moderatorUid: string,
  decision: ModerationDecisionInput,
  now: Date = new Date(),
  enforceSecurity: SecurityEnforcer = enforceAccountLock
): Promise<DsaStatementOfReasons> {
  const reportId = requireString(reportIdRaw, 'reportId', 128);
  const db = scopeServiceDatabase(firestore, 'auth');
  const reportRef = `reports/${reportId}`;

  const result = await db.transaction(async tx => {
    const snap = await tx.read(reportRef, record);
    if (!snap) {
      throw new InputError('Der angegebene Bericht existiert nicht.');
    }

    const reportData = snap ?? {};
    const targetUid = requireString(reportData.reportedProfileId, 'reportedProfileId', 128);
    const previousSecurity = await tx.read(`account_security_jobs/${targetUid}`, record);

    const statement = buildStatementOfReasons(reportId, targetUid, moderatorUid, decision, now);

    tx.write(reportRef, record, {
        status: 'decided',
        entscheidung: decision.restrictionType,
        begruendung: decision.factsAndCircumstances,
        legalGround: decision.legalGround,
        dsaStatement: statement,
        decidedAt: now.toISOString(),
        decidedByUid: moderatorUid,
      }, { merge: true });

    const userRef = `users/${targetUid}`;
    const userUpdate: JsonObject = {
      lastModerationAction: decision.restrictionType,
      lastModerationGround: decision.legalGround,
      lastModerationAt: now.toISOString(),
    };

    if (decision.restrictionType === 'account_suspension' || decision.restrictionType === 'account_termination') {
      userUpdate.active = false;
      userUpdate.mediaAccessState = 'blocked';
      userUpdate.suspendedReason = decision.factsAndCircumstances;
      tx.write(`account_locks/${targetUid}`, record, { lockedAt: now, reason: 'moderation' });
      tx.write(`account_security_jobs/${targetUid}`, record, securityJob(previousSecurity, 'disable', now));
      tx.delete(`public_profiles/${targetUid}`);
    }

    tx.write(userRef, record, userUpdate, { merge: true });

    return statement;
  });
  if (decision.restrictionType === 'account_suspension' || decision.restrictionType === 'account_termination') {
    await enforceSecurity(result.targetUid, db);
  }
  return result;
}

export function submitDsaAppeal(
  firestore: Firestore | TenantAwareFirestoreRepository,
  reportId: unknown,
  appellantUid: unknown,
  appealReasonRaw: unknown,
  additionalEvidenceRaw?: unknown,
  now?: Date
): Promise<DsaAppeal>;
export function submitDsaAppeal(
  decisionId: string,
  userId: unknown,
  appealStatement?: unknown,
  now?: Date
): Promise<{ ok: true; message: string }>;
export async function submitDsaAppeal(
  firestoreOrDecisionId: Firestore | TenantAwareFirestoreRepository | string,
  reportIdOrUserId: unknown,
  appellantUidOrStatement?: unknown,
  appealReasonRaw?: unknown,
  additionalEvidenceRaw?: unknown,
  now: Date = new Date()
): Promise<DsaAppeal | { ok: true; message: string }> {
  // Support both 3-arg simple call and 5-arg transactional call
  if (typeof firestoreOrDecisionId === 'string') {
    const decisionId = firestoreOrDecisionId;
    const userId = String(reportIdOrUserId ?? '');
    const appealStatement = String(appellantUidOrStatement ?? '');
    const db = getServiceRepository('auth');
    const decisionDoc = await db.read(`dsa_decisions/${decisionId}`, record);

    if (!decisionDoc) {
      throw new Error("DECISION_NOT_FOUND");
    }

    const decision = decisionDoc as unknown as DsaModerationDecision;
    if (decision.userId !== userId) {
      throw new Error("FORBIDDEN");
    }

    if (Timestamp.now().toMillis() > decision.appealDeadline.toMillis()) {
      throw new Error("APPEAL_WINDOW_EXPIRED");
    }

    const appealRef = `dsa_appeals/${decisionId}`;
    const appeal: DsaAppealSubmission = {
      decisionId,
      userId,
      appealStatement: appealStatement.trim(),
      submittedAt: Timestamp.now(),
      status: "pending_review",
    };

    await db.write(appealRef, record, appeal);
    return { ok: true, message: "Beschwerde fristgerecht eingereicht. Prüfung durch menschlichen Prüfer eingeleitet." };
  }

  const firestore = firestoreOrDecisionId;
  const reportId = requireString(reportIdOrUserId, 'reportId', 128);
  const appellantUid = String(appellantUidOrStatement);
  const appealReason = requireString(appealReasonRaw, 'appealReason', 2000);
  if (appealReason.length < 10) {
    throw new InputError('Die Begründung der Beschwerde muss mindestens 10 Zeichen lang sein.');
  }
  const additionalEvidence = optionalString(additionalEvidenceRaw, 'additionalEvidence', 2000);

  const db = scopeServiceDatabase(firestore, 'auth');
  const reportRef = `reports/${reportId}`;

  return db.transaction(async tx => {
    const snap = await tx.read(reportRef, record);
    if (!snap) {
      throw new InputError('Der angegebene Bericht existiert nicht.');
    }

    const reportData = snap ?? {};
    const rawStatement = reportData.dsaStatement;
    const dsaStatement = rawStatement && typeof rawStatement === 'object'
      ? rawStatement as unknown as DsaStatementOfReasons
      : undefined;
    if (!dsaStatement) {
      throw new InputError('Zu diesem Bericht liegt noch keine begründete Entscheidung vor.');
    }

    const isTarget = reportData.reportedProfileId === appellantUid || dsaStatement.targetUid === appellantUid;
    const isReporter = reportData.reporterId === appellantUid;
    if (!isTarget && !isReporter) {
      throw new InputError('Nur betroffene oder meldende Personen können Beschwerde einlegen.');
    }

    const decisionTime = new Date(dsaStatement.decidedAt).getTime();
    const diffDays = (now.getTime() - decisionTime) / (1000 * 60 * 60 * 24);
    if (diffDays > 180) {
      throw new InputError('Die Frist für das interne Beschwerdeverfahren (180 Tage) ist abgelaufen.');
    }

    const rawAppeal = reportData.dsaAppeal;
    const existingAppeal = rawAppeal && typeof rawAppeal === 'object'
      ? rawAppeal as unknown as DsaAppeal
      : undefined;
    if (existingAppeal?.status === 'pending') {
      throw new InputError('Für diese Entscheidung ist bereits eine Beschwerde in Prüfung.');
    }

    const appeal: DsaAppeal = {
      id: `appeal_${reportId}_${now.getTime()}`,
      reportId,
      statementId: dsaStatement.id,
      appellantUid,
      appealReason,
      additionalEvidence: additionalEvidence || null,
      status: 'pending',
      submittedAt: now.toISOString(),
      reviewedByUid: null,
      reviewDecision: null,
      reviewedAt: null,
    };

    tx.write(reportRef, record, {
        dsaAppeal: appeal,
        appealStatus: 'pending',
      }, { merge: true });

    return appeal;
  });
}

export async function reviewDsaAppeal(
  firestore: Firestore | TenantAwareFirestoreRepository,
  reportIdRaw: unknown,
  reviewerUid: string,
  outcome: 'upheld' | 'overturned',
  rationaleRaw: unknown,
  now: Date = new Date(),
  enforceSecurity: SecurityEnforcer = enforceAccountLock
): Promise<DsaAppeal> {
  const reportId = requireString(reportIdRaw, 'reportId', 128);
  if (outcome !== 'upheld' && outcome !== 'overturned') {
    throw new InputError('Ergebnis muss "upheld" oder "overturned" sein.');
  }

  const rationale = requireString(rationaleRaw, 'rationale', 2000);
  if (rationale.length < 10) {
    throw new InputError('Die Begründung der Beschwerdeprüfung muss mindestens 10 Zeichen umfassen.');
  }

  const db = scopeServiceDatabase(firestore, 'auth');
  const reportRef = `reports/${reportId}`;

  const result = await db.transaction(async tx => {
    const snap = await tx.read(reportRef, record);
    if (!snap) {
      throw new InputError('Der angegebene Bericht existiert nicht.');
    }

    const reportData = snap ?? {};
    const rawAppeal = reportData.dsaAppeal;
    const appeal = rawAppeal && typeof rawAppeal === 'object'
      ? rawAppeal as unknown as DsaAppeal
      : undefined;
    if (!appeal) {
      throw new InputError('Keine offene Beschwerde zu diesem Bericht vorhanden.');
    }

    if (appeal.status !== 'pending' && appeal.status !== 'under_review') {
      throw new InputError('Diese Beschwerde wurde bereits abgeschlossen.');
    }

    const target = typeof reportData.reportedProfileId === 'string' ? reportData.reportedProfileId : '';
    const [previousSecurity, deletion] = target ? await Promise.all([tx.read(`account_security_jobs/${target}`, record), tx.read(`account_deletions/${target}`, record)]) : [null, null];
    if (outcome === 'overturned' && deletion) throw new InputError('Konto nicht verfügbar.');
    const updatedAppeal: DsaAppeal = {
      ...appeal,
      status: outcome,
      reviewedByUid: reviewerUid,
      reviewDecision: rationale,
      reviewedAt: now.toISOString(),
    };

    tx.write(reportRef, record, {
        dsaAppeal: updatedAppeal,
        appealStatus: outcome,
      }, { merge: true });

    if (outcome === 'overturned' && typeof reportData.reportedProfileId === 'string' && reportData.reportedProfileId) {
      const userRef = `users/${reportData.reportedProfileId}`;
      tx.write(`account_security_jobs/${target}`, record, securityJob(previousSecurity, 'enable', now));
      tx.write(userRef, record, {
          active: true,
          suspendedReason: null,
          lastAppealOverturnedAt: now.toISOString(),
        }, { merge: true });
    }

    return {appeal:updatedAppeal, target};
  });
  if (outcome === 'overturned' && result.target) await enforceSecurity(result.target, db);
  return result.appeal;
}
