import { describe, expect, it } from 'vitest';
import { calculateMusicCompatibility, calculateTotalCompatibility } from '../lib/matching';
import type { UserProfile } from '../types/user';

const profile = (
  uid: string,
  interests: UserProfile['interests'],
  genres?: string[],
): UserProfile => ({
  uid,
  name: uid,
  interests,
  musicPreferences: genres
    ? { genres, concertGoer: true, playingInstrument: false }
    : undefined,
});

describe('music compatibility', () => {
  it('normalizes genre spelling and returns a bounded score', () => {
    const score = calculateMusicCompatibility(
      profile('a', ['Musik'], [' Rock ', 'Jazz']),
      profile('b', ['Musik'], ['rock', 'Pop']),
    );

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('contributes 30 percent when music data is available', () => {
    const a = profile('a', ['Musik', 'Reisen'], ['Rock']);
    const b = profile('b', ['Musik', 'Reisen'], ['Rock']);

    expect(calculateTotalCompatibility(a, b)).toBe(100);
  });

  it('is symmetric', () => {
    const a = profile('a', ['Musik', 'Reisen', 'Kultur'], ['Jazz']);
    const b = profile('b', ['Musik', 'Sport'], ['Jazz', 'Soul']);

    expect(calculateTotalCompatibility(a, b)).toBe(calculateTotalCompatibility(b, a));
  });

  it('renormalizes to interests when music data is missing', () => {
    expect(calculateTotalCompatibility(
      profile('a', ['Reisen']),
      profile('b', ['Reisen']),
    )).toBe(100);
  });
});
