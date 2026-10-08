import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processContactRequest,
  processContactUndo,
  type MinimalFirestore,
  type MinimalTransaction,
  type MinimalDocSnapshot,
} from '../../src/server/platform/contactEngine';
import { DAILY_CONTACTS } from '../../src/server/pure';

function createMockFirestore(initialDocs: Record<string, any> = {}) {
  const store = new Map<string, any>(Object.entries(initialDocs));

  const firestore: MinimalFirestore = {
    collection: (col: string) => ({
      doc: (id: string) => {
        const path = `${col}/${id}`;
        return { path };
      },
    }),
    runTransaction: async <T>(updateFn: (t: MinimalTransaction) => Promise<T>): Promise<T> => {
      const writes: { type: 'set' | 'delete'; path: string; data?: any; options?: any }[] = [];

      const tx: MinimalTransaction = {
        get: async (ref: any): Promise<MinimalDocSnapshot> => {
          const val = store.get(ref.path);
          return {
            exists: val !== undefined && val !== null,
            data: () => (val ? JSON.parse(JSON.stringify(val)) : undefined),
          };
        },
        set: (ref: any, data: any, options?: any) => {
          writes.push({ type: 'set', path: ref.path, data, options });
        },
        delete: (ref: any) => {
          writes.push({ type: 'delete', path: ref.path });
        },
      };

      const result = await updateFn(tx);

      // Commit writes atomically
      for (const w of writes) {
        if (w.type === 'delete') {
          store.delete(w.path);
        } else if (w.type === 'set') {
          const prev = store.get(w.path) || {};
          if (w.options?.merge) {
            store.set(w.path, { ...prev, ...w.data });
          } else {
            store.set(w.path, w.data);
          }
        }
      }

      return result;
    },
  };

  return { firestore, store };
}

test('processContactRequest rejects self-contact with 400 InputError', async () => {
  const { firestore } = createMockFirestore();
  await assert.rejects(
    async () => {
      await processContactRequest(firestore, 'user1', 'user1');
    },
    { message: 'Kein Kontakt zum eigenen Konto.' }
  );
});

test('processContactRequest rejects unverified user with nicht_verifiziert', async () => {
  const { firestore } = createMockFirestore({
    'users/user1': { isVerified: false, contactCount: 0 },
  });

  const res = await processContactRequest(firestore, 'user1', 'user2');
  assert.equal(res.ok, false);
  assert.equal(res.grund, 'nicht_verifiziert');
  assert.equal(res.error, 'Für den ersten Kontakt ist die Verifizierung nötig.');
});

test('processContactRequest establishes contact, decrements quota, and records document', async () => {
  const { firestore, store } = createMockFirestore({
    'users/user1': { isVerified: true, contactCount: 2, contactDay: '2026-09-24' },
  });

  const res = await processContactRequest(firestore, 'user1', 'user2', new Date('2026-09-24T12:00:00Z'));
  assert.equal(res.ok, true);
  assert.equal(res.uebrig, DAILY_CONTACTS - 3); // was 2, now 3, remaining = 8 - 3 = 5
  assert.equal(res.gesamt, DAILY_CONTACTS);

  // Check state updates
  const contactDoc = store.get('contacts/user1_user2');
  assert.ok(contactDoc);
  assert.equal(contactDoc.fromUid, 'user1');
  assert.equal(contactDoc.toUid, 'user2');

  const userDoc = store.get('users/user1');
  assert.equal(userDoc.contactCount, 3);
});

test('processContactRequest rejects duplicate contact with bereits_kontaktiert', async () => {
  const { firestore } = createMockFirestore({
    'users/user1': { isVerified: true, contactCount: 1, contactDay: '2026-09-24' },
    'contacts/user1_user2': { fromUid: 'user1', toUid: 'user2', tag: '2026-09-24' },
  });

  const res = await processContactRequest(firestore, 'user1', 'user2', new Date('2026-09-24T12:00:00Z'));
  assert.equal(res.ok, false);
  assert.equal(res.grund, 'bereits_kontaktiert');
  assert.equal(res.error, 'Diese Person hast du bereits angeschrieben.');
});

test('processContactRequest rejects contact when quota exhausted with limit', async () => {
  const { firestore } = createMockFirestore({
    'users/user1': { isVerified: true, contactCount: DAILY_CONTACTS, contactDay: '2026-09-24' },
  });

  const res = await processContactRequest(firestore, 'user1', 'user2', new Date('2026-09-24T12:00:00Z'));
  assert.equal(res.ok, false);
  assert.equal(res.grund, 'limit');
  assert.ok(res.error?.includes('sind alle 8 Kontakte vergeben'));
});

test('processContactUndo successfully reverts contact within 5s window and decrements quota', async () => {
  const contactTime = new Date('2026-09-24T12:00:00.000Z');
  const undoTime = new Date('2026-09-24T12:00:03.000Z'); // 3s later, within 5s

  const { firestore, store } = createMockFirestore({
    'users/user1': { isVerified: true, contactCount: 3, contactDay: '2026-09-24' },
    'contacts/user1_user2': { fromUid: 'user1', toUid: 'user2', at: contactTime },
  });

  const res = await processContactUndo(firestore, 'user1', 'user2', undoTime);
  assert.equal(res.ok, true);

  // Verify contact was deleted
  assert.equal(store.has('contacts/user1_user2'), false);

  // Verify user contactCount was decremented
  const userDoc = store.get('users/user1');
  assert.equal(userDoc.contactCount, 2);
});

test('processContactUndo rejects reversal when exceeding 5s window', async () => {
  const contactTime = new Date('2026-09-24T12:00:00.000Z');
  const undoTime = new Date('2026-09-24T12:00:06.000Z'); // 6s later, past 5s

  const { firestore, store } = createMockFirestore({
    'users/user1': { isVerified: true, contactCount: 3, contactDay: '2026-09-24' },
    'contacts/user1_user2': { fromUid: 'user1', toUid: 'user2', at: contactTime },
  });

  const res = await processContactUndo(firestore, 'user1', 'user2', undoTime);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Die Rücknahme ist nicht mehr möglich.');

  // Contact still exists
  assert.equal(store.has('contacts/user1_user2'), true);
});

test('processContactUndo rejects non-existent contact', async () => {
  const { firestore } = createMockFirestore({
    'users/user1': { isVerified: true, contactCount: 3 },
  });

  const res = await processContactUndo(firestore, 'user1', 'user_none', new Date());
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Die Rücknahme ist nicht mehr möglich.');
});
