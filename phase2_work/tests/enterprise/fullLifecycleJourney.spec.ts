import test from 'node:test';
import assert from 'node:assert/strict';
import type { DsaAppeal } from '../../src/server/platform/dsaAppealEngine';
import { processAgeVerification } from '../../src/server/platform/ageGateEngine';
import { recordExplicitConsent, revokeExplicitConsent } from '../../src/server/platform/consentEngine';
import { processContactRequest } from '../../src/server/platform/contactEngine';
import { computeMessageHash } from '../../src/server/messages';
import {
  recordModerationDecision,
  submitDsaAppeal,
  reviewDsaAppeal,
} from '../../src/server/platform/dsaAppealEngine';

interface LifecycleDb {
  users: Map<string, any>;
  public_profiles: Map<string, any>;
  reports: Map<string, any>;
  consent_audit_log: Map<string, any>;
  age_verification_attempts: Map<string, any>;
}

function createLifecycleFirestore(initial: Partial<{
  users: Record<string, any>;
  public_profiles: Record<string, any>;
  reports: Record<string, any>;
}> = {}) {
  const db: LifecycleDb = {
    users: new Map(Object.entries(initial.users || {})),
    public_profiles: new Map(Object.entries(initial.public_profiles || {})),
    reports: new Map(Object.entries(initial.reports || {})),
    consent_audit_log: new Map(),
    age_verification_attempts: new Map(),
  };

  const firestore: any = {
    collection: (colName: string) => ({
      doc: (id?: string) => {
        const docId = id || `gen_${Math.random().toString(36).substring(2, 9)}`;
        return {
          id: docId,
          collectionName: colName,
          path: `${colName}/${docId}`,
          get: async () => {
            const table = db[colName as keyof LifecycleDb];
            const data = table?.get(docId);
            return {
              exists: data !== undefined && data !== null,
              data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
            };
          },
        };
      },
    }),
    runTransaction: async <T>(updateFn: (t: any) => Promise<T>): Promise<T> => {
      const pendingWrites: Array<{ col: string; id: string; type: 'set' | 'delete'; data?: any; merge?: boolean }> = [];

      const tx: any = {
        get: async (ref: any) => {
          const colName = ref.collectionName || ref.path.split('/')[0];
          const docId = ref.id || ref.path.split('/')[1];
          const table = db[colName as keyof LifecycleDb];
          const item = table?.get(docId);
          return {
            exists: item !== undefined && item !== null,
            data: () => (item ? JSON.parse(JSON.stringify(item)) : undefined),
          };
        },
        set: (ref: any, data: any, options?: any) => {
          const colName = ref.collectionName || ref.path.split('/')[0];
          const docId = ref.id || ref.path.split('/')[1];
          pendingWrites.push({
            col: colName,
            id: docId,
            type: 'set',
            data: JSON.parse(JSON.stringify(data)),
            merge: options?.merge,
          });
        },
        delete: (ref: any) => {
          const colName = ref.collectionName || ref.path.split('/')[0];
          const docId = ref.id || ref.path.split('/')[1];
          pendingWrites.push({ col: colName, id: docId, type: 'delete' });
        },
      };

      const result = await updateFn(tx);

      for (const w of pendingWrites) {
        let table = db[w.col as keyof LifecycleDb];
        if (!table) {
          table = new Map();
          (db as any)[w.col] = table;
        }

        if (w.type === 'delete') {
          table.delete(w.id);
        } else if (w.merge) {
          const existing = table.get(w.id) || {};
          table.set(w.id, { ...existing, ...w.data });
        } else {
          table.set(w.id, w.data);
        }
      }

      return result;
    },
  };

  return { firestore, db };
}

