import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function purgeWorkIsolationViolations(source) {
  const failures = [];
  const { states, adapter, route, scheduler, legacyScheduler } = source;
  if (!states.includes('markDeletionIntent') ||
      !states.includes('purge_work_missing_delete_intent') ||
      !states.includes('assessDeletionIntentRecovery') ||
      !states.includes("physicalDeleteAuthorized: false")) {
    failures.push('write-ahead intent or no-auto-retry recovery gate removed');
  }
  if (!states.includes('claimReceiptReconciliation') ||
      !states.includes('markDeletionObserved') ||
      !states.includes('purge_work_stale_or_expired_lease')) {
    failures.push('lease or receipt fencing state transitions removed');
  }
  if (!adapter.includes('sameLease(current.lease, next.lease)') ||
      !adapter.includes('sameObserved(current.observed, next.observed)') ||
      !adapter.includes('next.attempt !== current.attempt + 1')) {
    failures.push('CAS lease identity, observation and attempt fencing removed');
  }
  if (!adapter.includes('allowedTransitions') ||
      !adapter.includes('validFencedTransition(current, next)') ||
      !adapter.includes('purge_work_transition_invariant')) {
    failures.push('Firestore CAS transition and write-ahead intent invariants removed');
  }
  if (!adapter.includes('db.runTransaction') ||
      !adapter.includes('tx.get(ref)') || !adapter.includes('tx.update(ref, next)')) {
    failures.push('transactional compare-and-swap adapter removed');
  }
  if (/\b(?:getStorage|getBucket|getMaintenanceBucket|deleteExpiredPhotoPage)\b|\.delete\s*\(/.test(states + adapter)) {
    failures.push('state-only modules must not access GCS or legacy purge');
  }
  if (route.includes('verificationPurgeWorkState') || route.includes('verificationPurgeWorkFirestore') ||
      scheduler.includes('verificationPurgeWorkState') || scheduler.includes('verificationPurgeWorkFirestore') ||
      legacyScheduler.includes('verificationPurgeWorkState') || legacyScheduler.includes('verificationPurgeWorkFirestore')) {
    failures.push('unapproved live binding of work state machine');
  }
  return failures;
}

const own = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === own) {
  const root = resolve(dirname(own), '..');
  const load = path => readFileSync(resolve(root, path), 'utf8');
  const violations = purgeWorkIsolationViolations({
    states: load('src/server/platform/verificationPurgeWorkState.ts'),
    adapter: load('src/server/platform/verificationPurgeWorkFirestore.ts'),
    route: load('src/server/routes/complianceStorage.ts'),
    scheduler: load('functions/src/purgeVerificationStorage.ts'),
    legacyScheduler: load('functions/src/deleteExpiredPhotos.ts'),
  });
  if (violations.length) {
    process.stderr.write('P0 purge-work isolation gate failed: ' + violations.join('; ') + '\n');
    process.exit(1);
  }
  console.log('PASS: P0 retention lease prototype remains isolated and mutation-free');
}
