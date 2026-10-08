import { describe, expect, it } from 'vitest';
import {
  PROFILE_CHECK_BIO_MAX_CHARS,
  parseProfileCheckInput,
  parseProfileCheckOutput,
} from '../src/server/platform/profileCheckBoundary';

describe('profile check input boundary', () => {
  it('accepts the UI contract', () => {
    expect(parseProfileCheckInput({
      bio: '  Ich wandere gern. ',
      interests: [' Wandern ', 'Kochen'],
      name: 'Alex',
      aiFocus: 50,
      tonality: 'Ehrlich',
    })).toEqual({
      bio: 'Ich wandere gern.',
      interests: ['Wandern', 'Kochen'],
      name: 'Alex',
      aiFocus: 50,
      tonality: 'Ehrlich',
    });
  });

  it.each([
    null,
    {},
    { bio: '', interests: [], name: '', aiFocus: 50, tonality: 'Ehrlich' },
    { bio: 'x'.repeat(PROFILE_CHECK_BIO_MAX_CHARS + 1), interests: [], name: '', aiFocus: 50, tonality: 'Ehrlich' },
    { bio: 'ok', interests: ['x'], name: '', aiFocus: -1, tonality: 'Ehrlich' },
    { bio: 'ok', interests: ['x'], name: '', aiFocus: 101, tonality: 'Ehrlich' },
    { bio: 'ok', interests: ['x'], name: '', aiFocus: 50, tonality: 'Aggressiv' },
  ])('rejects malformed or oversized input', value => {
    expect(parseProfileCheckInput(value)).toBeNull();
  });
});

describe('profile check output boundary', () => {
  const valid = {
    authenticityScore: 82,
    expressivenessScore: 74,
    compatibilityScore: 79,
    impression: 'Wirkt klar und persönlich.',
    suggestions: ['Konkreter werden'],
    factors: ['Klarer Stil'],
    optimizedBio: 'Überarbeitete Bio',
    optimizationCategory: 'Sprachstil',
  };

  it('accepts a complete bounded result', () => {
    expect(parseProfileCheckOutput(valid)).toEqual(valid);
  });

  it.each([
    { ...valid, authenticityScore: 101 },
    { ...valid, compatibilityScore: 72.5 },
    { ...valid, suggestions: [] },
    { ...valid, optimizedBio: '' },
    { ...valid, optimizationCategory: 'Unbekannt' },
    { ...valid, compatibilityScore: undefined },
  ])('rejects partial or implausible model results', value => {
    expect(parseProfileCheckOutput(value)).toBeNull();
  });
});
