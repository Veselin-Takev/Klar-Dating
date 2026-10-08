import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import {
  buildStatementOfReasons,
  recordModerationDecision,
  submitDsaAppeal,
  reviewDsaAppeal,
  type DsaAppeal,
} from '../../src/server/platform/dsaAppealEngine';

interface InMemoryDb {
  reports: Map<string, any>;
  users: Map<string, any>;
}

function createMockFirestore(seedData?: { reports?: Record<string, any>; users?: Record<string, any> }): {
  firestore: Firestore;
  db: InMemoryDb;
} {
  const db: InMemoryDb = {
    reports: new Map(Object.entries(seedData?.reports ?? {})),
    users: new Map(Object.entries(seedData?.users ?? {})),
  };

  const firestore: MinimalFirestore = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        id,
        collectionName: name,
      }),
    }),
    runTransaction: async <T>(updateFunction: (transaction: MinimalTransaction) => Promise<T>): Promise<T> => {
      const stagedSets: Array<{ collection: string; id: string; data: any; merge?: boolean }> = [];

      const transaction: MinimalTransaction = {
        get: async (ref: any): Promise<MinimalDocSnapshot> => {
          const col = db[ref.collectionName as keyof InMemoryDb];
          const item = col?.get(ref.id);
          return {
            exists: item !== undefined,
            data: () => (item ? JSON.parse(JSON.stringify(item)) : undefined),
          };
        },
        set: (ref: any, data: any, options?: any) => {
          stagedSets.push({
            collection: ref.collectionName,
            id: ref.id,
            data: JSON.parse(JSON.stringify(data)),
            merge: options?.merge,
          });
        },
      };

      const result = await updateFunction(transaction);

      for (const op of stagedSets) {
        const col = db[op.collection as keyof InMemoryDb];
        if (col) {
          if (op.merge && col.has(op.id)) {
            const existing = col.get(op.id);
            col.set(op.id, { ...existing, ...op.data });
          } else {
            col.set(op.id, op.data);
          }
        }
      }

      return result;
    },
  };

  return { firestore: firestore as unknown as Firestore, db };
}

test('DSA Engine: buildStatementOfReasons enforces valid inputs and sets DSA Art. 20 guarantees', () => {
  const now = new Date('2026-09-24T12:00:00Z');
  const statement = buildStatementOfReasons(
    'rep_123',
    'usr_target',
    'mod_456',
    {
      restrictionType: 'account_warning',
      legalGround: 'harassment',
      factsAndCircumstances: 'Wiederholte belästigende Kontaktaufnahmen nach Verweigerung.',
    },
    now
  );

  assert.equal(statement.reportId, 'rep_123');
  assert.equal(statement.targetUid, 'usr_target');
  assert.equal(statement.restrictionType, 'account_warning');
  assert.equal(statement.legalGround, 'harassment');
  assert.equal(statement.redressOptions.appealWindowDays, 180);
  assert.equal(statement.redressOptions.internalAppealAvailable, true);
  assert.equal(statement.decidedByUid, 'mod_456');
});

test('DSA Engine: recordModerationDecision suspends account and updates report with DSA Art. 17 statement', async () => {
  const { firestore, db } = createMockFirestore({
    reports: {
      rep_001: {
        reporterId: 'usr_reporter',
        reportedProfileId: 'usr_bad_actor',
        reason: 'fakeprofil_spam',
      },
    },
    users: {
      usr_bad_actor: { active: true },
    },
  });

  const statement = await recordModerationDecision(
    firestore,
    'rep_001',
    'mod_chief',
    {
      restrictionType: 'account_suspension',
      legalGround: 'fraud_scam',
      factsAndCircumstances: 'Kommerzielle Betrugsabsicht mit externen Zahlungslinks nachgewiesen.',
    }
  );

  assert.equal(statement.restrictionType, 'account_suspension');

  const reportDoc = db.reports.get('rep_001');
  assert.equal(reportDoc.status, 'decided');
  assert.equal(reportDoc.entscheidung, 'account_suspension');
  assert.equal(reportDoc.dsaStatement.legalGround, 'fraud_scam');

  const userDoc = db.users.get('usr_bad_actor');
  assert.equal(userDoc.active, false);
  assert.equal(userDoc.suspendedReason, 'Kommerzielle Betrugsabsicht mit externen Zahlungslinks nachgewiesen.');
});

