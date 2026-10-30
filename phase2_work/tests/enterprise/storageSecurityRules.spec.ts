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

test('Storage Rules: profile photos require the live Firestore adult and active status of requester and owner', () => {
  const valid = { size: 1 * 1024 * 1024, contentType: 'image/png' };
  const adult = { requesterUserIsAdult: true, requesterAccountStatus: 'active' };
  const target = { targetUserIsAdult: true, targetAccountStatus: 'active' };
  // Positive: both server-owned profiles are active adults. No JWT isAdult needed.
  const allowed = evaluateStorageSecurityRule({
    operation: 'read', path: '/profiles/usr_alice/avatar.png', auth: USER_BOB, ...adult, ...target,
  });
  assert.equal(allowed.allowed, true);
  // Missing / false / pending / deleted profiles fail closed for either side.
  for (const partial of [
    { ...adult, targetUserIsAdult: false, targetAccountStatus: 'active' },
    { ...adult, targetUserIsAdult: true, targetAccountStatus: 'deleted' },
    { ...adult, targetUserIsAdult: undefined, targetAccountStatus: 'active' },
    { requesterUserIsAdult: false, requesterAccountStatus: 'active', ...target },
    { requesterUserIsAdult: true, requesterAccountStatus: 'pending_age', ...target },
    { requesterUserIsAdult: undefined, requesterAccountStatus: undefined, ...target },
  ]) {
    assert.equal(evaluateStorageSecurityRule({
      operation: 'read', path: '/profiles/usr_alice/avatar.png', auth: USER_BOB, ...partial,
    }).allowed, false);
  }
  assert.equal(evaluateStorageSecurityRule({
    operation: 'read', path: '/profiles/usr_alice/avatar.png', auth: GAST_USER, ...adult, ...target,
  }).allowed, false);
  assert.equal(evaluateStorageSecurityRule({
    operation: 'read', path: '/profiles/usr_alice/avatar.png', auth: null, ...adult, ...target,
  }).code, 'UNAUTHENTICATED');

  // Owner-only writes and deletes also require a server-side active adult.
  for (const operation of ['write', 'delete'] as const) {
    assert.equal(evaluateStorageSecurityRule({
      operation, path: '/profiles/usr_alice/avatar.png', auth: USER_ALICE,
      resource: valid, ...adult,
    }).allowed, true);
    assert.equal(evaluateStorageSecurityRule({
      operation, path: '/profiles/usr_alice/avatar.png', auth: USER_ALICE,
      resource: valid, requesterUserIsAdult: false, requesterAccountStatus: 'active',
    }).allowed, false);
    assert.equal(evaluateStorageSecurityRule({
      operation, path: '/profiles/usr_alice/avatar.png', auth: USER_BOB,
      resource: valid, ...adult,
    }).allowed, false);
  }
  assert.equal(evaluateStorageSecurityRule({
    operation: 'write', path: '/profiles/usr_alice/avatar.png',
    auth: USER_ALICE, resource: { size: 1, contentType: 'application/pdf' }, ...adult,
  }).code, 'INVALID_MIME');
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
