import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const route = readFileSync(fileURLToPath(new URL('../src/server/routes/partnerReferrals.ts', import.meta.url)), 'utf8');
assert.match(route, /router\.post\('\/partner\/interaction',\s*noStorePartnerPrivateData,\s*accountGate,\s*userMutationLimiter,/);
assert.match(route, /const noStorePartnerPrivateData = [\s\S]*?res\.setHeader\('Cache-Control', 'private, no-store'\)/);
assert.match(route, /const noStorePartnerPrivateData = [\s\S]*?res\.setHeader\('Pragma', 'no-cache'\)/);
assert.match(route, /const noStorePartnerPrivateData = [\s\S]*?res\.setHeader\('Referrer-Policy', 'no-referrer'\)/);
console.log('PASS partner interaction no-store middleware ordering');
