// Offline, read-only source mutation tests: no GCP project, credentials or
// production TTL/Storage access. The formal matrix also has a separate gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRetentionConfiguration } from './check-retention-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const original = {
  script: read('scripts/configure-retention.sh'),
  docs: read('docs/DATA_RETENTION.md'),
  messageWriter: read('src/server/messages.ts'),
  archiveWorker: read('functions/src/archiveInactiveChats.ts'),
  kycWriter: read('src/server/verification/diditKyc.ts'),
  legacyCron: read('functions/src/deleteExpiredPhotos.ts'),
  signedCron: read('functions/src/purgeVerificationStorage.ts'),
  functionsIndex: read('functions/src/index.ts'),
  route: read('src/server/routes/complianceStorage.ts'),
  engine: read('src/server/platform/storageRetentionEngine.ts'),
};

test('actual retention writers and staged provisioning reflect the authoritative decision-bound path', () => {
  assert.doesNotThrow(() => assertRetentionConfiguration(original));
});

const cases = [
  ['reactivate upload-age biometric deletion in legacy scheduled function',
    { legacyCron: original.legacyCron + '\ngetMaintenanceBucket().getFiles({ prefix: "verification/" });' }],
  ['remove signed-purge scheduler export',
    { functionsIndex: original.functionsIndex.replace("export { purgeVerificationStorageCron }", '// removed signed scheduler') }],
  ['remove HMAC from photo-purge scheduler',
    { signedCron: original.signedCron.replace("createHmac('sha256'", "unsafeHash('sha256'") }],
  ['remove signed compliance endpoint target',
    { signedCron: original.signedCron.replace('/api/admin/purge-verification-storage', '/unsafe/unspecified-delete') }],
  ['move due-date selection to GCS upload metadata',
    { route: original.route.replace(".where('fotoLoeschenAb', '<=', new Date(now))", ".where('timeCreated', '<=', new Date(now))") }],
  ['remove generation-conditional GCS deletion',
    { route: original.route.replace(
      'await file.delete({ ifGenerationMatch: generation });',
      'await file.delete({ dangerouslyIgnoreGeneration: generation });',
    ) }],
  ['allow pending review status into photo deletion',
    { engine: original.engine.replace("artifact.status !== 'approved' && artifact.status !== 'rejected'", "artifact.status === 'pending'") }],
  ['base retention expiry on an upload timestamp',
    { engine: original.engine.replace('isVerificationArtifactExpired(artifact.decidedAt', 'isVerificationArtifactExpired(artifact.uploadedAt') }],
  ['remove the legal approval gate',
    { script: original.script.replace('KLAR_RETENTION_LEGAL_APPROVED', 'LEGAL_APPROVAL_IGNORED') }],
  ['remove archived message expiration preservation',
    { archiveWorker: original.archiveWorker.replace('...message.data()', '...{text: message.data()?.text}') }],
  ['remove Didit deduplication TTL',
    { kycWriter: original.kycWriter.replace('expiresAt: new Date(now + 30 * 86400_000)', 'expiresAt: undefined') }],
  ['remove 90-day message expiry',
    { messageWriter: original.messageWriter.replace('expiresAt: new Date(Date.now() + 90 * 86400_000)', 'expiresAt: undefined') }],
];

for (const [label, mutation] of cases) {
  test('fails closed if: ' + label, () => {
    const modified = { ...original, ...mutation };
    assert.notDeepEqual(modified, original, 'test mutation must alter source');
    assert.throws(() => assertRetentionConfiguration(modified));
  });
}
