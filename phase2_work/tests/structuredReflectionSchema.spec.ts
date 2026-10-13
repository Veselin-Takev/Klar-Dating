import { describe, expect, it } from 'vitest';
import {
  validateReflectionAnalysisOutput,
  validateAndParseStructuredResponse,
} from '../src/server/platform/structuredAiValidator';

describe('structured reflection output boundary', () => {
  const base = { mood: 'ruhig', tags: ['klar'] };

  it('accepts a valid reflection with or without optional personName', () => {
    expect(validateReflectionAnalysisOutput(base)).toBe(true);
    expect(validateReflectionAnalysisOutput({ ...base, personName: 'Testperson' })).toBe(true);
  });

  it.each([null, 123, true, [], {}, ['someone']])(
    'rejects a non-string optional personName (%j)',
    personName => {
      expect(validateReflectionAnalysisOutput({ ...base, personName })).toBe(false);
    },
  );

  it('falls back deterministically on invalid personName rather than accepting unvalidated model output', () => {
    const result = validateAndParseStructuredResponse(
      JSON.stringify({ ...base, personName: { injected: 'untrusted' } }),
      validateReflectionAnalysisOutput,
      base,
    );
    expect(result.source).toBe('fallback');
    expect(result.data).toEqual(base);
  });
});
