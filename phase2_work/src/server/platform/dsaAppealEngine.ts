import { Timestamp } from "firebase-admin/firestore";
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { getDb } from "../db";
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
  const db: Firestore = getDb();
  const decisionRef = db.collection("dsa_decisions").doc();

  const now = new Date();
  const deadlineDate = new Date(now.getTime() + APPEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const decision: DsaModerationDecision = {
    decisionId: decisionRef.id,
    userId,
    actionTaken: action,
    legalGround,
    reasonStatement: reason,
    automatedDecision: automated,
    decidedAt: Timestamp.fromDate(now),
    appealDeadline: Timestamp.fromDate(deadlineDate),
  };

  await decisionRef.set(decision);
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
  firestore: Firestore,
  reportIdRaw: unknown,
  moderatorUid: string,
  decision: ModerationDecisionInput,
  now: Date = new Date()
): Promise<DsaStatementOfReasons> {
  const reportId = requireString(reportIdRaw, 'reportId', 128);
  const reportRef = firestore.collection('reports').doc(reportId);

  return firestore.runTransaction(async (t: Transaction) => {
    const snap = await t.get(reportRef);
    if (!snap.exists) {
      throw new InputError('Der angegebene Bericht existiert nicht.');
    }

    const reportData = snap.data() ?? {};
    const targetUid = requireString(reportData.reportedProfileId, 'reportedProfileId', 128);

    const statement = buildStatementOfReasons(reportId, targetUid, moderatorUid, decision, now);

    t.set(
      reportRef,
      {
        status: 'decided',
        entscheidung: decision.restrictionType,
        begruendung: decision.factsAndCircumstances,
        legalGround: decision.legalGround,
        dsaStatement: statement,
        decidedAt: now.toISOString(),
        decidedByUid: moderatorUid,
      },
      { merge: true }
    );

    const userRef = firestore.collection('users').doc(targetUid);
    const userUpdate: JsonObject = {
      lastModerationAction: decision.restrictionType,
      lastModerationGround: decision.legalGround,
      lastModerationAt: now.toISOString(),
    };

    if (decision.restrictionType === 'account_suspension' || decision.restrictionType === 'account_termination') {
      userUpdate.active = false;
      userUpdate.suspendedReason = decision.factsAndCircumstances;
    }

    t.set(userRef, userUpdate, { merge: true });

    return statement;
  });
}

export async function submitDsaAppeal(
  firestoreOrDecisionId: Firestore | string,
  reportIdOrUserId: unknown,
  appellantUidOrStatement?: unknown,
  appealReasonRaw?: unknown,
  additionalEvidenceRaw?: unknown,
  now: Date = new Date()
): Promise<unknown> {
  // Support both 3-arg simple call and 5-arg transactional call
  if (typeof firestoreOrDecisionId === 'string') {
    const decisionId = firestoreOrDecisionId;
    const userId = String(reportIdOrUserId ?? '');
    const appealStatement = String(appellantUidOrStatement ?? '');
    const db = getDb();
    const decisionDoc = await db.collection("dsa_decisions").doc(decisionId).get();

    if (!decisionDoc.exists) {
      throw new Error("DECISION_NOT_FOUND");
    }

    const decision = decisionDoc.data() as DsaModerationDecision;
    if (decision.userId !== userId) {
      throw new Error("FORBIDDEN");
    }

    if (Timestamp.now().toMillis() > decision.appealDeadline.toMillis()) {
      throw new Error("APPEAL_WINDOW_EXPIRED");
    }

    const appealRef = db.collection("dsa_appeals").doc(decisionId);
    const appeal: DsaAppealSubmission = {
      decisionId,
      userId,
      appealStatement: appealStatement.trim(),
      submittedAt: Timestamp.now(),
      status: "pending_review",
    };

    await appealRef.set(appeal);
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

  const reportRef = firestore.collection('reports').doc(reportId);

  return firestore.runTransaction(async (t: MinimalTransaction) => {
    const snap = await t.get(reportRef);
    if (!snap.exists) {
      throw new InputError('Der angegebene Bericht existiert nicht.');
    }

    const reportData = snap.data() ?? {};
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

    t.set(
      reportRef,
      {
        dsaAppeal: appeal,
        appealStatus: 'pending',
      },
      { merge: true }
    );

    return appeal;
  });
}

export async function reviewDsaAppeal(
  firestore: MinimalFirestore,
  reportIdRaw: unknown,
  reviewerUid: string,
  outcome: 'upheld' | 'overturned',
  rationaleRaw: unknown,
  now: Date = new Date()
): Promise<DsaAppeal> {
  const reportId = requireString(reportIdRaw, 'reportId', 128);
  if (outcome !== 'upheld' && outcome !== 'overturned') {
    throw new InputError('Ergebnis muss "upheld" oder "overturned" sein.');
  }

  const rationale = requireString(rationaleRaw, 'rationale', 2000);
  if (rationale.length < 10) {
    throw new InputError('Die Begründung der Beschwerdeprüfung muss mindestens 10 Zeichen umfassen.');
  }

  const reportRef = firestore.collection('reports').doc(reportId);

  return firestore.runTransaction(async (t: MinimalTransaction) => {
    const snap = await t.get(reportRef);
    if (!snap.exists) {
      throw new InputError('Der angegebene Bericht existiert nicht.');
    }

    const reportData = snap.data() ?? {};
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

    const updatedAppeal: DsaAppeal = {
      ...appeal,
      status: outcome,
      reviewedByUid: reviewerUid,
      reviewDecision: rationale,
      reviewedAt: now.toISOString(),
    };

    t.set(
      reportRef,
      {
        dsaAppeal: updatedAppeal,
        appealStatus: outcome,
      },
      { merge: true }
    );

    if (outcome === 'overturned' && typeof reportData.reportedProfileId === 'string' && reportData.reportedProfileId) {
      const userRef = firestore.collection('users').doc(reportData.reportedProfileId);
      t.set(
        userRef,
        {
          active: true,
          suspendedReason: null,
          lastAppealOverturnedAt: now.toISOString(),
        },
        { merge: true }
      );
    }

    return updatedAppeal;
  });
}
