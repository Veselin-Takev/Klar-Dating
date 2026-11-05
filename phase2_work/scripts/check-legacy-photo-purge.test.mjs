import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyPhotoPurgeViolations } from './check-legacy-photo-purge.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const baseline = {
  legacyCron: read('functions/src/deleteExpiredPhotos.ts'),
  helperSource: read('functions/src/retention.ts'),
  indexSource: read('functions/src/index.ts'),
  modernCron: read('functions/src/purgeVerificationStorage.ts'),
  policy: read('docs/DATA_RETENTION.md'),
};

test('combined PR 203/269 legacy purge gate passes', () => {
  assert.deepEqual(legacyPhotoPurgeViolations(baseline), []);
  assert.equal(baseline.helperSource.includes('export async function deleteExpiredPhotoPage('), false);
});

for (const [name, mutate] of [
  ['legacy photo scanner', b => ({ ...b, legacyCron: b.legacyCron + "\ngetMaintenanceBucket()" })],
  ['direct storage delete', b => ({ ...b, legacyCron: b.legacyCron + "\nawait photo.delete({ifGenerationMatch:7})" })],
  ['Storage SDK import', b => ({ ...b, legacyCron: b.legacyCron + "\nimport { getStorage } from 'firebase-admin/storage'" })],
  ['funnel cleanup removed', b => ({ ...b, legacyCron: b.legacyCron.replace("collection('funnel_events')", "collection('removed')") })],
  ['account erasure removed', b => ({ ...b, helperSource: b.helperSource.replace('export async function deleteAccountPhotos(', 'async function deletedAccountErasure(') })],
  ['retired helper reintroduced', b => ({ ...b, helperSource: b.helperSource + "\nexport async function deleteExpiredPhotoPage() { await photo.delete(); }" })],
  ['retired helper reintroduced as a throwing shim', b => ({ ...b, helperSource: b.helperSource + "\nexport async function deleteExpiredPhotoPage() { throw new Error('disabled'); }" })],
  ['retired helper reintroduced as a constant', b => ({ ...b, helperSource: b.helperSource + "\nexport const deleteExpiredPhotoPage = async () => { throw new Error('disabled'); }" })],
  ['retired helper reintroduced through assignment', b => ({ ...b, helperSource: b.helperSource + "\ndeleteExpiredPhotoPage = async () => {}" })],
  ['retired helper called from retention module', b => ({ ...b, helperSource: b.helperSource + "\nvoid deleteExpiredPhotoPage()" })],
  ['policy falsely claims active legacy purge', b => ({ ...b, policy: b.policy.replace('deaktiviert nur diesen Upload-Alter-Löschpfad', 'aktiviert wieder diesen Upload-Alter-Löschpfad') })],
  ['scheduler secret removed', b => ({ ...b, modernCron: b.modernCron.replaceAll('COMPLIANCE_JOB_SECRET', 'UNSIGNED_JOB') })],
  ['decision scheduler export removed', b => ({ ...b, indexSource: b.indexSource.replace("export { purgeVerificationStorageCron } from './purgeVerificationStorage';", '') })],
]) {
  test('rejects integration regression: ' + name, () => {
    const changed = mutate(baseline);
    assert.notDeepEqual(changed, baseline);
    assert.notEqual(legacyPhotoPurgeViolations(changed).length, 0);
  });
}
