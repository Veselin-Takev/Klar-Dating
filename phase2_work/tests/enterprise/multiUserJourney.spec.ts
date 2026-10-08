import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processContactRequest,
  processContactUndo,
  type MinimalFirestore,
  type MinimalTransaction,
  type MinimalDocSnapshot,
} from '../../src/server/platform/contactEngine';
import { DAILY_CONTACTS, contactDay } from '../../src/server/pure';
import { VerificationManager } from '../../src/server/verification/VerificationManager.js';
import { IdNowProvider } from '../../src/server/verification/IdNowProvider.js';
import { DiditProvider } from '../../src/server/verification/DiditProvider.js';

interface InMemoryDb {
  users: Map<string, any>;
  contacts: Map<string, any>;
}

function createMockFirestore(seedData?: { users?: Record<string, any>; contacts?: Record<string, any> }): {
  firestore: MinimalFirestore;
  db: InMemoryDb;
} {
  const db: InMemoryDb = {
    users: new Map(Object.entries(seedData?.users ?? {})),
    contacts: new Map(Object.entries(seedData?.contacts ?? {})),
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
      const stagedDeletes: Array<{ collection: string; id: string }> = [];

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
        delete: (ref: any) => {
          stagedDeletes.push({ collection: ref.collectionName, id: ref.id });
        },
      };

      const result = await updateFunction(transaction);

      // Commit changes
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

      for (const op of stagedDeletes) {
        const col = db[op.collection as keyof InMemoryDb];
        col?.delete(op.id);
      }

      return result;
    },
  };

  return { firestore, db };
}

test('Multi-User Journey: Full identity verification pipeline with primary and fallback', async () => {
  const primary = new IdNowProvider();
  const secondary = new DiditProvider();
  const manager = new VerificationManager(primary, secondary);

  // 1. Primary provider succeeds
  const primaryResult = await manager.verifyUser({
    userId: 'user_alice',
    documentType: 'PASSPORT',
    frontImageUrl: 'https://storage.example.com/alice_id.jpg',
  });
  assert.equal(primaryResult.success, true);
  assert.equal(primaryResult.providerUsed, 'IDNOW');

  // 2. Primary provider failure routes seamlessly to Didit
  primary.isHealthy = async () => false;
  const fallbackResult = await manager.verifyUser({
    userId: 'user_bob',
    documentType: 'ID_CARD',
    frontImageUrl: 'https://storage.example.com/bob_id.jpg',
  });
  assert.equal(fallbackResult.success, true);
  assert.equal(fallbackResult.providerUsed, 'DIDIT');
});

test('Multi-User Journey: Verified contact orchestration, quota ledger enforcement, duplicate prevention & 5s undo', async () => {
  const now = new Date('2026-09-24T12:00:00Z');
  const todayStr = contactDay(now);

  const { firestore, db } = createMockFirestore({
    users: {
      alice: { isVerified: true, contactDay: todayStr, contactCount: 0 },
      bob: { isVerified: true, contactDay: todayStr, contactCount: 0 },
      unverified_user: { isVerified: false, contactDay: todayStr, contactCount: 0 },
    },
  });

  // Step 1: Unverified user cannot initiate contact
  const unverifiedRes = await processContactRequest(firestore, 'unverified_user', 'bob', now);
  assert.equal(unverifiedRes.ok, false);
  assert.equal(unverifiedRes.grund, 'nicht_verifiziert');
  assert.equal(db.contacts.size, 0);

  // Step 2: Alice contacts Bob
  const firstContact = await processContactRequest(firestore, 'alice', 'bob', now, now);
  assert.equal(firstContact.ok, true);
  assert.equal(firstContact.uebrig, DAILY_CONTACTS - 1);
  assert.equal(firstContact.gesamt, DAILY_CONTACTS);

  // Check state in DB
  const aliceState = db.users.get('alice');
  assert.equal(aliceState.contactCount, 1);
  assert.equal(db.contacts.has('alice_bob'), true);

  // Step 3: Duplicate contact attempt is rejected
  const dupContact = await processContactRequest(firestore, 'alice', 'bob', now, now);
  assert.equal(dupContact.ok, false);
  assert.equal(dupContact.grund, 'bereits_kontaktiert');
  assert.equal(db.users.get('alice').contactCount, 1);

  // Step 4: Undo within 5 seconds restores quota and removes contact
  const undoTime = new Date(now.getTime() + 3_000); // 3 seconds later
  const undoResult = await processContactUndo(firestore, 'alice', 'bob', undoTime);
  assert.equal(undoResult.ok, true);
  assert.equal(db.contacts.has('alice_bob'), false);
  assert.equal(db.users.get('alice').contactCount, 0);

  // Step 5: After undo, Alice can initiate contact again
  const reContact = await processContactRequest(firestore, 'alice', 'bob', undoTime, undoTime);
  assert.equal(reContact.ok, true);
  assert.equal(reContact.uebrig, DAILY_CONTACTS - 1);
  assert.equal(db.contacts.has('alice_bob'), true);
  assert.equal(db.users.get('alice').contactCount, 1);

  // Step 6: Expired undo (> 5000ms) is strictly rejected
  const expiredTime = new Date(undoTime.getTime() + 6_000); // 6 seconds after re-contact
  const expiredUndo = await processContactUndo(firestore, 'alice', 'bob', expiredTime);
  assert.equal(expiredUndo.ok, false);
  assert.equal(db.contacts.has('alice_bob'), true);
  assert.equal(db.users.get('alice').contactCount, 1);
});

test('Multi-User Journey: 8-contacts quota hard limit with 4am rollover', async () => {
  const day1 = new Date('2026-09-24T10:00:00Z');
  const day1Str = contactDay(day1);

  const { firestore, db } = createMockFirestore({
    users: {
      charlie: { isVerified: true, contactDay: day1Str, contactCount: 0 },
    },
  });

  // Consume all 8 contacts
  for (let i = 1; i <= DAILY_CONTACTS; i++) {
    const target = `target_${i}`;
    const res = await processContactRequest(firestore, 'charlie', target, day1, day1);
    assert.equal(res.ok, true);
    assert.equal(res.uebrig, DAILY_CONTACTS - i);
  }

  // 9th contact attempt is rejected
  const limitRes = await processContactRequest(firestore, 'charlie', 'target_overflow', day1, day1);
  assert.equal(limitRes.ok, false);
  assert.equal(limitRes.grund, 'limit');
  assert.equal(db.users.get('charlie').contactCount, DAILY_CONTACTS);

  // Next day after 4am rollover (2026-09-25T05:00:00Z)
  const day2 = new Date('2026-09-25T05:00:00Z');
  const nextDayRes = await processContactRequest(firestore, 'charlie', 'target_day2', day2, day2);
  assert.equal(nextDayRes.ok, true);
  assert.equal(nextDayRes.uebrig, DAILY_CONTACTS - 1);
  assert.equal(db.users.get('charlie').contactCount, 1);
});
