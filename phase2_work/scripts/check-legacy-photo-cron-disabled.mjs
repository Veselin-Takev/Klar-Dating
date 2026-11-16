import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const worker = readFileSync(new URL('functions/src/deleteExpiredPhotos.ts', root), 'utf8');
const exports = readFileSync(new URL('functions/src/index.ts', root), 'utf8');

function verify(source, entrypoint) {
  assert.match(source, /export const deleteExpiredPhotosCron = onSchedule/);
  assert.match(source, /verification_photo_retention_disabled/);
  assert.match(source, /photoDeletionAttempted:\s*false/);
  assert.doesNotMatch(source, /deleteExpiredPhotoPage|getMaintenanceBucket|\.bucket\(/,
    'legacy upload-age scheduler must not list or delete Storage objects');
  assert.match(source, /collection\('funnel_events'\)/,
    'unrelated funnel-event expiry cleanup must remain active');
  assert.match(entrypoint, /export \{ deleteExpiredPhotosCron \} from '\.\/deleteExpiredPhotos'/,
    'preserve deployed Cloud Function export identity; do not silently remove the scheduled function');
}

verify(worker, exports);

// Mutation regressions: reintroducing the former deletion helper or bucket
// access must make the mandatory retention gate fail.
assert.throws(() => verify(worker + '\nvoid deleteExpiredPhotoPage(bucket, now);', exports));
assert.throws(() => verify(worker + '\ngetMaintenanceBucket();', exports));
console.log('PASS: legacy verification-photo age purge disabled; scheduler identity and funnel cleanup preserved.');
