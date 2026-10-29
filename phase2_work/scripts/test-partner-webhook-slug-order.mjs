import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/server/routes/partnerReferrals.ts', import.meta.url)), 'utf8');
assert.match(src, /router\.post\('\/partner\/webhook\/:slug', protectWebhookResponse, validateWebhookSlug, webhookLimiter,/);
assert.match(src, /const validateWebhookSlug = [\s\S]*?\/\^\[a-z0-9\]/);
assert.match(src, /return res\.status\(404\)\.json\(\{ code: 'partner_webhook_not_found'/);
console.log('PASS webhook slug rejection precedes distributed limiter');
