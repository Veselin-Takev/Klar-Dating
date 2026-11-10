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
console.log('Compliance storage purge boundary: PASS');
