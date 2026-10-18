import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/server/routes/partnerReferrals.ts', import.meta.url), 'utf8');
const from = source.indexOf('function optionalVisitorUid(req: Request): Promise<string | null> {');
const until = source.indexOf('\nexport function createPartnerReferralPublicRouter(', from);
assert.ok(from !== -1 && until > from, 'Visitor identity helper not found');
const visitor = source.slice(from, until);
assert.match(visitor, /if \(isGuest\(req\)\) return Promise\.resolve\(null\)/,
  'Existing anonymous Firebase request claims must not identify an attributed visitor');
assert.match(visitor, /getAuth\(getServerFirebaseApp\(\)\)\.verifyIdToken\(token, true\)/,
  'Bearer JWT must be server-verified and checked for revocation');
assert.match(visitor, /decoded\.firebase\?\.sign_in_provider !== 'anonymous'/,
  'Verified anonymous JWT must not identify attributed visitor');
assert.match(visitor, /\.catch\(\(\) => null\)/, 'Invalid tokens must fail closed');
console.log('PASS: anonymous Firebase request claims and verified anonymous JWT denied for partner attribution (static check)');
