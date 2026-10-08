import { describe, expect, it } from 'vitest';
import {
  SMART_AUDIT_BIO_MAX_CHARS,
  parseSmartAuditInput,
  parseSmartAuditOutput,
} from '../src/server/platform/smartAuditBoundary';

describe('smart audit input boundary', () => {
  it('accepts the widget request contract', () => {
    expect(parseSmartAuditInput({
      bio: '  Ich koche gern. ',
      values: [' Ehrlichkeit ', 'Humor'],
      profileImageUrl: ' https://example.com/a.jpg ',
    })).toEqual({
      bio: 'Ich koche gern.',
      values: ['Ehrlichkeit', 'Humor'],
      profileImageUrl: 'https://example.com/a.jpg',
    });
  });

  it.each([
    null,
    {},
    { bio: '', values: ['Humor'] },
    { bio: 'x'.repeat(SMART_AUDIT_BIO_MAX_CHARS + 1), values: ['Humor'] },
    { bio: 'ok', values: [] },
    { bio: 'ok', values: ['Humor', 'Humor'] },
    { bio: 'ok', values: [42] },
    { bio: 'ok', values: ['Humor'], profileImageUrl: 42 },
  ])('rejects malformed or oversized input', value => {
    expect(parseSmartAuditInput(value)).toBeNull();
  });
});

describe('smart audit output boundary', () => {
  const valid = {
    overallScore: 8.2,
    strengths: ['Klare Werte'],
    suggestions: ['Bio konkreter formulieren'],
  };

  it('accepts a bounded valid result', () => {
    expect(parseSmartAuditOutput(valid)).toEqual(valid);
  });

  it.each([
    { ...valid, overallScore: 0 },
    { ...valid, overallScore: 11 },
    { ...valid, overallScore: Number.NaN },
    { overallScore: 8.2, suggestions: ['ok'] },
    { overallScore: 8.2, strengths: ['ok'] },
    { ...valid, strengths: [42] },
    { ...valid, suggestions: [''] },
    { ...valid, suggestions: Array.from({ length: 9 }, () => 'ok') },
  ])('rejects invalid or implausible output', value => {
    expect(parseSmartAuditOutput(value)).toBeNull();
  });
});
