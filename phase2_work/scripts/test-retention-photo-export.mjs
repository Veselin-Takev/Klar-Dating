#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { photoPurgeExportViolations } from './check-retention-config.mjs';
const source = readFileSync('functions/src/index.ts', 'utf8');
const cron = readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
assert.deepEqual(photoPurgeExportViolations(source, cron), []);
for (const line of ["export { deleteExpiredPhotosCron } from './deleteExpiredPhotos';", 'export {  deleteExpiredPhotosCron } from "./deleteExpiredPhotos"']) {
  assert(photoPurgeExportViolations(source + '\n' + line, cron).some(x => x.includes('unsafe legacy')));
}
assert(photoPurgeExportViolations(source.replace("export { purgeVerificationStorageCron } from './purgeVerificationStorage';", ''), cron).some(x => x.includes('authenticated verification purge')));
assert(photoPurgeExportViolations(source, cron.replace('COMPLIANCE_JOB_SECRET', 'NO_SECRET')).some(x => x.includes('authenticated verification purge')));
console.log('PASS: legacy photo scanner remains unexported and authenticated purge required');
