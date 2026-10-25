import { createHash } from 'node:crypto';
export const sha = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const assert = (value, code) => { if (!value) throw new Error(code); };
const id = value => typeof value === 'string' && /^[a-z][a-z0-9-]{2,62}$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function compile(plan) {
  assert(plan?.version === 1 && plan.environment === 'staging', 'STAGING_ONLY');
  assert(id(plan.projectId) && id(plan.productionProjectId) && plan.projectId !== plan.productionProjectId
    && plan.projectId !== 'striped-antler-500815-e6', 'PROJECT_IDENTITY');
  assert(typeof plan.databaseId === 'string' && /^(\(default\)|[a-z][a-z0-9-]{2,62})$/.test(plan.databaseId), 'DATABASE_IDENTITY');
  assert(id(plan.sourceRevision) && id(plan.targetRevision) && plan.sourceRevision !== plan.targetRevision, 'REVISION_IDENTITY');
  assert(hash(plan.sourceArtifactSha256) && hash(plan.targetArtifactSha256) && hash(plan.compatibilitySuiteSha256), 'ARTIFACT_IDENTITY');
  assert(['same-database', 'dual-write-outbox'].includes(plan.strategy), 'DATA_STRATEGY');
  assert(plan.privacy?.dataset === 'synthetic' && plan.privacy?.productionDataCopied === false
    && Number.isInteger(plan.privacy?.evidenceRetentionDays) && plan.privacy.evidenceRetentionDays > 0
    && plan.privacy.evidenceRetentionDays <= 30, 'PRIVACY_POLICY');
  assert(Number.isInteger(plan.schema?.source) && plan.schema.source >= 1 && (plan.schema?.target === plan.schema.source || plan.schema?.target === plan.schema.source + 1) && plan.schema?.expandOnly === true
    && plan.schema?.contractDuringRollbackWindow === false, 'N_MINUS_ONE_SCHEMA');
  const t = plan.triggers;
  assert(t && Number.isFinite(t.maxErrorRate) && t.maxErrorRate > 0 && t.maxErrorRate < 1
    && Number.isFinite(t.maxErrorRateIncrease) && t.maxErrorRateIncrease > 0 && t.maxErrorRateIncrease < 1
    && Number.isFinite(t.maxP95Ms) && t.maxP95Ms > 0 && Number.isInteger(t.healthFailures) && t.healthFailures >= 1
    && t.healthFailures <= 5 && Number.isInteger(t.minRequests) && t.minRequests >= 1
    && Number.isInteger(t.minWindowMs) && t.minWindowMs >= 1000
    && Number.isInteger(t.maxAgeMs) && t.maxAgeMs >= t.minWindowMs, 'TRIGGER_POLICY');
  assert(Number.isInteger(plan.operationTimeoutMs) && plan.operationTimeoutMs >= 100 && plan.operationTimeoutMs <= 300000, 'OPERATION_TIMEOUT');
  assert(['happy-path', 'health-failure', 'error-spike'].includes(plan.scenario), 'DRILL_SCENARIO');
  assert(Array.isArray(plan.canaryPercent) && canonical(plan.canaryPercent) === '[1,10,50,100]', 'CANARY_POLICY');
  const base = { ...plan }; delete base.scenario;
  return { version: 1, scope: 'staging-only', planHash: sha(plan), basePlanHash: sha(base),
    steps: ['identity', 'compatibility', 'baseline', ...(plan.strategy === 'dual-write-outbox' ? ['prepare-outbox'] : []),
      ...plan.canaryPercent.map(p => 'canary-' + p), ...(plan.strategy === 'dual-write-outbox' ? ['write-cutover'] : []),
      'rollback-drill', 'verify-source'], productionApproved: false };
}
function identity(p, s) {
  for (const key of ['projectId','databaseId','sourceRevision','targetRevision','sourceArtifactSha256','targetArtifactSha256'])
    assert(s?.[key] === p[key], 'LIVE_IDENTITY_' + key);
  assert(s.environment === 'staging' && s.stagingLabelVerified === true && s.syntheticDataOnly === true
    && s.productionDataCopied === false && s.serviceBindingVerified === true, 'LIVE_ISOLATION');
}
function compatible(p, c) {
  assert(c?.suiteSha256 === p.compatibilitySuiteSha256 && c.sourceSchema === p.schema.source
    && c.targetSchema === p.schema.target && c.oldReadsNewWrites === true && c.newReadsOldWrites === true
    && c.oldWritesPreserveNewFields === true && c.rollbackWritesSurvive === true, 'N_MINUS_ONE_PROOF');
}
export function evaluateWindow(p, sample, baseline, now, previousEnd = 0) {
  const t = p.triggers;
  assert(sample && sample.origin && Number.isFinite(sample.startMs) && Number.isFinite(sample.endMs)
    && sample.startMs >= previousEnd && sample.endMs > previousEnd && sample.endMs <= now + 1000
    && now - sample.endMs <= t.maxAgeMs && sample.endMs - sample.startMs >= t.minWindowMs, 'METRICS_WINDOW');
  assert(Number.isSafeInteger(sample.requests) && sample.requests >= t.minRequests
    && Number.isSafeInteger(sample.errors) && sample.errors >= 0 && sample.errors <= sample.requests
    && Number.isFinite(sample.p95Ms) && sample.p95Ms >= 0
    && typeof sample.healthy === 'boolean' && typeof sample.ready === 'boolean', 'METRICS_MISSING');
  const rate = sample.errors / sample.requests;
  return !sample.ready ? 'READINESS_FAILURE' : rate > t.maxErrorRate ? 'ERROR_RATE'
    : baseline !== null && rate - baseline > t.maxErrorRateIncrease ? 'ERROR_SPIKE'
    : sample.p95Ms > t.maxP95Ms ? 'P95_BREACH' : null;
}
const required = ['fenced-lease','conditional-routing','per-revision-windows','identity-attestation','n-minus-one-fixtures','rollback-probe','synthetic-fault-injection'];
export async function rehearsal(plan, adapter, { live = false, dryReceipt, now = Date.now, emit = () => {} } = {}) {
  const compiled = compile(plan);
  const scope = live ? 'live-staging' : 'simulation';
  assert(adapter?.origin === (live ? 'live' : 'simulation'), 'ADAPTER_ORIGIN');
  for (const capability of required) assert(adapter.capabilities?.includes(capability), 'CAPABILITY_' + capability);
  if (plan.strategy === 'dual-write-outbox') for (const capability of ['atomic-outbox','fenced-write-authority','reverse-replication','tombstone-parity'])
    assert(adapter.capabilities.includes(capability), 'CAPABILITY_' + capability);
  if (live) {
    assert(plan.strategy === 'same-database' && plan.schema.target === plan.schema.source, 'HOSTING_ONLY_NO_SCHEMA_CHANGE');
    assert(plan.privacy.reviewReference && plan.privacy.reviewReference !== 'pending', 'PRIVACY_REVIEW_REQUIRED');
    assert(dryReceipt?.kind === 'LIVE_STAGING_DRY_RUN' && dryReceipt.planHash === compiled.planHash
      && hash(adapter.codeSha256) && dryReceipt.adapterSha256 === adapter.codeSha256
      && dryReceipt.issuedAtMs <= now() && dryReceipt.expiresAtMs >= now()
      && dryReceipt.expiresAtMs - dryReceipt.issuedAtMs <= 15*60_000, 'LIVE_DRY_RUN_REQUIRED');
  }
  let previous = '0'.repeat(64), sequence = 0, lease, mutated = false, rollbackVerified = false, uncertain = false;
  const journal = (event, details = {}) => {
    const record = { sequence: sequence++, scope, planHash: compiled.planHash, event, ...details, previous };
    previous = sha(record); emit({ ...record, hash: previous });
  };
  const call = async (method, payload = {}) => {
    const commandId = sha({ plan: compiled.planHash, method, payload });
    if (['prepareReplication','setTraffic','injectFault','cutoverWrites','rollback'].includes(method)) journal('COMMAND_INTENT', { method, commandId });
    const signal = AbortSignal.timeout(plan.operationTimeoutMs);
    let listener, timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => adapter[method]({ ...payload, plan, lease, commandId, signal })),
        new Promise((_, reject) => {
          listener = () => reject(new Error('OPERATION_OUTCOME_UNKNOWN'));
          signal.addEventListener('abort', listener, { once: true });
          timer = setTimeout(listener, plan.operationTimeoutMs);
        }),
      ]);
    } catch (error) { if (error.message === 'OPERATION_OUTCOME_UNKNOWN') uncertain = true; throw error; }
    finally { clearTimeout(timer); if (listener) signal.removeEventListener('abort', listener); }
  };
  const ensureOrigin = r => assert(r?.origin === adapter.origin, 'OBSERVATION_ORIGIN');
  const rollback = async reason => {
    const probe = await call('probeRollback'); ensureOrigin(probe);
    assert(probe.healthy === true && probe.ready === true && probe.dataSafe === true, 'ROLLBACK_TARGET_UNSAFE');
    const result = await call('rollback', { reason }); ensureOrigin(result);
    assert(result.sourcePercent === 100 && result.targetPercent === 0 && result.writeAuthority === 'source'
      && result.unacknowledgedWrites === 0 && result.parity === true && result.tombstonesPreserved === true, 'ROLLBACK_NOT_VERIFIED');
    const state = await call('inspect'); identity(plan, state); ensureOrigin(state);
    assert(state.sourcePercent === 100 && state.targetPercent === 0 && state.writeAuthority === 'source', 'ROLLBACK_TRAFFIC_DRIFT');
    const health = await call('probeRollback'); ensureOrigin(health);
    assert(health.healthy && health.ready && health.dataSafe, 'ROLLBACK_POSTCHECK');
    rollbackVerified = true; journal('ROLLBACK_VERIFIED', { reason });
  };
  try {
    const state = await call('inspect'); identity(plan, state); ensureOrigin(state);
    assert(state.sourcePercent === 100 && state.targetPercent === 0 && state.writeAuthority === 'source', 'BASELINE_TRAFFIC');
    const proof = await call('compatibility'); compatible(plan, proof); ensureOrigin(proof);
    const baseline = await call('observe', { revision: plan.sourceRevision }); ensureOrigin(baseline);
    assert(baseline.revision === plan.sourceRevision, 'METRIC_REVISION');
    assert(!evaluateWindow(plan, baseline, null, now()) && baseline.healthy && baseline.ready, 'BASELINE_UNHEALTHY');
    journal('PREFLIGHT_VERIFIED');
    lease = await call('acquireLease'); assert(typeof lease === 'string' && lease.length >= 16, 'LEASE_REQUIRED');
    if (plan.strategy === 'dual-write-outbox') {
      mutated = true;
      const r = await call('prepareReplication'); ensureOrigin(r);
      assert(r.atomicOutbox && r.backfillComplete && r.lag === 0 && r.parity && r.reverseReady && r.tombstonesPreserved, 'OUTBOX_NOT_READY');
      mutated = true; journal('OUTBOX_READY');
    }
    let lastEnd = baseline.endMs, healthFailures = 0, trigger;
    for (const percent of plan.canaryPercent) {
      mutated = true;
      const transition = await call('setTraffic', { percent }); ensureOrigin(transition);
      assert(transition.targetPercent === percent && transition.sourcePercent === 100 - percent
        && transition.writeAuthority === 'source' && transition.fenceVerified === true, 'TRAFFIC_NOT_VERIFIED');
      if (percent === 10 && plan.scenario !== 'happy-path') await call('injectFault', { scenario: plan.scenario });
      for (let sampleNumber = 0; sampleNumber < plan.triggers.healthFailures; sampleNumber++) {
        const sample = await call('observe', { revision: plan.targetRevision, percent, sampleNumber }); ensureOrigin(sample);
        assert(sample.revision === plan.targetRevision, 'METRIC_REVISION');
        trigger = evaluateWindow(plan, sample, baseline.errors / baseline.requests, now(), lastEnd);
        lastEnd = sample.endMs;
        healthFailures = sample.healthy ? 0 : healthFailures + 1;
        if (healthFailures >= plan.triggers.healthFailures) trigger = 'HEALTH_FAILURE';
        journal('CANARY_WINDOW', { percent, requests: sample.requests, errors: sample.errors, p95Ms: sample.p95Ms, healthy: sample.healthy, ready: sample.ready });
        if (trigger) break;
      }
      if (trigger) break;
    }
    const expected = { 'health-failure':'HEALTH_FAILURE', 'error-spike':'ERROR_SPIKE' }[plan.scenario];
    if (!trigger && plan.strategy === 'dual-write-outbox') {
      const r = await call('cutoverWrites'); ensureOrigin(r);
      assert(r.writeAuthority === 'target' && r.epochFenced && r.reverseLag === 0 && r.oldVersionCompatible, 'WRITE_CUTOVER_UNSAFE');
      journal('WRITE_AUTHORITY_TARGET');
    }
    await rollback(trigger || 'PLANNED_ROLLBACK_DRILL');
    assert(expected ? trigger === expected : !trigger, 'SCENARIO_NOT_VERIFIED');
    const released = await call('releaseLease'); ensureOrigin(released);
    assert(released.released === true, 'LEASE_RELEASE_UNCONFIRMED'); lease = undefined;
    journal('REHEARSAL_PASSED');
    return { kind: live ? 'LIVE_STAGING_REHEARSAL' : 'SIMULATION_REHEARSAL', scenario: plan.scenario,
      planHash: compiled.planHash, basePlanHash: compiled.basePlanHash, rollbackVerified,
      productionApproved: false, completedAtMs: now(), finalJournalHash: previous };
  } catch (error) {
    journal('REHEARSAL_FAILED', { code: /^[A-Z0-9_-]+$/.test(error.message) ? error.message : 'ADAPTER_FAILURE' });
    if (mutated && !rollbackVerified && error.message !== 'OPERATION_OUTCOME_UNKNOWN') {
      try { await rollback('FAIL_CLOSED'); } catch { journal('MANUAL_CONTAINMENT_REQUIRED'); }
    } else if (mutated && error.message === 'OPERATION_OUTCOME_UNKNOWN') journal('MANUAL_RECONCILIATION_REQUIRED');
    throw new Error('MIGRATION_NO_GO', { cause: error });
  } finally {
    if (lease && !uncertain) {
      try { await call('releaseLease'); } catch { journal('LEASE_RELEASE_UNCONFIRMED'); }
    }
  }
}
export async function liveDryRun(plan, adapter, { now = Date.now } = {}) {
  const compiled = compile(plan);
  assert(plan.strategy === 'same-database' && plan.schema.target === plan.schema.source, 'HOSTING_ONLY_NO_SCHEMA_CHANGE');
  assert(adapter.origin === 'live' && hash(adapter.codeSha256), 'LIVE_ADAPTER_REQUIRED');
  for (const capability of required) assert(adapter.capabilities?.includes(capability), 'CAPABILITY_' + capability);
  assert(plan.privacy.reviewReference && plan.privacy.reviewReference !== 'pending', 'PRIVACY_REVIEW_REQUIRED');
  const bounded = async method => {
    let timer;
    try { return await Promise.race([
      Promise.resolve().then(() => adapter[method]({ plan, signal: AbortSignal.timeout(plan.operationTimeoutMs) })),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DRY_RUN_TIMEOUT')), plan.operationTimeoutMs); }),
    ]); } finally { clearTimeout(timer); }
  };
  const state = await bounded('inspect'); identity(plan, state);
  assert(state.origin === 'live', 'OBSERVATION_ORIGIN');
  assert(state.sourcePercent === 100 && state.targetPercent === 0 && state.writeAuthority === 'source', 'BASELINE_TRAFFIC');
  const c = await bounded('compatibility'); compatible(plan, c);
  assert(c.origin === 'live', 'COMPATIBILITY_ORIGIN');
  return { kind:'LIVE_STAGING_DRY_RUN', planHash:compiled.planHash, adapterSha256:adapter.codeSha256,
    issuedAtMs:now(), expiresAtMs:now()+15*60_000, productionApproved:false };
}