import test from 'node:test';
import assert from 'node:assert/strict';
import { tenantCollectionNames } from './tenant-collection-inventory.mjs';
test('keeps scoped event ledgers and constant-derived rate limits in the deletion catalog', () => {
  const source = 'const KYC_START_RATE_LIMIT_COLLECTION = "kyc_start_rate_limits"; const ref = `${KYC_START_RATE_LIMIT_COLLECTION}/${uid}`; tx.read(ref, schema); tx.write(`processed_stripe_events/subscription_${id}`, schema, data);';
  assert.deepEqual([...tenantCollectionNames(source)].sort(), ['kyc_start_rate_limits', 'processed_stripe_events']);
});
test('does not accept unused declarations as evidence for a persisted collection', () => {
  assert.deepEqual([...tenantCollectionNames('const UNUSED = "kyc_start_rate_limits"; const ref = `${UNUSED}/${uid}`; searchParams.delete("session_id");')], []);
});

test('resolves multiple declarations, nested collections and scoped deletion selectors', () => {
  const source = 'const SLUGS="partner_campaign_slugs"; const user=`users/${uid}`, attempt=`age_verification_attempts/${id}`; tx.create(attempt,schema,data); tx.write(`${SLUGS}/${slug}`,schema,data); db.listAll(`${user}/legal_acknowledgements`,schema); select(`${user}/ai_budget`);';
  assert.deepEqual([...tenantCollectionNames(source)].sort(), ['age_verification_attempts','ai_budget','legal_acknowledgements','partner_campaign_slugs','users']);
});
test('recognizes adapter reads and literal selectors without including unused helper bindings', () => {
  const source = 'const UNUSED="not_persisted"; readStored(tx, `partner_referral_ledger/${id}`); select("notifications","userId",uid);';
  assert.deepEqual([...tenantCollectionNames(source)].sort(), ['notifications','partner_referral_ledger']);
});
