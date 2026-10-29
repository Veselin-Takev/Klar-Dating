import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../src/server/routes/partnerReferrals.ts', import.meta.url)), 'utf8');
const block = source.match(/const webhookLimiter = distributedRateLimit\(\{([\s\S]*?)\n  \}\);/);
assert(block, 'webhook rate limiter must exist');
assert.match(block[1], /collection: 'partner_referral_webhook_rate_limits'/);
assert.match(block[1], /keyGenerator: req => 'ip:' \+ ipKeyGenerator\(req\.ip \?\? ''\)/);
assert.doesNotMatch(block[1], /req\.params\.slug/);
assert.match(source, /router\.post\('\/partner\/webhook\/:slug', protectWebhookResponse, validateWebhookSlug, webhookLimiter,/);
console.log('PASS: webhook limiter cardinality independent of untrusted campaign slug');
