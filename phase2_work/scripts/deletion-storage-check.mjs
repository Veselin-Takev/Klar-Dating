import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Execute the real dependency-free module, with no Firebase/Admin SDK mocks.
const source = stripTypeScriptTypes(readFileSync(new URL('../functions/src/retention.ts', import.meta.url), 'utf8'));
const { deleteAccountPhotos: deleteAccountPhotosReal } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
// Legacy verification-object scenarios run only through the explicit
// nonproduction test mode; real account deletion does not use this override.
const deleteAccountPhotos = (bucket, uid) =>
  deleteAccountPhotosReal(bucket, uid, 'unsafe-emulator-test-only');

function photo(options = {}) {
  return {
    async getMetadata() {
      if (options.metadataError) throw options.metadataError;
      return [{ generation: '7', ...options.metadata }];
    },
    async delete(precondition) {
      assert.deepEqual(precondition, { ifGenerationMatch: '7' });
      if (options.error) throw options.error;
      options.onDelete?.();
    },
  };
}
function bucket(files) {
  return { async getFiles() { return [files, null]; } };
}

test('real account erasure rejects unfenced verification photos before any delete', async () => {
  let deleted = 0;
  let profileTouched = false;
  const photo = { async getMetadata() { return [{ generation: '7' }]; },
    async delete() { deleted++; } };
  const storage = { async getFiles({ prefix }) {
    if (prefix === 'verification/owner/') return [[photo], null];
    if (prefix === 'profiles/owner/') profileTouched = true;
    return [[], null];
  } };
  await assert.rejects(deleteAccountPhotosReal(storage, 'owner'), /verification_photo_p0_fencing_unverified/);
  assert.equal(deleted, 0);
  assert.equal(profileTouched, false);
});

test('profile-only erasure succeeds when verification prefix stays absent', async () => {
  const requests = [];
  let deleted = 0;
  const profile = { async getMetadata() { return [{ generation: '7' }]; },
    async delete({ ifGenerationMatch }) {
      assert.equal(ifGenerationMatch, '7');
      deleted++;
    } };
  const storage = { async getFiles({ prefix }) {
    requests.push(prefix);
    return [prefix === 'profiles/owner/' && deleted === 0 ? [profile] : [], null];
  } };
  assert.equal(await deleteAccountPhotosReal(storage, 'owner'), false);
  assert.equal(deleted, 1);
  assert.deepEqual(requests, [
    'verification/owner/', 'profiles/owner/', 'verification/owner/',
  ]);
  assert.equal(await deleteAccountPhotosReal(storage, 'owner'), true);
  assert.equal(deleted, 1);
});

test('late verification photo creation is not silently acknowledged as account erasure', async () => {
  let verificationReads = 0;
  let profileDeletions = 0;
  const file = { async getMetadata() { return [{ generation: '7' }]; },
    async delete() { profileDeletions++; } };
  const storage = { async getFiles({ prefix }) {
    if (prefix === 'verification/owner/') {
      verificationReads++;
      return [verificationReads === 1 ? [] : [file], null];
    }
    return [[file], null];
  } };
  await assert.rejects(deleteAccountPhotosReal(storage, 'owner'), /verification_photo_p0_fencing_unverified/);
  assert.equal(profileDeletions, 1);
  assert.equal(verificationReads, 2);
});

