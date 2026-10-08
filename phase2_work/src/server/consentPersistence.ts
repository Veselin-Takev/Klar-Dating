import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { getDb, FieldValue, runObservedTransaction } from './db';
import { consentAuditSecret, signConsentAuditRecord, type ConsentAuditAction } from './consentAudit';

export interface ConsentState {
  version: number;
  erteiltAm: string | null;
  zwecke: Record<string, boolean>;
  widerrufenAm: string | null;
  evidenceId?: string;
}

interface Decision {
  state: ConsentState;
  action: ConsentAuditAction;
  effectiveAt: string;
  withdrawnPurpose?: string;
}

/** Evidence creation and the current state either both commit or neither does.
 * Transactions serialize concurrent partial withdrawals without lost updates.
 */
export async function persistConsentDecision(
  actorUid: string,
  decide: (previous: ConsentState | null) => Decision,
): Promise<{ einwilligung: ConsentState; evidenceId: string }> {
  const db = getDb() as Firestore;
  const userRef = db.collection('users').doc(actorUid);
  const evidenceRef = userRef.collection('einwilligungen').doc();
  const secret = consentAuditSecret();
  return runObservedTransaction(db, 'consentPersistence.persistConsentDecision', async (tx: Transaction) => {
    const snapshot = await tx.get(userRef);
    const previous = (snapshot.data()?.einwilligung ?? null) as ConsentState | null;
    const decision = decide(previous);
    const state = { ...decision.state, evidenceId: evidenceRef.id };
    const record = signConsentAuditRecord({
      actorUid,
      action: decision.action,
      legalVersion: state.version,
      purposes: state.zwecke,
      effectiveAt: decision.effectiveAt,
      recordedAt: new Date().toISOString(),
      previousEvidenceId: previous?.evidenceId ?? null,
      source: 'authenticated-api',
      ...(decision.withdrawnPurpose ? { withdrawnPurpose: decision.withdrawnPurpose } : {}),
    }, secret);
    tx.create(evidenceRef, {
      ...state, ...record, at: FieldValue.serverTimestamp(),
      art: decision.action === 'granted' ? 'erteilt' : 'widerrufen',
      ...(decision.withdrawnPurpose ? { widerrufenerZweck: decision.withdrawnPurpose } : {}),
    });
    tx.set(userRef, { einwilligung: state, updatedAt: record.recordedAt }, { merge: true });
    return { einwilligung: state, evidenceId: evidenceRef.id };
  });
}

/**
 * Deterministische, audit-sichere Protokollierung für den Widerruf von
 * Biometrie- und Identitätsprüfungs-Einwilligungen (z.B. Didit / IDnow).
 * Stellt sicher, dass sensible Identitätsnachweise unverzüglich entwertet werden.
 */
export async function revokeIdentityBiometricsConsent(
  actorUid: string,
  provider: 'didit' | 'idnow' | 'biometrie_all' = 'biometrie_all',
): Promise<{ einwilligung: ConsentState; evidenceId: string }> {
  return persistConsentDecision(actorUid, (previous) => {
    const jetzt = new Date().toISOString();
    const updatedPurposes = {
      ...(previous?.zwecke ?? {}),
      biometrie_identitaet: false,
      biometrie_didit: false,
      biometrie_idnow: false,
      notwendig: true,
    };
    return {
      action: 'withdrawn',
      effectiveAt: jetzt,
      withdrawnPurpose: provider,
      state: {
        version: previous?.version ?? 1,
        erteiltAm: previous?.erteiltAm ?? null,
        zwecke: updatedPurposes,
        widerrufenAm: jetzt,
      },
    };
  });
}
