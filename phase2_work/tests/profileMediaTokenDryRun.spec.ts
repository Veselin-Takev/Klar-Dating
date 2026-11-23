import { describe, expect, it } from 'vitest';
import {
  createProfileMediaTokenDryRunPlan,
  verifyProfileMediaTokenDryRunPlan,
  type DryRunApproval,
  type OfflineMediaInventory,
} from '../src/server/platform/profileMediaTokenDryRun';

const a = 'profiles/synthetic-user-a/photo-a.jpg';
const b = 'profiles/synthetic-user-b/photo-b.jpg';

const fixture: OfflineMediaInventory = {
  objects: [
    { objectPath: a, exists: true, generation: '10', metageneration: '2', tokenMetadataPresent: true },
    { objectPath: b, exists: true, generation: '20', metageneration: '3', tokenMetadataPresent: false },
  ],
  references: [
    { objectPath: a, generation: '10', metageneration: '2' },
    { objectPath: b, generation: '20', metageneration: '3' },
  ],
};

function approvals(digest: string): DryRunApproval[] {
  const now = Date.now();
  return (['APPSEC', 'DPO', 'SRE'] as const).map((role, index) => ({
    role,
    reviewerId: `synthetic-reviewer-${index}`,
    manifestDigest: digest,
    approvedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
  }));
}

