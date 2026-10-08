import { describe, expect, it } from 'vitest';
import { retryDelayMs, validMessagePayload } from '../src/lib/offlineQueue';

describe('offline message queue invariants', () => {
  it('accepts only bounded idempotent message payloads', () => {
    expect(validMessagePayload({ chatId:'chat-1', text:'Hallo', clientMessageId:'abc-123' })).toBe(true);
    expect(validMessagePayload({ chatId:'../other', text:'Hallo', clientMessageId:'abc-123' })).toBe(false);
    expect(validMessagePayload({ chatId:'chat-1', text:'', clientMessageId:'abc-123' })).toBe(false);
    expect(validMessagePayload({ chatId:'chat-1', text:'x'.repeat(4001), clientMessageId:'abc-123' })).toBe(false);
    expect(validMessagePayload({ chatId:'chat-1', text:'Hallo', clientMessageId:'not valid!' })).toBe(false);
  });

  it('uses bounded exponential retry delays', () => {
    expect(retryDelayMs(1)).toBe(2000);
    expect(retryDelayMs(2)).toBe(4000);
    expect(retryDelayMs(5)).toBe(32000);
    expect(retryDelayMs(99)).toBe(60000);
  });
});
