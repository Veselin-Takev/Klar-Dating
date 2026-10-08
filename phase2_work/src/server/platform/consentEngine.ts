/**
 * Klar Platform - GDPR Art. 9 Explicit Consent Ledger & Purpose-Bound Processing Engine
 * 
 * Implements legal mandates:
 * - GDPR Art. 9(2)(a): Explicit consent for processing special categories of personal data
 *   (sexual orientation, philosophical/religious beliefs, health markers).
 * - GDPR Art. 7(3): The data subject shall have the right to withdraw consent at any time.
 *   Withdrawal must be as easy to give as to withdraw, taking immediate effect across all indexes.
 * - GDPR Art. 5(1)(b) & 7(1): Purpose limitation and demonstrable evidence ledger (consent_audit_log).
 */

import crypto from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { JsonObject } from '../../types/strict';

export const ART9_PURPOSES = [
  'art9_sexual_orientation',
  'art9_religious_philosophical',
  'art9_health_dietary',
  'ai_personality_insights',
] as const;

export type Art9Purpose = (typeof ART9_PURPOSES)[number];

export interface Art9ConsentState {
  version: number;
  updatedAt: string;
  purposes: Record<Art9Purpose, boolean>;
  evidenceHash: string;
  withdrawnAt?: string | null;
}

export interface ConsentEvaluationResult {
  allowed: boolean;
  activePurposes: Art9Purpose[];
  deniedPurposes: Art9Purpose[];
  requiresRenewal: boolean;
}

export const CURRENT_ART9_CONSENT_VERSION = 1;

/**
 * Computes an immutable SHA-256 evidence hash over the user's consent declaration.
 */
