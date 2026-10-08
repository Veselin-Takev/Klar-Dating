import { describe, expect, it } from 'vitest';
import { generateMusicIcebreaker } from '../lib/aiCoachService';
import type { UserProfile } from '../types/user';

const profile = (uid: string, genres: string[], likesMusic = true): UserProfile => ({
  uid,
  name: uid,
  interests: likesMusic ? ['Musik'] : [],
  musicPreferences: { genres, concertGoer: false, playingInstrument: false },
});

describe('music icebreakers', () => {
  it('uses a shared genre case-insensitively', () => {
    expect(generateMusicIcebreaker(
      profile('a', ['Jazz']),
      profile('b', ['jazz']),
    )).toContain('Jazz');
  });

  it('does not claim both users selected music when they did not', () => {
    expect(generateMusicIcebreaker(
      profile('a', [], false),
      profile('b', [], false),
    )).not.toContain('Ihr beide habt Musik');
  });
});
