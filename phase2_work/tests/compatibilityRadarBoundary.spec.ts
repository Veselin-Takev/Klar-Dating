import { describe, expect, it } from 'vitest';
import {
  parseCompatibilityRadarInput,
  RADAR_CONNECTION_JSON_MAX_CHARS,
  RADAR_CONNECTION_MAX_ITEMS,
  RADAR_INTEREST_MAX_CHARS,
  RADAR_INTEREST_MAX_ITEMS,
} from '../src/server/platform/compatibilityRadarBoundary';

describe('compatibility radar input boundary', () => {
  it('accepts trimmed bounded arrays', () => {
    expect(parseCompatibilityRadarInput({
      userInterests: [' Wandern ', 'Kochen'],
      verbindungen: [{ id: 'a', interests: ['Wandern'] }],
    })).toEqual({
      userInterests: ['Wandern', 'Kochen'],
      verbindungen: [{ id: 'a', interests: ['Wandern'] }],
    });
  });

  it.each([
    null,
    {},
    { userInterests: 'Wandern', verbindungen: [] },
    { userInterests: [], verbindungen: {} },
    { userInterests: [42], verbindungen: [] },
    { userInterests: [''], verbindungen: [] },
    { userInterests: ['x'.repeat(RADAR_INTEREST_MAX_CHARS + 1)], verbindungen: [] },
    { userInterests: Array.from({ length: RADAR_INTEREST_MAX_ITEMS + 1 }, () => 'x'), verbindungen: [] },
    { userInterests: [], verbindungen: Array.from({ length: RADAR_CONNECTION_MAX_ITEMS + 1 }, () => ({})) },
  ])('rejects malformed or oversized shapes', value => {
    expect(parseCompatibilityRadarInput(value)).toBeNull();
  });

  it('rejects an oversized serialized connection payload', () => {
    expect(parseCompatibilityRadarInput({
      userInterests: ['Wandern'],
      verbindungen: [{ text: 'x'.repeat(RADAR_CONNECTION_JSON_MAX_CHARS) }],
    })).toBeNull();
  });

  it('rejects values that JSON.stringify cannot represent as JSON text', () => {
    expect(parseCompatibilityRadarInput({
      userInterests: ['Wandern'],
      verbindungen: [undefined],
    })).toBeNull();
  });

  it.each([
    { nested: undefined },
    { nested: Number.NaN },
    { nested: Number.POSITIVE_INFINITY },
    { nested: 1n },
    { nested: () => 'not-json' },
  ])('rejects lossy or non-JSON connection values', connection => {
    expect(parseCompatibilityRadarInput({
      userInterests: ['Wandern'],
      verbindungen: [connection],
    })).toBeNull();
  });

  it('rejects non-serializable connection payloads', () => {
    const cyclic: any = {};
    cyclic.self = cyclic;
    expect(parseCompatibilityRadarInput({
      userInterests: ['Wandern'],
      verbindungen: [cyclic],
    })).toBeNull();
  });
});
