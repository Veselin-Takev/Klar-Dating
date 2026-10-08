import { describe, expect, it } from 'vitest';
import { validateRecoveryDrillEvidence } from '../src/server/platform/recoveryEvidence';

const hash = 'a'.repeat(64);
function valid() {
  return {
    schemaVersion: 1,
    buildSha: 'b'.repeat(40),
    environment: 'isolated_restore',
    projectId: 'klar-restore-drill', databaseId: 'klar-primary',
    backupUri: 'gs://klar-backups/firestore/klar-prod/export-1',
    backupCreatedAt: '2026-09-29T18:00:00Z', restoreStartedAt: '2026-09-29T18:10:00Z', readyAt: '2026-09-29T18:25:00Z',
    approvedTargets: { rpoMinutes: 30, rtoMinutes: 30, approvedBy: 'Incident commander', approvedAt: '2026-09-29T17:00:00Z' },
    integrity: { sourceDocumentCount: 1000, restoredDocumentCount: 1000, sampledChecksums: [{ path: 'users/sample', sourceSha256: hash, restoredSha256: hash }] },
    smokeTests: { api: 'passed', rules: 'passed', playwright: 'passed' },
    rollbackEvidence: { trafficPercent: 100, health: 'passed', readiness: 'passed' },
  };
}

describe('recovery drill evidence validation', () => {
  it('accepts a complete drill within approved targets', () => {
    expect(validateRecoveryDrillEvidence(valid(), 'b'.repeat(40))).toEqual({ passed: true, errors: [] });
  });
  it('rejects evidence for a different evaluated build', () => {
    expect(validateRecoveryDrillEvidence(valid(), 'c'.repeat(40)).errors.join(' ')).toMatch(/exact evaluated build/);
  });
  it('rejects targets approved after the drill started', () => {
    const e = valid(); e.approvedTargets.approvedAt = '2026-09-29T18:11:00Z';
    expect(validateRecoveryDrillEvidence(e, 'b'.repeat(40)).errors.join(' ')).toMatch(/must not be after restoreStartedAt/);
  });
  it('rejects RPO or RTO breaches', () => {
    const e = valid(); e.approvedTargets.rpoMinutes = 5; e.approvedTargets.rtoMinutes = 5;
    expect(validateRecoveryDrillEvidence(e, 'b'.repeat(40)).errors.join(' ')).toMatch(/RPO|RTO/);
  });
  it('rejects document-count and checksum mismatches', () => {
    const e = valid();
    e.integrity.restoredDocumentCount = 999;
    const [sample] = e.integrity.sampledChecksums;
    expect(sample).toBeDefined();
    if (!sample) throw new Error('Expected recovery checksum fixture.');
    sample.restoredSha256 = 'c'.repeat(64);
    expect(validateRecoveryDrillEvidence(e, 'b'.repeat(40)).passed).toBe(false);
  });
  it('rejects failed post-restore smoke tests', () => {
    const e = valid(); e.smokeTests.playwright = 'failed';
    expect(validateRecoveryDrillEvidence(e, 'b'.repeat(40)).errors.join(' ')).toMatch(/Playwright/);
  });
  it('rejects incomplete rollback evidence', () => {
    const e = valid(); e.rollbackEvidence.trafficPercent = 50;
    expect(validateRecoveryDrillEvidence(e, 'b'.repeat(40)).errors.join(' ')).toMatch(/100%/);
  });
});
