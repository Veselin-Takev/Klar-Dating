import { describe, expect, it } from 'vitest';
import { parseSafetyMessage, SAFETY_MESSAGE_MAX_CHARS, serializeSafetyAuditOutput } from '../src/server/platform/safetyBoundary';

describe('safety endpoint boundary', () => {
  it('accepts and trims a bounded text message', () => {
    expect(parseSafetyMessage('  Hallo  ')).toBe('Hallo');
  });

  it.each([undefined, null, 42, true, '', '   ', 'x'.repeat(SAFETY_MESSAGE_MAX_CHARS + 1)])(
    'rejects invalid or oversized messages',
    value => {
      expect(parseSafetyMessage(value)).toBeNull();
    },
  );

  it('serializes only the actual safety result shape for audit logging', () => {
    const serialized = serializeSafetyAuditOutput({
      isFlagged: true,
      explanation: 'Problematisch',
      suggestions: ['Abstand halten', 'Blockieren'],
      herkunft: 'ki',
      text: 'must-not-be-used',
      arbitrary: 'must-not-leak',
    });

    expect(JSON.parse(serialized)).toEqual({
      isFlagged: true,
      explanation: 'Problematisch',
      suggestions: ['Abstand halten', 'Blockieren'],
      herkunft: 'ki',
    });
    expect(serialized).not.toContain('must-not-be-used');
    expect(serialized).not.toContain('must-not-leak');
  });
});
