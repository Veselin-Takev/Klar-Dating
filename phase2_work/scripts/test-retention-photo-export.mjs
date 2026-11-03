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

const safe = "export { purgeVerificationStorageCron } from './purgeVerificationStorage';";
const forbidden = [
  "export * from './deleteExpiredPhotos';",
  "export * as legacy from './deleteExpiredPhotos';",
  "export { deleteExpiredPhotosCron as legacy } from './deleteExpiredPhotos';",
  "export {\n deleteExpiredPhotosCron\n} from './deleteExpiredPhotos';",
  "export { /* comment */ deleteExpiredPhotosCron } from './deleteExpiredPhotos';",
  "import { deleteExpiredPhotosCron as legacy } from './deleteExpiredPhotos'; export { legacy };",
  "export { legacy } from './deleteExpiredPhotos.js';",
  String.raw`export * from './deleteExpired\u0050hotos';`,
  "const legacy = require('./deleteExpiredPhotos'); export { legacy };",
  "const legacy = import('./deleteExpiredPhotos');",
];
for (const fragment of forbidden) {
  assert(photoPurgeExportViolations(safe + '\n' + fragment, cron).some(x => x.includes('unsafe legacy')), fragment);
}
for (const valid of [safe, 'export {\n purgeVerificationStorageCron\n} from "./purgeVerificationStorage";',
  safe + "\n// export * from './deleteExpiredPhotos';", safe + '\n/* deleteExpiredPhotosCron */']) {
  assert.deepEqual(photoPurgeExportViolations(valid, cron), [], valid);
}
for (const invalid of ['', '// ' + safe, '/* ' + safe + ' */',
  "export type { purgeVerificationStorageCron } from './purgeVerificationStorage';",
  "export { type purgeVerificationStorageCron } from './purgeVerificationStorage';",
  "export { other as purgeVerificationStorageCron } from './purgeVerificationStorage';",
  "export { purgeVerificationStorageCron as other } from './purgeVerificationStorage';"]) {
  assert(photoPurgeExportViolations(invalid, cron).some(x => x.includes('authenticated verification purge')), invalid);
}
assert(photoPurgeExportViolations(safe + '\nexport {', cron).some(x => x.includes('invalid')));
console.log('PASS: 22 additional entrypoint syntax and export-boundary regression cases');
