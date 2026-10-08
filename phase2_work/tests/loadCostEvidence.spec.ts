import { describe, expect, it } from 'vitest';
import { validateProductionLoadCostEvidence } from '../src/server/platform/loadCostEvidence';

const sha = 'a'.repeat(40);
function validate(evidenceValue: unknown, loadValue: unknown, expectedBuildSha = sha) {
  return validateProductionLoadCostEvidence(
    evidenceValue,
    loadValue,
    expectedBuildSha,
    'production',
    ['console.cloud.google.com'],
    '2026-09-29T00:00:00Z',
    '2026-09-29T23:59:59Z',
    0.5,
  );
}

function evidence() {
  return {
    schemaVersion: 2, buildSha: sha, environment: 'production', measuredAt: '2026-09-29T19:00:00Z',
    loadReportPath: 'load-evidence/prod.json',
    billingSource: { name: 'Cloud Billing export', evidenceLinks: ['https://console.cloud.google.com/billing/example'] },
    approvedBudget: { maxCostPer1000RequestsUsd: 0.5, approvedBy: 'Finance owner', approvedAt: '2026-09-29T18:00:00Z', rationale: 'Approved launch envelope' },
    cost: { totalCostUsd: 2.5, requestCount: 10000, costPer1000RequestsUsd: 0.25 },
  };
}
function load() {
  return { schemaVersion: 2, generatedAt: '2026-09-29T19:00:00Z', buildSha: sha, measurements: { total: 10000 }, verdict: { passed: true } };
}

describe('production load/cost evidence validation', () => {
  it('accepts a consistent measured record under an explicitly approved budget', () => {
    expect(validate(evidence(), load())).toEqual({ passed: true, errors: [] });
  });
  it('rejects evidence for a different evaluated build', () => {
    expect(validate(evidence(), load(), 'c'.repeat(40)).errors.join(' ')).toMatch(/exact evaluated build/);
  });
  it('rejects a load report from another build', () => {
    const l = load(); l.buildSha = 'b'.repeat(40);
    expect(validate(evidence(), l).errors.join(' ')).toMatch(/buildSha/);
  });
  it('rejects inconsistent unit-cost arithmetic', () => {
    const e = evidence(); e.cost.costPer1000RequestsUsd = 0.1;
    expect(validate(e, load()).errors.join(' ')).toMatch(/does not match/);
  });
  it('rejects measured cost above the approved envelope', () => {
    const e = evidence(); e.approvedBudget.maxCostPer1000RequestsUsd = 0.2;
    expect(validate(e, load()).errors.join(' ')).toMatch(/exceeds/);
  });
  it('rejects placeholder records without billing evidence or approval', () => {
    const e = evidence(); e.billingSource.evidenceLinks = []; e.approvedBudget.approvedBy = '';
    expect(validate(e, load()).passed).toBe(false);
  });
});