test('DSA Engine: submitDsaAppeal enforces party legitimacy, window limits and prevents duplicates', async () => {
  const decisionDate = new Date('2026-09-01T10:00:00Z');
  const statement = buildStatementOfReasons(
    'rep_002',
    'usr_target',
    'mod_1',
    {
      restrictionType: 'account_suspension',
      legalGround: 'terms_violation',
      factsAndCircumstances: 'Verstoß gegen Nutzungsbedingungen bezüglich Identitätsnachweis.',
    },
    decisionDate
  );

  const { firestore, db } = createMockFirestore({
    reports: {
      rep_002: {
        reporterId: 'usr_reporter',
        reportedProfileId: 'usr_target',
        dsaStatement: statement,
      },
    },
    users: {
      usr_target: { active: false },
    },
  });

  // 1. Unrelated third party cannot appeal
  await assert.rejects(
    async () => {
      await submitDsaAppeal(
        firestore,
        'rep_002',
        'usr_unrelated_stranger',
        'Ich möchte mich für diesen Nutzer beschweren.'
      );
    },
    { message: 'Nur betroffene oder meldende Personen können Beschwerde einlegen.' }
  );

  // 2. Target user appeals within window
  const nowAppeal = new Date('2026-09-10T10:00:00Z');
  const appeal = await submitDsaAppeal(
    firestore,
    'rep_002',
    'usr_target',
    'Die Anschuldigung trifft nicht zu, mein Dokument war gültig.',
    'https://evidence.example.com/doc.pdf',
    nowAppeal
  );
  assert.equal(appeal.status, 'pending');
  assert.equal(appeal.appellantUid, 'usr_target');
  assert.equal(db.reports.get('rep_002').appealStatus, 'pending');

  // 3. Duplicate appeal while pending is rejected
  await assert.rejects(
    async () => {
      await submitDsaAppeal(
        firestore,
        'rep_002',
        'usr_target',
        'Noch ein zweiter Beschwerdeversuch.'
      );
    },
    { message: 'Für diese Entscheidung ist bereits eine Beschwerde in Prüfung.' }
  );

  // 4. Appeal outside of 180 days is rejected
  const lateDate = new Date('2027-04-01T10:00:00Z'); // > 180 days after Sept 1, 2026
  const { firestore: lateFs } = createMockFirestore({
    reports: {
      rep_late: {
        reporterId: 'usr_reporter',
        reportedProfileId: 'usr_late_target',
        dsaStatement: statement,
      },
    },
  });

  await assert.rejects(
    async () => {
      await submitDsaAppeal(
        lateFs,
        'rep_late',
        'usr_late_target',
        'Sehr späte Beschwerde nach Ablauf aller Fristen.',
        undefined,
        lateDate
      );
    },
    { message: 'Die Frist für das interne Beschwerdeverfahren (180 Tage) ist abgelaufen.' }
  );
});

test('DSA Engine: reviewDsaAppeal overturns restriction and restores account status', async () => {
  const { firestore, db } = createMockFirestore({
    reports: {
      rep_003: {
        reporterId: 'usr_reporter',
        reportedProfileId: 'usr_wrongly_flagged',
        dsaAppeal: {
          id: 'appeal_003',
          reportId: 'rep_003',
          appellantUid: 'usr_wrongly_flagged',
          status: 'pending',
          appealReason: 'Gültiges Dokument wurde fälschlicherweise als ungültig erkannt.',
        },
      },
    },
    users: {
      usr_wrongly_flagged: { active: false, suspendedReason: 'Ungültiges Dokument' },
    },
  });

  const reviewTime = new Date('2026-09-24T15:00:00Z');
  const reviewed = await reviewDsaAppeal(
    firestore,
    'rep_003',
    'super_mod_anna',
    'overturned',
    'Nachmanueller Prüfung: Dokument ist vollgültig. Sperre aufgehoben.',
    reviewTime
  );

  assert.equal(reviewed.status, 'overturned');
  assert.equal(reviewed.reviewedByUid, 'super_mod_anna');

  const reportDoc = db.reports.get('rep_003');
  assert.equal(reportDoc.appealStatus, 'overturned');

  const userDoc = db.users.get('usr_wrongly_flagged');
  assert.equal(userDoc.active, true);
  assert.equal(userDoc.suspendedReason, null);
});
