import { describe, expect, it } from 'vitest';
import {
  AI_CONTEXT_MAX_CHARS,
  AI_SHORT_TEXT_MAX_CHARS,
  parseBoundedText,
  parseOptionalBoundedText,
} from '../src/server/platform/aiInputBoundary';

describe('AI text input boundary', () => {
  it('trims and accepts bounded text', () => {
    expect(parseBoundedText('  Hallo  ')).toBe('Hallo');
  });

  it.each([undefined, null, 42, true, '', '   '])('rejects non-text or empty values', value => {
    expect(parseBoundedText(value)).toBeNull();
  });

  it('rejects text above the configured limit', () => {
    expect(parseBoundedText('x'.repeat(AI_SHORT_TEXT_MAX_CHARS + 1))).toBeNull();
    expect(parseOptionalBoundedText('x'.repeat(AI_CONTEXT_MAX_CHARS + 1))).toBeNull();
  });

  it('accepts an omitted optional context as empty text', () => {
    expect(parseOptionalBoundedText(undefined)).toBe('');
    expect(parseOptionalBoundedText('')).toBe('');
  });
});
