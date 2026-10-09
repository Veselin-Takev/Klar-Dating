import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import {
  formatPublicKeyPem,
  getMessageToVerify,
  verifyAdMobSignature,
  processAdMobReward,
  type AdMobCallbackParams,
} from '../../src/server/platform/admobSsvEngine';

function createMockFirestore(initialDocs: Record<string, any> = {}) {
  const store = new Map<string, any>(Object.entries(initialDocs));

  const firestore = {
    collection: (col: string) => ({
      doc: (id: string) => {
        const path = `${col}/${id}`;
        return { path };
      },
    }),
    runTransaction: async <T>(updateFn: (t: any) => Promise<T>): Promise<T> => {
      const writes: { type: 'set' | 'delete'; path: string; data?: any; options?: any }[] = [];

      const tx = {
        get: async (ref: any) => {
          const val = store.get(ref.path);
          return {
            exists: val !== undefined && val !== null,
            data: () => (val ? JSON.parse(JSON.stringify(val)) : undefined),
          };
        },
        set: (ref: any, data: any, options?: any) => {
          writes.push({ type: 'set', path: ref.path, data, options });
        },
      };

      const result = await updateFn(tx);

      for (const w of writes) {
        const prev = store.get(w.path) || {};
        if (w.options?.merge) {
          store.set(w.path, { ...prev, ...w.data });
        } else {
          store.set(w.path, w.data);
        }
      }

      return result;
    },
  };

  return { firestore, store };
}

test('AdMob SSV: PEM normalization wraps raw base64 key correctly', () => {
  const rawKey = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1234567890';
  const pem = formatPublicKeyPem(rawKey);
  assert.ok(pem.startsWith('-----BEGIN PUBLIC KEY-----'));
  assert.ok(pem.endsWith('-----END PUBLIC KEY-----'));
});

test('AdMob SSV: getMessageToVerify preserves query parameters before &signature=', () => {
  const rawUrl = 'ad_network=545021&reward_amount=3&timestamp=1700000000000&transaction_id=tx_123&user_id=u_abc&signature=MEQCID...&key_id=123';
  const msg = getMessageToVerify({
    transaction_id: 'tx_123',
    user_id: 'u_abc',
    signature: 'MEQCID...',
    key_id: '123',
  }, rawUrl);

  assert.equal(msg, 'ad_network=545021&reward_amount=3&timestamp=1700000000000&transaction_id=tx_123&user_id=u_abc');
});

test('AdMob SSV: Cryptographic ECDSA-SHA256 signature verification and tamper detection', () => {
  // Generate a legitimate ECDSA keypair on the P-256 (prime256v1) curve
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const message = 'ad_network=545021&reward_amount=3&timestamp=1700000000000&transaction_id=tx_test_456&user_id=usr_alice';
  
  // Sign the message using ECDSA-SHA256
  const signer = crypto.createSign('SHA256');
  signer.update(message);
  const validSignature = signer.sign(privateKey, 'base64url');

  // Assert valid signature passes verification
  const isValid = verifyAdMobSignature(message, validSignature, publicKey);
  assert.equal(isValid, true, 'Legitimate signature must verify successfully');

  // Assert tampered message fails
  const tamperedMessage = message + '&tampered=1';
  const isTamperedValid = verifyAdMobSignature(tamperedMessage, validSignature, publicKey);
  assert.equal(isTamperedValid, false, 'Tampered message must be rejected');

  // Assert corrupted signature fails
  const corruptedSignature = validSignature.substring(0, validSignature.length - 4) + 'AAAA';
  const isCorruptedValid = verifyAdMobSignature(message, corruptedSignature, publicKey);
  assert.equal(isCorruptedValid, false, 'Corrupted signature must be rejected');
});

test('AdMob SSV: Atomic reward processing, quota grant, and replay prevention', async () => {
  const fixedNow = new Date('2026-09-24T12:00:00Z');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const keysMap = new Map<string, string>([['key_google_1', publicKey]]);
  const { firestore, store } = createMockFirestore({
    'users/user_bob': {
      isVerified: true,
      extraContacts: 0,
      extraTag: '2026-09-24',
    },
  });

  const params: AdMobCallbackParams = {
    ad_network: '5450213213286189855',
    reward_amount: 3,
    reward_item: 'contacts',
    timestamp: fixedNow.getTime(),
    transaction_id: 'admob_tx_789012',
    user_id: 'user_bob',
    signature: '',
    key_id: 'key_google_1',
  };

  const rawQuery = `ad_network=${params.ad_network}&reward_amount=3&reward_item=contacts&timestamp=${params.timestamp}&transaction_id=${params.transaction_id}&user_id=${params.user_id}`;
  const signer = crypto.createSign('SHA256');
  signer.update(rawQuery);
  params.signature = signer.sign(privateKey, 'base64url');

  // 1. First execution: Success, reward +3 contacts granted
  const res1 = await processAdMobReward(firestore as unknown as Firestore, params, rawQuery + `&signature=${params.signature}&key_id=key_google_1`, keysMap, fixedNow);
  assert.equal(res1.ok, true);
  assert.equal(res1.duplicate, false);
  assert.equal(res1.rewardAmount, 3);
  assert.equal(res1.transactionId, 'admob_tx_789012');

  const bobData = store.get('users/user_bob');
  assert.equal(bobData.extraContacts, 3, 'Bob must have received +3 extra contacts');
  assert.ok(store.has('admob_rewards/admob_tx_789012'), 'Reward ledger must record transaction');

  // 2. Second execution with identical transaction_id (Replay attack): Idempotent duplicate handled cleanly
  const res2 = await processAdMobReward(firestore as unknown as Firestore, params, rawQuery + `&signature=${params.signature}&key_id=key_google_1`, keysMap, fixedNow);
  assert.equal(res2.ok, true);
  assert.equal(res2.duplicate, true, 'Duplicate transaction must be flagged as duplicate');

  // Extra contacts must NOT be credited a second time!
  const bobDataAfterReplay = store.get('users/user_bob');
  assert.equal(bobDataAfterReplay.extraContacts, 3, 'Extra contacts must remain 3 after replay');
});

test('AdMob SSV: Outdated timestamp outside 24-hour window is rejected', async () => {
  const now = new Date('2026-09-24T12:00:00Z');
  const expiredTime = new Date('2026-09-20T12:00:00Z').getTime(); // 4 days old

  const { firestore } = createMockFirestore();
  const params: AdMobCallbackParams = {
    timestamp: expiredTime,
    transaction_id: 'tx_old',
    user_id: 'user_bob',
    signature: 'dummy_sig',
    key_id: 'key_1',
  };

  const res = await processAdMobReward(firestore as unknown as Firestore, params, undefined, undefined, now);
  assert.equal(res.ok, false);
  assert.ok(res.error?.includes('acceptable window'));
});
