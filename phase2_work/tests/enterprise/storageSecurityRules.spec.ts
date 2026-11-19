import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateStorageSecurityRule,
  isImageContentType,
  isGuestAuth,
} from '../../src/server/platform/storageRulesEngine';

const USER_ALICE = { uid: 'usr_alice', token: { firebase: { sign_in_provider: 'password' } } };
const USER_BOB = { uid: 'usr_bob', token: { firebase: { sign_in_provider: 'google.com' } } };
const GAST_USER = { uid: 'usr_guest', token: { firebase: { sign_in_provider: 'anonymous' } } };

test('Storage Rules: Helper methods validate MIME types and guest markers', () => {
  assert.equal(isImageContentType('image/jpeg'), true);
  assert.equal(isImageContentType('image/png'), true);
  assert.equal(isImageContentType('image/webp'), true);
  assert.equal(isImageContentType('application/pdf'), false);
  assert.equal(isImageContentType('text/html'), false);
  assert.equal(isImageContentType(''), false);

  assert.equal(isGuestAuth(GAST_USER), true);
  assert.equal(isGuestAuth(USER_ALICE), false);
  assert.equal(isGuestAuth(null), false);
});

test('Storage Rules: /verification/{uid}/{datei} strictly enforces Art. 9 zero-read mandate', () => {
  // 1. Owner CANNOT read their own verification photo (Art. 9 biometric data isolation)
  const ownerRead = evaluateStorageSecurityRule({
    operation: 'read',
    path: '/verification/usr_alice/gesture.jpg',
    auth: USER_ALICE,
  });
  assert.equal(ownerRead.allowed, false);
  assert.equal(ownerRead.code, 'PERMISSION_DENIED');

  // 2. Stranger cannot read
  const strangerRead = evaluateStorageSecurityRule({
    operation: 'read',
    path: '/verification/usr_alice/gesture.jpg',
    auth: USER_BOB,
  });
  assert.equal(strangerRead.allowed, false);

  // 3. Unauthenticated cannot read
  const unauthRead = evaluateStorageSecurityRule({
    operation: 'read',
    path: '/verification/usr_alice/gesture.jpg',
    auth: null,
  });
  assert.equal(unauthRead.allowed, false);
});

test('Storage Rules: retired verification path denies every Firebase client upload (owner, guest, stranger, malformed)', () => {
  const cases = [
    { auth: USER_ALICE, resource: { size: 2048, contentType: 'image/jpeg' } },
    { auth: USER_BOB, resource: { size: 2048, contentType: 'image/jpeg' } },
    { auth: GAST_USER, resource: { size: 2048, contentType: 'image/jpeg' } },
    { auth: null, resource: { size: 2048, contentType: 'image/jpeg' } },
    { auth: USER_ALICE, resource: { size: 50, contentType: 'application/pdf' } },
    { auth: USER_ALICE, resource: { size: 9 * 1024 * 1024, contentType: 'image/png' } },
  ];
  for (const entry of cases) {
    const decision = evaluateStorageSecurityRule({
      operation: 'write', path: '/verification/usr_alice/gesture.jpg', ...entry,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'PERMISSION_DENIED');
  }
});

test('Storage Rules: /verification/{uid}/{datei} deletion is forbidden client-side', () => {
  const ownerDelete = evaluateStorageSecurityRule({
    operation: 'delete',
    path: '/verification/usr_alice/gesture.jpg',
    auth: USER_ALICE,
  });
  assert.equal(ownerDelete.allowed, false);
  assert.equal(ownerDelete.code, 'PERMISSION_DENIED');
});

test('Storage Rules: /profiles/{uid}/{datei} enforces authenticated read, owner write and owner delete', () => {
  const validResource = { size: 1 * 1024 * 1024, contentType: 'image/png' };

  // 1. Any signed in user can read profile picture
  const bobReadsAlice = evaluateStorageSecurityRule({
    operation: 'read',
    path: '/profiles/usr_alice/avatar.png',
    auth: USER_BOB,
  });
  assert.equal(bobReadsAlice.allowed, true);

  // 2. Unauthenticated cannot read profile picture
  const unauthRead = evaluateStorageSecurityRule({
    operation: 'read',
    path: '/profiles/usr_alice/avatar.png',
    auth: null,
  });
  assert.equal(unauthRead.allowed, false);
  assert.equal(unauthRead.code, 'UNAUTHENTICATED');

  // 3. Owner can write profile picture
  const aliceWrites = evaluateStorageSecurityRule({
    operation: 'write',
    path: '/profiles/usr_alice/avatar.png',
    auth: USER_ALICE,
    resource: validResource,
  });
  assert.equal(aliceWrites.allowed, true);

  // 4. Stranger cannot write to Alice profile folder
  const bobWritesAlice = evaluateStorageSecurityRule({
    operation: 'write',
    path: '/profiles/usr_alice/avatar.png',
    auth: USER_BOB,
    resource: validResource,
  });
  assert.equal(bobWritesAlice.allowed, false);
  assert.equal(bobWritesAlice.code, 'PERMISSION_DENIED');

  // 5. Owner can delete own profile picture
  const aliceDeletes = evaluateStorageSecurityRule({
    operation: 'delete',
    path: '/profiles/usr_alice/avatar.png',
    auth: USER_ALICE,
  });
  assert.equal(aliceDeletes.allowed, true);

  // 6. Stranger cannot delete Alice profile picture
  const bobDeletesAlice = evaluateStorageSecurityRule({
    operation: 'delete',
    path: '/profiles/usr_alice/avatar.png',
    auth: USER_BOB,
  });
  assert.equal(bobDeletesAlice.allowed, false);
  assert.equal(bobDeletesAlice.code, 'PERMISSION_DENIED');
});

test('Storage Rules: Default deny-all on unregistered collections or incomplete paths', () => {
  const unknownPath = evaluateStorageSecurityRule({
    operation: 'read',
    path: '/system/config/keys.json',
    auth: USER_ALICE,
  });
  assert.equal(unknownPath.allowed, false);
  assert.equal(unknownPath.code, 'PERMISSION_DENIED');
});
