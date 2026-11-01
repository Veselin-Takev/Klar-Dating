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

test('canonical P0 legacy path cannot delete verification photos', () => {
  assert.deepEqual(legacyPhotoPurgeViolations(baseline), []);
});

const mutations = [
  ['legacy bucket import reinstated', b => ({ ...b, legacyCron: b.legacyCron + "\ngetMaintenanceBucket()" })],
  ['legacy age-only call reinstated', b => ({ ...b, legacyCron: b.legacyCron + "\ndeleteExpiredPhotoPage(bucket, now)" })],
  ['legacy callback deletes by Storage age', b => ({ ...b, legacyCron: b.legacyCron + "\nbucket.getFiles({prefix:'verification/'})" })],
  ['legacy helper no longer fails closed', b => ({ ...b, helperSource: b.helperSource.replace("throw new Error('legacy_age_only_photo_purge_disabled')", 'return undefined as never') })],
  ['legacy helper performs forbidden delete', b => ({ ...b, helperSource: b.helperSource.replace("throw new Error('legacy_age_only_photo_purge_disabled')", "await _bucket.getFiles({prefix:'verification/',maxResults:200,autoPaginate:false}); throw new Error('legacy_age_only_photo_purge_disabled')") })],
  ['funnel cleanup removed', b => ({ ...b, legacyCron: b.legacyCron.replace("collection('funnel_events')", "collection('unrelated')") })],
  ['new decision scheduler export dropped', b => ({ ...b, indexSource: b.indexSource.replace("export { purgeVerificationStorageCron } from './purgeVerificationStorage';", '') })],
  ['decision scheduler loses secret', b => ({ ...b, modernCron: b.modernCron.replaceAll('COMPLIANCE_JOB_SECRET', 'UNSIGNED_JOB') })],
  ['policy wrongly claims legacy active', b => ({ ...b, policy: b.policy.replace('Legacy-Pfad deaktiviert', 'Legacy-Pfad aktiv') })],
];

for (const [name, mutate] of mutations) {
  test('rejects regression: ' + name, () => {
    const changed = mutate(baseline);
    assert.notDeepEqual(changed, baseline, 'mutation ineffective: ' + name);
    assert.notEqual(legacyPhotoPurgeViolations(changed).length, 0, 'fail-open: ' + name);
  });
}
