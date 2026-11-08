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
