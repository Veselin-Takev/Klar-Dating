// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assessDeletionIntentRecovery, claimPurgeWork, claimReceiptReconciliation, completePurgeReceipt,
  createPurgeWork, hasCanonicalGcsReceiptEvidence, isCanonicalGcsGeneration,
  markDeletionIntent, markDeletionObserved, quarantinePurgeWork,
  releaseUndeletedWork,
} from '../src/server/platform/verificationPurgeWorkState';

const key = 'a'.repeat(64);
const tokenA = 'token-a-000000000000000000';
const tokenB = 'token-b-000000000000000000';
const digest = 'b'.repeat(64);
const now = 1_798_000_000_000;
const start = () => createPurgeWork(key, now);
const lease = () => claimPurgeWork(start(), tokenA, now, 5_000);
const intent = (generation = '123', preparedAt = now + 500) =>
  markDeletionIntent(lease(), tokenA, 1, preparedAt, generation);

describe('P0 #202 retention lease and audit state machine (no IO)', () => {
  it('creates an opaque ready item and valid exclusive lease', () => {
    const base = start();
    const claimed = lease();
    expect(base).toMatchObject({ schemaVersion: 1, status: 'ready', revision: 0, attempt: 0 });
    expect(base).not.toHaveProperty('lease');
    expect(claimed).toMatchObject({
      status: 'leased', revision: 1, attempt: 1,
      lease: { token: tokenA, epoch: 1, expiresAt: now + 5_000 },
    });
    expect(base.status).toBe('ready');
    expect(JSON.stringify(claimed)).not.toContain('verification/');
    expect(JSON.stringify(claimed)).not.toContain('user-id');
  });

  it('prevents early, double and terminal claims', () => {
    expect(() => claimPurgeWork(start(), tokenA, now - 1, 5_000)).toThrow('purge_work_not_claimable');
    expect(() => claimPurgeWork(lease(), tokenB, now + 1_000, 5_000)).toThrow('purge_work_not_claimable');
    expect(() => claimPurgeWork(claimPurgeWork(lease(), tokenB, now + 5_000, 5_000), tokenA, now + 5_500, 5_000))
      .toThrow('purge_work_not_claimable');
  });

  it('reclaims only expired leases with strictly increasing epoch and attempt', () => {
    const reclaimed = claimPurgeWork(lease(), tokenB, now + 5_000, 6_000);
    expect(reclaimed).toMatchObject({
      status: 'leased', revision: 2, attempt: 2,
      lease: { token: tokenB, epoch: 2, expiresAt: now + 11_000 },
    });
    expect(() => markDeletionIntent(reclaimed, tokenA, 1, now + 5_001, '12'))
      .toThrow('purge_work_stale_or_expired_lease');
    expect(() => releaseUndeletedWork(reclaimed, tokenA, 1, now + 5_001, now + 8_000))
      .toThrow('purge_work_stale_or_expired_lease');
  });

  it('releases an undeleted lease with a future retry, rejects premature retry', () => {
    const released = releaseUndeletedWork(lease(), tokenA, 1, now + 1_000, now + 9_000);
    expect(released).toMatchObject({ status: 'ready', revision: 2, attempt: 1, availableAt: now + 9_000 });
    expect(() => claimPurgeWork(released, tokenB, now + 8_999, 5_000)).toThrow('purge_work_not_claimable');
    const claimed = claimPurgeWork(released, tokenB, now + 9_000, 5_000);
    expect(claimed).toMatchObject({ attempt: 2, lease: { token: tokenB, epoch: 2 } });
    expect(() => releaseUndeletedWork(lease(), tokenA, 1, now + 1_000, now + 1_000))
      .toThrow('purge_work_invalid_retry');
  });

  it('never redoes physical deletion after successful generation-observed marker', () => {
    const observed = markDeletionObserved(intent('18446744073709551615', now + 500), tokenA, 1, now + 1_000, '18446744073709551615');
    expect(observed).toMatchObject({
      status: 'receipt_pending', revision: 3,
      observed: { generation: '18446744073709551615', observedAt: now + 1_000 },
    });
    expect(() => claimPurgeWork(observed, tokenB, now + 7_000, 5_000))
      .toThrow('purge_work_not_claimable');
    expect(() => releaseUndeletedWork(observed, tokenA, 1, now + 2_000, now + 8_000))
      .toThrow('purge_work_not_undeleted');
    expect(() => markDeletionObserved(observed, tokenA, 1, now + 2_000, '123'))
      .toThrow('purge_work_missing_delete_intent');
  });


  it('persists write-ahead intent before any observed delete, with exact generation and lease epoch', () => {
    const prepared = intent('567');
    expect(prepared).toMatchObject({
      status: 'delete_intent', revision: 2,
      intent: { generation: '567', leaseEpoch: 1, preparedAt: now + 500 },
    });
    expect(() => markDeletionObserved(lease(), tokenA, 1, now + 1_000, '567'))
      .toThrow('purge_work_missing_delete_intent');
    expect(() => markDeletionObserved(prepared, tokenA, 1, now + 1_000, '568'))
      .toThrow('purge_work_intent_mismatch');
    expect(() => markDeletionObserved(prepared, tokenB, 1, now + 1_000, '567'))
      .toThrow('purge_work_stale_or_expired_lease');
    expect(markDeletionObserved(prepared, tokenA, 1, now + 1_000, '567').status).toBe('receipt_pending');
  });

  it('never reclaims or re-deletes an expired ambiguous intent, even across worker crashes', () => {
    const prepared = intent('18446744073709551615');
    expect(() => claimPurgeWork(prepared, tokenB, now + 50_000, 5_000))
      .toThrow('purge_work_not_claimable');
    expect(() => releaseUndeletedWork(prepared, tokenA, 1, now + 600, now + 6_000))
      .toThrow('purge_work_not_undeleted');
    expect(() => quarantinePurgeWork(prepared, 'manual_review', now + 600, tokenA, 1))
      .toThrow('purge_work_cannot_quarantine');
    expect(() => markDeletionObserved(prepared, tokenA, 1, now + 5_000, '18446744073709551615'))
      .toThrow('purge_work_stale_or_expired_lease');
  });

  it.each([
    [{ kind: 'not_found' } as const, 'absence_ambiguous'],
    [{ kind: 'present', generation: '777' } as const, 'replacement_detected'],
    [{ kind: 'present', generation: '123' } as const, 'same_generation_present'],
    [{ kind: 'present', generation: '0' } as const, 'unverifiable'],
    [{ kind: 'unknown' } as const, 'unverifiable'],
  ])('requires human/independent reconciliation, NEVER GCS delete: %j', (observation, reason) => {
    expect(assessDeletionIntentRecovery(intent('123'), observation)).toEqual({
      action: 'manual_reconcile', physicalDeleteAuthorized: false, reason,
    });
  });

  it('cannot reconcile without a durably persisted matching write-ahead intent', () => {
    expect(() => assessDeletionIntentRecovery(lease(), { kind: 'not_found' }))
      .toThrow('purge_work_no_persisted_delete_intent');
  });

  it('only reclaims the audit receipt after its lease expires, fences stale workers', () => {
    const observed = markDeletionObserved(intent('123', now + 500), tokenA, 1, now + 1_000, '123');
    expect(() => claimReceiptReconciliation(observed, tokenB, now + 4_999, 5_000))
      .toThrow('purge_work_receipt_not_claimable');
    const reclaimed = claimReceiptReconciliation(observed, tokenB, now + 5_000, 5_000);
    expect(reclaimed.status).toBe('receipt_pending');
    expect(reclaimed.observed).toEqual(observed.observed);
    expect(reclaimed.lease).toEqual({ token: tokenB, epoch: 2, expiresAt: now + 10_000 });
    expect(() => completePurgeReceipt(reclaimed, tokenA, 1, now + 5_001, digest))
      .toThrow('purge_work_stale_or_expired_lease');
    const done = completePurgeReceipt(reclaimed, tokenB, 2, now + 5_001, digest);
    expect(done).toMatchObject({
      status: 'complete', completedAt: now + 5_001, receiptDigest: digest, revision: 5,
    });
    expect(() => claimPurgeWork(done, tokenA, now + 40_000, 5_000))
      .toThrow('purge_work_not_claimable');
    expect(() => claimReceiptReconciliation(done, tokenB, now + 40_000, 5_000))
      .toThrow('purge_work_receipt_not_claimable');
  });

  it('rejects missing, forged or expired receipt evidence', () => {
    expect(() => completePurgeReceipt(lease(), tokenA, 1, now + 1_000, digest))
      .toThrow('purge_work_no_receipt_evidence');
    const observed = markDeletionObserved(intent('100', now + 500), tokenA, 1, now + 1_000, '100');
    expect(() => completePurgeReceipt(observed, tokenA, 1, now + 1_500, 'not-a-sha256'))
      .toThrow('purge_work_invalid_receipt');
    expect(() => completePurgeReceipt(observed, tokenA, 1, now + 5_000, digest))
      .toThrow('purge_work_stale_or_expired_lease');
    expect(() => completePurgeReceipt(observed, tokenB, 1, now + 1_500, digest))
      .toThrow('purge_work_stale_or_expired_lease');
  });

  it('quarantines malformed/held candidates before deletion but never hides observed deletes', () => {
    const held = quarantinePurgeWork(start(), 'legal_hold', now);
    expect(held).toMatchObject({ status: 'quarantined', quarantineReason: 'legal_hold', revision: 1 });
    expect(() => claimPurgeWork(held, tokenA, now + 6_000, 5_000)).toThrow('purge_work_not_claimable');
    const fromLease = quarantinePurgeWork(lease(), 'ambiguous_ownership', now + 100, tokenA, 1);
    expect(fromLease.status).toBe('quarantined');
    expect(() => quarantinePurgeWork(lease(), 'invalid_source', now + 100, tokenB, 1))
      .toThrow('purge_work_stale_or_expired_lease');
    expect(() => quarantinePurgeWork(markDeletionObserved(intent('16', now + 50), tokenA, 1, now + 100, '16'),
      'legal_hold', now + 200, tokenA, 1)).toThrow('purge_work_cannot_quarantine');
  });

  it('rejects unsafe tokens, generation and lease bounds', () => {
    expect(() => createPurgeWork('raw-user-path', now)).toThrow('purge_work_invalid_source');
    expect(() => claimPurgeWork(start(), 'weak', now, 5_000)).toThrow('purge_work_invalid_lease');
    expect(() => claimPurgeWork(start(), tokenA, now, 10 * 60_000 + 1)).toThrow('purge_work_invalid_lease');
    expect(() => claimPurgeWork(start(), tokenA, now, 999)).toThrow('purge_work_invalid_lease');
    expect(() => markDeletionIntent(lease(), tokenA, 1, now + 1_000, '0'))
      .toThrow('purge_work_invalid_generation');
    expect(() => markDeletionIntent(lease(), tokenA, 1, now + 1_000, '12e3'))
      .toThrow('purge_work_invalid_generation');
  });

  it('does not mutate the original record in any state transition', () => {
    const before = Object.freeze(start());
    const current = claimPurgeWork(before, tokenA, now, 5_000);
    const after = markDeletionObserved(markDeletionIntent(current, tokenA, 1, now + 500, '17'), tokenA, 1, now + 1_000, '17');
    expect(before.status).toBe('ready');
    expect(current.status).toBe('leased');
    expect(after.status).toBe('receipt_pending');
    expect(after.observed).toEqual({ generation: '17', observedAt: now + 1_000 });
  });

  it('accepts only canonical positive unsigned 64-bit GCS generation strings without numeric coercion', () => {
    expect(isCanonicalGcsGeneration('1')).toBe(true);
    expect(isCanonicalGcsGeneration('18446744073709551615')).toBe(true);
    for (const value of [
      '0', '00', '0001', '18446744073709551616', '99999999999999999999',
      '1'.repeat(21), '9'.repeat(4096), '1e3', '1.0', ' 1', '+1', '-1', '', null, 1, 123n,
    ]) {
      expect(isCanonicalGcsGeneration(value)).toBe(false);
      expect(() => markDeletionIntent(lease(), tokenA, 1, now + 100, value as string))
        .toThrow('purge_work_invalid_generation');
    }
    expect(markDeletionIntent(lease(), tokenA, 1, now + 100, '18446744073709551615')
      .intent?.generation).toBe('18446744073709551615');
  });

  it('refuses malformed persisted intent generation and never authorizes an ambiguous delete', () => {
    const invalid = {
      ...intent('123'),
      intent: { generation: '18446744073709551616', preparedAt: now + 500, leaseEpoch: 1 },
    };
    expect(() => assessDeletionIntentRecovery(invalid, { kind: 'present', generation: '123' }))
      .toThrow('purge_work_no_persisted_delete_intent');
    for (const value of ['18446744073709551616', '9'.repeat(50), '000123', '0']) {
      expect(assessDeletionIntentRecovery(intent('123'), { kind: 'present', generation: value }))
        .toEqual({ action: 'manual_reconcile', physicalDeleteAuthorized: false, reason: 'unverifiable' });
    }
  });


  it('rejects a forged or corrupted generation when receipt observation matches invalid intent text', () => {
    const good = intent('123');
    const invalidValues = ['18446744073709551616', '000123', '9'.repeat(128), '0'];
    for (const generation of invalidValues) {
      const forged = { ...good, intent: { ...good.intent!, generation } };
      expect(() => markDeletionObserved(forged, tokenA, 1, now + 1_000, generation))
        .toThrow('purge_work_intent_mismatch');
      expect(() => markDeletionObserved(good, tokenA, 1, now + 1_000, generation))
        .toThrow('purge_work_intent_mismatch');
    }
    const observed = markDeletionObserved(good, tokenA, 1, now + 1_000, '123');
    expect(hasCanonicalGcsReceiptEvidence(observed)).toBe(true);
  });

  it('cannot reclaim or complete a receipt whose stored GCS generation evidence was corrupted', () => {
    const observed = markDeletionObserved(intent('123'), tokenA, 1, now + 1_000, '123');
    for (const generation of ['18446744073709551616', '000123', '9'.repeat(200)]) {
      const forgedIntent = { ...observed, intent: { ...observed.intent!, generation } };
      const forgedObserved = { ...observed, observed: { ...observed.observed!, generation } };
      const forgedBoth = {
        ...observed, intent: { ...observed.intent!, generation },
        observed: { ...observed.observed!, generation },
      };
      for (const corrupt of [forgedIntent, forgedObserved, forgedBoth]) {
        expect(hasCanonicalGcsReceiptEvidence(corrupt)).toBe(false);
        expect(() => claimReceiptReconciliation(corrupt, tokenB, now + 5_000, 5_000))
          .toThrow('purge_work_receipt_not_claimable');
        expect(() => completePurgeReceipt(corrupt, tokenA, 1, now + 2_000, digest))
          .toThrow('purge_work_no_receipt_evidence');
      }
    }
    expect(hasCanonicalGcsReceiptEvidence(observed)).toBe(true);
    expect(claimReceiptReconciliation(observed, tokenB, now + 5_000, 5_000).status)
      .toBe('receipt_pending');
    expect(completePurgeReceipt(observed, tokenA, 1, now + 2_000, digest).status)
      .toBe('complete');
  });


  it('never reclaims a ready record containing stale irreversible delete or receipt markers', () => {
    const ready = start();
    const markers = [
      { intent: { generation: '123', preparedAt: now, leaseEpoch: 1 } },
      { observed: { generation: '123', observedAt: now } },
      { completedAt: now },
      { receiptDigest: digest },
      { quarantineReason: 'legal_hold' as const },
    ];
    for (const marker of markers) {
      const corrupt = { ...ready, ...marker };
      expect(() => claimPurgeWork(corrupt, tokenA, now, 5_000))
        .toThrow('purge_work_invalid_state');
      expect(() => quarantinePurgeWork(corrupt, 'manual_review', now))
        .toThrow('purge_work_invalid_state');
      expect(ready).toEqual(start());
    }
  });

  it('never writes a new delete intent from a leased record containing a prior receipt or observation', () => {
    const leased = lease();
    for (const marker of [
      { receiptDigest: digest },
      { completedAt: now },
      { observed: { generation: '123', observedAt: now } },
      { intent: { generation: '123', preparedAt: now, leaseEpoch: 1 } },
      { quarantineReason: 'legal_hold' as const },
    ]) {
      const corrupt = { ...leased, ...marker };
      expect(() => markDeletionIntent(corrupt, tokenA, 1, now + 100, '123'))
        .toThrow('purge_work_invalid_state');
      expect(() => releaseUndeletedWork(corrupt, tokenA, 1, now + 100, now + 9_000))
        .toThrow('purge_work_invalid_state');
    }
    // A normal undeleted release intentionally retains its lease epoch:
    // this is NOT a terminal marker and remains safely reclaimable.
    const released = releaseUndeletedWork(leased, tokenA, 1, now + 100, now + 9_000);
    expect(claimPurgeWork(released, tokenB, now + 9_000, 5_000)).toMatchObject({
      status: 'leased', attempt: 2, lease: { epoch: 2 },
    });
  });

});
