import test from 'node:test';
import assert from 'node:assert/strict';
import { categoriesForLine, detectionRules } from './tenant-access-patterns.mjs';

test('detects actual Admin SDK chained reads, sensitive collection literals and delete operations', () => {
  const samples = [
    ["const snapshot = await db.collection('verification_events')", ['firestore_client', 'user_sensitive_path', 'firestore_collection_literal']],
    ["const ref = db.collection('tenants').doc(tenantId)", ['firestore_client', 'user_sensitive_path', 'firestore_collection_literal']],
    ["const ref = db.doc('users/' + uid)", ['firestore_client', 'user_sensitive_path']],
    ["const user = doc(db, 'users', uid)", ['firestore_client', 'user_sensitive_path']],
    ["const profiles = collection(db, 'profiles')", ['firestore_client', 'user_sensitive_path', 'firestore_collection_literal']],
    ["db.collectionGroup('messages').where('tenantId', '==', id)", ['firestore_client', 'user_sensitive_path', 'firestore_collection_literal']],
    ["const db = getDb()", ['admin_firestore']],
    ["const s = getStorage().bucket()", ['storage_access']],
    ["await bucket.file(path).delete({ ifGenerationMatch: generation })", ['storage_access', 'database_mutation']],
    ["tx.update(ref, auditData)", ['database_mutation']],
    ["const url = await getDownloadURL(storageRef)", ['storage_access']],
    ["getDocs(query(collection(db, 'chats')))", ['firestore_client', 'user_sensitive_path', 'firestore_collection_literal']],
    ["await db.collection('mail_queue').where('uid', '==', uid).get()", ['firestore_client', 'firestore_collection_literal']],
    ["await batch.commit()", ['database_mutation']],
    ["await db.collection('reports').add({ ownerUid: uid })", ['database_mutation', 'firestore_client', 'firestore_collection_literal']],
    ["await db.collection('users').doc(uid).set({ active: false })", ['database_mutation', 'firestore_client', 'firestore_collection_literal']],
  ];
  for (const [source, expected] of samples) {
    const actual = categoriesForLine(source);
    for (const category of expected) assert.ok(actual.includes(category), `missed ${category}: ${source}`);
  }
});

test('category output is metadata only and never source text or guessed proof of authorization', () => {
  const marker = 'SECRET_CANARY_DO_NOT_OUTPUT';
  const actual = categoriesForLine("db.collection('users'); // " + marker);
  const names = detectionRules.map(([name]) => name);
  assert.deepEqual([...new Set(names)], names, 'duplicate category definitions');
  assert.ok(actual.every(name => names.includes(name)), 'invented category');
  assert.ok(!JSON.stringify(actual).includes(marker), 'source text leaked into category metadata');
  assert.deepEqual(categoriesForLine('plain harmless text'), []);
  assert.throws(() => categoriesForLine(null), TypeError);
});
