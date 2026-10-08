import { describe, it, expect } from 'vitest';
import { formatCoins, formatDate, formatDistance, formatMoney, formatRelativeTime } from './format';
import { initialLanguage, normalizeLanguage } from './locale';
describe('international formatting', () => {
  it('formats integer minor currency units without assuming two decimals', () => {
    expect(formatMoney(1199, 'EUR', 'de')).toContain('11,99');
    expect(formatMoney(1199, 'EUR', 'en')).toContain('11.99');
    expect(formatMoney(1200, 'JPY', 'en')).toContain('1,200');
    expect(() => formatMoney(1.5, 'EUR', 'en')).toThrow();
  });
  it('converts miles and localizes numbers', () => {
    expect(formatDistance(1.609344, 'en', 'mile')).toBe('1 mi');
    expect(formatCoins(1200, 'de')).toBe('1.200');
    expect(() => formatDistance(-1, 'en')).toThrow();
  });
  it('uses explicit time zones and reference clocks', () => {
    expect(formatRelativeTime(0, 300000, 'en')).toContain('5 min. ago');
    expect(formatRelativeTime(0, 300000, 'de')).toContain('5');
    const instant = Date.parse('2026-01-01T23:00:00Z');
    expect(formatDate(instant, 'en', 'Europe/Berlin')).toContain('Jan 2, 2026');
    expect(formatDate(instant, 'en', 'America/New_York')).toContain('Jan 1, 2026');
  });
  it('handles denied storage and normalizes regional language tags', () => {
    expect(initialLanguage({ getItem: () => { throw new Error('denied'); } })).toBe('de');
    expect(normalizeLanguage('en-GB')).toBe('en');
    expect(normalizeLanguage('__proto__')).toBe('de');
  });
});
