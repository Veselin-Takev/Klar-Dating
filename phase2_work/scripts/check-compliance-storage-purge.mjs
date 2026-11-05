import fs from 'node:fs';
const route = fs.readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const fn = fs.readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const checks = [
  ['protected purge endpoint', /purge-verification-storage/],
  ['environment secret', /COMPLIANCE_JOB_SECRET/],
  ['HMAC timing-safe validation', /timingSafeEqual/],
  ['nonce bound to purge signature', /timestampHeader}\.\$\{nonceHeader}\./],
  ['nonce ledger transaction', /tx\.create\(nonceRef/],
  ['nonce replay rejection', /ownership\.kind === 'replay'/],
  ['scheduler checks receipt rather than only HTTP 200', /assertCompleteVerificationPurgeReceipt/],
  ['durable failure progress callback', /recordFailedPage:\s*async/],
  ['journal failures on verification event', /photoPurgeFailure:/],
  ['persistent unresolved failure latch', /hasUnresolvedFailures:/],
  ['full clean cycle latch reset', /cycleHadFailures: false/],
  ['default-deny photo purge opt-in', /isVerificationPhotoPurgeEnabled\(process\.env\.KLAR_VERIFICATION_PHOTO_PURGE_ENABLED\)/],
  ['P0 source-locked live release disabled', /const VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED = false/],
  ['P0 denies before Cloud Firestore or Storage use', /if \(!isVerificationPhotoPurgeRuntimeAllowed\(process\.env\)\)/],
  ['disabled photo purge returns retryable error', /status\(503\)\.json\(\{ code: 'verification_storage_purge_disabled' \}\)/],
  ['30-day retention engine', /executeVerificationRetentionBatch/],
  ['verification path boundary', /startsWith\(`verification\/\$\{uid\}\/`\)/],
  ['daily scheduler', /schedule: '0 3 \* \* \*'/],
  ['single scheduler instance', /maxInstances: 1/],
];
for (const [label, re] of checks) {
  const source = label === 'daily scheduler' || label === 'single scheduler instance'
    || label === 'scheduler checks receipt rather than only HTTP 200' ? fn
    : label === 'protected purge endpoint' ? server + route : route;
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
const verifier = route.split('export function validComplianceRequest(')[1]?.split('function normalizeTimestamp(')[0] ?? '';
if (!verifier.includes('.update(body)') || verifier.includes("toString('utf8')")) {
  throw new Error('Compliance storage purge boundary failed: verifier must HMAC raw bytes');
}
if (!route.includes('if (!Buffer.isBuffer(req.body)) return res.sendStatus(415);')
  || route.includes("Buffer.from('{}')")
  || !fn.includes('randomUUID()')
  || !fn.includes('X-Klar-Compliance-Nonce')
  || !fn.includes('${timestamp}.${nonce}.${body}')) {
  throw new Error('Compliance storage purge boundary failed: signed raw-body fail-closed binding');
}
console.log('Compliance storage purge boundary: PASS');