export function computeConsentEvidenceHash(
  userId: string,
  purposes: Record<string, boolean>,
  timestamp: string,
  version: number = CURRENT_ART9_CONSENT_VERSION
): string {
  const sortedEntries = Object.entries(purposes).sort(([a], [b]) => a.localeCompare(b));
  const payload = JSON.stringify({
    userId,
    purposes: sortedEntries,
    timestamp,
    version,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Evaluates whether sensitive Art. 9 processing is legally permissible for a user.
 */
export function evaluateArt9Consent(
  consent: Art9ConsentState | null | undefined,
  requiredPurpose: Art9Purpose,
  expectedVersion: number = CURRENT_ART9_CONSENT_VERSION
): boolean {
  if (!consent) return false;
  if (consent.withdrawnAt) return false;
  if (consent.version !== expectedVersion) return false;
  return consent.purposes?.[requiredPurpose] === true;
}

/**
 * Sanitizes a profile before discovery feed or recommendation processing:
 * If explicit Art. 9 consent is absent or withdrawn, sensitive attributes are stripped.
 */
export function filterProfileSensitiveFields<T extends JsonObject>(
  profile: T,
  consent: Art9ConsentState | null | undefined
): T {
  const sanitized = { ...profile };

  if (!evaluateArt9Consent(consent, 'art9_sexual_orientation')) {
    delete sanitized.sexualOrientation;
    delete sanitized.seekingGender;
  }

  if (!evaluateArt9Consent(consent, 'art9_religious_philosophical')) {
    delete sanitized.religion;
    delete sanitized.beliefs;
  }

  if (!evaluateArt9Consent(consent, 'art9_health_dietary')) {
    delete sanitized.dietary;
    delete sanitized.healthNotes;
  }

  return sanitized;
}

/**
 * Records a new explicit consent grant in the tamper-evident audit ledger.
 */
export async function recordExplicitConsent(
  firestore: Firestore,
  userId: string,
  declaredPurposes: Partial<Record<Art9Purpose, boolean>>,
  now: Date = new Date(),
  ipHash?: string
): Promise<Art9ConsentState> {
  const timestampStr = now.toISOString();
  const normalizedPurposes = {} as Record<Art9Purpose, boolean>;

  for (const p of ART9_PURPOSES) {
    normalizedPurposes[p] = declaredPurposes[p] === true;
  }

  const evidenceHash = computeConsentEvidenceHash(
    userId,
    normalizedPurposes,
    timestampStr,
    CURRENT_ART9_CONSENT_VERSION
  );

  const consentState: Art9ConsentState = {
    version: CURRENT_ART9_CONSENT_VERSION,
    updatedAt: timestampStr,
    purposes: normalizedPurposes,
    evidenceHash,
    withdrawnAt: null,
  };

  const auditLogRef = firestore.collection('consent_audit_log').doc();
  const userRef = firestore.collection('users').doc(userId);
  const consentAuditSecret = process.env.CONSENT_AUDIT_SECRET ?? process.env.AUDIT_LOG_SECRET_KEY;
  if (!consentAuditSecret || consentAuditSecret.length < 32) throw new Error('CONSENT_AUDIT_SECRET is required for append-only consent audit records');
  const subjectPseudonym = crypto.createHmac('sha256', consentAuditSecret).update(userId, 'utf8').digest('hex');

  await firestore.runTransaction(async (tx: Transaction) => {
    // 1. Write immutable audit log
    tx.set(auditLogRef, {
      subjectPseudonym,
      action: 'grant',
      version: CURRENT_ART9_CONSENT_VERSION,
      purposes: normalizedPurposes,
      evidenceHash,
      ipHash: ipHash || null,
      timestamp: timestampStr,
    });

    // 2. Commit current state to user profile
    tx.set(
      userRef,
      {
        art9Consent: consentState,
        updatedAt: timestampStr,
      },
      { merge: true }
    );
  });

  return consentState;
}

export function getArt9FieldsToPurge(purposeToRevoke?: Art9Purpose | 'all'): string[] {
  if (!purposeToRevoke || purposeToRevoke === 'all') {
    return [
      'sexualOrientation',
      'seekingGender',
      'religion',
      'beliefs',
      'dietary',
      'healthNotes',
      'aiPersonalitySummary',
      'aiBioSummary',
      'personalityRadar',
    ];
  }
  switch (purposeToRevoke) {
    case 'art9_sexual_orientation':
      return ['sexualOrientation', 'seekingGender'];
    case 'art9_religious_philosophical':
      return ['religion', 'beliefs'];
    case 'art9_health_dietary':
      return ['dietary', 'healthNotes'];
    case 'ai_personality_insights':
      return ['aiPersonalitySummary', 'aiBioSummary', 'personalityRadar'];
    default:
      return [];
  }
}

/**
 * Revokes explicit Art. 9 consent either entirely or for specific purposes.
 * Immediate effect: Updates user state, performs transactional cascade purge of sensitive
 * data from user and public_profiles documents, and appends withdrawal audit entry.
 */
export async function revokeExplicitConsent(
  firestore: unknown,
  userId: string,
  purposeToRevoke?: Art9Purpose | 'all',
  now: Date = new Date()
): Promise<{ ok: boolean; updatedState: Art9ConsentState; purgedFields: string[] }> {
  const timestampStr = now.toISOString();
  const userRef = firestore.collection('users').doc(userId);
  const publicProfileRef = firestore.collection('public_profiles').doc(userId);
  const auditLogRef = firestore.collection('consent_audit_log').doc();
  const consentAuditSecret = process.env.CONSENT_AUDIT_SECRET ?? process.env.AUDIT_LOG_SECRET_KEY;
  if (!consentAuditSecret || consentAuditSecret.length < 32) throw new Error('CONSENT_AUDIT_SECRET is required for append-only consent audit records');
  const subjectPseudonym = crypto.createHmac('sha256', consentAuditSecret).update(userId, 'utf8').digest('hex');
  const fieldsToPurge = getArt9FieldsToPurge(purposeToRevoke);

  let nextState: Art9ConsentState;

  await firestore.runTransaction(async (tx: unknown) => {
    const userDoc = await tx.get(userRef);
    const existingState: Art9ConsentState | undefined = userDoc.data()?.art9Consent;

    const newPurposes = { ...(existingState?.purposes || {}) } as Record<Art9Purpose, boolean>;

    if (!purposeToRevoke || purposeToRevoke === 'all') {
      for (const p of ART9_PURPOSES) {
        newPurposes[p] = false;
      }
    } else {
      newPurposes[purposeToRevoke] = false;
    }

    const evidenceHash = computeConsentEvidenceHash(
      userId,
      newPurposes,
      timestampStr,
      existingState?.version || CURRENT_ART9_CONSENT_VERSION
    );

    nextState = {
      version: existingState?.version || CURRENT_ART9_CONSENT_VERSION,
      updatedAt: timestampStr,
      purposes: newPurposes,
      evidenceHash,
      withdrawnAt: (!purposeToRevoke || purposeToRevoke === 'all') ? timestampStr : (existingState?.withdrawnAt || null),
    };

    tx.set(auditLogRef, {
      subjectPseudonym,
      action: 'withdrawal',
      revokedPurpose: purposeToRevoke || 'all',
      evidenceHash,
      purgedFields: fieldsToPurge,
      timestamp: timestampStr,
    });

    // Prepare cascade deletion map
    const purgeUpdate: JsonObject = {
      art9Consent: nextState,
      updatedAt: timestampStr,
    };
    for (const f of fieldsToPurge) {
      purgeUpdate[f] = null;
    }

    tx.set(userRef, purgeUpdate, { merge: true });

    // Also purge from public profile if present
    const publicProfileDoc = await tx.get(publicProfileRef);
    if (publicProfileDoc.exists) {
      const pubPurgeUpdate: JsonObject = { updatedAt: timestampStr };
      for (const f of fieldsToPurge) {
        pubPurgeUpdate[f] = null;
      }
      tx.set(publicProfileRef, pubPurgeUpdate, { merge: true });
    }
  });

  return { ok: true, updatedState: nextState!, purgedFields: fieldsToPurge };
}

