import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { purgeWorkIsolationViolations } from './check-purge-work-inert.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const original = {
  states: read('src/server/platform/verificationPurgeWorkState.ts'),
  adapter: read('src/server/platform/verificationPurgeWorkFirestore.ts'),
  route: read('src/server/routes/complianceStorage.ts'),
  scheduler: read('functions/src/purgeVerificationStorage.ts'),
  legacyScheduler: read('functions/src/deleteExpiredPhotos.ts'),
};

test('new lease state machine is completely unbound from live photo deletion', () => {
  assert.deepEqual(purgeWorkIsolationViolations(original), []);
});

const mutations = [
  ['live route starts calling adapter', x => ({ ...x, route: x.route + '\nverificationPurgeWorkFirestore' })],
  ['scheduled worker calls state machine', x => ({ ...x, scheduler: x.scheduler + '\nverificationPurgeWorkState' })],
  ['state machine starts deleting objects', x => ({ ...x, states: x.states + '\nbucket.file(path).delete()' })],
  ['adapter imports storage', x => ({ ...x, adapter: x.adapter + '\ngetStorage()' })],
  ['transaction CAS removed', x => ({ ...x, adapter: x.adapter.replace('db.runTransaction', 'unsafeTransaction') })],
  ['transactional allowed-transition matrix removed', x => ({ ...x, adapter: x.adapter.replaceAll('allowedTransitions', 'unrestrictedTransitions') })],
  ['adapter-side intent fence removed', x => ({ ...x, adapter: x.adapter.replaceAll('validFencedTransition(current, next)', 'true') })],
  ['CAS lease-identity check removed', x => ({ ...x, adapter: x.adapter.replaceAll('sameLease(current.lease, next.lease)', 'true') })],
  ['CAS immutable observation check removed', x => ({ ...x, adapter: x.adapter.replaceAll('sameObserved(current.observed, next.observed)', 'true') })],
  ['CAS attempt increment removed', x => ({ ...x, adapter: x.adapter.replaceAll('next.attempt !== current.attempt + 1', 'false') })],
  ['stale worker guard removed', x => ({ ...x, states: x.states.replaceAll('purge_work_stale_or_expired_lease', 'lease_check_disabled') })],
  ['write-ahead intent removed', x => ({ ...x, states: x.states.replaceAll('markDeletionIntent', 'unsafeDeleteDirectly') })],
  ['intent reconciliation removed', x => ({ ...x, states: x.states.replaceAll('assessDeletionIntentRecovery', 'skipIndependentReconciliation') })],
  ['implicit automatic physical delete enabled', x => ({ ...x, states: x.states.replaceAll('physicalDeleteAuthorized: false', 'physicalDeleteAuthorized: true') })],
];
for (const [label, mutate] of mutations) {
  test('regression: reject ' + label, () => {
    assert.notEqual(purgeWorkIsolationViolations(mutate(original)).length, 0);
  });
}
