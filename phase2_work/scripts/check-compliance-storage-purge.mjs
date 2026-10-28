import fs from 'node:fs';
const route = fs.readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const fn = fs.readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const checks = [
  ['protected purge endpoint', /purge-verification-storage/],
  ['environment secret', /COMPLIANCE_JOB_SECRET/],
  ['HMAC timing-safe validation', /timingSafeEqual/],
  ['30-day retention engine', /executeVerificationRetentionBatch/],
  ['verification path boundary', /startsWith\(`verification\/\$\{uid\}\/`\)/],
  ['daily scheduler', /schedule: '0 3 \* \* \*'/],
  ['single scheduler instance', /maxInstances: 1/],
];
for (const [label, re] of checks) {
  const source = label === 'daily scheduler' || label === 'single scheduler instance' ? fn : label === 'protected purge endpoint' ? server + route : route;
  if (!re.test(source)) throw new Error(`Compliance storage purge boundary failed: ${label}`);
}
// A-14 source invariant: neither a fabricated body nor a parser-order reversal
// may silently disable byte-exact webhook validation.
const rawMount = server.indexOf("app.use('/api/admin/purge-verification-storage', express.raw(");
const jsonMount = server.indexOf('app.use(express.json({ inflate: false, limit: "900kb", strict: true }));');
if (rawMount < 0 || jsonMount < 0 || rawMount >= jsonMount
    || !server.slice(rawMount, jsonMount).includes("limit: '2kb'")) throw new Error('Compliance purge raw parser order or limit invalid');
if (!route.includes('Buffer.isBuffer(req.body)') || route.includes("Buffer.from('{}')")
    || !route.includes(".update(body).digest('hex')"))
  throw new Error('Compliance purge must HMAC original received bytes');
const engine = fs.readFileSync('src/server/platform/storageRetentionEngine.ts', 'utf8');
const writer = fs.readFileSync('src/server/klarCore.ts', 'utf8');
if (!engine.includes('MISSING_DECISION_STORAGE_GENERATION')
    || !route.includes('ifGenerationMatch: generation')
    || route.includes('ignoreNotFound: true')
    || !writer.includes('storagePath, storageGeneration, photoPurged: false'))
  throw new Error('A-06 missing immutable decision generation / GCS delete precondition');
// A-15: fail if a future refactor restores a fixed first-page query.
for (const required of ["CURSOR_STATE_PATH", "readVerificationPurgeCursor", ".orderBy('fotoLoeschenAb', 'asc')",
  "FieldPath.documentId()", ".startAfter(claim.cursor.at, claim.cursor.id)",
  "leaseToken", "readVerificationPurgeLease(state, now)",
  "await assertWorkerLeaseOwned()", "leaseState.leaseToken !== leaseToken",
  "lastScanned: snapshot.docs.length", "completedCycle: next === null"]) {
  if (!route.includes(required)) throw new Error('A-15 missing persistent keyset/liveness invariant: ' + required);
}
const scheduler = fs.readFileSync('functions/src/verificationPurgeSchedulerResponse.ts', 'utf8');
if (!fn.includes('await assertSuccessfulVerificationPurgePage(response)')
    || !scheduler.includes('response.status !== 200')
    || !scheduler.includes('scanned === MAX_PAGE')
    || !scheduler.includes('value.ok !== true')
    || !scheduler.includes('purgedCount + skippedCount !== processed')) {
  throw new Error('A-15 scheduler must reject busy, malformed and full-page success');
}
console.log('Compliance storage purge boundary: PASS');