describe('offline profile media token inventory dry-run', () => {
  it('deterministic SHA-256 digests independent of input order', () => {
    const first = createProfileMediaTokenDryRunPlan(fixture);
    const reversed = createProfileMediaTokenDryRunPlan({
      objects: [...fixture.objects].reverse(),
      references: [...fixture.references].reverse(),
    });
    expect(first.manifestDigest).toBe(reversed.manifestDigest);
    expect(first.planDigest).toBe(reversed.planDigest);
    expect(first.manifestDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('every dry-run explicitly guarantees storageMutations=0 and databaseWrites=0', () => {
    const plan = createProfileMediaTokenDryRunPlan(fixture);
    expect(plan.storageMutations).toBe(0);
    expect(plan.databaseWrites).toBe(0);
  });

  it('classifies legacy token metadata and already-absent metadata without returning paths', () => {
    const plan = createProfileMediaTokenDryRunPlan(fixture);
    expect(plan.counts.tokenMetadataPresent).toBe(1);
    expect(plan.counts.alreadyAbsent).toBe(1);
    expect(plan.counts.eligibleForReview).toBe(1);
    expect(JSON.stringify(plan).includes(a)).toBe(false);
  });

  it('counts missing objects and blocks eligibility', () => {
    const plan = createProfileMediaTokenDryRunPlan({
      objects: [],
      references: [{ objectPath: a, generation: '10', metageneration: '2' }],
    });
    expect(plan.conflicts.missingObjects).toBe(1);
    expect(plan.counts.eligibleForReview).toBe(0);
  });

  it('detects contradictory object metadata and conflicting reference versions', () => {
    const plan = createProfileMediaTokenDryRunPlan({
      objects: [
        { objectPath: a, exists: true, generation: '10', metageneration: '2', tokenMetadataPresent: true },
        { objectPath: a, exists: true, generation: '11', metageneration: '2', tokenMetadataPresent: true },
      ],
      references: [
        { objectPath: a, generation: '10', metageneration: '2' },
        { objectPath: a, generation: '11', metageneration: '2' },
      ],
    });
    expect(plan.conflicts.contradictoryReferences).toBeGreaterThan(0);
  });

  it('detects contradictory references even when one object version exists', () => {
    const plan = createProfileMediaTokenDryRunPlan({
      objects: [fixture.objects[0]!],
      references: [
        { objectPath: a, generation: '10', metageneration: '2' },
        { objectPath: a, generation: '11', metageneration: '2' },
      ],
    });
    expect(plan.conflicts.contradictoryReferences).toBe(1);
  });

  it('detects generation mismatch', () => {
    const plan = createProfileMediaTokenDryRunPlan({
      objects: [fixture.objects[0]!],
      references: [{ objectPath: a, generation: '999', metageneration: '2' }],
    });
    expect(plan.conflicts.generationMismatches).toBe(1);
  });

  it('detects metageneration mismatch', () => {
    const plan = createProfileMediaTokenDryRunPlan({
      objects: [fixture.objects[0]!],
      references: [{ objectPath: a, generation: '10', metageneration: '999' }],
    });
    expect(plan.conflicts.metagenerationMismatches).toBe(1);
  });

  it('accepts complete distinct approvals bound to the exact manifest digest', () => {
    const plan = createProfileMediaTokenDryRunPlan(fixture);
    expect(() => verifyProfileMediaTokenDryRunPlan(
      plan,
      plan.manifestDigest,
      approvals(plan.manifestDigest),
    )).not.toThrow();
  });

  it('rejects stale or mismatched manifest digests', () => {
    const plan = createProfileMediaTokenDryRunPlan(fixture);
    expect(() => verifyProfileMediaTokenDryRunPlan(
      plan,
      'a'.repeat(64),
      approvals(plan.manifestDigest),
    )).toThrow();
  });

  it('rejects tampered plan digest and nonzero mutation counters', () => {
    const plan = createProfileMediaTokenDryRunPlan(fixture);
    expect(() => verifyProfileMediaTokenDryRunPlan(
      { ...plan, planDigest: '0'.repeat(64) },
      plan.manifestDigest,
      approvals(plan.manifestDigest),
    )).toThrow();
    expect(() => verifyProfileMediaTokenDryRunPlan(
      { ...plan, storageMutations: 1 as unknown as 0 },
      plan.manifestDigest,
      approvals(plan.manifestDigest),
    )).toThrow();
  });

  it('rejects missing, duplicate, expired and wrong-digest independent approvals', () => {
    const plan = createProfileMediaTokenDryRunPlan(fixture);
    const allApprovals = approvals(plan.manifestDigest);
    expect(() => verifyProfileMediaTokenDryRunPlan(plan, plan.manifestDigest, [])).toThrow();
    expect(() => verifyProfileMediaTokenDryRunPlan(
      plan,
      plan.manifestDigest,
      [allApprovals[0]!, allApprovals[0]!, allApprovals[2]!],
    )).toThrow();
    expect(() => verifyProfileMediaTokenDryRunPlan(
      plan,
      plan.manifestDigest,
      allApprovals.map(approval => ({
        ...approval,
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      })),
    )).toThrow();
    expect(() => verifyProfileMediaTokenDryRunPlan(
      plan,
      plan.manifestDigest,
      allApprovals.map(approval => ({
        ...approval,
        manifestDigest: 'b'.repeat(64),
      })),
    )).toThrow();
  });

  it('rejects inconsistent inventory before review', () => {
    const plan = createProfileMediaTokenDryRunPlan({
      objects: [fixture.objects[0]!],
      references: [{ objectPath: a, generation: '77', metageneration: '2' }],
    });
    expect(() => verifyProfileMediaTokenDryRunPlan(
      plan,
      plan.manifestDigest,
      approvals(plan.manifestDigest),
    )).toThrow();
  });

  it('output and errors do not disclose synthetic UID, path, URL or token', () => {
    const uid = 'synthetic-user-a';
    const url = 'https://firebasestorage.googleapis.com/v0/b/demo/o/profiles%2Fsynthetic-user-a%2Fphoto-a.jpg?alt=media&token=SYNTHETIC_SECRET_TOKEN';
    const token = 'SYNTHETIC_SECRET_TOKEN';
    const plan = createProfileMediaTokenDryRunPlan(fixture);
    const output = JSON.stringify(plan);
    for (const secret of [uid, a, url, token]) {
      expect(output.includes(secret)).toBe(false);
    }
    let errorMessage = '';
    try {
      verifyProfileMediaTokenDryRunPlan(plan, 'not-a-digest', []);
    } catch (error) {
      errorMessage = (error as Error).message;
    }
    expect(errorMessage).not.toBe('');
    for (const secret of [uid, a, url, token]) {
      expect(errorMessage.includes(secret)).toBe(false);
    }
  });
});
