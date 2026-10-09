// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/server/db';
import { handleEinwilligung, handleEinwilligungWiderruf } from '../src/server/datenschutz';
import { consentAuditSecret, verifyConsentAuditRecord } from '../src/server/consentAudit';

const users: string[] = [];
function account() { const uid = 'consent-test-' + randomUUID(); users.push(uid); return uid; }
async function invoke(handler: (req: Request, res: Response) => Promise<void>, uid: string, body: unknown) {
  let status = 200;
  let payload: any;
  const response = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { payload = value; return this; },
  };
  await handler({ user: { uid }, body } as unknown as Request, response as unknown as Response);
  expect(status, JSON.stringify(payload)).toBe(200);
  return payload;
}
beforeEach(() => { vi.stubEnv('CONSENT_AUDIT_SECRET', 'test-only-consent-audit-secret-32-characters-minimum'); });
afterEach(async () => {
  for (const uid of users.splice(0)) await getDb().recursiveDelete(getDb().collection('users').doc(uid));
  vi.unstubAllEnvs();
});

describe('consent transactions with real Firestore emulator', { timeout: 20000 }, () => {
  it('keeps concurrent partial withdrawals, profile state and evidence chain consistent', async () => {
    const uid = account();
    await invoke(handleEinwilligung, uid, { zwecke: { ki_auswertung: true, fehlerberichte: true } });
    await Promise.all([
      invoke(handleEinwilligungWiderruf, uid, { zweck: 'ki_auswertung' }),
      invoke(handleEinwilligungWiderruf, uid, { zweck: 'fehlerberichte' }),
    ]);
    const user = getDb().collection('users').doc(uid);
    const userData = (await user.get()).data();
    if (!userData) throw new Error('Expected persisted user consent state.');
    const state = userData.einwilligung;
    expect(state.zwecke).toMatchObject({ notwendig: true, ki_auswertung: false, fehlerberichte: false });
    const snapshots = await user.collection('einwilligungen').get();
    expect(snapshots.size).toBe(3);
    const records = new Map<string, any>(snapshots.docs.map((doc: any) => [doc.id, doc.data()]));
    let cursor: string | null = state.evidenceId;
    const visited = new Set<string>();
    while (cursor) {
      expect(visited.has(cursor)).toBe(false);
      visited.add(cursor);
      const record = records.get(cursor);
      expect(record).toBeDefined();
      // Signed fields are deliberately separated from Firestore metadata.
      const { actorUid, action, legalVersion, purposes, effectiveAt, recordedAt,
        previousEvidenceId, source, signatureAlgorithm, signature, withdrawnPurpose } = record;
      expect(verifyConsentAuditRecord({
        actorUid, action, legalVersion, purposes, effectiveAt, recordedAt,
        previousEvidenceId, source, signatureAlgorithm, signature,
        ...(withdrawnPurpose ? { withdrawnPurpose } : {}),
      }, consentAuditSecret())).toBe(true);
      cursor = record.previousEvidenceId;
    }
    expect(visited.size).toBe(3);
    expect(records.get(state.evidenceId).zwecke).toEqual(state.zwecke);
  });

  it('never invents a grant date or reverses a full withdrawal', async () => {
    const uid = account();
    const first = await invoke(handleEinwilligungWiderruf, uid, {});
    expect(first.einwilligung.erteiltAm).toBeNull();
    const next = await invoke(handleEinwilligungWiderruf, uid, { zweck: 'ki_auswertung' });
    expect(next.einwilligung.erteiltAm).toBeNull();
    expect(next.einwilligung.widerrufenAm).toBe(first.einwilligung.widerrufenAm);
    expect(next.einwilligung.zwecke.ki_auswertung).toBe(false);
  });
});
