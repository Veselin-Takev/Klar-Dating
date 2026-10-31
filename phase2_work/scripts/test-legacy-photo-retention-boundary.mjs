import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const load = name => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
const legacy = load('../functions/src/deleteExpiredPhotos.ts');
const index = load('../functions/src/index.ts');
const authoritative = load('../functions/src/purgeVerificationStorage.ts');

test('legacy scheduled export remains, preventing accidental function deletion during deploy', () => {
  assert.match(index, /export\s*\{\s*deleteExpiredPhotosCron\s*\}\s*from\s*['"]\.\/deleteExpiredPhotos['"]/);
  assert.match(legacy, /export const deleteExpiredPhotosCron\s*=\s*onSchedule\(/);
});

test('legacy worker cannot call upload-age photo deletion or touch verification objects', () => {
  assert.doesNotMatch(legacy, /deleteExpiredPhotoPage|getMaintenanceBucket|verification\/|\.delete\(\s*\{\s*ifGenerationMatch/);
  assert.match(legacy, /deletedVerificationPhotos:\s*0/);
});

test('independent decision-aware worker remains exported', () => {
  assert.match(index, /export\s*\{\s*purgeVerificationStorageCron\s*\}/);
  assert.match(authoritative, /purge-verification-storage/);
});
