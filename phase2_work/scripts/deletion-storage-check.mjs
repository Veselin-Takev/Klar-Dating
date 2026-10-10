import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Execute the real dependency-free module, with no Firebase/Admin SDK mocks.
const source = stripTypeScriptTypes(readFileSync(new URL('../functions/src/retention.ts', import.meta.url), 'utf8'));
const { deleteAccountPhotos } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

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
