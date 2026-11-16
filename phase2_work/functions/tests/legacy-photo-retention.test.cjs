const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const workerSource = readFileSync(join(__dirname, '../src/deleteExpiredPhotos.ts'), 'utf8');

test('legacy photo-retention scheduler never lists or deletes verification photos', () => {
  assert.doesNotMatch(workerSource, /getMaintenanceBucket|deleteExpiredPhotoPage/);
  assert.match(workerSource, /verification_photo_retention_disabled_legacy_worker/);
  assert.match(workerSource, /decision_aware_fenced_purge_required/);
});

test('legacy scheduler preserves only the independent funnel-event cleanup', () => {
  assert.match(workerSource, /collection\('funnel_events'\)/);
  assert.match(workerSource, /expiresAt/);
  assert.match(workerSource, /funnel_event_retention/);
});
