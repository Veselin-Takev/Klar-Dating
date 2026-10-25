// Reference model only: never connects to a service or processes personal data.
import { canonical } from './staging-migration-core.mjs';
export function schemaFixtures() {
  const oldRead = row => ({ id: row.id, value: row.value });
  const oldPatch = (row, value) => ({ ...row, value });
  const newRead = row => ({ ...oldRead(row), optional: row.optional ?? null });
  const old = { id: 'synthetic-one', value: 1 };
  const expanded = { ...old, optional: 'synthetic' };
  return {
    oldReadsNewWrites: oldRead(expanded).value === 1,
    newReadsOldWrites: newRead(old).optional === null,
    oldWritesPreserveNewFields: oldPatch(expanded, 2).optional === 'synthetic',
    rollbackWritesSurvive: oldRead(oldPatch(expanded, 3)).value === 3,
  };
}
// Models atomic data+outbox commits, ordered replay and persistent deletion tombstones.
// It is NOT an implementation of Firestore cross-database replication.
export class OutboxModel {
  constructor() { this.source = new Map(); this.target = new Map(); this.events = []; this.seen = new Set(); this.authority = 'source'; this.epoch = 1; }
  write(key, value, { epoch = this.epoch, authority = this.authority } = {}) {
    if (epoch !== this.epoch || authority !== this.authority) throw new Error('STALE_WRITE_EPOCH');
    const event = { sequence: this.events.length + 1, key, row: { value, deleted: value === null } };
    this[this.authority].set(key, structuredClone(event.row)); this.events.push(event);
    return event.sequence; // Acknowledgement follows atomic commit in this reference model.
  }
  replay() {
    for (const event of this.events) {
      if (this.seen.has(event.sequence)) continue;
      this.source.set(event.key, structuredClone(event.row));
      this.target.set(event.key, structuredClone(event.row)); this.seen.add(event.sequence);
    }
  }
  parity() { return canonical([...this.source].sort()) === canonical([...this.target].sort()) && this.seen.size === this.events.length; }
  cutover(authority) { this.replay(); if (!this.parity()) throw new Error('PARITY'); this.epoch++; this.authority = authority; }
}
export function simulatedAdapter(plan) {
  let clock = 1800000000000, lease, percent = 0, fault;
  const model = new OutboxModel();
  const origin = 'simulation';
  const capabilities = ['fenced-lease','conditional-routing','per-revision-windows','identity-attestation','n-minus-one-fixtures','rollback-probe','synthetic-fault-injection',
    'atomic-outbox','fenced-write-authority','reverse-replication','tombstone-parity'];
  const fenced = input => { if (!lease || input.lease !== lease) throw new Error('LEASE_LOST'); };
  const adapter = {
    origin, capabilities, model, now: () => clock,
    async inspect() { return { ...plan, origin, stagingLabelVerified:true, syntheticDataOnly:true, productionDataCopied:false,
      serviceBindingVerified:true, sourcePercent:100-percent, targetPercent:percent, writeAuthority:model.authority }; },
    async compatibility() { return { origin, suiteSha256:plan.compatibilitySuiteSha256, sourceSchema:plan.schema.source,
      targetSchema:plan.schema.target, ...schemaFixtures() }; },
    async observe({ revision }) {
      const startMs = clock; clock += plan.triggers.minWindowMs;
      return { origin, revision, startMs, endMs:clock, requests:1000, errors:fault === 'error-spike' ? 20 : 0,
        p95Ms:100, healthy:fault !== 'health-failure', ready:true };
    },
    async acquireLease() { if (lease) throw new Error('LEASE_BUSY'); lease = 'synthetic-fencing-token'; return lease; },
    async releaseLease(input) { fenced(input); lease = undefined; return { origin, released:true }; },
    async prepareReplication(input) { fenced(input); model.write('synthetic-one', { optional:'expanded' }); model.write('synthetic-deleted', null); model.replay();
      return { origin, atomicOutbox:true, backfillComplete:true, lag:0, parity:model.parity(), reverseReady:true, tombstonesPreserved:true }; },
    async setTraffic(input) { fenced(input); if (input.percent <= percent) throw new Error('TRAFFIC_DRIFT'); percent = input.percent;
      if (plan.strategy === 'dual-write-outbox') { model.write('synthetic-during-canary', percent); model.replay(); }
      return { origin, sourcePercent:100-percent, targetPercent:percent, writeAuthority:model.authority, fenceVerified:true }; },
    async injectFault(input) { fenced(input); fault = input.scenario; return { origin }; },
    async cutoverWrites(input) { fenced(input); model.cutover('target'); model.write('synthetic-after-cutover', 1); model.replay();
      return { origin, writeAuthority:'target', epochFenced:true, reverseLag:0, oldVersionCompatible:true }; },
    async probeRollback() { return { origin, healthy:true, ready:true, dataSafe:model.events.length === 0 || model.parity() }; },
    async rollback(input) { fenced(input); model.cutover('source'); percent = 0; fault = undefined;
      return { origin, sourcePercent:100, targetPercent:0, writeAuthority:'source', unacknowledgedWrites:0,
        parity:model.parity(), tombstonesPreserved:!model.source.has('synthetic-deleted') || model.source.get('synthetic-deleted').deleted }; },
  };
  return adapter;
}

