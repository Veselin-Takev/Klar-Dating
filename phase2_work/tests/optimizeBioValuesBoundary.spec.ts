import { describe, expect, it } from 'vitest';
import {
  BIO_VALUES_MAX_BIO_CHARS,
  parseOptimizeBioValuesInput,
  parseOptimizeBioValuesOutput,
} from '../src/server/platform/optimizeBioValuesBoundary';

describe('optimize bio values input boundary', () => {
  it('accepts and normalizes the UI contract', () => {
    expect(parseOptimizeBioValuesInput({
      bio: '  Ich koche gern. ',
      values: [
        { subject: ' Ehrlichkeit ', A: 90, B: 20 },
        { subject: 'Humor', A: 72.34 },
      ],
    })).toEqual({
      bio: 'Ich koche gern.',
      values: [
        { subject: 'Ehrlichkeit', A: 90 },
        { subject: 'Humor', A: 72.3 },
      ],
    });
  });

  it.each([
    null,
    {},
    { bio: '', values: [] },
    { bio: 'x'.repeat(BIO_VALUES_MAX_BIO_CHARS + 1), values: [{ subject: 'Humor', A: 50 }] },
    { bio: 'ok', values: 'Humor' },
    { bio: 'ok', values: [{ subject: '', A: 50 }] },
    { bio: 'ok', values: [{ subject: 'Humor', A: -1 }] },
    { bio: 'ok', values: [{ subject: 'Humor', A: 101 }] },
    { bio: 'ok', values: [{ subject: 'Humor', A: 50 }, { subject: 'Humor', A: 60 }] },
  ])('rejects malformed or oversized input', value => {
    expect(parseOptimizeBioValuesInput(value)).toBeNull();
  });
});

describe('optimize bio values output boundary', () => {
  it('accepts bounded suggestions', () => {
    expect(parseOptimizeBioValuesOutput({
      suggestions: [' Mehr Konkretheit ', 'Ein Satz zum Suchziel'],
    })).toEqual({
      suggestions: ['Mehr Konkretheit', 'Ein Satz zum Suchziel'],
    });
  });

  it.each([
    null,
    {},
    { suggestions: [] },
    { suggestions: [''] },
    { suggestions: [42] },
    { suggestions: Array.from({ length: 5 }, () => 'ok') },
  ])('rejects invalid output', value => {
    expect(parseOptimizeBioValuesOutput(value)).toBeNull();
  });
});
