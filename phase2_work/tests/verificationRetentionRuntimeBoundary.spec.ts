// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  executeVerificationRetentionBatch,
  purgeSingleVerificationArtifact,
  MS_PER_DAY,
  type VerificationArtifactRecord,
} from '../src/server/platform/storageRetentionEngine';

const DECIDED_AT = 1_700_000_000_000;
const NOW = DECIDED_AT + 31 * MS_PER_DAY;
const fixture = (status: unknown): VerificationArtifactRecord => ({
  uid: 'synthetic-photo-owner',
  challengeId: 'synthetic-approval',
  storagePath: 'verification/synthetic-photo-owner/one.jpg',
  decidedAt: DECIDED_AT,
  // Deliberately exercise the actual runtime boundary despite TS type erasure.
  status: status as VerificationArtifactRecord['status'],
});

describe('P0 #202 biometric photo retention: fail-closed runtime decisions and errors', () => {
  it.each([
    ['pending', 'pending'],
    ['unknown new state', 'withdrawn'],
    ['empty state', ''],
    ['missing state', undefined],
    ['wrong-case state', 'Approved'],
    ['malformed state', { status: 'approved' }],
  ])('never deletes an expired photo with %s', async (_label, status) => {
    const remove = vi.fn(async () => {});
    const persist = vi.fn(async () => {});
    const result = await purgeSingleVerificationArtifact(
      fixture(status), remove, persist, NOW,
    );
    expect(result).toMatchObject({
      purged: false,
      reason: 'pending_decision',
    });
    expect(remove).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it.each(['approved', 'rejected'] as const)(
    'preserves the authorized expired %s decision path',
    async status => {
      const remove = vi.fn(async () => {});
      const persist = vi.fn(async () => {});
      const result = await purgeSingleVerificationArtifact(
        fixture(status), remove, persist, NOW,
      );
      expect(result).toMatchObject({ purged: true, reason: 'expired' });
      expect(result.auditDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(remove).toHaveBeenCalledTimes(1);
      expect(persist).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['Error', () => new Error('Storage failed: private uid=owner-123 path=verification/owner-123/x.jpg')],
    ['foreign thrown object', () => ({
      uid: 'private-account', path: 'verification/private-account/raw.jpg',
      message: 'sensitive photo path',
    })],
  ])('does not propagate sensitive %s details from Storage', async (_label, failure) => {
    const persist = vi.fn(async () => {});
    const result = await purgeSingleVerificationArtifact(
      fixture('approved'), async () => { throw failure(); }, persist, NOW,
    );
    expect(result).toMatchObject({
      reason: 'error', purged: false, error: 'verification_photo_purge_failed',
    });
    expect(result.error).not.toContain('private');
    expect(result.error).not.toContain('verification/');
    expect(persist).not.toHaveBeenCalled();
  });

  it('redacts a Firestore audit write failure, without claiming a successful purge', async () => {
    const remove = vi.fn(async () => {});
    const result = await purgeSingleVerificationArtifact(
      fixture('rejected'), remove,
      async () => { throw new Error('Firestore document users/private-name'); },
      NOW,
    );
    expect(remove).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      reason: 'error', purged: false, error: 'verification_photo_purge_failed',
    });
  });

  it('keeps malformed decisions out of batch deletes and counts unsafe operations as non-purged', async () => {
    const remove = vi.fn(async () => {});
    const persist = vi.fn(async () => {});
    const summary = await executeVerificationRetentionBatch([
      fixture('withdrawn'), fixture('pending'), fixture('approved'),
    ], remove, persist, NOW);
    expect(summary).toMatchObject({
      processed: 3, purgedCount: 1, skippedCount: 2,
    });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(summary.results.map(x => x.reason)).toEqual([
      'pending_decision', 'pending_decision', 'expired',
    ]);
  });
});
