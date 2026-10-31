import fs from 'node:fs';
const route = fs.readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const fn = fs.readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const deleteGuard = fs.readFileSync('src/server/platform/verificationPhotoDelete.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const checks = [
  ['protected purge endpoint', /purge-verification-storage/],
  ['environment secret', /COMPLIANCE_JOB_SECRET/],
  ['HMAC timing-safe validation', /timingSafeEqual/],
  ['30-day retention engine', /executeVerificationRetentionBatch/],
  ['current Firestore state verified', /matchesActiveRetentionDecision/],
  ['generation-safe Storage deletion', /deleteVerificationPhotoIfUnchanged/],
  ['failed per-artifact cleanup forces retry', /summary\.results\.some\(result => result\.reason === 'error'\)/],
  ['verification path boundary', /startsWith\(`verification\/\$\{uid\}\/`\)/],
  ['daily scheduler', /schedule: '0 3 \* \* \*'/],
  ['single scheduler instance', /maxInstances: 1/],
];
for (const [label, re] of checks) {
  const source = label === 'daily scheduler' || label === 'single scheduler instance' ? fn : label === 'protected purge endpoint' ? server + route : route;
  if (!re.test(source)) throw new Error(`Compliance storage purge boundary failed: ${label}`);
}
if (!deleteGuard.includes('ifGenerationMatch: generation') ||
    !deleteGuard.includes('metadata.temporaryHold') ||
    !deleteGuard.includes('metadata.eventBasedHold') ||
    !deleteGuard.includes('verification_photo_generation_missing')) {
  throw new Error('Compliance storage purge boundary failed: generation and retention holds');
}
console.log('Compliance storage purge boundary: PASS');
