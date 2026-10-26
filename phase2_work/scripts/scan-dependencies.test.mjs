import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inventory, query } from './scan-dependencies.mjs';
const packages = [{ name: 'synthetic', version: '1.0.0' }];
const reply = results => async () => ({ ok: true, json: async () => ({ results }) });
test('counts affected versions and deduplicates advisory ids', async () => {
  assert.deepEqual(await query([...packages, ...packages], reply([{ vulns: [{ id: 'TEST-1' }] }, { vulns: [{ id: 'TEST-1' }] }])), { queriedVersions: 2, affectedVersions: 2, uniqueAdvisories: 1 });
});
test('accepts explicit complete clean results', async () => {
  assert.equal((await query(packages, reply([{}]))).affectedVersions, 0);
});
for (const results of [[], [null], [{ next_page_token: 'more' }], [{ vulns: {} }], [{ vulns: [{}] }]]) {
  test('fails closed for incomplete or malformed result ' + JSON.stringify(results), async () => { await assert.rejects(query(packages, reply(results))); });
}
test('network failure cannot produce a clean verdict', async () => { await assert.rejects(query(packages, async () => { throw Error('offline'); })); });
test('rejects unresolved package versions and empty inventories', () => {
  assert.throws(() => inventory([['bun.lock', 'x']], () => ({ config: { packages: { x: ['x@latest'] } } })));
  assert.throws(() => inventory([['bun.lock', 'x']], () => ({ config: { packages: {} } })));
});
test('deduplicates exact npm versions across lockfiles and hashes source bytes', () => {
  const parsed = () => ({ config: { packages: { 'node_modules/synthetic': { version: '1.0.0' } } } });
  const result = inventory([['one/package-lock.json', 'a'], ['two/package-lock.json', 'b']], parsed);
  assert.equal(result.packages.length, 1); assert.notEqual(result.hashes['one/package-lock.json'], result.hashes['two/package-lock.json']);
});
