import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getServiceRepository } from './firestoreRepository/nativeDatabase';
import { FieldValue } from './db';
import { consentAuditSecret, signConsentAuditRecord, type ConsentAuditAction } from './consentAudit';

export interface ConsentState {
  version: number;
  erteiltAm: string | null;
  zwecke: Record<string, boolean>;
  widerrufenAm: string | null;
  evidenceId?: string;
}

const consentSchema = z.object({version: z.number().int().positive(), erteiltAm: z.string().nullable(), zwecke: z.record(z.string(), z.boolean()), widerrufenAm: z.string().nullable(), evidenceId: z.string().optional()});
const consentDocumentSchema = z.object({einwilligung: consentSchema.nullable().optional()}).passthrough();
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
  const db = getServiceRepository('auth');
  const userRef = `users/${actorUid}`, evidenceId = randomUUID(), evidenceRef = `${userRef}/einwilligungen/${evidenceId}`;
  const secret = consentAuditSecret();
  return db.transaction(async tx => {
    const snapshot = await tx.read(userRef, consentDocumentSchema);
    const deletion = await tx.read(`account_deletions/${actorUid}`, consentDocumentSchema);
    if (deletion) throw new Error('account_unavailable');
    const previous = snapshot?.einwilligung ?? null;
    const decision = decide(previous);
    const state = { ...decision.state, evidenceId: evidenceId };
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
    tx.create(evidenceRef, consentDocumentSchema, {
      ...state, ...record, at: FieldValue.serverTimestamp(),
      art: decision.action === 'granted' ? 'erteilt' : 'widerrufen',
      ...(decision.withdrawnPurpose ? { widerrufenerZweck: decision.withdrawnPurpose } : {}),
    });
    tx.write(userRef, consentDocumentSchema, { einwilligung: state, updatedAt: record.recordedAt }, { merge: true });
    return { einwilligung: state, evidenceId: evidenceId };
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
