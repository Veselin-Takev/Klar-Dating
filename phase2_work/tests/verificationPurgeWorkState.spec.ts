// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  claimPurgeWork, claimReceiptReconciliation, completePurgeReceipt,
  createPurgeWork, markDeletionObserved, quarantinePurgeWork,
  releaseUndeletedWork,
} from '../src/server/platform/verificationPurgeWorkState';

const key = 'a'.repeat(64);
const tokenA = 'token-a-000000000000000000';
const tokenB = 'token-b-000000000000000000';
const digest = 'b'.repeat(64);
const now = 1_798_000_000_000;
const start = () => createPurgeWork(key, now);
const lease = () => claimPurgeWork(start(), tokenA, now, 5_000);

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
    expect(() => markDeletionObserved(reclaimed, tokenA, 1, now + 5_001, '12'))
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
    const observed = markDeletionObserved(lease(), tokenA, 1, now + 1_000, '18446744073709551615');
    expect(observed).toMatchObject({
      status: 'receipt_pending', revision: 2,
      observed: { generation: '18446744073709551615', observedAt: now + 1_000 },
    });
    expect(() => claimPurgeWork(observed, tokenB, now + 7_000, 5_000))
      .toThrow('purge_work_not_claimable');
    expect(() => releaseUndeletedWork(observed, tokenA, 1, now + 2_000, now + 8_000))
      .toThrow('purge_work_not_undeleted');
    expect(() => markDeletionObserved(observed, tokenA, 1, now + 2_000, '123'))
      .toThrow('purge_work_not_leased');
  });

  it('only reclaims the audit receipt after its lease expires, fences stale workers', () => {
    const observed = markDeletionObserved(lease(), tokenA, 1, now + 1_000, '123');
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
      status: 'complete', completedAt: now + 5_001, receiptDigest: digest, revision: 4,
    });
    expect(() => claimPurgeWork(done, tokenA, now + 40_000, 5_000))
      .toThrow('purge_work_not_claimable');
    expect(() => claimReceiptReconciliation(done, tokenB, now + 40_000, 5_000))
      .toThrow('purge_work_receipt_not_claimable');
  });

  it('rejects missing, forged or expired receipt evidence', () => {
    expect(() => completePurgeReceipt(lease(), tokenA, 1, now + 1_000, digest))
      .toThrow('purge_work_no_receipt_evidence');
    const observed = markDeletionObserved(lease(), tokenA, 1, now + 1_000, '100');
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
    expect(() => quarantinePurgeWork(markDeletionObserved(lease(), tokenA, 1, now + 100, '16'),
      'legal_hold', now + 200, tokenA, 1)).toThrow('purge_work_cannot_quarantine');
  });

  it('rejects unsafe tokens, generation and lease bounds', () => {
    expect(() => createPurgeWork('raw-user-path', now)).toThrow('purge_work_invalid_source');
    expect(() => claimPurgeWork(start(), 'weak', now, 5_000)).toThrow('purge_work_invalid_lease');
    expect(() => claimPurgeWork(start(), tokenA, now, 10 * 60_000 + 1)).toThrow('purge_work_invalid_lease');
    expect(() => claimPurgeWork(start(), tokenA, now, 999)).toThrow('purge_work_invalid_lease');
    expect(() => markDeletionObserved(lease(), tokenA, 1, now + 1_000, '0'))
      .toThrow('purge_work_invalid_generation');
    expect(() => markDeletionObserved(lease(), tokenA, 1, now + 1_000, '12e3'))
      .toThrow('purge_work_invalid_generation');
  });

  it('does not mutate the original record in any state transition', () => {
    const before = Object.freeze(start());
    const current = claimPurgeWork(before, tokenA, now, 5_000);
    const after = markDeletionObserved(current, tokenA, 1, now + 1_000, '17');
    expect(before.status).toBe('ready');
    expect(current.status).toBe('leased');
    expect(after.status).toBe('receipt_pending');
    expect(after.observed).toEqual({ generation: '17', observedAt: now + 1_000 });
  });
});
