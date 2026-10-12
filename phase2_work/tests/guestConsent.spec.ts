import { describe, it, expect } from 'vitest';
import { readGuestConsent, saveGuestConsent } from '../src/lib/guestConsent';

const allFalse = { ki_auswertung: false, fehlerberichte: false, produktanalyse: false };

describe('anonymous guest consent storage', () => {
  it('persists an explicit rejection under the current guest identity', () => {
    const storage = window.sessionStorage;
    storage.clear();
    saveGuestConsent('guest-A', allFalse, storage);
    expect(readGuestConsent('guest-A', storage)).toEqual(allFalse);
    expect(readGuestConsent('guest-B', storage)).toBeNull();
    storage.clear();
  });

  it('preserves independent purpose choices and refuses malformed storage', () => {
    const storage = window.sessionStorage;
    storage.clear();
    const selected = { ...allFalse, fehlerberichte: true };
    saveGuestConsent('guest-A', selected, storage);
    expect(readGuestConsent('guest-A', storage)).toEqual(selected);
    storage.setItem('klar:guest:consent:guest-A', '{"ownerUid":"guest-B"}');
    expect(readGuestConsent('guest-A', storage)).toBeNull();
    storage.clear();
  });

  it('fails closed when storage cannot confirm the write', () => {
    const storage = { setItem() {}, getItem() { return null; } } as unknown as Storage;
    expect(() => saveGuestConsent('guest-A', allFalse, storage)).toThrow('not confirmed');
  });

  it('never accepts missing guest identity or nonboolean purposes', () => {
    expect(() => saveGuestConsent('', allFalse, window.sessionStorage)).toThrow('Invalid guest identity');
    expect(() => saveGuestConsent('guest-A', { ...allFalse, fehlerberichte: 'yes' } as never, window.sessionStorage)).toThrow('Invalid consent purposes');
  });
});