test('Full Lifecycle Journey: Complete orchestration from Onboarding to DSA Moderation and Appeal', async () => {
  const userA = 'usr_sarah';
  const userB = 'usr_lukas';
  const journeyStart = new Date('2026-09-25T10:00:00Z');

  const { firestore, db } = createLifecycleFirestore({
    users: {
      [userA]: { name: 'Sarah', isVerified: true, accountStatus: 'pending_age' },
      [userB]: { name: 'Lukas', isVerified: true, isAdult: true, geburtsdatum: '1998-04-12' },
    },
    public_profiles: {
      [userA]: { name: 'Sarah', bio: 'Architektur & Musik' },
      [userB]: { name: 'Lukas', bio: 'Kochen & Wandern' },
    },
  });

  // ── PHASE 1: Hard Age-Gate & Art. 9 Consent ──────────────────────────────
  // 1. Sarah completes Hard Age-Gate
  const ageOutcome = await processAgeVerification(firestore, userA, '2001-08-15', { now: journeyStart });
  assert.equal(ageOutcome.ok, true);
  assert.equal(ageOutcome.status, 'verified_adult');
  assert.equal(ageOutcome.age, 25);
  assert.ok(ageOutcome.evidenceDigest);

  // 2. Sarah provides Art. 9 explicit consent
  const consentState = await recordExplicitConsent(
    firestore,
    userA,
    { art9_sexual_orientation: true, ai_personality_insights: true },
    journeyStart
  );
  assert.equal(consentState.purposes.art9_sexual_orientation, true);
  assert.ok(consentState.evidenceHash);

  // ── PHASE 2: Contact Orchestration & Quota Ledger ────────────────────────
  // 3. Sarah initiates contact with Lukas (8 contacts/day ledger)
  const contactTime = new Date('2026-09-25T11:00:00Z');
  const contactResult = await processContactRequest(firestore, userA, userB, contactTime, contactTime);
  assert.equal(contactResult.ok, true);
  assert.equal(contactResult.uebrig, 7);
  assert.equal(contactResult.gesamt, 8);

  // ── PHASE 3: Chat Message Integrity & Content Moderation Report ──────────
  // 4. Message sent and hashed for cryptographic immutability
  const msgText = 'Unangemessene Belästigungsnachricht';
  const msgHash = computeMessageHash(userA, 'chat_sarah_lukas', msgText, 'msg_dsa_001');
  assert.equal(msgHash.length, 64);

  // 5. Lukas files report against Sarah under DSA Art. 16
  const reportId = 'rep_dsa_001';
  db.reports.set(reportId, {
    reportId,
    reportedProfileId: userA,
    reporterId: userB,
    category: 'harassment',
    status: 'pending',
    evidenceMessageHash: msgHash,
    createdAt: '2026-09-25T11:05:00Z',
  });

  // 6. Trust & Safety moderator issues suspension decision with DSA Art. 17 Statement of Reasons
  const modDecisionTime = new Date('2026-09-25T11:30:00Z');
  const modDecision = await recordModerationDecision(
    firestore,
    reportId,
    'mod_trust_safety_lead',
    {
      restrictionType: 'account_suspension',
      legalGround: 'harassment',
      factsAndCircumstances: 'Nachricht enthält wiederholte verbale Grenzüberschreitungen.',
    },
    modDecisionTime
  );
  assert.equal(modDecision.restrictionType, 'account_suspension');
  assert.equal(modDecision.targetUid, userA);
  assert.ok(modDecision.redressOptions.internalAppealAvailable);

  // Assert Sarah's account is now suspended
  const userDocAfterSuspension = db.users.get(userA);
  assert.equal(userDocAfterSuspension.active, false);
  assert.equal(userDocAfterSuspension.suspendedReason, modDecision.factsAndCircumstances);

  // ── PHASE 4: DSA Internal Appeal (Art. 20) & Moderator Review ────────────
  // 7. Sarah submits internal appeal
  const appealTime = new Date('2026-09-25T12:00:00Z');
  const appealResult: DsaAppeal = await submitDsaAppeal(
    firestore,
    reportId,
    userA,
    'Missverständnis im Kontext eines Zitats; keine vorsätzliche Belästigung beabsichtigt.',
    null,
    appealTime
  );
  assert.equal(appealResult.status, 'pending');
  assert.equal(appealResult.appellantUid, userA);

  // 8. Moderator reviews appeal and grants pardon / overturns restriction
  const reviewTime = new Date('2026-09-25T13:00:00Z');
  const reviewOutcome = await reviewDsaAppeal(
    firestore,
    reportId,
    'mod_supervisor_01',
    'overturned',
    'Kontextprüfung bestätigt Zitat-Charakter. Verwarnung ausgesprochen, Suspendierung aufgehoben.',
    reviewTime
  );
  assert.equal(reviewOutcome.status, 'overturned');

  // Assert Sarah's account is restored to active status
  const userDocAfterRestoration = db.users.get(userA);
  assert.equal(userDocAfterRestoration.active, true);
  assert.equal(userDocAfterRestoration.suspendedReason, null);

  // ── PHASE 5: GDPR Art. 9 Revocation & Cascading Data Minimization ────────
  // 9. Sarah revokes Art. 9 consent -> cascade purge removes sensitive attributes
  const revokeTime = new Date('2026-09-25T14:00:00Z');
  const revokeOutcome = await revokeExplicitConsent(firestore, userA, 'all', revokeTime);
  assert.equal(revokeOutcome.ok, true);
  assert.ok(revokeOutcome.purgedFields.includes('sexualOrientation'));

  const userDocAfterRevoke = db.users.get(userA);
  assert.equal(userDocAfterRevoke.sexualOrientation, null);
  assert.equal(userDocAfterRevoke.religion, null);
});
