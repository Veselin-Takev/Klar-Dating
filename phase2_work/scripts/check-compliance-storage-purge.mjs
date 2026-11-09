import fs from 'node:fs';

const route = fs.readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const fn = fs.readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const retention = fs.readFileSync('functions/src/retention.ts', 'utf8');
const legacyCron = fs.readFileSync('functions/src/deleteExpiredPhotos.ts', 'utf8');
const accounting = fs.readFileSync('src/server/trustAndSafety.ts', 'utf8');

const authorization = fs.readFileSync('src/server/verificationPurgeAuthorization.ts', 'utf8');
const holds = fs.readFileSync('src/server/deletionHolds.ts', 'utf8');
const checks = [
  ['account-specific plan binds request, bucket and expiry', ['plan.requestId !== requestId','plan.bucket !== bucket','timestampMillis(plan.expiresAt) <= now'].every(token => authorization.includes(token))],
  ['missing provenance/hold flags deny verification purge', ['event.legalHold !== false','event.photoPurgeHold !== false','event.generation','assertDeletionNotHeld(tx, uid)'].every(token => authorization.includes(token))],
  ['hold protection is transaction-local and fails closed', /class DeletionHold/.test(holds) && /data\[key\] !== false/.test(holds)],
  ['protected purge endpoint registered', /purge-verification-storage/.test(server + route)],
  ['environment HMAC secret', /COMPLIANCE_JOB_SECRET/.test(route)],
  ['HMAC timing-safe validation', /timingSafeEqual/.test(route)],
  ['signed scheduler retained for later approved recovery', /schedule: '0 3 \* \* \*'/.test(fn)],
  ['single scheduler instance', /maxInstances: 1/.test(fn)],
  ['production purge hard-denial', /return res\.status\(503\)\.json\(\{ code: 'verification_storage_purge_p0_fencing_unverified' \}\)/.test(route)],
  ['no purge bucket/Firestore/retention side effects', !/getStorage\(|getDb\(|executeVerificationRetentionBatch\(/.test(route)],
  ['legacy age-delete helper rejects unconditionally', /deleteExpiredPhotoPage[\s\S]*?throw new Error\('verification_photo_p0_fencing_unverified'\)/.test(retention)],
  ['legacy scheduled worker never invokes photo deletes', !/deleteExpiredPhotoPage\(|getMaintenanceBucket\(|\.delete\(\{\s*ifGenerationMatch/.test(legacyCron)],
  ['account deletion checks verification prefix', /const verificationPrefix = `verification\/\$\{uid\}\/`/.test(retention)],
  ['account deletion uses bounded profile-only prefix', /prefix: `profiles\/\$\{uid\}\/`, maxResults: 100/.test(retention)],
  ['account deletion rechecks verification objects', (retention.match(/await assertNoVerificationPhotos\(\)/g) ?? []).length >= 2],
  ['account deletion rejects held GCS metadata', /assertNotHeld\(metadata\)/.test(retention)],
  ['account deletion generation preconditions', /ifGenerationMatch: generation/.test(retention)],
  ['real account-erasure orchestrator retains Storage gate', /await deleteAccountPhotos\(photoBucket, meineUid, verificationPurgeAuthorization\(/.test(accounting)],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`Compliance storage P0 boundary failed: ${label}`);
}
console.log(`Compliance storage P0 containment boundary: PASS (${checks.length} checks)`);
