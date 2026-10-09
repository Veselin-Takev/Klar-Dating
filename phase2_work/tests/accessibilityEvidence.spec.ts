import { describe, expect, it } from 'vitest';
import { validateAccessibilityManualEvidence, type AccessibilityManualEvidence } from '../src/server/platform/accessibilityEvidence';

function validate(evidence: unknown, buildSha = 'a'.repeat(40)) {
  return validateAccessibilityManualEvidence(
    evidence,
    buildSha,
    'staging',
    ['evidence.invalid'],
    '2026-09-29T00:00:00Z',
    '2026-09-29T23:59:59Z',
  );
}

function validEvidence(): AccessibilityManualEvidence {
  return {
    schemaVersion: 2,
    standard: 'WCAG 2.2 AA',
    buildSha: 'a'.repeat(40),
    environment: 'staging',
    evaluatedAt: '2026-09-29T18:00:00Z',
    scope: { product: 'Klar web app', environments: ['Chrome + NVDA'], flows: ['chat'] },
    reviewer: { name: 'Reviewer', role: 'Accessibility specialist' },
    implementer: { name: 'Implementer' },
    checks: ['keyboard','screen_reader','reflow_zoom','visual','motion','input','cognitive'].map(area => ({
      area: area as AccessibilityManualEvidence['checks'][number]['area'],
      status: 'pass' as const, environments: ['test environment'], notes: 'Verified manually', evidenceLinks: ['https://evidence.invalid/item'],
    })),
    findings: [],
    conclusion: 'pass',
  };
}

describe('manual accessibility evidence validation', () => {
  it('accepts a complete independent manual record', () => {
    expect(validate(validEvidence())).toEqual({ passed: true, errors: [] });
  });

  it('rejects evidence for a different build SHA', () => {
    const evidence = validEvidence();
    expect(validate(evidence, 'b'.repeat(40)).errors.join(' ')).toMatch(/exact evaluated build/i);
  });

  it('rejects missing manual coverage even when conclusion says pass', () => {
    const evidence = validEvidence();
    evidence.checks = evidence.checks.filter(check => check.area !== 'screen_reader');
    const result = validate(evidence);
    expect(result.passed).toBe(false);
    expect(result.errors.join(' ')).toContain('screen_reader');
  });

  it('rejects self-review for critical journey evidence', () => {
    const evidence = validEvidence();
    evidence.reviewer.name = 'Same Person';
    evidence.implementer = { name: 'Same Person' };
    expect(validate(evidence).errors.join(' ')).toMatch(/independent/i);
  });

  it('rejects unresolved blocker/high findings', () => {
    const evidence = validEvidence();
    evidence.findings.push({ id: 'A11Y-1', severity: 'high', status: 'open', description: 'Keyboard trap' });
    expect(validate(evidence).passed).toBe(false);
  });

  it('rejects placeholder/incomplete matrix states', () => {
    const evidence = validEvidence();
    evidence.checks[0]!.status = 'not_tested';
    evidence.conclusion = 'incomplete';
    expect(validate(evidence).passed).toBe(false);
  });
});
