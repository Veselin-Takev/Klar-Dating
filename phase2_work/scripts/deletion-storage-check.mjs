import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Execute the real dependency-free production module (no Firebase/Admin mocks).
const source = stripTypeScriptTypes(readFileSync(new URL('../functions/src/retention.ts', import.meta.url), 'utf8'));
const { deleteAccountPhotos, deleteExpiredPhotoPage } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

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
function bucket(filesByPrefix = {}) {
  return {
    async getFiles({ prefix, maxResults, autoPaginate }) {
      assert.equal(autoPaginate, false);
      assert.equal(maxResults, prefix.startsWith('verification/') ? 1 : 100);
      return [(filesByPrefix[prefix] ?? []).slice(0, maxResults), null];
    },
  };
}

test('P0: rejects verification-photo account erasure before any Storage delete', async () => {
  let deleted = 0;
  const verification = photo({ onDelete() { deleted++; } });
  const profile = photo({ onDelete() { deleted++; } });
  const storage = bucket({ 'verification/owner/': [verification], 'profiles/owner/': [profile] });
  await assert.rejects(deleteAccountPhotos(storage, 'owner'), /verification_photo_p0_fencing_unverified/);
  assert.equal(deleted, 0);
});

test('P0: profile-only erasure remains bounded and resumable, unrelated owners untouched', async () => {
  const objects = new Map([
    ['verification/owner/', []],
    ['profiles/owner/', Array.from({ length: 205 }, () => ({}))],
    ['profiles/owner-other/', Array.from({ length: 1 }, () => ({}))],
  ]);
  let requests = 0;
  const storage = { async getFiles({ prefix, maxResults, autoPaginate, pageToken }) {
    requests++;
    assert.equal(maxResults, prefix.startsWith('verification/') ? 1 : 100);
    assert.equal(autoPaginate, false);
    assert.equal(pageToken, undefined);
    const remaining = objects.get(prefix);
    assert.ok(remaining);
    return [remaining.slice(0, maxResults).map(item => photo({ onDelete() { remaining.splice(remaining.indexOf(item), 1); } })), null];
  } };
  for (let i = 0; i < 3; i++) assert.equal(await deleteAccountPhotos(storage, 'owner'), false);
  assert.equal(await deleteAccountPhotos(storage, 'owner'), true);
  assert.equal(requests, 12);
  assert.equal(objects.get('profiles/owner-other/').length, 1);
});

test('rejects invalid owners before Storage access', async () => {
  const storage = { async getFiles() { assert.fail('must not access storage'); } };
  for (const uid of ['', '.', '..', 'a/b']) await assert.rejects(deleteAccountPhotos(storage, uid), /Invalid storage owner/);
});

test('does not report stale missing profile objects as successful progress', async () => {
  for (const options of [{ error: { code: 404 } }, { metadataError: { code: 404 } }]) {
    await assert.rejects(deleteAccountPhotos(bucket({ 'profiles/owner/': [photo(options)] }), 'owner'), /storage_erasure_no_progress/);
  }
});

test('propagates generation conflicts and failures even after partial profile deletion', async () => {
  for (const code of [412, 403, 503]) {
    const failure = { code };
    await assert.rejects(deleteAccountPhotos(bucket({ 'profiles/owner/': [photo(), photo({ error: failure })] }), 'owner'), error => error === failure);
  }
});

test('blocks malformed/held GCS metadata and missing or non-canonical generations', async () => {
  for (const metadata of [
    { temporaryHold: true }, { temporaryHold: null }, { temporaryHold: 'false' },
    { eventBasedHold: true }, { eventBasedHold: null },
    { generation: undefined }, { generation: '0' }, { generation: 'abc' },
    { generation: '18446744073709551616' },
  ]) {
    let deleted = 0;
    await assert.rejects(deleteAccountPhotos(bucket({
      'profiles/owner/': [photo({ metadata, onDelete() { deleted++; } })],
    }), 'owner'), /storage_object_held|storage_object_metadata_invalid/);
    assert.equal(deleted, 0);
  }
});

test('rejects oversized and empty-but-continuing profile pages', async () => {
  const oversized = { async getFiles({ prefix }) {
    return [prefix.startsWith('verification/') ? [] : Array.from({ length: 101 }, () => photo()), null];
  } };
  await assert.rejects(deleteAccountPhotos(oversized, 'owner'), /storage_page_limit_exceeded/);
  const continuing = { async getFiles({ prefix }) {
    return [[], prefix.startsWith('verification/') ? null : { pageToken: 'more' }];
  } };
  await assert.rejects(deleteAccountPhotos(continuing, 'owner'), /storage_erasure_no_progress/);
});

test('refuses completion when verification objects appear during profile cleanup', async () => {
  let check = 0;
  const storage = { async getFiles({ prefix }) {
    if (prefix.startsWith('verification/')) return [++check === 1 ? [] : [photo()], null];
    return [[photo()], null];
  } };
  await assert.rejects(deleteAccountPhotos(storage, 'owner'), /verification_photo_p0_fencing_unverified/);
  assert.equal(check, 2);
});

test('propagates failure when listing profile files after verification preflight', async () => {
  const storage = { async getFiles({ prefix }) {
    if (prefix.startsWith('verification/')) return [[], null];
    throw new Error('listing unavailable');
  } };
  await assert.rejects(deleteAccountPhotos(storage, 'owner'), /listing unavailable/);
});

test('P0: legacy age-only photo-delete worker cannot invoke Storage', async () => {
  const storage = { async getFiles() { assert.fail('Storage must not be reached'); } };
  await assert.rejects(deleteExpiredPhotoPage(storage, new Date('2026-11-08')), /verification_photo_p0_fencing_unverified/);
});
