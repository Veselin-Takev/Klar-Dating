import fs from 'node:fs';
const route = fs.readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const fn = fs.readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const checks = [
  ['protected purge endpoint', /purge-verification-storage/],
  ['environment secret', /COMPLIANCE_JOB_SECRET/],
  ['HMAC timing-safe validation', /timingSafeEqual/],
  ['default-deny photo purge opt-in', /isVerificationPhotoPurgeEnabled\(process\.env\.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED\)/],
  ['explicit purge bucket checked', /validatedVerificationPurgeBucketName\(process\.env\.FIREBASE_STORAGE_BUCKET\)/],
  ['record-level hold validation', /assertVerificationPurgeRecordNotHeld\(data\)/],
  ['hold and legal-hold must be checked', /\['photoPurgeHold', 'legalHold'\]/],
  ['unconfigured purge bucket returns 503', /verification_storage_purge_bucket_unconfigured/],
  ['disabled photo purge returns retryable error', /status\(503\)\.json\(\{ code: 'verification_storage_purge_disabled' \}\)/],
  ['30-day retention engine', /executeVerificationRetentionBatch/],
  ['verification path boundary', /startsWith\(`verification\/\$\{uid\}\/`\)/],
  ['daily scheduler', /schedule: '0 3 \* \* \*'/],
  ['single scheduler instance', /maxInstances: 1/],
];
for (const [label, re] of checks) {
  const source = label === 'daily scheduler' || label === 'single scheduler instance' ? fn : label === 'protected purge endpoint' ? server + route : route;
  if (!re.test(source)) throw new Error(`Compliance storage purge boundary failed: ${label}`);
}
// The scheduler signs the exact JSON bytes. A global express.json() parser
// before the scoped raw parser would erase those bytes and disable valid jobs.
const rawAt = server.indexOf("app.use('/api/admin/purge-verification-storage',");
const jsonAt = server.indexOf('app.use(express.json({');
const routerAt = server.indexOf("app.use('/api/admin', createVerificationStoragePurgeRouter(");
if (rawAt < 0 || jsonAt < 0 || routerAt < 0 || !(rawAt < jsonAt && jsonAt < routerAt)) {
  throw new Error('Compliance storage purge boundary failed: raw parser registration order');
}
if (!route.includes('if (!Buffer.isBuffer(req.body)) return res.sendStatus(415);')
  || route.includes("Buffer.from('{}')")) {
  throw new Error('Compliance storage purge boundary failed: signed raw-body fail-closed binding');
}
// Deleting from an implicit default bucket is forbidden even when the
// scheduler supplied a valid HMAC proof or an opt-in flag was enabled.
if (/getStorage\(\)\.bucket\(\s*\)/.test(route)) {
  throw new Error('Compliance storage purge boundary failed: implicit default bucket forbidden');
}
const bucketCheck = route.indexOf('if (!deps.getBucket && !purgeBucketName)');
const dbAccess = route.indexOf('const db = deps.getDb();');
if (bucketCheck < 0 || dbAccess < 0 || bucketCheck >= dbAccess) {
  throw new Error('Compliance storage purge boundary failed: bucket check must precede Firestore access');
}
console.log('Compliance storage purge boundary: PASS');
