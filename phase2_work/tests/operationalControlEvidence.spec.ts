import { describe, expect, it } from 'vitest';
import { validateOperationalControlEvidence } from '../src/server/platform/operationalControlEvidence';

function validate(value: unknown, buildSha = 'a'.repeat(40)) {
  return validateOperationalControlEvidence(
    value,
    buildSha,
    'production',
    ['evidence.invalid'],
    '2026-09-29T00:00:00Z',
  );
}

function valid() {
  return {
    schemaVersion: 1, buildSha: 'a'.repeat(40), environment: 'production',
    secretRotation: {
      secretName: 'STRIPE_SECRET_KEY', oldVersionDisabled: true,
      newVersionCreatedAt: '2026-09-29T18:00:00Z', workloadObservedNewVersionAt: '2026-09-29T18:05:00Z',
      smokeTest: 'passed', evidenceLinks: ['https://evidence.invalid/rotation'],
    },
    alertDelivery: {
      policyName: 'Klar API burn rate 1h', exerciseStartedAt: '2026-09-29T18:10:00Z',
      notificationReceivedAt: '2026-09-29T18:11:00Z', acknowledgedAt: '2026-09-29T18:12:00Z',
      recipient: 'primary-on-call', channelType: 'pager', evidenceLinks: ['https://evidence.invalid/alert'],
    },
  };
}

describe('operational control exercise evidence', () => {
  it('accepts a complete rotation and alert-delivery exercise', () => {
    expect(validate(valid())).toEqual({ passed: true, errors: [] });
  });
  it('rejects evidence for a different evaluated build', () => {
    expect(validate(valid(), 'b'.repeat(40)).errors.join(' ')).toMatch(/exact evaluated build/);
  });
  it('rejects an enabled old secret version', () => {
    const e = valid(); e.secretRotation.oldVersionDisabled = false;
    expect(validate(e).passed).toBe(false);
  });
  it('rejects failed rotation smoke validation', () => {
    const e = valid(); e.secretRotation.smokeTest = 'failed';
    expect(validate(e).errors.join(' ')).toMatch(/smoke/);
  });
  it('rejects impossible alert timing', () => {
    const e = valid(); e.alertDelivery.notificationReceivedAt = '2026-09-29T18:09:00Z';
    expect(validate(e).errors.join(' ')).toMatch(/precede/);
  });
  it('requires durable exercise evidence links', () => {
    const e = valid(); e.alertDelivery.evidenceLinks = [];
    expect(validate(e).passed).toBe(false);
  });
});
