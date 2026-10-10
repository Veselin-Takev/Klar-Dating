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
  it('rejects ambiguous dates instead of accepting Date.parse coercions', () => {
    const e = valid();
    e.secretRotation.newVersionCreatedAt = 'September 29, 2026';
    expect(validate(e).errors.join(' ')).toMatch(/ISO date/);
    const e2 = valid();
    e2.alertDelivery.acknowledgedAt = '2026-09-29';
    expect(validate(e2).errors.join(' ')).toMatch(/ISO date/);
  });
  it('rejects credentials and fragments in evidence URLs', () => {
    for (const url of [
      'https://admin:password@evidence.invalid/rotation',
      'https://evidence.invalid/rotation#sensitive',
    ]) {
      const e = valid();
      e.secretRotation.evidenceLinks = [url];
      expect(validate(e).passed).toBe(false);
    }
  });

  it('fails closed for malformed JSON field types instead of throwing', () => {
    const e = valid();
    const malformed = {
      ...e,
      secretRotation: { ...e.secretRotation, secretName: 123 },
      alertDelivery: { ...e.alertDelivery, recipient: { private: 'value' }, policyName: 77, channelType: true },
    };
    expect(() => validate(malformed)).not.toThrow();
    expect(validate(malformed).passed).toBe(false);
    expect(validateOperationalControlEvidence(e, 'a'.repeat(40), 'production', undefined as unknown as string[], '2026-09-29T00:00:00Z').passed).toBe(false);
  });

  it('rejects evidence links with query secrets, custom ports or non-string values', () => {
    for (const value of [
      'https://evidence.invalid/record?token=secret',
      'https://evidence.invalid:8443/record',
      42,
      null,
      { url: 'https://evidence.invalid/record' },
    ]) {
      const e = valid();
      const candidate = { ...e, alertDelivery: { ...e.alertDelivery, evidenceLinks: [value] } };
      expect(validate(candidate).passed).toBe(false);
    }
  });

  it('rejects evidence links pointing only to a trusted host root', () => {
    for (const link of ['https://evidence.invalid', 'https://evidence.invalid/', 'gs://evidence.invalid/']) {
      const record = valid();
      record.alertDelivery.evidenceLinks = [link];
      expect(validate(record).errors.join(' ')).toMatch(/specific evidence record/);
    }
    expect(validate(valid()).passed).toBe(true);
  });

  it('rejects impossible calendar dates and offsets', () => {
    for (const timestamp of [
      '2026-02-30T12:00:00Z',
      '2025-02-29T12:00:00Z',
      '2026-13-01T12:00:00Z',
      '2026-10-10T24:00:00Z',
      '2026-10-10T12:60:00Z',
      '2026-10-10T12:00:00+24:00',
    ]) {
      const record = valid();
      record.secretRotation.newVersionCreatedAt = timestamp;
      expect(validate(record).errors.join(' ')).toMatch(/valid ISO date/);
    }
    const leapYear = valid();
    leapYear.secretRotation.newVersionCreatedAt = '2024-02-29T18:00:00Z';
    expect(validateOperationalControlEvidence(leapYear, 'a'.repeat(40), 'production', ['evidence.invalid'], '2024-02-28T00:00:00Z').errors.join(' ')).not.toMatch(/ISO date/);
  });

  it('handles Gregorian leap years for low four-digit years without Date.UTC coercion', () => {
    const checks = [
      ['0004-02-29T12:00:00Z', true],
      ['0100-02-29T12:00:00Z', false],
      ['0400-02-29T12:00:00Z', true],
      ['1900-02-29T12:00:00Z', false],
      ['2000-02-29T12:00:00Z', true],
    ] as const;
    for (const [timestamp, allowed] of checks) {
      const record = valid();
      record.secretRotation.newVersionCreatedAt = timestamp;
      const errors = validateOperationalControlEvidence(record, 'a'.repeat(40), 'production', ['evidence.invalid'], '0001-01-01T00:00:00Z').errors;
      expect(errors.some(message => message.includes('newVersionCreatedAt must be a valid ISO date/time'))).toBe(!allowed);
    }
  });

  it('rejects future-dated operational events and a future acceptance floor', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const fields = [
      'newVersionCreatedAt',
      'workloadObservedNewVersionAt',
    ] as const;
    for (const field of fields) {
      const record = valid();
      record.secretRotation[field] = tomorrow;
      expect(validate(record).errors.join(' ')).toMatch(/must not be in the future/);
    }
    for (const field of ['exerciseStartedAt', 'notificationReceivedAt', 'acknowledgedAt'] as const) {
      const record = valid();
      record.alertDelivery[field] = tomorrow;
      expect(validate(record).errors.join(' ')).toMatch(/must not be in the future/);
    }
    expect(validateOperationalControlEvidence(valid(), 'a'.repeat(40), 'production', ['evidence.invalid'], tomorrow).errors.join(' ')).toMatch(/evidenceNotBefore must not be in the future/);
  });

  it('accepts genuine ISO digit syntax in UTC and offset timestamps', () => {
    const record = valid();
    expect(validate(record)).toEqual({ passed: true, errors: [] });
    record.secretRotation.newVersionCreatedAt = '2026-10-10T12:45:00+02:00';
    record.secretRotation.workloadObservedNewVersionAt = '2026-10-10T13:00:00+02:00';
    record.alertDelivery.exerciseStartedAt = '2026-10-10T12:00:00Z';
    record.alertDelivery.notificationReceivedAt = '2026-10-10T12:01:00Z';
    record.alertDelivery.acknowledgedAt = '2026-10-10T12:02:00Z';
    // Use a future-safe fixture by asserting ISO parsing, not a fixed wall-clock assumption.
    const errors = validate(record).errors;
    expect(errors.filter(message => message.includes('ISO date/time'))).toEqual([]);
  });

});
