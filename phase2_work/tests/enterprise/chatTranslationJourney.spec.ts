import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processContactRequest,
  processContactUndo,
  type MinimalFirestore,
  type MinimalTransaction,
  type MinimalDocSnapshot,
} from '../../src/server/platform/contactEngine';
import {
  processTranslation,
  normalizeLanguage,
} from '../../src/server/platform/translationEngine';
import { InputError } from '../../src/server/pure';

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

test('Story 2.1: Mutual match initializes canonical chat with Icebreaker Gate', async () => {
  const fixedDate = new Date('2026-09-24T12:00:00Z');
  const { firestore, store } = createMockFirestore({
    'users/user_alice': { isVerified: true, plan: 'frei', contactCount: 0, contactDay: '2026-09-24' },
    'users/user_bob': { isVerified: true, plan: 'frei', contactCount: 0, contactDay: '2026-09-24' },
  });

  // Step 1: Alice contacts Bob (first-directional, not mutual yet)
  const res1 = await processContactRequest(firestore, 'user_alice', 'user_bob', fixedDate);
  assert.equal(res1.ok, true);
  assert.equal(res1.isMutual, false);
  assert.equal(res1.chatId, undefined);
  assert.ok(store.has('contacts/user_alice_user_bob'));

  // Step 2: Bob contacts Alice (reciprocal match!)
  const res2 = await processContactRequest(firestore, 'user_bob', 'user_alice', fixedDate);
  assert.equal(res2.ok, true);
  assert.equal(res2.isMutual, true);
  assert.equal(res2.chatId, 'user_alice_user_bob');

  // Verify chat doc was created with Icebreaker questions
  const chatDoc = store.get('chats/user_alice_user_bob');
  assert.ok(chatDoc, 'Chat document must exist');
  assert.deepEqual(chatDoc.participants, ['user_alice', 'user_bob']);
  assert.equal(chatDoc.gateAntwortenA, 0);
  assert.equal(chatDoc.gateAntwortenB, 0);
  assert.equal(chatDoc.gateFragen.length, 2);
  assert.equal(chatDoc.isMutual, true);
});

test('Story 2.1: Undo within 5 seconds cleanly removes mutual chat', async () => {
  const t0 = new Date('2026-09-24T12:00:00Z');
  const t1 = new Date('2026-09-24T12:00:03Z'); // 3s later (within 5s limit)
  const { firestore, store } = createMockFirestore({
    'users/user_alice': { isVerified: true, plan: 'frei', contactCount: 1, contactDay: '2026-09-24' },
    'users/user_bob': { isVerified: true, plan: 'frei', contactCount: 1, contactDay: '2026-09-24' },
    'contacts/user_alice_user_bob': { fromUid: 'user_alice', toUid: 'user_bob', at: t0 },
    'contacts/user_bob_user_alice': { fromUid: 'user_bob', toUid: 'user_alice', at: t0 },
    'chats/user_alice_user_bob': { participants: ['user_alice', 'user_bob'], isMutual: true },
  });

  const undoRes = await processContactUndo(firestore, 'user_bob', 'user_alice', t1);
  assert.equal(undoRes.ok, true);
  assert.equal(store.has('contacts/user_bob_user_alice'), false);
  assert.equal(store.has('chats/user_alice_user_bob'), false, 'Chat must be torn down on undo');
});

test('Story 2.3: Translation engine normalizes language codes and names', () => {
  assert.deepEqual(normalizeLanguage('de'), { code: 'de', name: 'Deutsch' });
  assert.deepEqual(normalizeLanguage('Deutsch'), { code: 'de', name: 'Deutsch' });
  assert.deepEqual(normalizeLanguage('en'), { code: 'en', name: 'Englisch' });
  assert.deepEqual(normalizeLanguage('Englisch'), { code: 'en', name: 'Englisch' });
  assert.deepEqual(normalizeLanguage('es'), { code: 'es', name: 'Spanisch' });
});

test('Story 2.3: Translation engine redacts GDPR Art. 9 data and handles fallback safely', async () => {
  const sensitiveMessage = 'Ich habe Depressionen und war in der Psychiatrie. Schreib mir auf Insta: @dating_test oder ruf an: +49 170 1234567';

  const result = await processTranslation(sensitiveMessage, 'Englisch', 'Deutsch');
  assert.equal(result.success, true);
  assert.equal(result.redacted, true);
  assert.ok(result.redactedTypes.includes('art9_health'));
  assert.ok(result.redactedTypes.includes('contact_info'));

  // Ensure redacted tokens are present in output
  assert.ok(!result.textTranslated.includes('Depressionen'));
  assert.ok(!result.textTranslated.includes('@dating_test'));
  assert.ok(result.textTranslated.includes('[REDACTED_'));
});

test('Story 2.3: Translation engine strictly rejects input over 4000 characters', async () => {
  const longText = 'A'.repeat(4001);
  await assert.rejects(
    async () => {
      await processTranslation(longText, 'en');
    },
    (err: any) => err instanceof InputError
  );
});
