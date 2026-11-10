import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_ATTEST_ACTION_SHA, validateAttestActionPin } from './release-attest-pin.mjs';

test('accepts the exact verified immutable actions/attest commit', () => {
  assert.equal(validateAttestActionPin('      uses: actions/attest@' + APPROVED_ATTEST_ACTION_SHA), true);
});
for (const [name, workflow] of [
  ['previous approved pin', '      uses: actions/attest@4d7d407517fe0a9f57ab8ca277dfd2efb1188c7f'],
  ['mutable version tag', '      uses: actions/attest@v3'],
  ['missing action', '      uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['duplicate action entries', '      uses: actions/attest@' + APPROVED_ATTEST_ACTION_SHA + '\n      uses: actions/attest@' + APPROVED_ATTEST_ACTION_SHA],
  ['unexpected action commit', '      uses: actions/attest@0000000000000000000000000000000000000000'],
]) {
  test('rejects ' + name, () => assert.equal(validateAttestActionPin(workflow), false));
}