test('production rejects the legacy emulator-only deletion override', async () => {
  const previous = process.env.NODE_ENV;
  let bucketAccessed = false;
  try {
    process.env.NODE_ENV = 'production';
    await assert.rejects(deleteAccountPhotosReal({
      async getFiles() { bucketAccessed = true; return [[], null]; },
    }, 'owner', 'unsafe-emulator-test-only'), /verification_photo_p0_fencing_unverified/);
    assert.equal(bucketAccessed, false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('server account-deletion caller cannot opt into emulator-only verification deletion', () => {
  const caller = readFileSync(new URL('../src/server/trustAndSafety.ts', import.meta.url), 'utf8');
  assert.match(caller, /deleteAccountPhotos\(getAppBucket\(\), meineUid\)/);
  assert.doesNotMatch(caller, /deleteAccountPhotos\(getAppBucket\(\),\s*meineUid\s*,/,
    'live account-deletion must not use the legacy unsafe test mode');
});

test('bounds pages, re-lists after deletion and requires empty prefixes before completion', async () => {
  const objects = new Map();
  for (const [prefix, size] of [['verification/owner/', 205], ['profiles/owner/', 102], ['profiles/owner-other/', 1]]) {
    objects.set(prefix, Array.from({ length: size }, () => ({})));
  }
  let requests = 0;
  const storage = { async getFiles(options) {
    requests++;
    assert.equal(options.maxResults, 100);
    assert.equal(options.autoPaginate, false);
    assert.equal(options.pageToken, undefined);
    const remaining = objects.get(options.prefix);
    assert.ok(remaining);
    return [remaining.slice(0, 100).map(item => photo({ onDelete() { remaining.splice(remaining.indexOf(item), 1); } })), null];
  } };
  for (let i = 0; i < 3; i++) assert.equal(await deleteAccountPhotos(storage, 'owner'), false);
  assert.equal(await deleteAccountPhotos(storage, 'owner'), true);
  assert.equal(requests, 8);
  assert.equal(objects.get('profiles/owner-other/').length, 1);
});

test('rejects invalid owners before storage access', async () => {
  const storage = { async getFiles() { assert.fail('must not access storage'); } };
  for (const uid of ['', '.', '..', 'a/b']) await assert.rejects(deleteAccountPhotos(storage, uid), /Invalid storage owner/);
});

test('does not report stale missing objects as successful progress', async () => {
  for (const options of [{ error: { code: 404 } }, { metadataError: { code: 404 } }]) {
    await assert.rejects(deleteAccountPhotos(bucket([photo(options)]), 'owner'), /storage_erasure_no_progress/);
  }
});

test('propagates generation conflicts and service failures even after partial deletion', async () => {
  for (const code of [412, 403, 503]) {
    const failure = { code };
    await assert.rejects(deleteAccountPhotos(bucket([photo(), photo({ error: failure })]), 'owner'), e => e === failure);
  }
});

test('holds and missing generations prevent completion', async () => {
  for (const metadata of [{ temporaryHold: true }, { eventBasedHold: true }, { generation: undefined }]) {
    await assert.rejects(deleteAccountPhotos(bucket([photo({ metadata })]), 'owner'), /storage_object_held|Photo generation missing/);
  }
});

test('production-default profile erasure fails closed on malformed GCS hold metadata', async () => {
  const malformed = [
    { temporaryHold: 'true' }, { temporaryHold: 'false' },
    { eventBasedHold: 'false' }, { eventBasedHold: 'true' },
    { temporaryHold: 0 }, { eventBasedHold: { active: false } },
    { temporaryHold: null }, { eventBasedHold: null },
  ];
  for (const metadata of malformed) {
    let deleted = 0;
    const profile = photo({ metadata, onDelete() { deleted++; } });
    const storage = { async getFiles({ prefix }) {
      return prefix === 'verification/owner/' ? [[], null] : [[profile], null];
    } };
    await assert.rejects(deleteAccountPhotosReal(storage, 'owner'),
      /storage_object_held_or_invalid/);
    assert.equal(deleted, 0, 'no profile or verification delete may occur');
  }
});

test('account erasure rejects invalid GCS generations before physical deletion', async () => {
  const invalid = [
    undefined, null, false, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1,
    '0', '0007', '-7', '7e3', '7.0', 'n/a', {},
  ];
  for (const generation of invalid) {
    let deleted = 0;
    const profile = photo({ metadata: { generation }, onDelete() { deleted++; } });
    const storage = { async getFiles({ prefix }) {
      return prefix === 'verification/owner/' ? [[], null] : [[profile], null];
    } };
    await assert.rejects(deleteAccountPhotosReal(storage, 'owner'),
      /Photo generation missing or invalid/);
    assert.equal(deleted, 0);
  }
  let deleted = 0;
  const storage = { async getFiles({ prefix }) {
    return prefix === 'verification/owner/' ? [[], null] : [[{
      async getMetadata() { return [null]; },
      async delete() { deleted++; },
    }], null];
  } };
  await assert.rejects(deleteAccountPhotosReal(storage, 'owner'),
    /storage_object_held_or_invalid/);
  assert.equal(deleted, 0);
});

test('rejects oversized and empty-but-continuing pages', async () => {
  await assert.rejects(deleteAccountPhotos(bucket(Array.from({ length: 101 }, () => photo())), 'owner'), /storage_page_limit_exceeded/);
  await assert.rejects(deleteAccountPhotos({ async getFiles() { return [[], { pageToken: 'more' }]; } }, 'owner'), /storage_erasure_no_progress/);
});

test('does not swallow a listing failure after deleting the first prefix', async () => {
  let requests = 0;
  await assert.rejects(deleteAccountPhotos({ async getFiles() {
    if (++requests === 2) throw new Error('listing unavailable');
    return [[photo()], null];
  } }, 'owner'), /listing unavailable/);
});
