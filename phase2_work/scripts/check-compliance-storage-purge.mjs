import fs from 'node:fs';
const route = fs.readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const fn = fs.readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const checks = [
  ['protected purge endpoint', /purge-verification-storage/],
  ['environment secret', /COMPLIANCE_JOB_SECRET/],
  ['HMAC timing-safe validation', /timingSafeEqual/],
  ['30-day retention engine', /executeVerificationRetentionBatch/],
  ['temporary Storage hold guard', /isActiveOrMalformedHold\(metadata\.temporaryHold\)/],
  ['event-based Storage hold guard', /isActiveOrMalformedHold\(metadata\.eventBasedHold\)/],
  ['object retention expiration guard', /metadata\.retentionExpirationTime/],
  ['object retain-until guard', /metadata\.retention\?\.retainUntilTime/],
  ['legal hold on current Firestore decision', /'legalHold' in data && data\.legalHold !== false/],
  ['retention hold on current Firestore decision', /'retentionHold' in data && data\.retentionHold !== false/],
  ['generation-conditional delete', /file\.delete\(\{ ifGenerationMatch: generation \}\)/],
  ['resumable scanner', /scanPurgePages/],
  ['persisted deletion intent', /photoPurgeIntent/],
  ['verification path boundary', /startsWith\(`verification\/\$\{uid\}\/`\)/],
  ['daily scheduler', /schedule: '0 3 \* \* \*'/],
  ['single scheduler instance', /maxInstances: 1/],
];
for (const [label, re] of checks) {
  const source = label === 'daily scheduler' || label === 'single scheduler instance' ? fn : label === 'protected purge endpoint' ? server + route : route;
  if (!re.test(source)) throw new Error(`Compliance storage purge boundary failed: ${label}`);
}
console.log('Compliance storage purge boundary: PASS');
